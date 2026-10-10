"""Starting, switching and archiving a goal."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_user
from app.db import get_session
from app.models import Enrollment, Schedule, User

router = APIRouter(prefix="/enrollments", tags=["enrollments"])


class EnrollmentIn(BaseModel):
    goal_id: str
    start_date: date
    target_date: date | None = None
    minutes_by_weekday: dict[str, int]
    language: str = "en"
    selected_subjects: list[str] = Field(default_factory=list)


class EnrollmentOut(BaseModel):
    id: str
    goal_id: str
    start_date: date
    target_date: date | None
    status: str


@router.get("", response_model=list[EnrollmentOut])
async def list_enrollments(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[EnrollmentOut]:
    rows = (
        (await session.execute(select(Enrollment).where(Enrollment.user_id == user.id)))
        .scalars()
        .all()
    )
    return [
        EnrollmentOut(
            id=e.id,
            goal_id=e.goal_id,
            start_date=e.start_date,
            target_date=e.target_date,
            status=e.status,
        )
        for e in rows
    ]


@router.post("", response_model=EnrollmentOut, status_code=status.HTTP_201_CREATED)
async def start(
    payload: EnrollmentIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> EnrollmentOut:
    if any(minutes < 0 for minutes in payload.minutes_by_weekday.values()):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Negative study minutes.")

    # One goal at a time (§2). The old one is ARCHIVED, never deleted —
    # decision #6 keeps its progress viewable.
    live = (
        (
            await session.execute(
                select(Enrollment).where(
                    Enrollment.user_id == user.id, Enrollment.status != "archived"
                )
            )
        )
        .scalars()
        .all()
    )
    for e in live:
        e.status = "archived"

    enrollment = Enrollment(
        user_id=user.id,
        goal_id=payload.goal_id,
        start_date=payload.start_date,
        target_date=payload.target_date,
        status="trial",
    )
    session.add(enrollment)
    await session.flush()

    session.add(
        Schedule(
            enrollment_id=enrollment.id,
            minutes_by_weekday=payload.minutes_by_weekday,
            language=payload.language,
            selected_subjects=payload.selected_subjects,
            effective_from=payload.start_date,
        )
    )
    await session.commit()
    await session.refresh(enrollment)

    return EnrollmentOut(
        id=enrollment.id,
        goal_id=enrollment.goal_id,
        start_date=enrollment.start_date,
        target_date=enrollment.target_date,
        status=enrollment.status,
    )
