"""Coupons, purchases and what a learner is entitled to — §10.1, §10.3, §10.4.

Three endpoints:

  POST /billing/coupons/validate  — is this code usable, and which Play
                                    product does it map to? Does not spend it.
  POST /billing/purchases         — verify a Play purchase with Google and
                                    record it. Idempotent on the order id.
  GET  /billing/entitlement       — what the learner holds, per enrollment.

The price is never sent by the app and never calculated here. The server
returns a *product id* and Play charges whatever that product costs. A client
that lies about a discount therefore gains nothing: it can only launch a
product the server named.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import billing, play
from app import limits
from app.auth import current_user
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Coupon, Enrollment, Purchase, User

router = APIRouter(prefix="/billing", tags=["billing"])


# --- coupons ----------------------------------------------------------------


class CouponIn(BaseModel):
    code: str
    plan: str = "basic"


class CouponOut(BaseModel):
    code: str
    discount_percent: int
    """The Play product to launch. The app does not compute this."""
    product_id: str
    plan: str


@router.post(
    "/coupons/validate",
    response_model=CouponOut,
    # A coupon is worth up to 90%% off and the code format is a known shape,
    # so this endpoint is a guessing oracle. See app/limits.py.
    dependencies=[Depends(limits.limit(limits.COUPON_VALIDATE))],
)
async def validate_coupon(
    payload: CouponIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> CouponOut:
    if payload.plan not in billing.PLANS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown plan.")

    code = billing.normalise_code(payload.code)
    if not billing.check_code_format(code):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            billing.COUPON_MESSAGES[billing.CouponProblem.MALFORMED],
        )

    row = (
        await session.execute(select(Coupon).where(Coupon.code == code))
    ).scalar_one_or_none()

    check = billing.check_coupon(
        None
        if row is None
        else billing.CouponState(
            discount_tier=row.discount_tier,
            status=row.status,
            used_count=row.used_count,
            max_uses=row.max_uses,
            valid_from=row.valid_from,
            valid_to=row.valid_to,
        )
    )
    if not check.ok or check.tier is None:
        # 404 for an unknown code, 409 for a real code that cannot be used
        # now — the learner can act on the difference.
        code_status = (
            status.HTTP_404_NOT_FOUND
            if check.problem is billing.CouponProblem.NOT_FOUND
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(code_status, check.message)

    return CouponOut(
        code=code,
        discount_percent=check.tier,
        product_id=billing.product_id(payload.plan, check.tier),
        plan=payload.plan,
    )


# --- purchases --------------------------------------------------------------


class PurchaseIn(BaseModel):
    """What Play Billing hands the app after a successful purchase."""

    purchase_token: str
    product_id: str
    enrollment_id: str | None = None
    """Applied only if it is still usable at the moment of purchase."""
    coupon_code: str | None = None


class EntitlementOut(BaseModel):
    """None means nothing is bought — the trial clock decides from here."""

    entitlement: str | None
    plan: str | None = None
    product_id: str | None = None
    order_id: str | None = None


@router.post(
    "/purchases",
    response_model=EntitlementOut,
    status_code=201,
    # Calls out to Google Play, where the quota is ours to protect.
    dependencies=[Depends(limits.limit(limits.PURCHASE))],
)
async def record_purchase(
    payload: PurchaseIn,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> EntitlementOut:
    plan = billing.plan_from_product(payload.product_id)
    if plan is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"We do not sell '{payload.product_id}'.",
        )

    verifier = play.get_verifier(settings)

    # The local verifier accepts a 'test:' token, so in production it would
    # hand out paid plans for free. Guarded here rather than at startup: the
    # server legitimately runs in production before billing goes live — auth,
    # sync and the catalog do not need a Play Console — so refusing to boot
    # would be the wrong trade. Refusing this one endpoint is not.
    if settings.is_production and isinstance(verifier, play.LocalVerifier):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Purchases are not enabled on this server yet.",
        )

    result = await verifier.verify(
        purchase_token=payload.purchase_token, product_id=payload.product_id
    )
    if not result.ok or not result.order_id:
        # 402: the request was well-formed, the payment was not established.
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            result.reason or "Google could not confirm that purchase.",
        )

    # Idempotency. The app retries on a dropped connection, and Play itself
    # can redeliver a purchase, so the same order id must never create a
    # second row or spend a coupon twice.
    existing = (
        await session.execute(select(Purchase).where(Purchase.play_order_id == result.order_id))
    ).scalar_one_or_none()
    if existing is not None:
        if existing.user_id != user.id:
            # Someone else's order id. Not ours to attach to this account.
            raise HTTPException(status.HTTP_409_CONFLICT, "That purchase belongs to another account.")
        return await _entitlement_out(session, user, existing.enrollment_id)

    enrollment_id = payload.enrollment_id
    if enrollment_id:
        owned = (
            await session.execute(
                select(Enrollment).where(
                    Enrollment.id == enrollment_id, Enrollment.user_id == user.id
                )
            )
        ).scalar_one_or_none()
        if owned is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No such enrollment on this account.")

    coupon_id: str | None = None
    if payload.coupon_code:
        coupon_id = await _spend_coupon(session, payload.coupon_code)

    session.add(
        Purchase(
            user_id=user.id,
            enrollment_id=enrollment_id,
            play_order_id=result.order_id,
            product_id=payload.product_id,
            plan=plan,
            coupon_id=coupon_id,
            purchase_state=result.purchase_state or "confirmed",
            acknowledged_at=datetime.now(timezone.utc),
        )
    )

    # §10.1: a paid enrollment is no longer on trial.
    if enrollment_id:
        live = (
            await session.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
        ).scalar_one_or_none()
        if live is not None and live.status == "trial":
            live.status = "active"

    try:
        await session.commit()
    except IntegrityError:
        # Two devices racing the same purchase. The unique index on
        # play_order_id is the arbiter; whoever lost reads the winner's row.
        await session.rollback()
        return await _entitlement_out(session, user, enrollment_id)

    # §10.4: acknowledge within 3 days or Play refunds it. Done after the row
    # is committed, so a crash here leaves a purchase we know about.
    await verifier.acknowledge(
        purchase_token=payload.purchase_token, product_id=payload.product_id
    )

    return await _entitlement_out(session, user, enrollment_id)


@router.get("/entitlement", response_model=EntitlementOut)
async def get_entitlement(
    enrollment_id: str | None = None,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> EntitlementOut:
    return await _entitlement_out(session, user, enrollment_id)


async def _entitlement_out(
    session: AsyncSession, user: User, enrollment_id: str | None
) -> EntitlementOut:
    """What the learner holds.

    Scoped to an enrollment when one is given, because §10.1 sells per
    roadmap: switching goal is a new purchase, so Premium on one goal must not
    unlock another. A purchase with no enrollment_id is account-wide and
    counts for every goal — that is how a pre-enrollment purchase behaves.
    """
    rows = (
        (await session.execute(select(Purchase).where(Purchase.user_id == user.id)))
        .scalars()
        .all()
    )
    relevant = [
        r for r in rows if enrollment_id is None or r.enrollment_id in (None, enrollment_id)
    ]

    entitlement = billing.entitlement_from(
        [billing.PurchaseState(plan=r.plan, purchase_state=r.purchase_state) for r in relevant]
    )
    if entitlement is None:
        return EntitlementOut(entitlement=None)

    # The row that granted it, for the receipt line in the app.
    granting = next(
        (r for r in relevant if r.plan == entitlement and r.purchase_state == "confirmed"),
        None,
    )
    return EntitlementOut(
        entitlement=entitlement,
        plan=entitlement,
        product_id=granting.product_id if granting else None,
        order_id=granting.play_order_id if granting else None,
    )


async def _spend_coupon(session: AsyncSession, raw_code: str) -> str | None:
    """Re-checks and consumes one use.

    Re-checked rather than trusted: validate/ was a separate request and the
    coupon may have expired or filled up since. The increment happens in the
    same transaction as the purchase insert, so a coupon cannot be spent
    without a purchase to show for it.
    """
    code = billing.normalise_code(raw_code)
    if not billing.check_code_format(code):
        return None

    row = (
        await session.execute(select(Coupon).where(Coupon.code == code))
    ).scalar_one_or_none()
    if row is None:
        return None

    check = billing.check_coupon(
        billing.CouponState(
            discount_tier=row.discount_tier,
            status=row.status,
            used_count=row.used_count,
            max_uses=row.max_uses,
            valid_from=row.valid_from,
            valid_to=row.valid_to,
        )
    )
    if not check.ok:
        # The purchase still stands — Play has taken the money and refusing
        # the plan over a lapsed coupon would be the worst of both. It is
        # simply recorded without a coupon.
        return None

    row.used_count += 1
    return row.id
