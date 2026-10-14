"""The public web pages — account deletion and the policy documents.

Google Play requires a deletion route that works without the app installed, so
this page is a launch blocker. The tests that matter most are the ones proving
it cannot be used to delete somebody else's account, and that it never leaks
the service key into a browser.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import Settings, get_settings
from app.main import app
from app.models import User
from tests.conftest import auth, auth_id


def configured() -> Settings:
    """Settings with the browser-safe key set, as a deployment would have."""
    return Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="sb_publishable_TESTKEY",
        supabase_service_key="SERVICE-KEY-MUST-NOT-LEAK",
    )


class Override:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def __enter__(self) -> None:
        app.dependency_overrides[get_settings] = lambda: self._settings

    def __exit__(self, *_: object) -> None:
        app.dependency_overrides.pop(get_settings, None)


class TestDeletePage:
    @pytest.mark.asyncio
    async def test_is_reachable_without_signing_in(self, client: AsyncClient) -> None:
        # The whole point: somebody who uninstalled the app must be able to
        # reach it. An auth wall here would defeat the Play requirement.
        with Override(configured()):
            response = await client.get("/delete-account")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    @pytest.mark.asyncio
    async def test_says_what_is_deleted_before_asking_anyone_to_sign_in(
        self, client: AsyncClient
    ) -> None:
        # Play and the DPDP Act both expect a person to find out what happens
        # before they commit to it.
        with Override(configured()):
            body = (await client.get("/delete-account")).text
        for expected in ("What gets deleted", "What we have to keep", "30 days"):
            assert expected in body

    @pytest.mark.asyncio
    async def test_injects_the_publishable_key_and_never_the_service_key(
        self, client: AsyncClient
    ) -> None:
        # The one way this page could be a genuine security problem.
        with Override(configured()):
            body = (await client.get("/delete-account")).text
        assert "sb_publishable_TESTKEY" in body
        assert "SERVICE-KEY-MUST-NOT-LEAK" not in body
        assert "__SUPABASE_URL__" not in body, "placeholder left unreplaced"

    @pytest.mark.asyncio
    async def test_explains_itself_when_the_server_is_not_configured(
        self, client: AsyncClient
    ) -> None:
        # Better than a page whose sign-in button silently does nothing.
        with Override(Settings(supabase_url="", supabase_publishable_key="")):
            response = await client.get("/delete-account")
        assert response.status_code == 503
        assert "email support" in response.text.lower()


class TestDeletionItself:
    @pytest.mark.asyncio
    async def test_marks_the_signed_in_account_for_deletion(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The page calls this endpoint; it is the same one the app uses.
        await client.get("/account/me", headers=auth())
        response = await client.delete("/account/me", headers=auth())
        assert response.status_code == 202
        assert response.json()["purge_within_days"] == "30"

        async with session_factory() as session:
            user = (
                await session.execute(
                    select(User).where(User.auth_id == auth_id("learner-1"))
                )
            ).scalar_one()
            assert user.deleted_at is not None

    @pytest.mark.asyncio
    async def test_cannot_delete_anybody_else(
        self, client: AsyncClient, session_factory
    ) -> None:
        # There is no account identifier in the request at all — the endpoint
        # deletes whoever the token belongs to. This asserts that holds, so a
        # tampered page cannot name a victim.
        await client.get("/account/me", headers=auth(user="victim", email="victim@example.com"))
        await client.get("/account/me", headers=auth(user="attacker", email="bad@example.com"))

        await client.delete("/account/me", headers=auth(user="attacker", email="bad@example.com"))

        async with session_factory() as session:
            victim = (
                await session.execute(
                    select(User).where(User.auth_id == auth_id("victim"))
                )
            ).scalar_one()
            assert victim.deleted_at is None, "deleted the wrong account"

    @pytest.mark.asyncio
    async def test_an_unsigned_request_deletes_nothing(self, client: AsyncClient) -> None:
        assert (await client.delete("/account/me")).status_code == 401

    @pytest.mark.asyncio
    async def test_deleting_twice_is_harmless(self, client: AsyncClient) -> None:
        # Somebody double-tapping the confirm button must not see an error.
        await client.get("/account/me", headers=auth())
        first = await client.delete("/account/me", headers=auth())
        assert first.status_code == 202
        second = await client.delete("/account/me", headers=auth())
        # Either accepted again or refused as already-deleting; never a 500.
        assert second.status_code in (202, 403)


class TestPolicyPages:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "path,marker",
        [
            ("/privacy-policy", "Privacy Policy"),
            ("/terms", "Terms and Conditions"),
            ("/refund-policy", "Refund Policy"),
            ("/content-policy", "Content & Copyright Policy"),
        ],
    )
    async def test_each_policy_is_served(
        self, client: AsyncClient, path: str, marker: str
    ) -> None:
        # The app links to /privacy and /terms; Play requires the privacy
        # policy at a public URL outside the app.
        response = await client.get(path)
        assert response.status_code == 200
        assert marker in response.text

    @pytest.mark.asyncio
    async def test_the_drafts_still_carry_their_placeholders(
        self, client: AsyncClient
    ) -> None:
        # A reminder in test form: these are drafts. When the placeholders are
        # filled in and a lawyer has reviewed them, delete this test — it
        # failing is the signal that the documents are finished.
        body = (await client.get("/privacy-policy")).text
        assert "[LEGAL ENTITY NAME]" in body, "placeholders filled — see the note in this test"
