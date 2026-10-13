"""The admin APIs behind the panel — product plan §10.3 and §16.

Coupons, a read-only view of learners, and what the library has published.

## Who gets in

An email allowlist in `ADMIN_EMAILS`, matched against the **verified** JWT —
not a flag the client sends, and not a column a compromised account could set
on itself. An empty setting means nobody, which is the only safe default for a
check that might be missing.

The coupons table already denies every client through row-level security with
no policy, so the service key is the only way in. That is on purpose: these
endpoints are the only door, and this is the lock on it.

## What gets written down

Every mutation writes an audit_log row — who, what, which coupon. A 90%
discount code is worth real money, so "who created this" has to be answerable
later. Reads are not audited; before there are real learners that would be
noise, and §15 keeps the learner fields here to the minimum support needs.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import billing
from app.auth import Principal, current_principal
from app.config import Settings, get_settings
from app.db import get_session
from app.models import AuditLog, Coupon, Enrollment, Goal, LibraryVersion, Purchase, User

router = APIRouter(prefix="/admin", tags=["admin"])

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
DIGITS = "0123456789"


async def current_admin(
    principal: Principal = Depends(current_principal),
    settings: Settings = Depends(get_settings),
) -> Principal:
    """Every endpoint here depends on this. Nothing else grants admin."""
    allowed = settings.admin_email_set
    if not allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "No admins are configured on this server (ADMIN_EMAILS is empty).",
        )
    if principal.email.strip().lower() not in allowed:
        # Deliberately the same message either way: whether an address is an
        # admin is not something to confirm to someone who is not one.
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not an admin account.")
    return principal


async def audit(
    session: AsyncSession, actor: Principal, action: str, target: str, detail: dict
) -> None:
    """A coupon is worth money; who made it has to be answerable later."""
    session.add(
        AuditLog(
            # The admin's Supabase id. They may have no users row of their own.
            actor_id=actor.auth_id,
            action=action,
            target=target,
            detail=detail,
        )
    )


def generate_code() -> str:
    """Six letters then three digits (§10.3), from a CSPRNG.

    secrets, not random: a guessable 90%-off code is a free product.
    """
    letters = "".join(secrets.choice(LETTERS) for _ in range(6))
    digits = "".join(secrets.choice(DIGITS) for _ in range(3))
    return letters + digits


# --- who am I ---------------------------------------------------------------


class WhoAmI(BaseModel):
    email: str
    is_admin: bool


@router.get("/whoami", response_model=WhoAmI)
async def whoami(admin: Principal = Depends(current_admin)) -> WhoAmI:
    """Lets the panel show a sign-in failure instead of a blank screen."""
    return WhoAmI(email=admin.email, is_admin=True)


# --- coupons ----------------------------------------------------------------


class CouponRow(BaseModel):
    id: str
    code: str
    discount_tier: int
    max_uses: int | None
    used_count: int
    status: str
    valid_from: datetime | None
    valid_to: datetime | None
    created_at: datetime
    """What a learner would get — resolved here so the panel cannot drift."""
    basic_product_id: str
    premium_product_id: str


def _row(coupon: Coupon) -> CouponRow:
    return CouponRow(
        id=coupon.id,
        code=coupon.code,
        discount_tier=coupon.discount_tier,
        max_uses=coupon.max_uses,
        used_count=coupon.used_count,
        status=coupon.status,
        valid_from=coupon.valid_from,
        valid_to=coupon.valid_to,
        created_at=coupon.created_at,
        basic_product_id=billing.product_id("basic", coupon.discount_tier),
        premium_product_id=billing.product_id("premium", coupon.discount_tier),
    )


@router.get("/coupons", response_model=list[CouponRow])
async def list_coupons(
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    coupon_status: str | None = Query(default=None, alias="status"),
) -> list[CouponRow]:
    query = select(Coupon).order_by(Coupon.created_at.desc())
    if coupon_status:
        query = query.where(Coupon.status == coupon_status)
    rows = (await session.execute(query)).scalars().all()
    return [_row(c) for c in rows]


class CouponCreate(BaseModel):
    discount_tier: int
    """Omit to have one generated. Supplied codes must match the §10.3 format."""
    code: str | None = None
    max_uses: int | None = Field(default=None, ge=1)
    valid_from: datetime | None = None
    valid_to: datetime | None = None


@router.post("/coupons", response_model=CouponRow, status_code=201)
async def create_coupon(
    payload: CouponCreate,
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> CouponRow:
    if payload.discount_tier not in billing.DISCOUNT_TIERS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Tier must be one of {', '.join(str(t) for t in billing.DISCOUNT_TIERS)}. "
            "Each maps to a Play product that has to already exist.",
        )

    if payload.valid_from and payload.valid_to and payload.valid_to <= payload.valid_from:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "The end of the window must be after its start.",
        )

    code = billing.normalise_code(payload.code) if payload.code else generate_code()
    if not billing.check_code_format(code):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            billing.COUPON_MESSAGES[billing.CouponProblem.MALFORMED],
        )

    coupon = Coupon(
        code=code,
        discount_tier=payload.discount_tier,
        max_uses=payload.max_uses,
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
        status="active",
        created_by=admin.auth_id,
    )
    session.add(coupon)
    await audit(
        session,
        admin,
        "coupon.create",
        code,
        {"tier": payload.discount_tier, "max_uses": payload.max_uses},
    )

    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        # The code column is unique. Reusing a code would merge two campaigns'
        # usage counts, so it is refused rather than quietly reused.
        raise HTTPException(status.HTTP_409_CONFLICT, f"{code} already exists.") from None

    await session.refresh(coupon)
    return _row(coupon)


class CouponPatch(BaseModel):
    status: str


@router.patch("/coupons/{coupon_id}", response_model=CouponRow)
async def update_coupon(
    coupon_id: str,
    payload: CouponPatch,
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> CouponRow:
    # 'deleted' is allowed but keeps the row: usage history has to survive, and
    # the purchases that used it carry a foreign key to it.
    if payload.status not in {"active", "archived", "expired", "deleted"}:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown status.")

    coupon = (
        await session.execute(select(Coupon).where(Coupon.id == coupon_id))
    ).scalar_one_or_none()
    if coupon is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such coupon.")

    before = coupon.status
    coupon.status = payload.status
    await audit(
        session, admin, "coupon.status", coupon.code, {"from": before, "to": payload.status}
    )
    await session.commit()
    await session.refresh(coupon)
    return _row(coupon)


# --- learners (read only) ---------------------------------------------------


class UserRow(BaseModel):
    """The minimum support needs (§15). No birth year, no photo, no progress."""

    id: str
    email: str
    name: str | None
    language: str
    is_minor: bool
    created_at: datetime
    deleted_at: datetime | None
    enrollments: int
    purchases: int


@router.get("/users", response_model=list[UserRow])
async def list_users(
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = None,
) -> list[UserRow]:
    query = select(User).order_by(User.created_at.desc()).limit(limit).offset(offset)
    if search:
        query = query.where(User.email.ilike(f"%{search.strip()}%"))
    users = (await session.execute(query)).scalars().all()

    # Counted in two grouped queries rather than per user, so a thousand
    # learners is three queries and not two thousand and one.
    ids = [u.id for u in users]
    enrollments: dict[str, int] = {}
    purchases: dict[str, int] = {}
    if ids:
        for table, into in ((Enrollment, enrollments), (Purchase, purchases)):
            rows = await session.execute(
                select(table.user_id, func.count())
                .where(table.user_id.in_(ids))
                .group_by(table.user_id)
            )
            into.update({user_id: count for user_id, count in rows.all()})

    return [
        UserRow(
            id=u.id,
            email=u.email,
            name=u.name,
            language=u.language,
            is_minor=u.is_minor,
            created_at=u.created_at,
            deleted_at=u.deleted_at,
            enrollments=enrollments.get(u.id, 0),
            purchases=purchases.get(u.id, 0),
        )
        for u in users
    ]


# --- the library ------------------------------------------------------------


class LibraryRow(BaseModel):
    goal_id: str
    goal_name: str | None
    version: str
    checksum: str | None
    published_at: datetime | None


@router.get("/library", response_model=list[LibraryRow])
async def list_library(
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> list[LibraryRow]:
    """The CURRENT published version of each goal.

    library_versions keeps every version ever published, so a plain listing
    showed each goal once per version — twelve goals appearing twenty-four
    times, under a heading claiming to show what the CDN serves. The CDN
    serves one file per goal, so this returns the newest row per goal and the
    heading is true again. The history stays in the table.
    """
    rows = (
        await session.execute(
            select(LibraryVersion, Goal.name)
            .outerjoin(Goal, Goal.id == LibraryVersion.goal_id)
            .order_by(LibraryVersion.goal_id, LibraryVersion.published_at.desc())
        )
    ).all()

    newest: dict[str, LibraryRow] = {}
    for version, name in rows:
        # Ordered newest-first per goal, so the first one wins.
        if version.goal_id in newest:
            continue
        newest[version.goal_id] = LibraryRow(
            goal_id=version.goal_id,
            goal_name=name,
            version=version.version,
            checksum=version.checksum,
            published_at=version.published_at,
        )
    return list(newest.values())


# --- dashboard --------------------------------------------------------------


class Stats(BaseModel):
    users: int
    enrollments: int
    purchases: int
    active_coupons: int
    goals_published: int
    generated_at: datetime


@router.get("/stats", response_model=Stats)
async def stats(
    admin: Principal = Depends(current_admin),
    session: AsyncSession = Depends(get_session),
) -> Stats:
    async def count(model, *where) -> int:
        query = select(func.count()).select_from(model)
        for clause in where:
            query = query.where(clause)
        return int((await session.execute(query)).scalar() or 0)

    return Stats(
        users=await count(User, User.deleted_at.is_(None)),
        enrollments=await count(Enrollment),
        purchases=await count(Purchase, Purchase.purchase_state == "confirmed"),
        active_coupons=await count(Coupon, Coupon.status == "active"),
        # DISTINCT: library_versions holds every version ever published, so a
        # plain count said 24 for the 12 goals that exist.
        goals_published=int(
            (
                await session.execute(
                    select(func.count(func.distinct(LibraryVersion.goal_id)))
                )
            ).scalar()
            or 0
        ),
        generated_at=datetime.now(timezone.utc),
    )
