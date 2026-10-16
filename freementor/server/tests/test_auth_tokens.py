"""Real JWT verification — the branch that guards every learner's data.

## Why this file was missing, and why that mattered

The whole suite runs in *local mode*: no `SUPABASE_JWT_SECRET`, so
`verify_token` takes its stub branch and accepts `local:<id>:<email>`. That
made the API testable before any cloud account existed, which was the right
call — but it meant the branch that actually validates a signed token had no
tests at all. 261 passing tests and the one function standing between a
stranger and every learner's account was exercised by none of them.

The library swap (python-jose -> PyJWT) is what surfaced it: there was nothing
to run to find out whether the swap had broken verification.

## What is actually being asserted

Not "does a good token work" — that is the easy half. The half that matters is
that each specific forgery is refused:

  * the `alg: none` unsigned token, the oldest JWT attack there is
  * a token signed with the wrong key
  * a token whose payload was edited after signing
  * algorithm confusion, which is one of the two CVEs that prompted the swap
  * an expired token, and one for a different audience

Each is written as a token this test constructs itself, so it fails if
`verify_token` ever stops passing `algorithms=` or `audience=` explicitly.
"""

from __future__ import annotations

import time
import uuid

import jwt
import pytest
from fastapi import HTTPException

from app.auth import LOCAL_TOKEN_PREFIX, verify_token
from app.config import Settings

SECRET = "test-jwt-secret-not-a-real-one-padded-to-32-bytes"
WRONG_SECRET = "also-not-real-but-different-and-also-32-bytes"
SUBJECT = "11111111-2222-3333-4444-555555555555"


def real_mode(secret: str = SECRET) -> Settings:
    """Settings that make verify_token take its real branch."""
    settings = Settings(
        supabase_jwt_secret=secret,
        supabase_url="https://demo.supabase.co",
        database_url="postgresql://user:pw@host/db",
    )
    assert settings.verifies_real_tokens, "fixture did not enable real verification"
    return settings


def claims(**over: object) -> dict[str, object]:
    now = int(time.time())
    base: dict[str, object] = {
        "sub": SUBJECT,
        "email": "learner@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
    }
    base.update(over)
    return base


def signed(secret: str = SECRET, algorithm: str = "HS256", **over: object) -> str:
    return jwt.encode(claims(**over), secret, algorithm=algorithm)


class TestAValidToken:
    def test_is_accepted_and_its_claims_are_read(self) -> None:
        principal = verify_token(signed(), real_mode())
        assert principal.auth_id == SUBJECT
        assert principal.email == "learner@example.com"

    def test_a_null_email_claim_becomes_an_empty_string(self) -> None:
        # Supabase omits `email` for some providers, and a present-but-null
        # claim defeats `.get("email", "")`. `Principal.email` is typed
        # `str` and the admin check calls `.strip()` on it, so a None got
        # there as an AttributeError — a 500 where a 403 belonged.
        principal = verify_token(signed(email=None), real_mode())
        assert principal.auth_id == SUBJECT
        assert principal.email == ""
        # The call that used to raise.
        assert principal.email.strip().lower() == ""


class TestForgeries:
    """Each of these must be refused. This is the whole point of the file."""

    def test_an_unsigned_alg_none_token_is_refused(self) -> None:
        # The oldest JWT attack: strip the signature and set alg to "none".
        # Refused because verify_token passes algorithms=["HS256"], so "none"
        # is simply not on the list.
        forged = jwt.encode(claims(), key="", algorithm="none")
        with pytest.raises(HTTPException) as error:
            verify_token(forged, real_mode())
        assert error.value.status_code == 401

    def test_a_token_signed_with_the_wrong_key_is_refused(self) -> None:
        with pytest.raises(HTTPException) as error:
            verify_token(signed(secret=WRONG_SECRET), real_mode())
        assert error.value.status_code == 401

    def test_a_token_whose_payload_was_edited_is_refused(self) -> None:
        # Swap the subject for somebody else's and keep the signature.
        header, payload, signature = signed().split(".")
        other = jwt.encode(claims(sub="99999999-9999-9999-9999-999999999999"), SECRET)
        _, other_payload, _ = other.split(".")
        tampered = f"{header}.{other_payload}.{signature}"
        with pytest.raises(HTTPException) as error:
            verify_token(tampered, real_mode())
        assert error.value.status_code == 401

    def test_an_expired_token_is_refused(self) -> None:
        now = int(time.time())
        with pytest.raises(HTTPException) as error:
            verify_token(signed(exp=now - 10, iat=now - 3600), real_mode())
        assert error.value.status_code == 401

    def test_a_token_for_a_different_audience_is_refused(self) -> None:
        # A Supabase project issues tokens for several audiences; only
        # "authenticated" is a signed-in learner. Refused because
        # verify_token passes audience= explicitly.
        with pytest.raises(HTTPException) as error:
            verify_token(signed(aud="anon"), real_mode())
        assert error.value.status_code == 401

    def test_a_token_with_no_subject_is_refused(self) -> None:
        # Correctly signed, but identifies nobody — so it must not be
        # accepted as somebody.
        with pytest.raises(HTTPException) as error:
            verify_token(signed(sub=None), real_mode())
        assert error.value.status_code == 401
        assert "subject" in str(error.value.detail).lower()

    def test_rubbish_is_refused_rather_than_crashing(self) -> None:
        for rubbish in ("", "not.a.token", "a.b", "...", "Bearer x", "null"):
            with pytest.raises(HTTPException) as error:
                verify_token(rubbish, real_mode())
            assert error.value.status_code == 401, rubbish

    def test_the_local_stub_token_is_refused_in_real_mode(self) -> None:
        # The most dangerous confusion of the two modes: a stub token must
        # never be honoured by a server that verifies real ones, or local mode
        # becomes a universal skeleton key.
        stub = f"{LOCAL_TOKEN_PREFIX}{SUBJECT}:learner@example.com"
        with pytest.raises(HTTPException) as error:
            verify_token(stub, real_mode())
        assert error.value.status_code == 401

    def test_every_refusal_carries_the_www_authenticate_header(self) -> None:
        with pytest.raises(HTTPException) as error:
            verify_token("garbage", real_mode())
        assert error.value.headers is not None
        assert error.value.headers.get("WWW-Authenticate") == "Bearer"


class TestAlgorithmConfusion:
    """One of the two CVEs that prompted leaving python-jose behind."""

    def test_an_asymmetrically_signed_token_is_refused(self) -> None:
        # The attack shape: sign with RS256 using a key the attacker controls
        # and hope the server will verify it with whatever algorithm the token
        # declares. Refused because the algorithm list is fixed server-side.
        from cryptography.hazmat.primitives.asymmetric import rsa

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        forged = jwt.encode(claims(), key, algorithm="RS256")

        with pytest.raises(HTTPException) as error:
            verify_token(forged, real_mode())
        assert error.value.status_code == 401

    def test_the_server_chooses_the_algorithm_not_the_token(self) -> None:
        # Stated as a test so it cannot be quietly loosened: HS512 is a
        # perfectly good algorithm and is still refused, because the server
        # accepts exactly one.
        with pytest.raises(HTTPException):
            verify_token(signed(algorithm="HS512"), real_mode())


class TestLocalMode:
    """The stub branch, which is what the rest of the suite runs on."""

    def test_accepts_the_documented_stub_shape(self) -> None:
        principal = verify_token(
            f"{LOCAL_TOKEN_PREFIX}abc:dev@example.com", Settings()
        )
        # Not "abc": the id is coerced to a UUID so it satisfies the
        # users.auth_id column type. See TestLocalTokenIdsAreUsable below.
        assert uuid.UUID(principal.auth_id)
        assert principal.email == "dev@example.com"

    def test_refuses_anything_that_is_not_the_stub_shape(self) -> None:
        # Including a real signed token: local mode cannot check it, so
        # accepting it would mean accepting it unverified.
        for bad in ("abc:dev@example.com", signed(), "", "local:"):
            with pytest.raises(HTTPException):
                verify_token(bad, Settings())

    def test_a_production_server_can_never_be_in_local_mode(self) -> None:
        # The guarantee that makes the stub branch acceptable at all.
        with pytest.raises(RuntimeError, match="Refusing to start"):
            Settings(environment="production").assert_safe()

class TestLocalTokenIdsAreUsable:
    """A local token's id has to satisfy the users.auth_id column.

    That column is `Uuid(as_uuid=False)`. A real Supabase `sub` always is a
    UUID; the local stub takes whatever is in the token, so
    `local:dev:me@example.com` wrote the string "dev" into a UUID column.
    SQLite accepts that on write and raises on read, so one convenient token
    permanently 500s every later read of the users table — which is exactly
    what happened while curling the running server during this audit.

    These tests exist because conftest.auth_id() already hashes its names
    through uuid5, so the rest of the suite only ever sends well-formed ids
    and cannot catch this.
    """

    def test_an_arbitrary_id_becomes_a_real_uuid(self) -> None:
        import uuid as uuidlib

        principal = verify_token("local:dev:me@example.com", Settings(supabase_jwt_secret=""))
        assert uuidlib.UUID(principal.auth_id)
        assert principal.email == "me@example.com"

    def test_the_mapping_is_stable(self) -> None:
        # One token must keep landing on the same users row, or every request
        # would create a new account.
        settings = Settings(supabase_jwt_secret="")
        first = verify_token("local:dev:me@example.com", settings)
        second = verify_token("local:dev:me@example.com", settings)
        assert first.auth_id == second.auth_id

    def test_different_ids_stay_different(self) -> None:
        settings = Settings(supabase_jwt_secret="")
        a = verify_token("local:alice:a@example.com", settings)
        b = verify_token("local:bob:b@example.com", settings)
        assert a.auth_id != b.auth_id

    def test_an_id_that_is_already_a_uuid_is_left_alone(self) -> None:
        # Normalised, not rewritten: tooling that mints a UUID token must
        # keep hitting the row it expects.
        given = "88f9d7f3-407a-4a5a-8654-6462fa3ba0ad"
        principal = verify_token(f"local:{given}:a@b.c", Settings(supabase_jwt_secret=""))
        assert principal.auth_id == given
