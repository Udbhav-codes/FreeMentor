"""Settings, and the local mode that makes this runnable with no accounts.

The whole API can be exercised before Supabase exists: with no DATABASE_URL we
fall back to SQLite, and with no SUPABASE_JWT_SECRET we accept a stub token.
That keeps the sync protocol testable and lets the app be pointed at a real
server weeks before anyone signs up for anything.

Local mode is refused outright when ENVIRONMENT is "production", so the stub
verifier can never be what is guarding real learner data.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"

    database_url: str = ""
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_key: str = ""
    # Safe to send to a browser: it grants nothing on its own and row-level
    # security decides what any caller may touch. Used by the public
    # account-deletion page. The SERVICE key must never go near it.
    supabase_publishable_key: str = ""
    supabase_storage_bucket: str = "library"

    # Who may use the admin panel: a comma-separated list of email addresses,
    # matched against the verified JWT. Empty means nobody, deliberately —
    # a missing setting must never mean "everyone".
    admin_emails: str = ""

    youtube_api_key: str = ""
    google_play_service_account_json: str = ""
    android_package_name: str = "com.freementor.app"

    # Demo delivery for consent codes: the API echoes the code back so the
    # flow can be exercised without an email or SMS subscription. Ignored
    # outside local/development, and assert_safe() refuses production.
    otp_echo: bool = True

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def uses_sqlite(self) -> bool:
        return not self.database_url

    @property
    def sqlalchemy_url(self) -> str:
        if self.database_url:
            # SQLAlchemy's async driver name differs from the one Supabase prints.
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return "sqlite+aiosqlite:///./freementor-local.db"

    @property
    def admin_email_set(self) -> frozenset[str]:
        """Lower-cased, blanks dropped. Fails closed: no setting, no admins."""
        return frozenset(
            part.strip().lower() for part in self.admin_emails.split(",") if part.strip()
        )

    @property
    def verifies_real_tokens(self) -> bool:
        return bool(self.supabase_jwt_secret)

    def assert_safe(self) -> None:
        """Refuse to start a production server that is missing its secrets."""
        if not self.is_production:
            return
        missing = [
            name
            for name, value in (
                ("DATABASE_URL", self.database_url),
                ("SUPABASE_JWT_SECRET", self.supabase_jwt_secret),
                ("SUPABASE_URL", self.supabase_url),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                "ENVIRONMENT=production but these are unset: "
                + ", ".join(missing)
                + ". Refusing to start with the local stubs guarding real data."
            )
        if self.otp_echo:
            raise RuntimeError(
                "OTP_ECHO is on in production. That returns the consent code "
                "in the API response, so anyone could approve themselves. "
                "Set OTP_ECHO=false and configure a real sender."
            )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.assert_safe()
    return settings
