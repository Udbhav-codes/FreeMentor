"""Progress sync — draining the device's queue.

The phone is the source of truth while offline: the learner ticks tasks on a
train with no signal, and those ticks must survive. Every write is recorded in
a local `sync_queue` and replayed here when there is a connection.

Two properties matter more than anything else here:

**Idempotent.** A replay can arrive twice — the device may upload, lose the
response, and retry. Every operation is an upsert keyed on what identifies the
row, so applying a batch twice leaves the same state as applying it once.

**Order-independent within a batch.** The queue is replayed oldest-first, but
a dropped connection can split a batch. Nothing here depends on a neighbour
having been applied, so a partial replay is simply a smaller correct one.

A conflict between device and server is resolved by *latest wins on
completed_at*, never by deleting a tick. Product plan §7.7: completed ticks
are never changed. The worst case has to be a duplicate, not a loss.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import limits
from app.auth import current_user
from app.db import get_session
from app.models import (
    ConfidenceRating,
    Enrollment,
    RestDay,
    TaskProgress,
    TestScore,
    User,
)

router = APIRouter(prefix="/progress", tags=["progress"])

CONFIDENCE_LEVELS = {
    "need_revision",
    "little_afraid",
    "confident",
    "all_cleared",
    "mastered",
}


# --------------------------------------------------------------- payloads --


class TaskDone(BaseModel):
    kind: Literal["task_progress"] = "task_progress"
    enrollment_id: str
    block_id: str
    scheduled_date: date | None = None
    completed_at: date
    minutes_credited: int = Field(ge=0, le=24 * 60)


class TaskUndone(BaseModel):
    kind: Literal["task_progress_delete"] = "task_progress_delete"
    enrollment_id: str
    block_id: str


class ConfidenceSet(BaseModel):
    kind: Literal["confidence"] = "confidence"
    enrollment_id: str
    topic_id: str
    level: str
    rated_at: date
    next_review_on: date | None = None


class ScoreSet(BaseModel):
    kind: Literal["test_score"] = "test_score"
    enrollment_id: str
    block_or_milestone_id: str
    score: float = Field(ge=0)
    max_score: float = Field(gt=0)
    taken_at: date


class RestDaySet(BaseModel):
    kind: Literal["rest_day"] = "rest_day"
    enrollment_id: str
    date: date
    is_rest: bool


SyncOp = Annotated[
    TaskDone | TaskUndone | ConfidenceSet | ScoreSet | RestDaySet,
    Field(discriminator="kind"),
]


class SyncRequest(BaseModel):
    # A device that has been offline for a month should still be able to
    # catch up, but not in one unbounded request.
    operations: list[SyncOp] = Field(max_length=500)


class SyncResult(BaseModel):
    applied: int
    rejected: list[str]


# ------------------------------------------------------------------ apply --


async def _owned_enrollments(session: AsyncSession, user: User) -> set[str]:
    """Enrollment ids this user owns.

    Postgres enforces this again through row-level security, but the API
    checks it too: on SQLite there is no RLS, and a 404 is a better answer
    than a database error.
    """
    rows = await session.execute(select(Enrollment.id).where(Enrollment.user_id == user.id))
    return {row[0] for row in rows}


@router.post(
    "",
    response_model=SyncResult,
    # 500 operations per request; a loop here is the cheapest way to make the
    # database work hard.
    dependencies=[Depends(limits.limit(limits.SYNC))],
)
async def sync(
    payload: SyncRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> SyncResult:
    owned = await _owned_enrollments(session, user)
    applied = 0
    rejected: list[str] = []

    for op in payload.operations:
        if op.enrollment_id not in owned:
            # Do not say whether the enrollment exists — it is not theirs either way.
            rejected.append(f"{op.kind}: unknown enrollment")
            continue

        try:
            await _apply(session, op)
            applied += 1
        except ValueError as error:
            rejected.append(f"{op.kind}: {error}")

    await session.commit()
    return SyncResult(applied=applied, rejected=rejected)


async def _apply(session: AsyncSession, op: SyncOp) -> None:
    if isinstance(op, TaskDone):
        existing = await session.get(TaskProgress, (op.enrollment_id, op.block_id))
        if existing is None:
            session.add(
                TaskProgress(
                    enrollment_id=op.enrollment_id,
                    block_id=op.block_id,
                    scheduled_date=op.scheduled_date,
                    completed_at=op.completed_at,
                    minutes_credited=op.minutes_credited,
                )
            )
            return
        # Latest wins, and an earlier replay never moves a tick backwards.
        if op.completed_at >= existing.completed_at:
            existing.completed_at = op.completed_at
            existing.scheduled_date = op.scheduled_date
            existing.minutes_credited = op.minutes_credited
        return

    if isinstance(op, TaskUndone):
        existing = await session.get(TaskProgress, (op.enrollment_id, op.block_id))
        if existing is not None:
            await session.delete(existing)
        return

    if isinstance(op, ConfidenceSet):
        if op.level not in CONFIDENCE_LEVELS:
            raise ValueError(f"unknown confidence level '{op.level}'")
        existing = await session.get(ConfidenceRating, (op.enrollment_id, op.topic_id))
        if existing is None:
            session.add(
                ConfidenceRating(
                    enrollment_id=op.enrollment_id,
                    topic_id=op.topic_id,
                    level=op.level,
                    rated_at=op.rated_at,
                    next_review_on=op.next_review_on,
                )
            )
            return
        if op.rated_at >= existing.rated_at:
            existing.level = op.level
            existing.rated_at = op.rated_at
            existing.next_review_on = op.next_review_on
        return

    if isinstance(op, ScoreSet):
        if op.score > op.max_score:
            raise ValueError("score is above max_score")
        existing = await session.get(TestScore, (op.enrollment_id, op.block_or_milestone_id))
        if existing is None:
            session.add(
                TestScore(
                    enrollment_id=op.enrollment_id,
                    block_or_milestone_id=op.block_or_milestone_id,
                    score=op.score,
                    max_score=op.max_score,
                    taken_at=op.taken_at,
                )
            )
            return
        if op.taken_at >= existing.taken_at:
            existing.score = op.score
            existing.max_score = op.max_score
            existing.taken_at = op.taken_at
        return

    if isinstance(op, RestDaySet):
        existing = await session.get(RestDay, (op.enrollment_id, op.date))
        if op.is_rest and existing is None:
            session.add(RestDay(enrollment_id=op.enrollment_id, date=op.date))
        elif not op.is_rest and existing is not None:
            await session.delete(existing)
        return

    raise ValueError("unsupported operation")


# ------------------------------------------------------------------ fetch --


class ProgressSnapshot(BaseModel):
    """Everything a fresh install needs to rebuild the learner's plan."""

    enrollment_id: str
    completed: dict[str, dict]
    confidence: dict[str, dict]
    test_scores: dict[str, dict]
    rest_days: list[date]


@router.get("/{enrollment_id}", response_model=ProgressSnapshot)
async def snapshot(
    enrollment_id: str,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProgressSnapshot:
    if enrollment_id not in await _owned_enrollments(session, user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such enrollment.")

    tasks = (
        await session.execute(
            select(TaskProgress).where(TaskProgress.enrollment_id == enrollment_id)
        )
    ).scalars()
    ratings = (
        await session.execute(
            select(ConfidenceRating).where(ConfidenceRating.enrollment_id == enrollment_id)
        )
    ).scalars()
    scores = (
        await session.execute(select(TestScore).where(TestScore.enrollment_id == enrollment_id))
    ).scalars()
    rests = (
        await session.execute(select(RestDay).where(RestDay.enrollment_id == enrollment_id))
    ).scalars()

    return ProgressSnapshot(
        enrollment_id=enrollment_id,
        completed={
            t.block_id: {
                "completedAt": t.completed_at.isoformat(),
                "minutesCredited": t.minutes_credited,
            }
            for t in tasks
        },
        confidence={
            r.topic_id: {"level": r.level, "ratedAt": r.rated_at.isoformat()} for r in ratings
        },
        test_scores={
            s.block_or_milestone_id: {
                "score": float(s.score),
                "maxScore": float(s.max_score),
                "takenAt": s.taken_at.isoformat(),
            }
            for s in scores
        },
        rest_days=[r.date for r in rests],
    )
