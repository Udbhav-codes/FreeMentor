"""Profile, parent consent and account deletion."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import export as data_export
from app import otp
from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import (
    ConfidenceRating,
    Enrollment,
    Goal,
    NotificationPrefs,
    ParentConsent,
    Purchase,
    RestDay,
    Schedule,
    Streak,
    TaskProgress,
    TestScore,
    User,
)

router = APIRouter(prefix="/account", tags=["account"])

MINIMUM_AGE = 16
ADULT_AGE = 18


class ProfileOut(BaseModel):
    id: str
    email: str
    name: str | None
    birth_year: int | None
    qualification: str | None
    language: str
    is_minor: bool
    consent_required: bool
    consent_given: bool


async def _consent(session: AsyncSession, user: User) -> ParentConsent | None:
    rows = (
        (
            await session.execute(
                select(ParentConsent).where(ParentConsent.user_id == user.id)
            )
        )
        .scalars()
        .all()
    )
    live = [c for c in rows if c.revoked_at is None]
    return live[-1] if live else None


async def _profile_out(session: AsyncSession, user: User) -> ProfileOut:
    consent = await _consent(session, user)
    return ProfileOut(
        id=user.id,
        email=user.email,
        name=user.name,
        birth_year=user.birth_year,
        qualification=user.qualification,
        language=user.language,
        is_minor=user.is_minor,
        consent_required=user.is_minor,
        consent_given=bool(consent and consent.consented_at),
    )


@router.get("/me", response_model=ProfileOut)
async def me(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileOut:
    return await _profile_out(session, user)


class ProfileIn(BaseModel):
    name: str | None = None
    birth_year: int | None = None
    qualification: str | None = None
    language: str | None = None


@router.patch("/me", response_model=ProfileOut)
async def update_me(
    payload: ProfileIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileOut:
    if payload.birth_year is not None:
        age = datetime.now(timezone.utc).year - payload.birth_year - 1
        # 16+ only (decision #9). The app gates this too; the server does not
        # trust the app, because the app is the part an attacker controls.
        if age < MINIMUM_AGE:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"FreeMentor is for ages {MINIMUM_AGE} and over.",
            )
        user.birth_year = payload.birth_year
        user.is_minor = age < ADULT_AGE

    if payload.name is not None:
        user.name = payload.name.strip() or None
    if payload.qualification is not None:
        user.qualification = payload.qualification
    if payload.language is not None:
        if payload.language not in {"en", "hi", "hi-en"}:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown language.")
        user.language = payload.language

    await session.commit()
    await session.refresh(user)
    return await _profile_out(session, user)


class ConsentRequest(BaseModel):
    parent_contact: str
    method: str = "email"


class ConsentRequestOut(BaseModel):
    status: str
    expires_in_seconds: int
    # Demo delivery only. Never populated outside local/development, and
    # config.assert_safe() refuses to start production with echo on.
    demo_code: str | None = None


@router.post("/consent/request", response_model=ConsentRequestOut, status_code=202)
async def request_consent(
    payload: ConsentRequest,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> ConsentRequestOut:
    """Start verifiable parental consent for a 16-17 year old (§15).

    The row is created WITHOUT consented_at: consent is the confirmation, not
    the request. A learner typing their parent's address is not a parent
    agreeing — which is exactly the gap this endpoint exists to close.
    """
    if not user.is_minor:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This account does not need consent.")
    if payload.method not in {"email", "sms"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown method.")

    contact = payload.parent_contact.strip()
    if len(contact) < 5:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Contact looks incomplete.")
    if payload.method == "email" and "@" not in contact:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "That is not an email address.")

    existing = await _consent(session, user)

    # Rate limit so a parent cannot be spammed with codes through us.
    if existing and not otp.may_resend(existing.last_sent_at):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "A code was just sent. Wait a minute before asking for another.",
        )

    code = otp.generate_code()
    now = datetime.now(timezone.utc)

    if existing and existing.consented_at is None:
        consent = existing
        consent.parent_contact = contact
        consent.method = payload.method
        # A fresh code resets the attempt counter; the previous code dies.
        consent.attempts = 0
    else:
        consent = ParentConsent(
            user_id=user.id, parent_contact=contact, method=payload.method
        )
        session.add(consent)
        await session.flush()

    consent.code_hash = otp.hash_code(code, salt=consent.id)
    consent.expires_at = otp.expiry_from(now)
    consent.last_sent_at = now
    await session.commit()

    await otp.get_sender(settings.environment).send(contact, code, payload.method)

    echo = settings.otp_echo and not settings.is_production
    return ConsentRequestOut(
        status="sent",
        expires_in_seconds=int(otp.TTL.total_seconds()),
        demo_code=code if echo else None,
    )


class ConsentConfirm(BaseModel):
    code: str


@router.post("/consent/confirm", response_model=ProfileOut)
async def confirm_consent(
    payload: ConsentConfirm,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> ProfileOut:
    consent = await _consent(session, user)
    if consent is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No consent request to confirm.")
    if consent.consented_at is not None:
        return await _profile_out(session, user)

    result = otp.check(
        supplied=payload.code,
        stored_hash=consent.code_hash,
        salt=consent.id,
        expires_at=consent.expires_at,
        attempts=consent.attempts,
    )

    if not result.ok:
        # Count the attempt whatever went wrong, so a wrong code cannot be
        # guessed indefinitely.
        consent.attempts += 1
        await session.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, result.reason)

    consent.consented_at = datetime.now(timezone.utc)
    # The code has done its job; it must not remain usable.
    consent.code_hash = None
    consent.expires_at = None
    await session.commit()
    return await _profile_out(session, user)


@router.get("/export")
async def export_me(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, object]:
    """Everything we hold about the caller, as JSON (DPDP Act 2023 §11).

    There is no account identifier in the request. Like `DELETE /me`, this
    endpoint serves whoever the token belongs to and cannot be pointed at
    anybody else — which is the only property of it that really matters.

    Note that `current_user` refuses an account already marked for deletion,
    so an export has to be taken **before** deleting. The app's delete
    confirmation says so; there is no un-delete to recover from getting that
    order wrong.

    Not paginated. The largest realistic export is one learner's ticks across
    a 72-week roadmap — a few thousand short rows — and a partial export of
    somebody's own data would be a strange thing to hand them.
    """
    consents = list(
        (
            await session.execute(
                select(ParentConsent)
                .where(ParentConsent.user_id == user.id)
                .order_by(ParentConsent.created_at)
            )
        )
        .scalars()
        .all()
    )

    enrollment_rows = list(
        (
            await session.execute(
                select(Enrollment)
                .where(Enrollment.user_id == user.id)
                .order_by(Enrollment.created_at)
            )
        )
        .scalars()
        .all()
    )

    async def _for(model, enrollment_id: str, order):
        return list(
            (
                await session.execute(
                    select(model).where(model.enrollment_id == enrollment_id).order_by(order)
                )
            )
            .scalars()
            .all()
        )

    roadmaps = []
    for enrollment in enrollment_rows:
        goal = (
            await session.execute(select(Goal).where(Goal.id == enrollment.goal_id))
        ).scalar_one_or_none()
        roadmaps.append(
            data_export.enrollment_section(
                enrollment,
                goal=goal,
                schedules=await _for(Schedule, enrollment.id, Schedule.effective_from),
                task_progress=await _for(TaskProgress, enrollment.id, TaskProgress.block_id),
                ratings=await _for(ConfidenceRating, enrollment.id, ConfidenceRating.topic_id),
                scores=await _for(TestScore, enrollment.id, TestScore.block_or_milestone_id),
                rest_days=await _for(RestDay, enrollment.id, RestDay.date),
            )
        )

    purchases = list(
        (
            await session.execute(
                select(Purchase)
                .where(Purchase.user_id == user.id)
                .order_by(Purchase.created_at)
            )
        )
        .scalars()
        .all()
    )
    streak = (
        await session.execute(select(Streak).where(Streak.user_id == user.id))
    ).scalar_one_or_none()
    prefs = (
        await session.execute(
            select(NotificationPrefs).where(NotificationPrefs.user_id == user.id)
        )
    ).scalar_one_or_none()

    return data_export.build_export(
        user=user,
        consents=consents,
        enrollments=roadmaps,
        purchases=purchases,
        streak=streak,
        prefs=prefs,
        generated_at=datetime.now(timezone.utc),
    )


@router.delete("/me", status_code=status.HTTP_202_ACCEPTED)
async def delete_me(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Mark for deletion. Purged within 30 days (§15).

    Soft-marked rather than removed on the spot because purchase records have
    to be retained for tax and refund purposes; the purge job keeps those and
    drops everything else.
    """
    user.deleted_at = datetime.now(timezone.utc)
    await session.commit()
    return {"status": "scheduled", "purge_within_days": "30"}
