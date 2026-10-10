"""The server must not start in production wearing its local stubs.

Local mode exists so the API can be exercised before any cloud account does —
SQLite instead of Postgres, an unsigned stub token instead of a Supabase JWT.
That is useful in development and catastrophic in production, where it would
accept any caller's claim about who they are. The guard is the only thing
standing between "convenient" and "open to the world", so it is tested.
"""

from __future__ import annotations

import pytest

from app.config import Settings


def test_local_mode_is_allowed_outside_production():
    settings = Settings(environment="local")
    settings.assert_safe()
    assert settings.uses_sqlite
    assert not settings.verifies_real_tokens


def test_production_without_secrets_refuses_to_start():
    settings = Settings(environment="production")
    with pytest.raises(RuntimeError) as error:
        settings.assert_safe()
    message = str(error.value)
    assert "DATABASE_URL" in message
    assert "SUPABASE_JWT_SECRET" in message


def test_production_with_a_database_but_no_jwt_secret_still_refuses():
    # The dangerous half-configured case: a real database, stub auth.
    settings = Settings(
        environment="production",
        database_url="postgresql://user:pw@host/db",
        supabase_url="https://x.supabase.co",
    )
    with pytest.raises(RuntimeError, match="SUPABASE_JWT_SECRET"):
        settings.assert_safe()


def test_production_refuses_to_echo_consent_codes():
    # OTP_ECHO returns the parental-consent code in the API response so the
    # flow can be exercised without an SMS subscription. In production that
    # would let a learner read their own parent's code and approve themselves.
    settings = Settings(
        environment="production",
        database_url="postgresql://user:pw@host/db",
        supabase_url="https://x.supabase.co",
        supabase_jwt_secret="secret",
        otp_echo=True,
    )
    with pytest.raises(RuntimeError, match="OTP_ECHO"):
        settings.assert_safe()


def test_production_with_everything_set_is_fine():
    settings = Settings(
        environment="production",
        database_url="postgresql://user:pw@host/db",
        supabase_url="https://x.supabase.co",
        supabase_jwt_secret="secret",
        otp_echo=False,
    )
    settings.assert_safe()
    assert not settings.uses_sqlite
    assert settings.verifies_real_tokens


def test_the_async_driver_is_substituted_for_postgres():
    settings = Settings(database_url="postgresql://user:pw@host/db")
    assert settings.sqlalchemy_url.startswith("postgresql+asyncpg://")
