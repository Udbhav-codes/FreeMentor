"""Profile photos.

The app uploads **directly to Supabase Storage** using a short-lived signed
URL this endpoint issues. Routing a 2 MB image through the API process would
burn memory and request time for no benefit, and the storage layer is better
at it than we are.

The `avatars` bucket is PRIVATE, unlike the library bucket: a photo is
personal data under §15. Reading one needs a signed URL too, which is why the
profile carries a time-limited link rather than a permanent public path.

Objects live at `<auth uid>/<file>`, and the storage policies in
migrations/0003 check that first path segment against the caller. So even if
a bug here issued a token for the wrong path, storage would still refuse it.
"""

from __future__ import annotations

import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, current_principal, current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import User

router = APIRouter(prefix="/media", tags=["media"])

BUCKET = "avatars"
ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_BYTES = 2 * 1024 * 1024
# Long enough for a slow connection, short enough that a leaked URL is stale.
READ_URL_TTL = 60 * 60


class UploadTicket(BaseModel):
    """Everything the app needs to PUT the file itself."""

    upload_url: str
    token: str
    path: str
    max_bytes: int


def _storage(settings: Settings) -> tuple[str, dict[str, str]]:
    if not settings.supabase_url or not settings.supabase_service_key:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Photo storage is not configured on this server.",
        )
    base = settings.supabase_url.rstrip("/")
    headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }
    return base, headers


@router.post("/avatar/upload-url", response_model=UploadTicket)
async def avatar_upload_url(
    content_type: str = "image/jpeg",
    principal: Principal = Depends(current_principal),
    settings: Settings = Depends(get_settings),
) -> UploadTicket:
    if content_type not in ALLOWED:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Photos must be {', '.join(sorted(ALLOWED))}.",
        )

    base, headers = _storage(settings)
    # A random suffix each time, so a replaced photo cannot be served from a
    # CDN or client cache under its old URL.
    path = f"{principal.auth_id}/{secrets.token_hex(8)}.{ALLOWED[content_type]}"

    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        response = await client.post(f"{base}/storage/v1/object/upload/sign/{BUCKET}/{path}")

    if response.status_code not in (200, 201):
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Storage refused the upload ticket: {response.status_code}",
        )

    token = response.json().get("token", "")
    return UploadTicket(
        upload_url=f"{base}/storage/v1/object/upload/sign/{BUCKET}/{path}",
        token=token,
        path=path,
        max_bytes=MAX_BYTES,
    )


class AvatarIn(BaseModel):
    path: str


class AvatarOut(BaseModel):
    path: str
    url: str


@router.put("/avatar", response_model=AvatarOut)
async def set_avatar(
    payload: AvatarIn,
    principal: Principal = Depends(current_principal),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AvatarOut:
    """Records an uploaded photo against the profile.

    The path is checked rather than trusted: the app supplies it, and the app
    is the part an attacker controls. Without this a caller could point their
    profile at somebody else's photo.
    """
    path = payload.path.strip().lstrip("/")
    if not path.startswith(f"{principal.auth_id}/") or ".." in path:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That is not your photo.")

    base, headers = _storage(settings)
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        # Confirm the object is really there before pointing a profile at it.
        head = await client.request("HEAD", f"{base}/storage/v1/object/{BUCKET}/{path}")
        if head.status_code != 200:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No uploaded photo at that path.")

        previous = user.photo_url
        user.photo_url = path
        await session.commit()

        # Only now remove the old one, so a failure cannot leave the learner
        # with neither.
        if previous and previous != path and previous.startswith(f"{principal.auth_id}/"):
            await client.delete(f"{base}/storage/v1/object/{BUCKET}/{previous}")

        signed = await _sign_read(client, base, path)

    return AvatarOut(path=path, url=signed)


@router.get("/avatar", response_model=AvatarOut)
async def get_avatar(
    principal: Principal = Depends(current_principal),
    user: User = Depends(current_user),
    settings: Settings = Depends(get_settings),
) -> AvatarOut:
    if not user.photo_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No photo set.")

    base, headers = _storage(settings)
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        signed = await _sign_read(client, base, user.photo_url)
    return AvatarOut(path=user.photo_url, url=signed)


@router.delete("/avatar", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_avatar(
    principal: Principal = Depends(current_principal),
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> None:
    path = user.photo_url
    user.photo_url = None
    await session.commit()

    if not path:
        return
    base, headers = _storage(settings)
    async with httpx.AsyncClient(headers=headers, timeout=30) as client:
        await client.delete(f"{base}/storage/v1/object/{BUCKET}/{path}")


async def _sign_read(client: httpx.AsyncClient, base: str, path: str) -> str:
    response = await client.post(
        f"{base}/storage/v1/object/sign/{BUCKET}/{path}",
        json={"expiresIn": READ_URL_TTL},
    )
    if response.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Could not sign the photo URL.")
    return f"{base}/storage/v1{response.json()['signedURL']}"
