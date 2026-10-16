"""Test fixtures: a fresh in-memory database per test, and a signed-in client.

Each test gets its own SQLite file so nothing leaks between them, and the auth
dependency is satisfied with a local-mode token — the same path a developer
uses before any Supabase project exists.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncIterator, Iterator

import pytest
import pytest_asyncio
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# The suite must be hermetic: it has to behave the same on a machine with a
# fully configured .env as on a fresh clone with none. Without this, adding
# real Supabase credentials to .env made every test fail, because the app
# started verifying real JWTs and rejecting the local stub token — a failure
# about the developer's environment, not the code.
#
# Environment variables win over the .env file in pydantic-settings, so
# blanking them here pins the suite to local mode. Must happen before
# app.config is imported anywhere.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_JWT_SECRET"] = ""
os.environ["SUPABASE_SERVICE_KEY"] = ""
os.environ["SUPABASE_URL"] = ""

from app import limits  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402


def all_api_routes() -> list[APIRoute]:
    """Every APIRoute the app serves, including those inside included routers.

    `app.routes` used to contain them flattened. FastAPI 1.x (starlette 1.x)
    keeps an included router as a single `_IncludedRouter` wrapper instead, so
    a plain scan of `app.routes` finds **zero** `/admin` routes — which is how
    two "every admin endpoint is behind the check" tests came to fail on the
    upgrade. They failed rather than passing vacuously only because each one
    asserted a minimum count first; without that guard the upgrade would have
    quietly disarmed the one test that proves admin routes are protected.

    Keep that guard in any test built on this helper.
    """
    seen: dict[int, APIRoute] = {}

    def walk(routes: object) -> None:
        for route in routes or []:  # type: ignore[union-attr]
            if isinstance(route, APIRoute):
                seen[id(route)] = route
            inner = getattr(route, "original_router", None)
            if inner is not None:
                walk(getattr(inner, "routes", []))

    walk(app.routes)
    return list(seen.values())


@pytest.fixture(autouse=True)
def fresh_rate_limits() -> Iterator[None]:
    """Clears the rate-limit counters around every test.

    `app.limits.window` is a process-global on purpose — that is what an
    in-process limiter is — so without this, counts accumulate across the
    whole session. The symptom when it was missing was eight consent tests and
    five export tests failing with 429 instead of their expected status,
    because EXPORT and CONSENT_REQUEST are limited per *hour* and every test
    authenticates as the same learner.

    Autouse rather than opt-in: a test that hits a limited route without
    knowing it is limited should still pass, and there is no reason for any
    test to inherit another's counters.
    """
    limits.window.forget()
    yield
    limits.window.forget()


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


# Supabase auth ids are UUIDs, and users.auth_id is a uuid column, so the
# fixtures use real ones. Derived from a name so they stay readable and
# stable across runs.
def auth_id(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"freementor-test/{name}"))


def auth(user: str = "learner-1", email: str = "learner@example.com") -> dict[str, str]:
    """Local-mode bearer token for a given identity."""
    return {"Authorization": f"Bearer local:{auth_id(user)}:{email}"}


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
