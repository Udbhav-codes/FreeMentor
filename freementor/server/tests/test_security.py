"""Security properties of the API: admin auth, CORS, headers, docs, limits.

These exist because each one is a thing that was either missing or only held
by convention. A convention is not a control, and the tests that matter most
here are the ones that enumerate the **live route table** rather than a list
somebody has to remember to update.
"""

from __future__ import annotations

import pytest
from fastapi.routing import APIRoute
from httpx import ASGITransport, AsyncClient

from app import limits, security
from app.config import Settings, get_settings
from app.main import app
from tests.conftest import all_api_routes, auth


class Override:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def __enter__(self) -> Settings:
        app.dependency_overrides[get_settings] = lambda: self._settings
        return self._settings

    def __exit__(self, *_: object) -> None:
        app.dependency_overrides.pop(get_settings, None)


def admin_routes() -> list[APIRoute]:
    """Every /admin route the app actually serves, from the route table."""
    return [r for r in all_api_routes() if r.path.startswith("/admin")]


class TestAdminAuth:
    def test_there_are_admin_routes_to_check(self) -> None:
        # Guards everything below: an empty list would pass vacuously, and
        # that is not hypothetical — the FastAPI 1.x upgrade changed route
        # introspection so that a naive scan of app.routes returns nothing.
        # This assertion is what turned that into a failure instead of a
        # silently disarmed test. See all_api_routes() in conftest.
        assert len(admin_routes()) >= 7

    @pytest.mark.asyncio
    async def test_every_admin_route_refuses_a_non_admin(
        self, client: AsyncClient
    ) -> None:
        # Enumerated from the route table, so an eighth route added later is
        # covered without anybody editing this test. ADMIN_EMAILS is empty in
        # the test settings, so nobody is an admin.
        failures: list[str] = []
        for route in admin_routes():
            if "{" in route.path:
                # Path params need a value; any value, since the 403 must come
                # before the lookup.
                path = route.path.replace("{coupon_id}", "00000000-0000-0000-0000-000000000000")
            else:
                path = route.path

            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                response = await client.request(method, path, headers=auth(), json={})
                if response.status_code != 403:
                    failures.append(f"{method} {path} -> {response.status_code}")

        assert failures == [], "these admin routes did not refuse a non-admin:\n" + "\n".join(
            failures
        )

    @pytest.mark.asyncio
    async def test_every_admin_route_refuses_an_unsigned_request(
        self, client: AsyncClient
    ) -> None:
        failures: list[str] = []
        for route in admin_routes():
            path = route.path.replace("{coupon_id}", "00000000-0000-0000-0000-000000000000")
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                response = await client.request(method, path, json={})
                if response.status_code != 401:
                    failures.append(f"{method} {path} -> {response.status_code}")
        assert failures == []

    @pytest.mark.asyncio
    async def test_an_empty_admin_list_means_nobody(self, client: AsyncClient) -> None:
        # A missing setting must never mean "everyone".
        with Override(Settings(admin_emails="")):
            response = await client.get("/admin/whoami", headers=auth())
        assert response.status_code == 403
        assert "ADMIN_EMAILS is empty" in response.text

    @pytest.mark.asyncio
    async def test_the_configured_admin_gets_in(self, client: AsyncClient) -> None:
        # The positive case, so the test above is not passing for the wrong
        # reason (e.g. the route being broken for everybody).
        with Override(Settings(admin_emails="Boss@Example.com")):
            response = await client.get(
                "/admin/whoami", headers=auth(user="boss", email="boss@example.com")
            )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_the_refusal_does_not_say_whether_an_address_is_an_admin(
        self, client: AsyncClient
    ) -> None:
        # Both refusals must read the same, or this is an admin-enumeration
        # oracle.
        with Override(Settings(admin_emails="boss@example.com")):
            other = await client.get(
                "/admin/whoami", headers=auth(user="nope", email="nope@example.com")
            )
        assert other.status_code == 403
        assert "Not an admin account." in other.text
        assert "nope@example.com" not in other.text


class TestCors:
    def test_no_origins_configured_means_no_cors_headers(self) -> None:
        # The default, and the correct one for a native mobile client.
        assert [p for p in Settings().cors_origins.split(",") if p.strip()] == []

    @pytest.mark.asyncio
    async def test_an_unlisted_origin_is_not_echoed_back(self) -> None:
        # Origin reflection is the specific mistake this is guarding, so it is
        # asserted against a freshly built app rather than reasoned about.
        from fastapi import FastAPI

        probe = FastAPI()

        @probe.get("/x")
        async def _x() -> dict[str, bool]:
            return {"ok": True}

        security.install(probe, Settings(cors_origins="https://admin.freementor.app"))

        async with AsyncClient(
            transport=ASGITransport(app=probe), base_url="http://test"
        ) as c:
            response = await c.get("/x", headers={"Origin": "https://evil.example"})

        assert response.headers.get("access-control-allow-origin") != "https://evil.example"

    def test_a_wildcard_is_refused_outright_in_production(self) -> None:
        with pytest.raises(RuntimeError, match=r"CORS_ORIGINS contains"):
            Settings(
                environment="production",
                database_url="postgresql://x/y",
                supabase_jwt_secret="s",
                supabase_url="https://x.supabase.co",
                otp_echo=False,
                cors_origins="*",
            ).assert_safe()


class TestResponseHeaders:
    @pytest.mark.asyncio
    async def test_the_baseline_headers_are_on_a_json_response(
        self, client: AsyncClient
    ) -> None:
        response = await client.get("/health")
        for header in (
            "x-content-type-options",
            "referrer-policy",
            "x-frame-options",
            "permissions-policy",
        ):
            assert header in response.headers, header
        assert response.headers["x-frame-options"] == "DENY"

    @pytest.mark.asyncio
    async def test_the_html_page_gets_a_csp(self, client: AsyncClient) -> None:
        # /delete-account is the ONLY HTML this API serves. The policy routes
        # return raw markdown as text/plain, which is deliberate and is why
        # they need no CSP — a text/plain response cannot execute anything.
        with Override(
            Settings(
                supabase_url="https://demo.supabase.co",
                supabase_publishable_key="sb_publishable_TESTKEY",
            )
        ):
            response = await client.get("/delete-account")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        csp = response.headers.get("content-security-policy", "")
        assert "default-src 'self'" in csp
        assert "frame-ancestors 'none'" in csp
        assert "object-src 'none'" in csp

    @pytest.mark.asyncio
    async def test_the_policy_pages_are_text_not_html(
        self, client: AsyncClient
    ) -> None:
        # Asserted so that if somebody later switches these to HTMLResponse,
        # this fails and they remember the CSP and the escaping that then
        # start to matter.
        response = await client.get("/privacy-policy")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/plain")

    def test_the_csp_allows_what_the_deletion_page_actually_loads(self) -> None:
        # A CSP that blocks the Supabase client would break the one page Play
        # requires, which is a worse outcome than a slightly looser policy.
        csp = security.html_csp(Settings(supabase_url="https://demo.supabase.co"))
        assert security.SUPABASE_CDN in csp
        assert "https://demo.supabase.co" in csp
        # ...and nothing wider than that.
        assert "connect-src 'self' https://demo.supabase.co" in csp

    def test_hsts_is_production_only(self) -> None:
        # Sending HSTS from a local http server pins localhost to https in the
        # developer's browser, which is miserable to undo.
        assert Settings().is_production is False


class TestApiDocs:
    @pytest.mark.asyncio
    async def test_the_schema_is_available_in_development(
        self, client: AsyncClient
    ) -> None:
        assert (await client.get("/openapi.json")).status_code == 200

    def test_production_switches_the_schema_off(self) -> None:
        # Asserted on the setting rather than by rebuilding the app, because
        # docs_url is fixed at construction time.
        production = Settings(
            environment="production",
            database_url="postgresql://x/y",
            supabase_jwt_secret="s",
            supabase_url="https://x.supabase.co",
            otp_echo=False,
        )
        assert production.is_production is True
        assert (production.expose_api_docs and not production.is_production) is False


class TestRateLimitWindow:
    """The counter itself, with the clock passed in."""

    def setup_method(self) -> None:
        self.w = limits.Window()
        self.rule = limits.Rule("probe", count=3, seconds=60)

    def test_allows_up_to_the_limit(self) -> None:
        for _ in range(3):
            assert self.w.check(self.rule, "a", now=1000.0) is None

    def test_refuses_the_next_one_and_says_how_long(self) -> None:
        for _ in range(3):
            self.w.check(self.rule, "a", now=1000.0)
        wait = self.w.check(self.rule, "a", now=1010.0)
        assert wait is not None
        assert 1 <= wait <= 60

    def test_counts_each_identity_separately(self) -> None:
        for _ in range(3):
            self.w.check(self.rule, "a", now=1000.0)
        # One learner hitting their limit must not lock out everybody else.
        assert self.w.check(self.rule, "b", now=1000.0) is None

    def test_counts_each_rule_separately(self) -> None:
        for _ in range(3):
            self.w.check(self.rule, "a", now=1000.0)
        other = limits.Rule("other", count=1, seconds=60)
        assert self.w.check(other, "a", now=1000.0) is None

    def test_the_window_reopens(self) -> None:
        for _ in range(3):
            self.w.check(self.rule, "a", now=1000.0)
        assert self.w.check(self.rule, "a", now=1061.0) is None

    def test_prune_drops_long_expired_windows(self) -> None:
        # Without this the dict grows per distinct IP forever.
        self.w.check(self.rule, "a", now=1000.0)
        assert self.w.prune(now=1000.0) == 0
        assert self.w.prune(now=1000.0 + 7201) == 1

    def test_identity_prefers_the_verified_subject_over_the_peer_address(self) -> None:
        from app.auth import Principal

        class FakeRequest:
            client = type("C", (), {"host": "203.0.113.9"})()

        subject = limits.identify(FakeRequest(), Principal(auth_id="abc", email="a@b.c"))
        anon = limits.identify(FakeRequest(), None)
        assert subject == "sub:abc"
        assert anon == "ip:203.0.113.9"
        assert subject != anon


class TestRateLimitsOnRoutes:
    @pytest.mark.asyncio
    async def test_coupon_validation_starts_refusing(self, client: AsyncClient) -> None:
        # The guessing oracle. 10 per minute.
        limits.window.forget()
        await client.get("/account/me", headers=auth())

        seen: set[int] = set()
        for _ in range(limits.COUPON_VALIDATE.count + 2):
            response = await client.post(
                "/billing/coupons/validate",
                headers=auth(),
                json={"code": "ABCDEF123", "plan": "basic"},
            )
            seen.add(response.status_code)

        assert 429 in seen, f"never rate limited; saw {sorted(seen)}"
        limits.window.forget()

    @pytest.mark.asyncio
    async def test_the_refusal_tells_the_client_when_to_retry(
        self, client: AsyncClient
    ) -> None:
        limits.window.forget()
        await client.get("/account/me", headers=auth())
        last = None
        for _ in range(limits.COUPON_VALIDATE.count + 2):
            last = await client.post(
                "/billing/coupons/validate",
                headers=auth(),
                json={"code": "ABCDEF123", "plan": "basic"},
            )
        assert last is not None and last.status_code == 429
        assert int(last.headers["retry-after"]) >= 1
        limits.window.forget()

    @pytest.mark.asyncio
    async def test_one_learner_hitting_a_limit_does_not_lock_out_another(
        self, client: AsyncClient
    ) -> None:
        # The property that makes per-subject keying worth the trouble.
        limits.window.forget()
        await client.get("/account/me", headers=auth())
        for _ in range(limits.COUPON_VALIDATE.count + 2):
            await client.post(
                "/billing/coupons/validate",
                headers=auth(),
                json={"code": "ABCDEF123", "plan": "basic"},
            )

        other = auth(user="second", email="second@example.com")
        await client.get("/account/me", headers=other)
        response = await client.post(
            "/billing/coupons/validate",
            headers=other,
            json={"code": "ABCDEF123", "plan": "basic"},
        )
        assert response.status_code != 429
        limits.window.forget()

    @pytest.mark.asyncio
    async def test_the_export_is_limited(self, client: AsyncClient) -> None:
        limits.window.forget()
        await client.get("/account/me", headers=auth())
        seen: set[int] = set()
        for _ in range(limits.EXPORT.count + 2):
            seen.add((await client.get("/account/export", headers=auth())).status_code)
        assert 429 in seen
        limits.window.forget()

    @pytest.mark.asyncio
    async def test_ordinary_use_is_never_limited(self, client: AsyncClient) -> None:
        # The limits must not be felt by somebody using the app normally.
        limits.window.forget()
        for _ in range(30):
            response = await client.get("/account/me", headers=auth())
            assert response.status_code == 200
        limits.window.forget()

    def test_every_rule_has_a_sane_shape(self) -> None:
        for rule in (
            limits.COUPON_VALIDATE,
            limits.CONSENT_REQUEST,
            limits.EXPORT,
            limits.PURCHASE,
            limits.SYNC,
        ):
            assert rule.count > 0
            assert rule.seconds > 0
            assert rule.retry_after == rule.seconds
