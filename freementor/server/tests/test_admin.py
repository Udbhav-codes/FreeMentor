"""The admin APIs — §10.3, §16.

The access check gets the most attention here. A 90%-off coupon is a free
product, and these endpoints are the only door to the coupons table, which
row-level security otherwise denies to every client. So the tests that matter
most are the ones proving the door is shut by default.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import Settings, get_settings
from app.main import app
from app.models import AuditLog, Coupon
from tests.conftest import auth

ADMIN = "boss@freementor.app"


def as_admin(emails: str = ADMIN):
    """Overrides settings so a given address is an admin.

    The JWT secret is left unset on purpose: the auth dependency reads the
    same settings, and a real secret would reject the local test token with a
    401 before the admin check is reached.
    """
    return Settings(admin_emails=emails)


def admin_headers(email: str = ADMIN) -> dict[str, str]:
    return auth(user="admin-1", email=email)


class Override:
    """Applies a settings override for the duration of a block."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def __enter__(self) -> None:
        app.dependency_overrides[get_settings] = lambda: self._settings

    def __exit__(self, *_: object) -> None:
        app.dependency_overrides.pop(get_settings, None)


# --- the door ---------------------------------------------------------------


class TestAccess:
    @pytest.mark.asyncio
    async def test_nobody_is_an_admin_when_the_setting_is_empty(
        self, client: AsyncClient
    ) -> None:
        # The whole safety argument. A missing ADMIN_EMAILS must never be read
        # as "everyone" — which is what a truthy check on a list would do.
        with Override(as_admin(emails="")):
            response = await client.get("/admin/coupons", headers=admin_headers())
            assert response.status_code == 403
            assert "No admins are configured" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_an_ordinary_learner_is_refused(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            response = await client.get("/admin/coupons", headers=auth())
            assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_an_allowlisted_admin_is_let_in(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            response = await client.get("/admin/whoami", headers=admin_headers())
            assert response.status_code == 200
            assert response.json() == {"email": ADMIN, "is_admin": True}

    @pytest.mark.asyncio
    async def test_the_match_ignores_case_and_padding(self, client: AsyncClient) -> None:
        with Override(as_admin(emails="  BOSS@FreeMentor.app , other@x.com ")):
            response = await client.get("/admin/whoami", headers=admin_headers())
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_refusals_do_not_reveal_who_is_an_admin(
        self, client: AsyncClient
    ) -> None:
        # Both non-admins get the same message, so the endpoint cannot be used
        # to enumerate which addresses have access.
        with Override(as_admin()):
            one = await client.get("/admin/coupons", headers=auth(email="a@x.com"))
            two = await client.get("/admin/coupons", headers=auth(email="b@x.com"))
        assert one.json()["detail"] == two.json()["detail"] == "Not an admin account."

    @pytest.mark.asyncio
    async def test_every_admin_endpoint_is_behind_the_check(
        self, client: AsyncClient
    ) -> None:
        # Guards against a new endpoint being added without the dependency.
        paths = [r.path for r in app.routes if getattr(r, "path", "").startswith("/admin")]
        assert len(paths) >= 7
        with Override(as_admin()):
            for path in paths:
                if "{" in path:
                    path = path.replace("{coupon_id}", "11111111-1111-1111-1111-111111111111")
                response = await client.get(path, headers=auth())
                # 403 for a GET, 405 where GET is not the verb — never 200.
                assert response.status_code in (403, 405), f"{path} let a learner in"

    @pytest.mark.asyncio
    async def test_an_unsigned_request_is_refused(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            assert (await client.get("/admin/coupons")).status_code == 401


# --- coupons ----------------------------------------------------------------


class TestCoupons:
    @pytest.mark.asyncio
    async def test_generates_a_code_in_the_documented_format(
        self, client: AsyncClient
    ) -> None:
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons", json={"discount_tier": 50}, headers=admin_headers()
            )
        assert response.status_code == 201, response.text
        body = response.json()
        assert len(body["code"]) == 9
        assert body["code"][:6].isalpha() and body["code"][:6].isupper()
        assert body["code"][6:].isdigit()

    @pytest.mark.asyncio
    async def test_resolves_the_play_products_so_the_panel_cannot_drift(
        self, client: AsyncClient
    ) -> None:
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons", json={"discount_tier": 30}, headers=admin_headers()
            )
        body = response.json()
        assert body["basic_product_id"] == "basic_off30"
        assert body["premium_product_id"] == "premium_off30"

    @pytest.mark.asyncio
    async def test_accepts_a_chosen_code_and_normalises_it(
        self, client: AsyncClient
    ) -> None:
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons",
                json={"discount_tier": 20, "code": "topper426"},
                headers=admin_headers(),
            )
        assert response.json()["code"] == "TOPPER426"

    @pytest.mark.asyncio
    async def test_refuses_a_malformed_chosen_code(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons",
                json={"discount_tier": 20, "code": "SAVE50"},
                headers=admin_headers(),
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_refuses_a_tier_with_no_play_product(self, client: AsyncClient) -> None:
        # 45% has no pre-made product, so a coupon for it would dead-end at the
        # payment sheet.
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons", json={"discount_tier": 45}, headers=admin_headers()
            )
        assert response.status_code == 422
        assert "Play product" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_refuses_a_duplicate_code(self, client: AsyncClient) -> None:
        # Reusing a code would merge two campaigns' usage counts.
        with Override(as_admin()):
            body = {"discount_tier": 10, "code": "TOPPER426"}
            first = await client.post("/admin/coupons", json=body, headers=admin_headers())
            second = await client.post("/admin/coupons", json=body, headers=admin_headers())
        assert first.status_code == 201
        assert second.status_code == 409

    @pytest.mark.asyncio
    async def test_refuses_a_window_that_ends_before_it_starts(
        self, client: AsyncClient
    ) -> None:
        now = datetime.now(timezone.utc)
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons",
                json={
                    "discount_tier": 10,
                    "valid_from": now.isoformat(),
                    "valid_to": (now - timedelta(days=1)).isoformat(),
                },
                headers=admin_headers(),
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_refuses_a_zero_use_cap(self, client: AsyncClient) -> None:
        # max_uses=0 would create a coupon nobody can ever use.
        with Override(as_admin()):
            response = await client.post(
                "/admin/coupons",
                json={"discount_tier": 10, "max_uses": 0},
                headers=admin_headers(),
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_archiving_keeps_the_row_and_its_history(
        self, client: AsyncClient, session_factory
    ) -> None:
        with Override(as_admin()):
            created = await client.post(
                "/admin/coupons", json={"discount_tier": 70}, headers=admin_headers()
            )
            coupon_id = created.json()["id"]
            patched = await client.patch(
                f"/admin/coupons/{coupon_id}",
                json={"status": "archived"},
                headers=admin_headers(),
            )
        assert patched.status_code == 200
        assert patched.json()["status"] == "archived"

        async with session_factory() as session:
            rows = (await session.execute(select(Coupon))).scalars().all()
            # Still there: purchases carry a foreign key to it and usage
            # history has to survive.
            assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_an_archived_coupon_stops_working_for_learners(
        self, client: AsyncClient
    ) -> None:
        # The point of archiving, checked through the learner-facing endpoint
        # rather than assumed from the status column.
        with Override(as_admin()):
            created = await client.post(
                "/admin/coupons",
                json={"discount_tier": 90, "code": "SECRET999"},
                headers=admin_headers(),
            )
            coupon_id = created.json()["id"]

        before = await client.post(
            "/billing/coupons/validate", json={"code": "SECRET999"}, headers=auth()
        )
        assert before.status_code == 200

        with Override(as_admin()):
            await client.patch(
                f"/admin/coupons/{coupon_id}",
                json={"status": "archived"},
                headers=admin_headers(),
            )

        after = await client.post(
            "/billing/coupons/validate", json={"code": "SECRET999"}, headers=auth()
        )
        assert after.status_code == 409

    @pytest.mark.asyncio
    async def test_refuses_an_unknown_status(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            created = await client.post(
                "/admin/coupons", json={"discount_tier": 10}, headers=admin_headers()
            )
            response = await client.patch(
                f"/admin/coupons/{created.json()['id']}",
                json={"status": "free"},
                headers=admin_headers(),
            )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_can_filter_the_list_by_status(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            a = await client.post(
                "/admin/coupons", json={"discount_tier": 10}, headers=admin_headers()
            )
            await client.post(
                "/admin/coupons", json={"discount_tier": 20}, headers=admin_headers()
            )
            await client.patch(
                f"/admin/coupons/{a.json()['id']}",
                json={"status": "archived"},
                headers=admin_headers(),
            )
            active = await client.get("/admin/coupons?status=active", headers=admin_headers())
        assert len(active.json()) == 1


class TestAudit:
    @pytest.mark.asyncio
    async def test_creating_and_archiving_are_both_written_down(
        self, client: AsyncClient, session_factory
    ) -> None:
        # A discount code is worth money; "who created this" has to be
        # answerable later.
        with Override(as_admin()):
            created = await client.post(
                "/admin/coupons", json={"discount_tier": 90}, headers=admin_headers()
            )
            await client.patch(
                f"/admin/coupons/{created.json()['id']}",
                json={"status": "archived"},
                headers=admin_headers(),
            )

        async with session_factory() as session:
            rows = (await session.execute(select(AuditLog))).scalars().all()
            actions = sorted(r.action for r in rows)
            assert actions == ["coupon.create", "coupon.status"]
            assert all(r.actor_id for r in rows), "an audit row with no actor is useless"
            detail = next(r.detail for r in rows if r.action == "coupon.create")
            assert detail["tier"] == 90


# --- learners and library ---------------------------------------------------


class TestUsers:
    @pytest.mark.asyncio
    async def test_lists_learners_with_their_counts(
        self, client: AsyncClient, enrollment: str
    ) -> None:
        with Override(as_admin()):
            rows = (await client.get("/admin/users", headers=admin_headers())).json()
        learner = next(r for r in rows if r["email"] == "learner@example.com")
        assert learner["enrollments"] == 1
        assert learner["purchases"] == 0

    @pytest.mark.asyncio
    async def test_exposes_only_what_support_needs(
        self, client: AsyncClient, enrollment: str
    ) -> None:
        # §15 minimum collection: no birth year, no photo, no progress.
        with Override(as_admin()):
            rows = (await client.get("/admin/users", headers=admin_headers())).json()
        for forbidden in ("birth_year", "photo_url", "qualification", "gender"):
            assert forbidden not in rows[0], f"{forbidden} should not be exposed"

    @pytest.mark.asyncio
    async def test_can_search_by_email(self, client: AsyncClient, enrollment: str) -> None:
        with Override(as_admin()):
            found = (
                await client.get("/admin/users?search=learner@", headers=admin_headers())
            ).json()
            missing = (
                await client.get("/admin/users?search=nobody", headers=admin_headers())
            ).json()
        assert len(found) == 1
        assert missing == []

    @pytest.mark.asyncio
    async def test_caps_the_page_size(self, client: AsyncClient) -> None:
        with Override(as_admin()):
            response = await client.get("/admin/users?limit=5000", headers=admin_headers())
        assert response.status_code == 422


class TestStats:
    @pytest.mark.asyncio
    async def test_counts_what_the_dashboard_shows(
        self, client: AsyncClient, enrollment: str
    ) -> None:
        with Override(as_admin()):
            await client.post(
                "/admin/coupons", json={"discount_tier": 10}, headers=admin_headers()
            )
            body = (await client.get("/admin/stats", headers=admin_headers())).json()
        assert body["enrollments"] == 1
        assert body["active_coupons"] == 1
        assert body["users"] >= 1
        # Nothing bought yet, and a pending purchase would not count either.
        assert body["purchases"] == 0

    @pytest.mark.asyncio
    async def test_an_empty_library_is_zero_not_an_error(
        self, client: AsyncClient
    ) -> None:
        with Override(as_admin()):
            rows = (await client.get("/admin/library", headers=admin_headers())).json()
        assert rows == []
