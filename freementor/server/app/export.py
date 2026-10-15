"""What a learner's data export contains — and what it must never contain.

The privacy policy promises this twice, once in the summary and once with the
exact menu path ("Profile -> Account -> Export my progress"), so it is a
commitment in a published document rather than a nice-to-have.

Under the DPDP Act 2023 the relevant right is **section 11**, the right to
access information about one's own personal data. Note that data portability
was in the 2019 Bill and did **not** survive into the 2023 Act — so the legal
floor here is a readable summary, not a machine-readable transfer format. We
give the machine-readable version anyway because it costs nothing extra and is
plainly more useful.

## Pure on purpose

Nothing here touches the database. The route fetches rows, this module decides
what is published. That split is what makes "the OTP hash never leaves the
server" a unit test rather than a hope.

## Three exclusion rules, and why each exists

1. **Secrets stay behind.** `parent_consents.code_hash` is a hashed OTP. It is
   not the learner's personal data in any useful sense, and an export is a
   file that gets emailed, backed up and left in a Downloads folder. Shipping
   a password-equivalent inside it would be the single worst thing this
   feature could do.
2. **Other people's data stays behind.** A coupon's `created_by` is an
   administrator. An audit row's `actor_id` may be someone else entirely. An
   export is scoped to one person; it must not become a way to enumerate
   staff.
3. **Internal identifiers that mean nothing to the learner stay behind** where
   leaving them out loses nothing — `library_version_id`, `coupon_id`. Row ids
   the learner might need to correlate (enrollment id) are kept.

Everything else the learner gave us, or that we derived about their studying,
goes in.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.models import (
    ConfidenceRating,
    Enrollment,
    Goal,
    NotificationPrefs,
    ParentConsent,
    Purchase,
    RestDay,
    Schedule,
    Streak,
    TaskProgress,
    TestScore,
    User,
)

#: Bumped when the shape changes. An export sitting in somebody's Downloads
#: folder for two years should still say what it is.
FORMAT_VERSION = 1

#: Columns that must never appear in an export, whatever is added to the
#: models later. Asserted against the real output in the tests, so a new
#: secret-bearing column fails the build rather than leaking quietly.
NEVER_EXPORTED = frozenset(
    {
        "code_hash",  # a hashed OTP — see rule 1 above
        "created_by",  # an administrator's id
        "actor_id",  # may be somebody other than the learner
        "auth_id",  # the Supabase subject; an internal join key
        "coupon_id",
        "library_version_id",
    }
)


def _decimal_str(value: Decimal) -> str:
    """A Decimal as its exact value, in the same form on every backend.

    Two separate problems here, and both are easy to get wrong:

    `str()` alone carries the column's *scale*, which is not the same across
    databases. SQLite hands back `Decimal("599.0000000000")` for a price
    stored as 599.00 while Postgres returns what was inserted, so a plain
    `str()` would make the exported price depend on which database the server
    happens to be running — the same class of divergence as the `JSONCol` and
    `Uuid` bugs that have already shipped here. Normalising first removes the
    padding without touching the value.

    `float()` would be worse: it is the quiet precision change, in a document
    somebody may hand to us back in support of a refund claim.

    `normalize()` on its own is not enough either, because it produces
    exponent form for round numbers — `Decimal("599.00").normalize()` is
    `5.99E+2`. Hence the re-quantize and the explicit `f` format.
    """
    normalized = value.normalize()
    _, _, exponent = normalized.as_tuple()
    if isinstance(exponent, int) and exponent > 0:
        normalized = normalized.quantize(Decimal(1))
    return format(normalized, "f")


def _plain(value: Any) -> Any:
    """JSON-safe, and lossless for the types the models actually use."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return _decimal_str(value)
    return value


def _row(obj: object, fields: tuple[str, ...]) -> dict[str, Any]:
    return {name: _plain(getattr(obj, name)) for name in fields}


def account_section(user: User) -> dict[str, Any]:
    return _row(
        user,
        (
            "id",
            "email",
            "name",
            "birth_year",
            "gender",
            "qualification",
            "language",
            "is_minor",
            "created_at",
            "deleted_at",
        ),
    ) | {
        # The stored value is a Storage path, and the signed URL for it
        # expires in an hour — putting that URL in a file somebody keeps would
        # produce a broken image tomorrow. The path says a photo exists and
        # where it lives; `/account/photo` mints a fresh URL on demand.
        "photo_path": user.photo_url,
    }


def consent_section(consents: list[ParentConsent]) -> list[dict[str, Any]]:
    """Parental consent records.

    The parent's contact detail is personal data belonging to the parent, not
    the learner — but the learner supplied it, it is held against their
    account, and withholding it would make the export misleading about what we
    store. It is included; the OTP hash is not.
    """
    return [
        _row(c, ("id", "parent_contact", "method", "consented_at", "revoked_at", "created_at"))
        for c in consents
    ]


def enrollment_section(
    enrollment: Enrollment,
    *,
    goal: Goal | None,
    schedules: list[Schedule],
    task_progress: list[TaskProgress],
    ratings: list[ConfidenceRating],
    scores: list[TestScore],
    rest_days: list[RestDay],
) -> dict[str, Any]:
    """One roadmap the learner enrolled in, with everything they did in it."""
    return {
        **_row(
            enrollment,
            ("id", "goal_id", "start_date", "target_date", "status", "created_at"),
        ),
        # Not personal data, but an export naming only "jee-main" is far less
        # use to a person than one that also says "JEE Main".
        "goal_name": goal.name if goal else None,
        "study_settings": [
            _row(
                s,
                (
                    "mode",
                    "minutes_by_weekday",
                    "study_time",
                    "study_place",
                    "language",
                    "selected_subjects",
                    "effective_from",
                ),
            )
            for s in schedules
        ],
        "completed_tasks": [
            _row(t, ("block_id", "scheduled_date", "completed_at", "minutes_credited"))
            for t in task_progress
        ],
        "confidence_ratings": [
            _row(r, ("topic_id", "level", "rated_at", "next_review_on")) for r in ratings
        ],
        "test_scores": [
            _row(s, ("block_or_milestone_id", "score", "max_score", "taken_at"))
            for s in scores
        ],
        "rest_days": [_plain(r.date) for r in rest_days],
    }


def purchase_section(purchases: list[Purchase]) -> list[dict[str, Any]]:
    """Payment records.

    Kept for 8 years for tax, as the privacy policy says, and so retained
    through an account purge. The learner is entitled to see them.
    """
    return [
        _row(
            p,
            (
                "id",
                "enrollment_id",
                "play_order_id",
                "product_id",
                "plan",
                "price_paid",
                "purchase_state",
                "created_at",
            ),
        )
        for p in purchases
    ]


def build_export(
    *,
    user: User,
    consents: list[ParentConsent],
    enrollments: list[dict[str, Any]],
    purchases: list[Purchase],
    streak: Streak | None,
    prefs: NotificationPrefs | None,
    generated_at: datetime,
) -> dict[str, Any]:
    """Assemble the whole document.

    `enrollments` arrives already built by `enrollment_section`, because the
    route is what knows how to query; this function only arranges.
    """
    return {
        "_meta": {
            "format_version": FORMAT_VERSION,
            "generated_at": _plain(generated_at),
            "service": "FreeMentor",
            "what_this_is": (
                "Everything FreeMentor holds about you, as JSON. Your roadmap "
                "files are not included — they are our published library, the "
                "same for every learner, not data about you."
            ),
            "what_is_left_out": (
                "Security values such as the hashed one-time code used to "
                "confirm parental consent, and identifiers belonging to other "
                "people such as the administrator who created a coupon."
            ),
        },
        "account": account_section(user),
        "parent_consent": consent_section(consents),
        "streak": (
            _row(streak, ("current", "best", "last_study_date", "grace_used_on"))
            if streak
            else None
        ),
        "notification_preferences": (
            _row(
                prefs,
                ("daily", "study", "weekly_report", "streak", "test", "quiet_from", "quiet_to"),
            )
            if prefs
            else None
        ),
        "roadmaps": enrollments,
        "purchases": purchase_section(purchases),
    }


def walk_keys(value: Any) -> list[str]:
    """Every key name anywhere in the document, for the exclusion tests."""
    found: list[str] = []
    if isinstance(value, dict):
        for key, inner in value.items():
            found.append(key)
            found.extend(walk_keys(inner))
    elif isinstance(value, list):
        for inner in value:
            found.extend(walk_keys(inner))
    return found
