"""The parental consent flow over HTTP.

This is the DPDP gap closing: until now a 16-year-old could tap "I have my
parent's permission" and that was that. The code has to actually reach a
parent and come back.
"""

from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient

from app import otp
from tests.conftest import auth

THIS_YEAR = datetime.now(timezone.utc).year


async def make_minor(client: AsyncClient) -> None:
    response = await client.patch(
        "/account/me", json={"birth_year": THIS_YEAR - 17}, headers=auth()
    )
    assert response.json()["is_minor"] is True


async def request_code(client: AsyncClient, contact: str = "parent@example.com") -> str:
    response = await client.post(
        "/account/consent/request",
        json={"parent_contact": contact},
        headers=auth(),
    )
    assert response.status_code == 202, response.text
    return response.json()["demo_code"]


class TestHappyPath:
    async def test_a_code_confirms_consent(self, client: AsyncClient):
        await make_minor(client)
        code = await request_code(client)

        response = await client.post(
            "/account/consent/confirm", json={"code": code}, headers=auth()
        )
        assert response.status_code == 200
        assert response.json()["consent_given"] is True

    async def test_confirming_twice_is_harmless(self, client: AsyncClient):
        await make_minor(client)
        code = await request_code(client)
        await client.post("/account/consent/confirm", json={"code": code}, headers=auth())
        again = await client.post(
            "/account/consent/confirm", json={"code": code}, headers=auth()
        )
        assert again.status_code == 200
        assert again.json()["consent_given"] is True


class TestWrongCodes:
    async def test_a_wrong_code_is_refused(self, client: AsyncClient):
        await make_minor(client)
        code = await request_code(client)
        wrong = "000000" if code != "000000" else "111111"

        response = await client.post(
            "/account/consent/confirm", json={"code": wrong}, headers=auth()
        )
        assert response.status_code == 400
        assert (await client.get("/account/me", headers=auth())).json()["consent_given"] is False

    async def test_guessing_is_capped(self, client: AsyncClient):
        await make_minor(client)
        code = await request_code(client)

        for _ in range(otp.MAX_ATTEMPTS):
            await client.post(
                "/account/consent/confirm", json={"code": "000000"}, headers=auth()
            )

        # Even the RIGHT code must now fail — otherwise the cap is decorative.
        response = await client.post(
            "/account/consent/confirm", json={"code": code}, headers=auth()
        )
        assert response.status_code == 400
        assert "too many" in response.json()["detail"].lower()

    async def test_an_empty_code_does_not_pass(self, client: AsyncClient):
        await make_minor(client)
        await request_code(client)
        response = await client.post(
            "/account/consent/confirm", json={"code": ""}, headers=auth()
        )
        assert response.status_code == 400


class TestIsolation:
    async def test_one_learner_cannot_use_another_code(self, client: AsyncClient):
        await make_minor(client)
        code = await request_code(client)

        other = auth("learner-2", "two@example.com")
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 17}, headers=other)
        await client.post(
            "/account/consent/request",
            json={"parent_contact": "other-parent@example.com"},
            headers=other,
        )

        # The first learner's code must not confirm the second learner.
        response = await client.post(
            "/account/consent/confirm", json={"code": code}, headers=other
        )
        assert response.status_code == 400
        assert (await client.get("/account/me", headers=other)).json()["consent_given"] is False


class TestRateLimit:
    async def test_an_immediate_resend_is_refused(self, client: AsyncClient):
        await make_minor(client)
        await request_code(client)
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        assert response.status_code == 429


class TestValidation:
    async def test_an_adult_cannot_request_consent(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 30}, headers=auth())
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        assert response.status_code == 400

    async def test_an_email_must_look_like_one(self, client: AsyncClient):
        await make_minor(client)
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "not-an-email", "method": "email"},
            headers=auth(),
        )
        assert response.status_code == 422

    async def test_confirming_without_requesting_is_a_404(self, client: AsyncClient):
        await make_minor(client)
        response = await client.post(
            "/account/consent/confirm", json={"code": "123456"}, headers=auth()
        )
        assert response.status_code == 404


class TestDemoEcho:
    async def test_the_demo_code_is_returned_only_for_convenience(self, client: AsyncClient):
        await make_minor(client)
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        body = response.json()
        # Useful in development, and the reason production refuses to start
        # with OTP_ECHO on — see test_config.
        assert body["demo_code"] is not None
        assert body["expires_in_seconds"] == int(otp.TTL.total_seconds())
