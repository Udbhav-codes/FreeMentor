"""Identity, the 16+ gate and parental consent.

The server re-checks the age gate the app already enforces. That is not
redundancy for its own sake: the app is the part an attacker controls, and
processing a 15-year-old's data is a DPDP problem whatever the client said.
"""

from __future__ import annotations

from datetime import datetime, timezone

from httpx import AsyncClient

from tests.conftest import auth

THIS_YEAR = datetime.now(timezone.utc).year


class TestIdentity:
    async def test_first_call_creates_the_user(self, client: AsyncClient):
        response = await client.get("/account/me", headers=auth())
        assert response.status_code == 200
        assert response.json()["email"] == "learner@example.com"

    async def test_two_tokens_are_two_learners(self, client: AsyncClient):
        a = await client.get("/account/me", headers=auth("a", "a@example.com"))
        b = await client.get("/account/me", headers=auth("b", "b@example.com"))
        assert a.json()["id"] != b.json()["id"]

    async def test_no_token_is_refused(self, client: AsyncClient):
        assert (await client.get("/account/me")).status_code == 401

    async def test_a_malformed_header_is_refused(self, client: AsyncClient):
        response = await client.get("/account/me", headers={"Authorization": "Basic abc"})
        assert response.status_code == 401


class TestAgeGate:
    async def test_under_16_is_refused_by_the_server_too(self, client: AsyncClient):
        # Born 15 years ago: may still be 15, so blocked.
        response = await client.patch(
            "/account/me", json={"birth_year": THIS_YEAR - 15}, headers=auth()
        )
        assert response.status_code == 403
        assert "16" in response.json()["detail"]

    async def test_16_and_17_are_marked_as_minors(self, client: AsyncClient):
        response = await client.patch(
            "/account/me", json={"birth_year": THIS_YEAR - 17}, headers=auth()
        )
        assert response.status_code == 200
        body = response.json()
        assert body["is_minor"] is True
        assert body["consent_required"] is True
        assert body["consent_given"] is False

    async def test_adults_need_no_consent(self, client: AsyncClient):
        response = await client.patch(
            "/account/me", json={"birth_year": THIS_YEAR - 25}, headers=auth()
        )
        body = response.json()
        assert body["is_minor"] is False
        assert body["consent_required"] is False

    async def test_a_blocked_birth_year_is_not_stored(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 15}, headers=auth())
        assert (await client.get("/account/me", headers=auth())).json()["birth_year"] is None


class TestParentConsent:
    async def test_a_request_alone_is_not_consent(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 17}, headers=auth())
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        assert response.status_code == 202

        # Requesting must NOT flip consent on — the parent has not answered.
        assert (await client.get("/account/me", headers=auth())).json()["consent_given"] is False

    async def test_confirming_grants_consent(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 17}, headers=auth())
        await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        response = await client.post(
            "/account/consent/confirm", json={"code": "123456"}, headers=auth()
        )
        assert response.status_code == 200
        assert response.json()["consent_given"] is True

    async def test_cannot_confirm_without_a_request(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 17}, headers=auth())
        response = await client.post(
            "/account/consent/confirm", json={"code": "123456"}, headers=auth()
        )
        assert response.status_code == 404

    async def test_adults_cannot_request_consent(self, client: AsyncClient):
        await client.patch("/account/me", json={"birth_year": THIS_YEAR - 25}, headers=auth())
        response = await client.post(
            "/account/consent/request",
            json={"parent_contact": "parent@example.com"},
            headers=auth(),
        )
        assert response.status_code == 400


class TestDeletion:
    async def test_deletion_is_scheduled_and_locks_the_account(self, client: AsyncClient):
        assert (await client.delete("/account/me", headers=auth())).status_code == 202
        # A deleted account cannot keep using the API.
        assert (await client.get("/account/me", headers=auth())).status_code == 403


class TestEnrollments:
    async def test_starting_a_second_goal_archives_the_first(self, client: AsyncClient):
        body = {
            "start_date": "2026-10-08",
            "minutes_by_weekday": {
                "mon": 120, "tue": 120, "wed": 120, "thu": 120,
                "fri": 120, "sat": 240, "sun": 240,
            },
        }
        await client.post("/enrollments", json={**body, "goal_id": "python"}, headers=auth())
        await client.post("/enrollments", json={**body, "goal_id": "sql"}, headers=auth())

        rows = (await client.get("/enrollments", headers=auth())).json()
        # Decision #6: the old goal is archived, never deleted.
        assert len(rows) == 2
        assert sorted(r["status"] for r in rows) == ["archived", "trial"]
        assert next(r for r in rows if r["status"] == "trial")["goal_id"] == "sql"

    async def test_negative_study_minutes_are_refused(self, client: AsyncClient):
        response = await client.post(
            "/enrollments",
            json={
                "goal_id": "python",
                "start_date": "2026-10-08",
                "minutes_by_weekday": {"mon": -30},
            },
            headers=auth(),
        )
        assert response.status_code == 422


class TestHealth:
    async def test_health_admits_when_tokens_are_stubbed(self, client: AsyncClient):
        body = (await client.get("/health")).json()
        assert body["status"] == "ok"
        # A staging box quietly running the stub verifier should be visible.
        assert body["verifies_real_tokens"] is False
