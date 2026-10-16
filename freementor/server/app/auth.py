"""Who is calling.

The app signs in with Supabase and sends its JWT. We verify that token and map
it to our own users row; we never hold a password and never mint a token.

In local mode (no SUPABASE_JWT_SECRET) an unsigned stub token is accepted so
the API can be exercised before any cloud account exists. config.assert_safe()
refuses to start a production server in that state, so this cannot be what
guards real data.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

# PyJWT, not python-jose. python-jose 3.3.0 carried six advisories, two of
# them with no fixed version published, and it is the library that validates
# every learner's token — the worst possible place for an unmaintained
# dependency. Two of the advisories matter here directly: algorithm confusion
# (CVE-2024-33663) and a decompression denial of service (CVE-2024-33664).
#
# The swap is small because only HS256 symmetric verification of a Supabase
# JWT is needed: `decode` takes the same arguments, and `PyJWTError` is the
# base exception where `JWTError` was. Both `algorithms=` and `audience=` are
# passed explicitly, which is what closes algorithm confusion regardless of
# library.
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import User

LOCAL_TOKEN_PREFIX = "local:"


@dataclass(frozen=True)
class Principal:
    """The verified caller: their Supabase id and email."""

    auth_id: str
    email: str


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def verify_token(token: str, settings: Settings) -> Principal:
    if settings.verifies_real_tokens:
        try:
            claims = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except PyJWTError as error:
            raise _unauthorised(f"Invalid token: {error}") from error

        auth_id = claims.get("sub")
        if not auth_id:
            raise _unauthorised("Token has no subject")
        # `or ""`, not `.get("email", "")`: a token can carry `"email": null`
        # — Supabase omits it for some providers — and `.get` with a default
        # returns None for a key that is present and null. `Principal.email`
        # is typed `str`, and the one place that reads it does
        # `principal.email.strip().lower()`, so a None reached the admin check
        # as an AttributeError: a 500 where a 403 belonged.
        return Principal(auth_id=auth_id, email=claims.get("email") or "")

    # Local mode: "local:<auth_id>:<email>"
    if not token.startswith(LOCAL_TOKEN_PREFIX):
        raise _unauthorised("Local mode expects a 'local:<id>:<email>' token")
    parts = token[len(LOCAL_TOKEN_PREFIX) :].split(":", 1)
    if not parts[0]:
        raise _unauthorised("Local token has no id")
    return Principal(
        auth_id=as_uuid(parts[0]),
        email=parts[1] if len(parts) > 1 else "",
    )


def as_uuid(value: str) -> str:
    """A local token's id, coerced to a real UUID.

    `users.auth_id` is `Uuid(as_uuid=False)`. A real Supabase `sub` is always
    a UUID, so the signed path is fine — but the local stub takes whatever
    string is in the token, and `local:dev:me@example.com` happily wrote
    `"dev"` into a UUID column. SQLite accepts it on the way in and then
    raises `ValueError: badly formed hexadecimal UUID string` on the way out,
    so one convenient token permanently 500s every later read of that table.

    Found by curling the running server with `local:aaaa-1:...`, not by the
    suite: tests/conftest.py already hashes its names through `uuid5`, so the
    tests only ever send well-formed ids and structurally cannot catch this.
    The same `uuid5` is used here, which also means the mapping is stable —
    one token always lands on the same users row, as before.

    This is the third bug of this shape (see CLAUDE.md on `Uuid` vs
    `String(36)` and `JSONCol` vs `Text`): SQLite's permissiveness on write
    hides a type error until something reads it back.
    """
    try:
        return str(uuid.UUID(value))
    except ValueError:
        return str(uuid.uuid5(uuid.NAMESPACE_URL, f"freementor-local/{value}"))


async def current_principal(
    authorization: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> Principal:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorised("Expected an 'Authorization: Bearer <token>' header")
    return verify_token(token, settings)


async def current_user(
    principal: Principal = Depends(current_principal),
    session: AsyncSession = Depends(get_session),
) -> User:
    """The caller's users row, created on first sight.

    Sign-in is the only thing that happens before consent, so this row holds
    nothing but the identity until the learner supplies more (§15).
    """
    result = await session.execute(select(User).where(User.auth_id == principal.auth_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(auth_id=principal.auth_id, email=principal.email)
        session.add(user)
        await session.commit()
        await session.refresh(user)
    elif user.deleted_at is not None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This account is scheduled for deletion."
        )

    return user
