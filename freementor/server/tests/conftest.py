"""Test fixtures: a fresh in-memory database per test, and a signed-in client.

Each test gets its own SQLite file so nothing leaks between them, and the auth
dependency is satisfied with a local-mode token — the same path a developer
uses before any Supabase project exists.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Must be set before app.config is imported anywhere.
os.environ.setdefault("ENVIRONMENT", "test")

from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


@pytest_asyncio.fixture
async def session_factory(tmp_path) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(session_factory) -> AsyncIterator[AsyncClient]:
    async def override() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def auth(user_id: str = "learner-1", email: str = "learner@example.com") -> dict[str, str]:
    """Local-mode bearer token for a given identity."""
    return {"Authorization": f"Bearer local:{user_id}:{email}"}


@pytest_asyncio.fixture
async def enrollment(client: AsyncClient) -> str:
    """A started goal, so progress tests have something to sync against."""
    await client.patch("/account/me", json={"birth_year": 2000}, headers=auth())
    response = await client.post(
        "/enrollments",
        json={
            "goal_id": "python",
            "start_date": "2026-10-08",
            "minutes_by_weekday": {
                "mon": 120,
                "tue": 120,
                "wed": 120,
                "thu": 120,
                "fri": 120,
                "sat": 240,
                "sun": 240,
            },
        },
        headers=auth(),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]
