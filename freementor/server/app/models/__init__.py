"""SQLAlchemy models mirroring migrations/0001_initial.sql and §13.

The device stores the same shapes in SQLite (app/src/db/schema.ts), so a row
coming off the sync queue maps across without translation. Where names differ
between the two, that is a bug, not a design choice.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


# The Postgres schema declares these columns as `uuid`. Modelling them as
# String(36) worked on SQLite and failed on Postgres with "column is of type
# uuid but expression is of type character varying" — a mismatch the test
# suite could never catch, because it runs on SQLite. SQLAlchemy's Uuid type
# renders native `uuid` on Postgres and CHAR(32) elsewhere, so one model is
# correct on both; as_uuid=False keeps the Python side as plain strings.
UUIDCol = Uuid(as_uuid=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    auth_id: Mapped[str] = mapped_column(UUIDCol, unique=True, index=True)
    email: Mapped[str] = mapped_column(Text)
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    gender: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualification: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ParentConsent(Base):
    __tablename__ = "parent_consents"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("users.id", ondelete="CASCADE"))
    parent_contact: Mapped[str] = mapped_column(Text)
    method: Mapped[str] = mapped_column(String(8))
    # Null until the OTP is confirmed. A row is not consent.
    consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Hashed, never plaintext — see app/otp.py.
    code_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(Text)
    group: Mapped[str | None] = mapped_column("group", Text, nullable=True)
    type: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="outline")
    est_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    official_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    eligibility_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class LibraryVersion(Base):
    __tablename__ = "library_versions"
    __table_args__ = (UniqueConstraint("goal_id", "version"),)

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    goal_id: Mapped[str] = mapped_column(String(64), ForeignKey("goals.id"))
    version: Mapped[str] = mapped_column(String(32))
    valid_for: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str] = mapped_column(Text)
    checksum: Mapped[str] = mapped_column(Text)
    published_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    goal_id: Mapped[str] = mapped_column(String(64), ForeignKey("goals.id"))
    library_version_id: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="trial")
    purchase_id: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    enrollment_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("enrollments.id", ondelete="CASCADE"), index=True
    )
    mode: Mapped[str] = mapped_column(String(16), default="each_day")
    # JSON text rather than a JSONB column so the same model works on SQLite.
    minutes_by_weekday: Mapped[str] = mapped_column(Text)
    study_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    study_place: Mapped[str | None] = mapped_column(Text, nullable=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    selected_subjects: Mapped[str | None] = mapped_column(Text, nullable=True)
    effective_from: Mapped[date] = mapped_column(Date)


class TaskProgress(Base):
    __tablename__ = "task_progress"

    enrollment_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("enrollments.id", ondelete="CASCADE"), primary_key=True
    )
    # PlannedItem.key — a block id, or a synthetic review/warm-up/test key.
    block_id: Mapped[str] = mapped_column(Text, primary_key=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    completed_at: Mapped[date] = mapped_column(Date)
    minutes_credited: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConfidenceRating(Base):
    __tablename__ = "confidence_ratings"

    enrollment_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("enrollments.id", ondelete="CASCADE"), primary_key=True
    )
    topic_id: Mapped[str] = mapped_column(Text, primary_key=True)
    level: Mapped[str] = mapped_column(String(24))
    rated_at: Mapped[date] = mapped_column(Date)
    next_review_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TestScore(Base):
    __tablename__ = "test_scores"

    enrollment_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("enrollments.id", ondelete="CASCADE"), primary_key=True
    )
    block_or_milestone_id: Mapped[str] = mapped_column(Text, primary_key=True)
    score: Mapped[float] = mapped_column(Numeric)
    max_score: Mapped[float] = mapped_column(Numeric)
    taken_at: Mapped[date] = mapped_column(Date)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RestDay(Base):
    __tablename__ = "rest_days"

    enrollment_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("enrollments.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[date] = mapped_column(Date, primary_key=True)


class Streak(Base):
    __tablename__ = "streaks"

    user_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    current: Mapped[int] = mapped_column(Integer, default=0)
    best: Mapped[int] = mapped_column(Integer, default=0)
    last_study_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    grace_used_on: Mapped[date | None] = mapped_column(Date, nullable=True)


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    code: Mapped[str] = mapped_column(String(9), unique=True)
    discount_tier: Mapped[int] = mapped_column(Integer)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="active")
    created_by: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    enrollment_id: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    play_order_id: Mapped[str | None] = mapped_column(Text, unique=True, nullable=True)
    product_id: Mapped[str] = mapped_column(Text)
    plan: Mapped[str] = mapped_column(String(16))
    coupon_id: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    price_paid: Mapped[float | None] = mapped_column(Numeric, nullable=True)
    purchase_state: Mapped[str] = mapped_column(String(16), default="pending")
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NotificationPrefs(Base):
    __tablename__ = "notification_prefs"

    user_id: Mapped[str] = mapped_column(
        UUIDCol, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    daily: Mapped[bool] = mapped_column(Boolean, default=True)
    study: Mapped[bool] = mapped_column(Boolean, default=True)
    weekly_report: Mapped[bool] = mapped_column(Boolean, default=True)
    streak: Mapped[bool] = mapped_column(Boolean, default=True)
    test: Mapped[bool] = mapped_column(Boolean, default=True)
    quiet_from: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quiet_to: Mapped[int | None] = mapped_column(Integer, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(UUIDCol, primary_key=True, default=_uuid)
    actor_id: Mapped[str | None] = mapped_column(
        UUIDCol, nullable=True)
    action: Mapped[str] = mapped_column(Text)
    target: Mapped[str | None] = mapped_column(Text, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
