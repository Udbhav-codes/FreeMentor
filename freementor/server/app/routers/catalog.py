"""The catalog and the library files.

The catalog also ships inside the app bundle, so this endpoint exists for one
reason: telling a device that a goal has a newer version than the one it
cached. The file itself comes from Supabase Storage over a signed URL, not
through this server — 568 KB of JSON has no business passing through an API
process.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Goal, LibraryVersion

router = APIRouter(tags=["catalog"])


class GoalOut(BaseModel):
    id: str
    name: str
    category: str
    group: str | None = None
    type: str
    status: str
    est_hours: int | None = None
    latest_version: str | None = None


@router.get("/catalog", response_model=list[GoalOut])
async def catalog(session: AsyncSession = Depends(get_session)) -> list[GoalOut]:
    goals = (await session.execute(select(Goal))).scalars().all()
    versions = (await session.execute(select(LibraryVersion))).scalars().all()

    latest: dict[str, str] = {}
    for v in versions:
        if v.goal_id not in latest or v.version > latest[v.goal_id]:
            latest[v.goal_id] = v.version

    return [
        GoalOut(
            id=g.id,
            name=g.name,
            category=g.category,
            group=g.group,
            type=g.type,
            status=g.status,
            est_hours=g.est_hours,
            latest_version=latest.get(g.id),
        )
        for g in goals
    ]


class DownloadOut(BaseModel):
    goal_id: str
    version: str
    url: str
    checksum: str


@router.get("/goals/{goal_id}/download", response_model=DownloadOut)
async def download(
    goal_id: str,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> DownloadOut:
    rows = (
        (
            await session.execute(
                select(LibraryVersion).where(LibraryVersion.goal_id == goal_id)
            )
        )
        .scalars()
        .all()
    )
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No published roadmap for this goal.")

    newest = max(rows, key=lambda v: v.version)
    return DownloadOut(
        goal_id=goal_id,
        version=newest.version,
        # Already a full URL when published; Storage signing lands with the
        # real bucket at deploy time.
        url=newest.file_url,
        checksum=newest.checksum,
    )
