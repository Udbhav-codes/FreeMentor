"""Async engine and session. SQLite locally, Postgres in anger."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import Base

_settings = get_settings()

def _connect_args() -> dict:
    """asyncpg options that depend on how we are reaching Postgres.

    Supabase's direct host (db.<ref>.supabase.co) is IPv6-only, so anywhere
    without IPv6 has to go through the Supavisor pooler. In TRANSACTION mode
    (port 6543) a connection is handed to a different backend between
    statements, so asyncpg's prepared-statement cache produces
    'prepared statement does not exist' under load. Session mode (5432) keeps
    one backend and is fine.
    """
    url = _settings.sqlalchemy_url
    if 'asyncpg' not in url:
        return {}
    if ':6543' in url:
        return {'statement_cache_size': 0, 'prepared_statement_cache_size': 0}
    return {}


engine = create_async_engine(
    _settings.sqlalchemy_url,
    echo=False,
    future=True,
    connect_args=_connect_args(),
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
