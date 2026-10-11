"""The billing endpoints — §10.1, §10.3, §10.4.

The rules themselves are covered in test_billing_rules.py. What is tested here
is the behaviour that only exists once a database and a request are involved:
idempotency, spending a coupon exactly once, and the per-roadmap scoping that
§10.1 requires.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import Coupon, Purchase
from tests.conftest import auth


async def make_coupon(session_factory, **over) -> str:
    """Inserts a coupon directly; there is no admin API yet (M6)."""
    fields = {
        "code": "TOPPER426",
        "discount_tier": 50,
        "max_uses": None,
        "used_count": 0,
        "status": "active",
        "valid_from": None,
        "valid_to": None,
    }
    fields.update(over)
    async with session_factory() as session:
        coupon = Coupon(**fields)
        session.add(coupon)
        await session.commit()
        return fields["code"]


# --- coupon validation ------------------------------------------------------


class TestValidateCoupon:
    @pytest.mark.asyncio
    async def test_returns_the_product_to_launch_not_a_price(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The app must never compute a price. It gets a product id and Play
        # charges whatever that product costs.
        await make_coupon(session_factory)
        response = await client.post(
            "/billing/coupons/validate",
            json={"code": "topper426", "plan": "premium"},
            headers=auth(),
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body == {
            "code": "TOPPER426",
            "discount_percent": 50,
            "product_id": "premium_off50",
            "plan": "premium",
        }
        assert "price" not in body

    @pytest.mark.asyncio
    async def test_does_not_spend_a_use(
        self, client: AsyncClient, session_factory
    ) -> None:
        # Checking a code then changing your mind must not cost a use.
        await make_coupon(session_factory, max_uses=1)
        for _ in range(3):
            response = await client.post(
                "/billing/coupons/validate",
                json={"code": "TOPPER426", "plan": "basic"},
                headers=auth(),
            )
            assert response.status_code == 200

        async with session_factory() as session:
            row = (await session.execute(select(Coupon))).scalar_one()
            assert row.used_count == 0

    @pytest.mark.asyncio
    async def test_a_malformed_code_is_rejected_before_any_lookup(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/billing/coupons/validate", json={"code": "nope"}, headers=auth()
        )
        assert response.status_code == 422
        assert "six letters" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_an_unknown_code_is_404_and_a_lapsed_one_is_409(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The learner can act on the difference: a typo versus a real code
        # that is finished.
        unknown = await client.post(
            "/billing/coupons/validate", json={"code": "ABCDEF123"}, headers=auth()
        )
        assert unknown.status_code == 404

        await make_coupon(session_factory, valid_to=datetime.now(timezone.utc) - timedelta(days=1))
        expired = await client.post(
            "/billing/coupons/validate", json={"code": "TOPPER426"}, headers=auth()
        )
        assert expired.status_code == 409
        assert "expired" in expired.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_an_unknown_plan_is_refused(self, client: AsyncClient) -> None:
        response = await client.post(
            "/billing/coupons/validate",
            json={"code": "TOPPER426", "plan": "gold"},
            headers=auth(),
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_requires_a_signed_in_learner(self, client: AsyncClient) -> None:
        response = await client.post("/billing/coupons/validate", json={"code": "TOPPER426"})
        assert response.status_code == 401


# --- recording a purchase ---------------------------------------------------


class TestRecordPurchase:
    @pytest.mark.asyncio
    async def test_a_verified_purchase_grants_the_plan(self, client: AsyncClient) -> None:
        response = await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-1", "product_id": "basic"},
            headers=auth(),
        )
        assert response.status_code == 201, response.text
        assert response.json()["entitlement"] == "basic"

    @pytest.mark.asyncio
    async def test_an_unverifiable_token_grants_nothing(self, client: AsyncClient) -> None:
        # Without Play credentials the local verifier accepts only a token
        # that names itself a test. Anything plausible is refused.
        response = await client.post(
            "/billing/purchases",
            json={"purchase_token": "GPA.3312-1234-5678-90123", "product_id": "premium"},
            headers=auth(),
        )
        assert response.status_code == 402
        entitlement = await client.get("/billing/entitlement", headers=auth())
        assert entitlement.json()["entitlement"] is None

    @pytest.mark.asyncio
    async def test_a_product_we_do_not_sell_is_refused(self, client: AsyncClient) -> None:
        response = await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-2", "product_id": "premium_off99"},
            headers=auth(),
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_replaying_the_same_order_is_idempotent(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The app retries on a dropped connection and Play can redeliver a
        # purchase, so one order must never become two rows.
        body = {"purchase_token": "test:order-3", "product_id": "premium"}
        first = await client.post("/billing/purchases", json=body, headers=auth())
        second = await client.post("/billing/purchases", json=body, headers=auth())

        assert first.status_code == 201
        assert second.status_code == 201
        assert second.json()["entitlement"] == "premium"

        async with session_factory() as session:
            rows = (await session.execute(select(Purchase))).scalars().all()
            assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_another_account_cannot_claim_the_same_order(
        self, client: AsyncClient
    ) -> None:
        body = {"purchase_token": "test:order-4", "product_id": "basic"}
        await client.post("/billing/purchases", json=body, headers=auth())
        stolen = await client.post(
            "/billing/purchases",
            json=body,
            headers=auth(user="learner-2", email="other@example.com"),
        )
        assert stolen.status_code == 409

    @pytest.mark.asyncio
    async def test_a_coupon_is_spent_exactly_once(
        self, client: AsyncClient, session_factory
    ) -> None:
        await make_coupon(session_factory, max_uses=2)
        body = {
            "purchase_token": "test:order-5",
            "product_id": "basic_off50",
            "coupon_code": "TOPPER426",
        }
        await client.post("/billing/purchases", json=body, headers=auth())
        # The replay must not spend a second use.
        await client.post("/billing/purchases", json=body, headers=auth())

        async with session_factory() as session:
            row = (await session.execute(select(Coupon))).scalar_one()
            assert row.used_count == 1
            purchase = (await session.execute(select(Purchase))).scalar_one()
            assert purchase.coupon_id == row.id

    @pytest.mark.asyncio
    async def test_a_lapsed_coupon_does_not_void_the_purchase(
        self, client: AsyncClient, session_factory
    ) -> None:
        # Play has taken the money. Refusing the plan over an expired coupon
        # would be the worst of both outcomes.
        await make_coupon(session_factory, status="archived")
        response = await client.post(
            "/billing/purchases",
            json={
                "purchase_token": "test:order-6",
                "product_id": "premium",
                "coupon_code": "TOPPER426",
            },
            headers=auth(),
        )
        assert response.status_code == 201
        assert response.json()["entitlement"] == "premium"

        async with session_factory() as session:
            purchase = (await session.execute(select(Purchase))).scalar_one()
            assert purchase.coupon_id is None
            coupon = (await session.execute(select(Coupon))).scalar_one()
            assert coupon.used_count == 0

    @pytest.mark.asyncio
    async def test_an_enrollment_on_another_account_is_refused(
        self, client: AsyncClient
    ) -> None:
        response = await client.post(
            "/billing/purchases",
            json={
                "purchase_token": "test:order-7",
                "product_id": "basic",
                "enrollment_id": "11111111-1111-1111-1111-111111111111",
            },
            headers=auth(),
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_paying_takes_the_enrollment_off_trial(
        self, client: AsyncClient, enrollment: str, session_factory
    ) -> None:
        response = await client.post(
            "/billing/purchases",
            json={
                "purchase_token": "test:order-8",
                "product_id": "basic",
                "enrollment_id": enrollment,
            },
            headers=auth(),
        )
        assert response.status_code == 201

        from app.models import Enrollment

        async with session_factory() as session:
            row = (
                await session.execute(select(Enrollment).where(Enrollment.id == enrollment))
            ).scalar_one()
            assert row.status == "active"


# --- what the learner holds -------------------------------------------------


class TestEntitlement:
    @pytest.mark.asyncio
    async def test_nothing_bought_reports_nothing(self, client: AsyncClient) -> None:
        # Not an error: the trial clock decides from here.
        response = await client.get("/billing/entitlement", headers=auth())
        assert response.status_code == 200
        assert response.json()["entitlement"] is None

    @pytest.mark.asyncio
    async def test_reports_the_order_so_the_app_can_show_a_receipt(
        self, client: AsyncClient
    ) -> None:
        await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-9", "product_id": "premium_off30"},
            headers=auth(),
        )
        body = (await client.get("/billing/entitlement", headers=auth())).json()
        assert body["entitlement"] == "premium"
        assert body["product_id"] == "premium_off30"
        assert body["order_id"] == "test:order-9"

    @pytest.mark.asyncio
    async def test_a_purchase_on_one_goal_does_not_unlock_another(
        self, client: AsyncClient, enrollment: str
    ) -> None:
        # §10.1 sells per roadmap: switching goal is a new purchase.
        await client.post(
            "/billing/purchases",
            json={
                "purchase_token": "test:order-10",
                "product_id": "premium",
                "enrollment_id": enrollment,
            },
            headers=auth(),
        )
        mine = await client.get(
            f"/billing/entitlement?enrollment_id={enrollment}", headers=auth()
        )
        assert mine.json()["entitlement"] == "premium"

        other = await client.get(
            "/billing/entitlement?enrollment_id=22222222-2222-2222-2222-222222222222",
            headers=auth(),
        )
        assert other.json()["entitlement"] is None

    @pytest.mark.asyncio
    async def test_a_purchase_with_no_enrollment_counts_everywhere(
        self, client: AsyncClient, enrollment: str
    ) -> None:
        # Someone who paid before picking a goal must not lose what they paid
        # for the moment they pick one.
        await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-11", "product_id": "basic"},
            headers=auth(),
        )
        scoped = await client.get(
            f"/billing/entitlement?enrollment_id={enrollment}", headers=auth()
        )
        assert scoped.json()["entitlement"] == "basic"

    @pytest.mark.asyncio
    async def test_one_learner_cannot_see_another_s_plan(self, client: AsyncClient) -> None:
        await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-12", "product_id": "premium"},
            headers=auth(),
        )
        other = await client.get(
            "/billing/entitlement", headers=auth(user="learner-3", email="three@example.com")
        )
        assert other.json()["entitlement"] is None

    @pytest.mark.asyncio
    async def test_upgrading_after_basic_reads_as_premium(self, client: AsyncClient) -> None:
        await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-13", "product_id": "basic"},
            headers=auth(),
        )
        await client.post(
            "/billing/purchases",
            json={
                "purchase_token": "test:order-14",
                "product_id": "upgrade_basic_to_premium",
            },
            headers=auth(),
        )
        body = (await client.get("/billing/entitlement", headers=auth())).json()
        assert body["entitlement"] == "premium"


class TestProductionGuard:
    """Production must never run purchases through the stand-in verifier."""

    @pytest.mark.asyncio
    async def test_a_production_server_without_play_credentials_refuses(
        self, client: AsyncClient, monkeypatch
    ) -> None:
        from app.config import Settings, get_settings
        from app.main import app

        # ENVIRONMENT=production with no Play credentials — exactly the state
        # the server is in today. The JWT secret is deliberately left unset:
        # the auth dependency reads the same settings, and a real secret would
        # reject this test's local token with a 401 before the guard is
        # reached. `is_production` is what the guard actually looks at.
        production = Settings(
            environment="production",
            database_url="postgresql://user:pw@host/db",
            supabase_url="https://x.supabase.co",
            otp_echo=False,
        )
        app.dependency_overrides[get_settings] = lambda: production
        try:
            response = await client.post(
                "/billing/purchases",
                json={"purchase_token": "test:free-premium", "product_id": "premium"},
                headers=auth(),
            )
            # 503, not 201. A 'test:' token must not buy Premium in production.
            assert response.status_code == 503
            assert "not enabled" in response.json()["detail"]
        finally:
            del app.dependency_overrides[get_settings]

    def test_the_server_still_boots_in_production_without_play_credentials(self) -> None:
        # Deploying the API before billing exists has to stay possible.
        from app.config import Settings

        Settings(
            environment="production",
            database_url="postgresql://user:pw@host/db",
            supabase_url="https://x.supabase.co",
            supabase_jwt_secret="secret",
            otp_echo=False,
        ).assert_safe()
