"""FreeMentor API.

The app works offline; this exists for what a phone cannot do alone — see
docs/APP_BUILD_SPEC.md §7.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.db import create_all
from app.routers import account, admin, billing, catalog, enrollments, media, progress, web

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Local mode bootstraps its own SQLite file. Postgres is migrated with the
    # SQL in migrations/, which carries the RLS policies.
    if settings.uses_sqlite:
        await create_all()
    yield


app = FastAPI(
    title="FreeMentor API",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(account.router)
app.include_router(admin.router)
app.include_router(billing.router)
app.include_router(catalog.router)
app.include_router(enrollments.router)
app.include_router(media.router)
app.include_router(progress.router)
app.include_router(web.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, object]:
    """Also reports whether real tokens are being verified.

    Worth exposing: a staging box quietly running the local stub verifier is
    exactly the kind of thing nobody notices until it matters.
    """
    return {
        "status": "ok",
        "environment": settings.environment,
        "database": "sqlite" if settings.uses_sqlite else "postgres",
        "verifies_real_tokens": settings.verifies_real_tokens,
        # Visible on purpose: a server still echoing consent codes is not one
        # that should be in front of learners.
        "otp_echo": settings.otp_echo,
    }
