"""One-time codes for verifiable parental consent.

The delivery channel is swappable — today a console sender that prints the
code, tomorrow an email or SMS provider once there is a subscription. What is
NOT deferred is how the code is stored and checked, because that is the part
that quietly becomes production. A demo that keeps plaintext codes with no
expiry and no attempt limit is how a hole ships.

So, even in demo mode:

  - the code is **hashed** before storage, never kept in plaintext
  - it **expires** (10 minutes)
  - **attempts are capped** (5), after which the code is dead
  - comparison is **constant-time**
  - re-requests are **rate limited**, so a parent cannot be spammed through us

This covers DPDP's "verifiable parental consent" (§15) in mechanism. Whether a
6-digit code to a parent's email is *sufficient* verification is a legal
question for the grievance officer, not an engineering one — see the note in
docs/FreeMentor_Product_Plan.md §19.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

CODE_LENGTH = 6
TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5
# A parent should not receive a code every few seconds because a bored
# teenager keeps tapping the button.
RESEND_INTERVAL = timedelta(seconds=60)


def generate_code() -> str:
    """A 6-digit code from a cryptographic source.

    secrets, not random: the module default is a Mersenne twister, which is
    predictable from previous outputs.
    """
    return "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))


def hash_code(code: str, salt: str) -> str:
    """Salted SHA-256. The salt is the consent row's id, so two consent
    requests holding the same code do not produce the same hash."""
    return hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()


def codes_match(supplied: str, stored_hash: str, salt: str) -> bool:
    """Constant-time comparison — a plain == leaks the position of the first
    wrong digit through timing."""
    return hmac.compare_digest(hash_code(supplied.strip(), salt), stored_hash)


@dataclass(frozen=True)
class Attempt:
    ok: bool
    reason: str = ""


def check(
    *,
    supplied: str,
    stored_hash: str | None,
    salt: str,
    expires_at: datetime | None,
    attempts: int,
    now: datetime | None = None,
) -> Attempt:
    """Everything that decides whether a code is accepted, in one testable place."""
    now = now or datetime.now(timezone.utc)

    if not stored_hash or not expires_at:
        return Attempt(False, "No code has been requested.")

    if attempts >= MAX_ATTEMPTS:
        return Attempt(False, "Too many attempts. Request a new code.")

    # Expiry is checked before the code itself, so an expired code cannot be
    # brute-forced indefinitely.
    if _aware(expires_at) < now:
        return Attempt(False, "That code has expired. Request a new one.")

    if not supplied.strip().isdigit() or len(supplied.strip()) != CODE_LENGTH:
        return Attempt(False, f"Enter the {CODE_LENGTH}-digit code.")

    if not codes_match(supplied, stored_hash, salt):
        return Attempt(False, "That code is not right.")

    return Attempt(True)


def may_resend(last_sent_at: datetime | None, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    if last_sent_at is None:
        return True
    return _aware(last_sent_at) + RESEND_INTERVAL <= now


def expiry_from(now: datetime | None = None) -> datetime:
    return (now or datetime.now(timezone.utc)) + TTL


def _aware(value: datetime) -> datetime:
    """SQLite hands back naive datetimes; Postgres gives aware ones."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------- delivery --


class Sender:
    """How a code reaches the parent. Swap the implementation, not the flow."""

    name = "base"

    async def send(self, contact: str, code: str, method: str) -> None:
        raise NotImplementedError


class ConsoleSender(Sender):
    """Demo delivery: prints the code to the server log.

    Deliberately useless in production — it reaches nobody. main.py refuses to
    start a production server that is still using it.
    """

    name = "console"

    async def send(self, contact: str, code: str, method: str) -> None:
        print(f"[otp] would send {code} to {contact} by {method}")


def get_sender(environment: str) -> Sender:
    # When an email/SMS subscription exists, select it here on the
    # environment or a provider setting. Nothing else has to change.
    return ConsoleSender()
