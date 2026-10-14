"""The public web pages — account deletion and the policy documents.

Google Play requires an account-deletion route that works **without the app
installed**: someone who has uninstalled it must still be able to delete their
data. The app has its own deletion screen; this is the other one, and it is a
launch blocker rather than a nicety.

Served from the API's own origin on purpose. The page's DELETE call is then
same-origin, so there is no CORS policy to get wrong and nothing extra to
deploy or keep in sync.

The Supabase URL and **publishable** key are injected at render time rather
than hardcoded in the HTML, so a different deployment serves its own project
without editing the file. The publishable key is safe in a browser — it grants
nothing on its own and row-level security decides what any caller may touch.
The service key never leaves the server and must never be injected here.
"""

from __future__ import annotations

import functools
import os
import pathlib

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, PlainTextResponse

from app.config import Settings, get_settings

router = APIRouter(tags=["web"])

WEB_DIR = pathlib.Path(__file__).resolve().parent.parent / "web"
# app/routers/web.py -> routers -> app -> server -> freementor -> repo root.
# The policies live in the repo's docs/, not inside the server package, so a
# deployment that ships only server/ will 404 them. That is handled rather
# than crashed on, and LEGAL_DOCS_DIR overrides the location.
DOCS_DIR = pathlib.Path(
    os.environ.get("LEGAL_DOCS_DIR")
    or pathlib.Path(__file__).resolve().parents[4] / "docs" / "legal"
)


@functools.lru_cache(maxsize=8)
def _template(name: str) -> str:
    path = WEB_DIR / name
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Page not found.")
    return path.read_text(encoding="utf-8")


@router.get("/delete-account", response_class=HTMLResponse)
async def delete_account_page(settings: Settings = Depends(get_settings)) -> HTMLResponse:
    """The page Play links to from the store listing."""
    if not settings.supabase_url or not settings.supabase_publishable_key:
        # Better a plain explanation than a page whose sign-in button silently
        # does nothing.
        return HTMLResponse(
            "<h1>Account deletion is not configured on this server.</h1>"
            "<p>Please email support and we will delete your account by hand.</p>",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    html = (
        _template("delete-account.html")
        .replace("__SUPABASE_URL__", settings.supabase_url.rstrip("/"))
        .replace("__SUPABASE_PUBLISHABLE_KEY__", settings.supabase_publishable_key)
    )
    return HTMLResponse(html)


def _policy(filename: str) -> PlainTextResponse:
    """Serves a policy from docs/legal as text.

    Deliberately plain: these are drafts with [PLACEHOLDERS] still in them, and
    rendering them as a polished page would invite publishing them as they
    stand. When they are finalised, swap this for proper HTML.
    """
    path = DOCS_DIR / filename
    if not path.is_file():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That document is not published yet.")
    return PlainTextResponse(path.read_text(encoding="utf-8"), media_type="text/plain")


@router.get("/privacy-policy", response_class=PlainTextResponse)
async def privacy_policy() -> PlainTextResponse:
    return _policy("privacy-policy.md")


@router.get("/privacy", response_class=PlainTextResponse)
async def privacy_alias() -> PlainTextResponse:
    """The app links here (sign-in.tsx). An installed build cannot be changed,
    so the alias stays even if the canonical path moves."""
    return _policy("privacy-policy.md")


@router.get("/terms", response_class=PlainTextResponse)
async def terms() -> PlainTextResponse:
    return _policy("terms-of-service.md")


@router.get("/refund-policy", response_class=PlainTextResponse)
async def refund_policy() -> PlainTextResponse:
    return _policy("refund-policy.md")


@router.get("/content-policy", response_class=PlainTextResponse)
async def content_policy() -> PlainTextResponse:
    return _policy("content-policy.md")
