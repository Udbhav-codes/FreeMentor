"""Async engine and session. SQLite locally, Postgres in anger."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import Base

_settings = get_settings()

engine = create_async_engine(
    _settings.sqlalchemy_url,
    echo=False,
    # asyncpg does not take SQLite's connect args, and vice versa.
    future=True,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def create_all() -> None:
    """Local convenience only.

    Postgres is migrated with the SQL in migrations/, which carries the RLS
    policies SQLAlchemy knows nothing about. Creating tables from the models
    against Postgres would silently produce a schema with security disabled.
    """
    if not _settings.uses_sqlite:
        raise RuntimeError(
            "create_all() is for local SQLite only — run migrations/0001_initial.sql "
            "against Postgres so the row-level security policies are applied."
        )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
