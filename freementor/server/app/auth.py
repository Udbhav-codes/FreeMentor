"""Who is calling.

The app signs in with Supabase and sends its JWT. We verify that token and map
it to our own users row; we never hold a password and never mint a token.

In local mode (no SUPABASE_JWT_SECRET) an unsigned stub token is accepted so
the API can be exercised before any cloud account exists. config.assert_safe()
refuses to start a production server in that state, so this cannot be what
guards real data.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
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
        except JWTError as error:
            raise _unauthorised(f"Invalid token: {error}") from error

        auth_id = claims.get("sub")
        if not auth_id:
            raise _unauthorised("Token has no subject")
        return Principal(auth_id=auth_id, email=claims.get("email", ""))

    # Local mode: "local:<auth_id>:<email>"
    if not token.startswith(LOCAL_TOKEN_PREFIX):
        raise _unauthorised("Local mode expects a 'local:<id>:<email>' token")
    parts = token[len(LOCAL_TOKEN_PREFIX) :].split(":", 1)
    if not parts[0]:
        raise _unauthorised("Local token has no id")
    return Principal(auth_id=parts[0], email=parts[1] if len(parts) > 1 else "")


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
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is scheduled for deletion.")

    return user
