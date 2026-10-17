"""Device registration and notification preferences.

The sending itself lives in `app/push.py`, which is pure policy plus a
pluggable `Sender`. This is the part the app talks to: registering the device
so there is somewhere to send, and setting the switches that decide whether
anything should be.

`notification_prefs` has existed in the schema since 0001 and nothing could
write it — the app kept its reminder settings on the phone, which is right
for the LOCAL daily reminder but useless for a push, since the server is what
decides whether to send one.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import limits
from app.auth import current_user
from app.db import get_session
from app.models import DeviceToken, NotificationPrefs, User

router = APIRouter(prefix="/push", tags=["push"])

PLATFORMS = {"android", "ios", "web"}


class DeviceIn(BaseModel):
    token: str = Field(min_length=8, max_length=4096)
    platform: str = "android"


class DeviceOut(BaseModel):
    registered: bool
    platform: str


@router.post(
    "/devices",
    response_model=DeviceOut,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(limits.limit(limits.SYNC))],
)
async def register_device(
    payload: DeviceIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> DeviceOut:
    """Registers this device, or refreshes it if already known.

    Idempotent, and called on every app start: FCM rotates a token whenever
    the app is restored, reinstalled or its data cleared, so "register once"
    would quietly stop working after a device restore.

    When the token already exists under a DIFFERENT user — the same phone,
    somebody else signing in — the row MOVES. Leaving it would send the new
    learner's notifications to the previous account's device list.
    """
    if payload.platform not in PLATFORMS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown platform.")

    existing = (
        await session.execute(select(DeviceToken).where(DeviceToken.token == payload.token))
    ).scalar_one_or_none()

    if existing is None:
        session.add(
            DeviceToken(user_id=user.id, token=payload.token, platform=payload.platform)
        )
    else:
        existing.user_id = user.id
        existing.platform = payload.platform
        existing.last_seen_at = datetime.now(timezone.utc)

    await session.commit()
    return DeviceOut(registered=True, platform=payload.platform)


@router.delete("/devices", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(
    payload: DeviceIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Forgets this device. Called on sign-out.

    Scoped to the caller's own rows, so a token somebody else holds cannot be
    unregistered by guessing it.
    """
    await session.execute(
        delete(DeviceToken).where(
            DeviceToken.token == payload.token, DeviceToken.user_id == user.id
        )
    )
    await session.commit()


class PrefsIn(BaseModel):
    daily: bool | None = None
    study: bool | None = None
    weekly_report: bool | None = None
    streak: bool | None = None
    test: bool | None = None
    quiet_from: int | None = Field(default=None, ge=0, le=23)
    quiet_to: int | None = Field(default=None, ge=0, le=23)


class PrefsOut(BaseModel):
    daily: bool
    study: bool
    weekly_report: bool
    streak: bool
    test: bool
    quiet_from: int | None
    quiet_to: int | None


def _out(prefs: NotificationPrefs) -> PrefsOut:
    return PrefsOut(
        daily=prefs.daily,
        study=prefs.study,
        weekly_report=prefs.weekly_report,
        streak=prefs.streak,
        test=prefs.test,
        quiet_from=prefs.quiet_from,
        quiet_to=prefs.quiet_to,
    )


async def _prefs_row(session: AsyncSession, user: User) -> NotificationPrefs:
    """The caller's row, created with the column defaults on first read."""
    row = (
        await session.execute(
            select(NotificationPrefs).where(NotificationPrefs.user_id == user.id)
        )
    ).scalar_one_or_none()
    if row is None:
        row = NotificationPrefs(user_id=user.id)
        session.add(row)
        await session.commit()
        await session.refresh(row)
    return row


@router.get("/prefs", response_model=PrefsOut)
async def get_prefs(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PrefsOut:
    return _out(await _prefs_row(session, user))


@router.patch("/prefs", response_model=PrefsOut)
async def update_prefs(
    payload: PrefsIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> PrefsOut:
    """Partial update: only the fields sent are changed.

    Quiet hours are accepted as a pair or not at all. Setting one half would
    leave a window with no other end, which `push.is_quiet` reads as "no quiet
    hours" — so a learner who set only `quiet_from` would think they had
    silenced the evening and would not have.
    """
    sent = payload.model_dump(exclude_unset=True)
    if ("quiet_from" in sent) != ("quiet_to" in sent):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Send quiet_from and quiet_to together, or neither.",
        )

    row = await _prefs_row(session, user)
    for field, value in sent.items():
        setattr(row, field, value)
    await session.commit()
    await session.refresh(row)
    return _out(row)
