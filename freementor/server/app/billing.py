"""The billing rules — product plan §10.1, §10.3, §10.4.

Pure functions, no database and no network, so every rule can be tested
directly. The router does the I/O; this decides what is allowed.

Two things live here that are easy to get wrong elsewhere:

  * which Play product a coupon maps to. The app must never compute a price;
    it launches a product id the server chose, and the price is whatever that
    product costs in the Play Console. That is the only arrangement where a
    tampered client cannot buy Premium for a 90% discount it was not given.
  * whether a coupon is usable *right now*. Four separate conditions, and
    "valid" is not the same as "spent" — validating a code must never consume
    it, or a learner who checks a code and then changes their mind has burned
    a use.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
import re

# §10.3: six uppercase letters then three digits, e.g. TOPPER426.
COUPON_PATTERN = re.compile(r"^[A-Z]{6}[0-9]{3}$")

# §10.3. Each maps to a product that must already exist in the Play Console.
DISCOUNT_TIERS = (10, 20, 30, 50, 70, 90)

PLANS = ("basic", "premium")

# §10.1: Basic -> Premium is its own product, priced at the difference.
UPGRADE_PRODUCT = "upgrade_basic_to_premium"


def normalise_code(raw: str) -> str:
    """Trims and upper-cases. A learner typing 'topper426' means TOPPER426."""
    return raw.strip().upper().replace(" ", "")


def product_id(plan: str, tier: int | None = None) -> str:
    """`premium_off50`, or `premium` at full price. Mirrors the app's
    playProductId() — the app uses it only to display, never to decide."""
    return f"{plan}_off{tier}" if tier else plan


def all_product_ids() -> list[str]:
    """Everything that has to exist in the Play Console before launch."""
    ids = [*PLANS, UPGRADE_PRODUCT]
    for plan in PLANS:
        ids.extend(product_id(plan, tier) for tier in DISCOUNT_TIERS)
    return ids


class CouponProblem(str, Enum):
    MALFORMED = "malformed"
    NOT_FOUND = "not_found"
    NOT_ACTIVE = "not_active"
    NOT_STARTED = "not_started"
    EXPIRED = "expired"
    USED_UP = "used_up"
    BAD_TIER = "bad_tier"


# What the learner is told. Deliberately specific: "this code has expired" and
# "this code has been fully claimed" are different situations and lumping them
# into "invalid code" invites support messages we cannot answer.
COUPON_MESSAGES: dict[CouponProblem, str] = {
    CouponProblem.MALFORMED: "Coupon codes are six letters then three numbers, like TOPPER426.",
    CouponProblem.NOT_FOUND: "We do not recognise that code.",
    CouponProblem.NOT_ACTIVE: "That code is no longer active.",
    CouponProblem.NOT_STARTED: "That code is not valid yet.",
    CouponProblem.EXPIRED: "That code has expired.",
    CouponProblem.USED_UP: "That code has been fully claimed.",
    CouponProblem.BAD_TIER: "That code is misconfigured. Please contact support.",
}


@dataclass(frozen=True)
class CouponState:
    """Just the fields the rules need, so this stays testable without a row."""

    discount_tier: int
    status: str
    used_count: int
    max_uses: int | None
    valid_from: datetime | None
    valid_to: datetime | None


@dataclass(frozen=True)
class CouponCheck:
    ok: bool
    problem: CouponProblem | None = None
    tier: int | None = None

    @property
    def message(self) -> str:
        return "" if self.problem is None else COUPON_MESSAGES[self.problem]


def _aware(value: datetime) -> datetime:
    """Postgres gives tz-aware datetimes; SQLite gives naive ones. Comparing
    the two raises, which would surface as a 500 on a valid coupon."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def check_code_format(raw: str) -> bool:
    return bool(COUPON_PATTERN.match(normalise_code(raw)))


def check_coupon(
    coupon: CouponState | None,
    *,
    now: datetime | None = None,
) -> CouponCheck:
    """Whether a coupon may be used right now.

    Does NOT consume it. Spending a use happens when a purchase is recorded,
    so checking a code costs nothing.
    """
    moment = now or datetime.now(timezone.utc)

    if coupon is None:
        return CouponCheck(False, CouponProblem.NOT_FOUND)
    if coupon.status != "active":
        return CouponCheck(False, CouponProblem.NOT_ACTIVE)
    if coupon.valid_from and moment < _aware(coupon.valid_from):
        return CouponCheck(False, CouponProblem.NOT_STARTED)
    if coupon.valid_to and moment > _aware(coupon.valid_to):
        return CouponCheck(False, CouponProblem.EXPIRED)
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return CouponCheck(False, CouponProblem.USED_UP)
    if coupon.discount_tier not in DISCOUNT_TIERS:
        # A row that violated the check constraint, or a tier retired later.
        # Refusing is right: the discounted Play product may not exist.
        return CouponCheck(False, CouponProblem.BAD_TIER)

    return CouponCheck(True, tier=coupon.discount_tier)


# --- what a purchase grants -------------------------------------------------


@dataclass(frozen=True)
class PurchaseState:
    plan: str
    purchase_state: str


def plan_from_product(product: str) -> str | None:
    """The plan a Play product grants, or None if we do not sell it.

    Checked rather than inferred from a prefix: `premium_off50` and `premium`
    both grant premium, but an unknown id must not be allowed to grant
    anything at all.
    """
    if product == UPGRADE_PRODUCT:
        return "premium"
    for plan in PLANS:
        if product == plan or any(product == product_id(plan, t) for t in DISCOUNT_TIERS):
            return plan
    return None


def entitlement_from(purchases: list[PurchaseState]) -> str | None:
    """The best plan a learner actually holds, or None.

    Premium outranks Basic, so buying the upgrade after Basic reads as
    premium. Only confirmed purchases count — a pending one grants nothing,
    which is the whole reason the state is stored.
    """
    held = {p.plan for p in purchases if p.purchase_state == "confirmed"}
    if "premium" in held:
        return "premium"
    if "basic" in held:
        return "basic"
    return None
