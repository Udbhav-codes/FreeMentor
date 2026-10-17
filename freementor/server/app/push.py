"""Push notifications — Firebase Cloud Messaging, and the rules around it.

Same shape as `otp.Sender` and `play.Verifier`, for the same reason: there is
no Firebase project yet, and a stub that pretends to deliver is worse than one
that says it cannot. `FcmSender` raises rather than silently dropping
messages; `ConsoleSender` prints them so the flow can be exercised today;
`config.assert_safe()` refuses a production server still on the console one.

## What the server sends, and what it does not

The app already schedules the **daily study reminder locally** (see
`notifications/daily.ts`), and that must stay local: it has to fire with no
network, and a server-driven daily reminder for a learner who has been offline
for a week would be both wrong and annoying. FCM is for the things only the
server knows — a trial about to expire, a weekly report that has been
generated, a purchase acknowledged on another device.

## Why quiet hours are enforced here as well as on the phone

`notifications/quiet.ts` already suppresses local notifications. A push
arrives from outside the app, so nothing on the phone gets a say — the only
place that can honour quiet hours for a push is the sender. The rule is
duplicated deliberately and the two are kept identical; `quiet_hours` below is
a direct port, including the midnight wrap.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum


class Category(str, Enum):
    """Which preference switch governs a message.

    Mirrors the columns on `notification_prefs`, so a new category has to be
    given a switch rather than quietly bypassing the learner's choices.
    """

    DAILY = "daily"
    STUDY = "study"
    WEEKLY_REPORT = "weekly_report"
    STREAK = "streak"
    TEST = "test"


@dataclass(frozen=True)
class Message:
    title: str
    body: str
    category: Category
    #: Delivered to the app as FCM `data`; used to route a tap.
    data: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Decision:
    """Whether a message may be sent, and why not when it may not."""

    send: bool
    reason: str = ""


def is_quiet(hour: int, quiet_from: int | None, quiet_to: int | None) -> bool:
    """A direct port of the app's notifications/quiet.ts.

    Quiet hours usually wrap midnight (22 -> 7), which is why this is not a
    simple range test. Kept identical to the app's version on purpose: a
    learner who sets 22:00-07:00 should get the same silence from a push as
    from a local reminder.
    """
    if quiet_from is None or quiet_to is None:
        return False
    if quiet_from > quiet_to:
        return hour >= quiet_from or hour < quiet_to
    return quiet_from <= hour < quiet_to


def may_send(
    message: Message,
    *,
    prefs: dict[str, object] | None,
    local_hour: int,
) -> Decision:
    """The whole policy, pure so it is testable without a device or Firebase.

    `prefs` is the learner's `notification_prefs` row as a dict, or None when
    they have never set any — in which case the defaults apply and everything
    is on, matching the column defaults.
    """
    if prefs is None:
        prefs = {}

    if prefs.get(message.category.value, True) is False:
        return Decision(False, f"the learner turned off {message.category.value}")

    if is_quiet(
        local_hour,
        prefs.get("quiet_from"),  # type: ignore[arg-type]
        prefs.get("quiet_to"),  # type: ignore[arg-type]
    ):
        return Decision(False, "quiet hours")

    return Decision(True)


class Sender:
    """Delivers a message to one device token."""

    async def send(self, token: str, message: Message) -> None:  # pragma: no cover
        raise NotImplementedError


class ConsoleSender(Sender):
    """Prints instead of delivering. Local and development only."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, Message]] = []

    async def send(self, token: str, message: Message) -> None:
        self.sent.append((token, message))
        print(
            f"[push:console] -> {token[:12]}… [{message.category.value}] "
            f"{message.title} — {message.body}"
        )


class FcmSender(Sender):
    """The real one.

    Deliberately raises rather than pretending. Delivering nothing while
    reporting success is the failure mode that goes unnoticed for weeks, and
    a push system nobody notices is broken is worse than one that is loudly
    absent.

    Implementing this needs a Firebase project and a service account with the
    Cloud Messaging scope, then an HTTP v1 POST to
    `/v1/projects/<id>/messages:send` with an OAuth2 bearer token minted from
    the service account.
    """

    def __init__(self, project_id: str, service_account_json: str) -> None:
        self.project_id = project_id
        self.service_account_json = service_account_json

    async def send(self, token: str, message: Message) -> None:
        raise NotImplementedError(
            "FCM is not wired up yet: it needs a Firebase project and a service "
            "account. Set FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT_JSON, "
            "then implement the HTTP v1 call here."
        )


def get_sender(environment: str, project_id: str, service_account_json: str) -> Sender:
    """The sender for this environment.

    Production with real credentials gets FCM; anything else gets the console.
    `config.assert_safe()` is what stops production reaching the console one.
    """
    if project_id and service_account_json:
        return FcmSender(project_id, service_account_json)
    return ConsoleSender()


def local_hour(now: datetime | None = None, utc_offset_minutes: int = 330) -> int:
    """The learner's local hour.

    Defaults to +05:30. We do not store a timezone per learner, and India is
    the entire launch market — so this is a deliberate simplification rather
    than an oversight, and the place to change when that stops being true.
    """
    now = now or datetime.now(timezone.utc)
    minutes = now.hour * 60 + now.minute + utc_offset_minutes
    return (minutes // 60) % 24
