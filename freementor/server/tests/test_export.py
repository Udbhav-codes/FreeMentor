"""The data export — GET /account/export.

The privacy policy promises this, with the menu path spelled out, so the
first-order test is simply that it exists and returns the caller's data.

The tests that matter more are the negative ones: that it never carries the
hashed consent OTP, never names another person, and cannot be pointed at
somebody else's account. An export is a file that gets emailed and left in a
Downloads folder; what it contains is a disclosure decision, not a formatting
one.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app import export as data_export
from app.models import (
    ConfidenceRating,
    Enrollment,
    Goal,
    NotificationPrefs,
    ParentConsent,
    Purchase,
    Schedule,
    Streak,
    TaskProgress,
    TestScore,
    User,
)
from tests.conftest import auth, auth_id


async def _seed_learner(client: AsyncClient, session_factory, *, user: str = "learner-1") -> str:
    """A learner with one roadmap and a tick, the way the app would create it."""
    await client.get("/account/me", headers=auth(user=user))
    await client.patch(
        "/account/me",
        headers=auth(user=user),
        json={"name": "Asha", "birth_year": 2004, "qualification": "Class 12", "language": "hi"},
    )

    async with session_factory() as session:
        row = (
            await session.execute(select(User).where(User.auth_id == auth_id(user)))
        ).scalar_one()
        user_id = row.id

        session.add(Goal(id="jee-main", name="JEE Main", category="Engineering", type="exam"))
        enrollment = Enrollment(
            user_id=user_id, goal_id="jee-main", start_date=date(2026, 10, 1), status="trial"
        )
        session.add(enrollment)
        await session.flush()

        session.add(
            Schedule(
                enrollment_id=enrollment.id,
                minutes_by_weekday={"mon": 90},
                study_time="evening",
                effective_from=date(2026, 10, 1),
            )
        )
        session.add(
            TaskProgress(
                enrollment_id=enrollment.id,
                block_id="b-1",
                completed_at=date(2026, 10, 2),
                minutes_credited=45,
            )
        )
        session.add(
            ConfidenceRating(
                enrollment_id=enrollment.id,
                topic_id="t-1",
                level="shaky",
                rated_at=date(2026, 10, 2),
            )
        )
        session.add(
            TestScore(
                enrollment_id=enrollment.id,
                block_or_milestone_id="m-1",
                score=Decimal("62.50"),
                max_score=Decimal("100"),
                taken_at=date(2026, 10, 3),
            )
        )
        session.add(Streak(user_id=user_id, current=4, best=9, last_study_date=date(2026, 10, 3)))
        session.add(NotificationPrefs(user_id=user_id, daily=True, quiet_from=22))
        session.add(
            Purchase(
                user_id=user_id,
                enrollment_id=enrollment.id,
                play_order_id="GPA.TEST-1",
                product_id="basic_599",
                plan="basic",
                price_paid=Decimal("599.00"),
                purchase_state="purchased",
            )
        )
        await session.commit()
    return user_id


class TestTheExportExists:
    @pytest.mark.asyncio
    async def test_the_promised_endpoint_responds(self, client: AsyncClient) -> None:
        # privacy-policy.md names "Profile -> Account -> Export my progress".
        # The button behind it had said "Not built yet" since the policy was
        # drafted, which is a published commitment the product did not keep.
        await client.get("/account/me", headers=auth())
        response = await client.get("/account/export", headers=auth())
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_an_unsigned_request_gets_nothing(self, client: AsyncClient) -> None:
        assert (await client.get("/account/export")).status_code == 401

    @pytest.mark.asyncio
    async def test_says_what_it_is_and_what_it_leaves_out(self, client: AsyncClient) -> None:
        # Somebody opening this file in a year should not have to guess.
        await client.get("/account/me", headers=auth())
        meta = (await client.get("/account/export", headers=auth())).json()["_meta"]
        assert meta["format_version"] == data_export.FORMAT_VERSION
        assert meta["generated_at"]
        assert "what_this_is" in meta
        assert "what_is_left_out" in meta


class TestItContainsTheLearnersData:
    @pytest.mark.asyncio
    async def test_carries_the_profile_the_learner_supplied(
        self, client: AsyncClient, session_factory
    ) -> None:
        await _seed_learner(client, session_factory)
        account = (await client.get("/account/export", headers=auth())).json()["account"]
        assert account["name"] == "Asha"
        assert account["birth_year"] == 2004
        assert account["qualification"] == "Class 12"
        assert account["language"] == "hi"
        assert account["email"]

    @pytest.mark.asyncio
    async def test_carries_the_roadmap_and_the_work_done_in_it(
        self, client: AsyncClient, session_factory
    ) -> None:
        await _seed_learner(client, session_factory)
        body = (await client.get("/account/export", headers=auth())).json()

        assert len(body["roadmaps"]) == 1
        roadmap = body["roadmaps"][0]
        assert roadmap["goal_id"] == "jee-main"
        # The goal's name, not just its slug: an export reading "jee-main" is
        # markedly less use to a person than one reading "JEE Main".
        assert roadmap["goal_name"] == "JEE Main"
        assert roadmap["completed_tasks"][0]["block_id"] == "b-1"
        assert roadmap["completed_tasks"][0]["minutes_credited"] == 45
        assert roadmap["confidence_ratings"][0]["level"] == "shaky"
        assert roadmap["study_settings"][0]["minutes_by_weekday"] == {"mon": 90}

    @pytest.mark.asyncio
    async def test_carries_streak_preferences_and_purchases(
        self, client: AsyncClient, session_factory
    ) -> None:
        await _seed_learner(client, session_factory)
        body = (await client.get("/account/export", headers=auth())).json()

        assert body["streak"]["current"] == 4
        assert body["streak"]["best"] == 9
        assert body["notification_preferences"]["quiet_from"] == 22
        # Purchase records are kept 8 years for tax and survive an account
        # purge, so the learner is certainly entitled to see them.
        assert body["purchases"][0]["play_order_id"] == "GPA.TEST-1"
        assert body["purchases"][0]["plan"] == "basic"

    @pytest.mark.asyncio
    async def test_keeps_money_and_marks_exact(
        self, client: AsyncClient, session_factory
    ) -> None:
        # Numeric columns are Decimal, exported as strings: a float would be a
        # quiet precision change in a document somebody may hand back to us in
        # support of a refund claim.
        #
        # The values are normalised, so they do NOT carry the column's scale.
        # This test first failed with "599.0000000000" — SQLite's padding —
        # which would have made an exported price depend on which database the
        # server was running. See _decimal_str.
        await _seed_learner(client, session_factory)
        body = (await client.get("/account/export", headers=auth())).json()
        assert body["purchases"][0]["price_paid"] == "599"
        assert body["roadmaps"][0]["test_scores"][0]["score"] == "62.5"
        assert body["roadmaps"][0]["test_scores"][0]["max_score"] == "100"

    @pytest.mark.asyncio
    async def test_a_brand_new_account_exports_cleanly(self, client: AsyncClient) -> None:
        # Somebody who signed in and did nothing else must get a valid file,
        # not a 500 from a missing streak row.
        await client.get("/account/me", headers=auth(user="fresh", email="fresh@example.com"))
        body = (
            await client.get(
                "/account/export", headers=auth(user="fresh", email="fresh@example.com")
            )
        ).json()
        assert body["roadmaps"] == []
        assert body["purchases"] == []
        assert body["streak"] is None
        assert body["notification_preferences"] is None


class TestWhatItMustNotContain:
    @pytest.mark.asyncio
    async def test_never_carries_the_hashed_consent_code(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The worst thing this feature could do. The OTP hash is a
        # password-equivalent and the export is a file people keep.
        await client.get("/account/me", headers=auth())
        await client.patch("/account/me", headers=auth(), json={"birth_year": 2009})
        await client.post(
            "/account/consent/request",
            headers=auth(),
            json={"parent_contact": "parent@example.com"},
        )

        async with session_factory() as session:
            consent = (await session.execute(select(ParentConsent))).scalars().first()
            assert consent is not None and consent.code_hash, "fixture did not store a hash"
            stored_hash = consent.code_hash

        response = await client.get("/account/export", headers=auth())
        assert stored_hash not in response.text
        assert "code_hash" not in response.text

    @pytest.mark.asyncio
    async def test_includes_the_consent_record_itself(
        self, client: AsyncClient
    ) -> None:
        # Excluding the hash must not mean excluding the record: the parent's
        # contact detail is held against this account and the learner is
        # entitled to know we hold it.
        await client.get("/account/me", headers=auth())
        await client.patch("/account/me", headers=auth(), json={"birth_year": 2009})
        await client.post(
            "/account/consent/request",
            headers=auth(),
            json={"parent_contact": "parent@example.com"},
        )
        body = (await client.get("/account/export", headers=auth())).json()
        assert body["parent_consent"][0]["parent_contact"] == "parent@example.com"
        assert body["parent_consent"][0]["method"] == "email"

    @pytest.mark.asyncio
    async def test_carries_none_of_the_forbidden_field_names(
        self, client: AsyncClient, session_factory
    ) -> None:
        # Checked against the real document rather than by reading the code,
        # so a column added to a model later and swept into an export by a
        # well-meaning edit fails here.
        await _seed_learner(client, session_factory)
        body = (await client.get("/account/export", headers=auth())).json()
        present = set(data_export.walk_keys(body))
        leaked = present & data_export.NEVER_EXPORTED
        assert leaked == set(), f"export leaks {sorted(leaked)}"

    @pytest.mark.asyncio
    async def test_never_carries_the_supabase_subject(
        self, client: AsyncClient, session_factory
    ) -> None:
        # auth_id is the join key to the identity provider. It is not useful
        # to the learner and is exactly the sort of identifier that should not
        # travel in a file.
        await _seed_learner(client, session_factory)
        response = await client.get("/account/export", headers=auth())
        assert auth_id("learner-1") not in response.text


class TestItCannotBePointedAtAnybodyElse:
    @pytest.mark.asyncio
    async def test_exports_only_the_token_holder(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The property that makes this endpoint safe: there is no account
        # identifier in the request at all.
        await _seed_learner(client, session_factory, user="victim")
        await client.get("/account/me", headers=auth(user="nosy", email="nosy@example.com"))

        body = (
            await client.get(
                "/account/export", headers=auth(user="nosy", email="nosy@example.com")
            )
        ).json()

        assert body["roadmaps"] == []
        assert body["purchases"] == []
        assert "Asha" not in str(body)

    @pytest.mark.asyncio
    async def test_two_learners_get_their_own_roadmaps(
        self, client: AsyncClient, session_factory
    ) -> None:
        await _seed_learner(client, session_factory, user="learner-1")
        await client.get("/account/me", headers=auth(user="other", email="other@example.com"))

        mine = (await client.get("/account/export", headers=auth())).json()
        theirs = (
            await client.get(
                "/account/export", headers=auth(user="other", email="other@example.com")
            )
        ).json()

        assert len(mine["roadmaps"]) == 1
        assert theirs["roadmaps"] == []
        assert mine["account"]["id"] != theirs["account"]["id"]

    @pytest.mark.asyncio
    async def test_an_account_marked_for_deletion_cannot_export(
        self, client: AsyncClient
    ) -> None:
        # Documented behaviour rather than an accident: current_user refuses a
        # deleted account everywhere, so the export has to be taken first. The
        # app's delete dialog says so, because there is no un-delete.
        await client.get("/account/me", headers=auth())
        await client.delete("/account/me", headers=auth())
        assert (await client.get("/account/export", headers=auth())).status_code == 403


class TestTheBuilderItself:
    @pytest.mark.parametrize(
        "stored,expected",
        [
            # The same value however the column padded it — the property that
            # keeps an export identical on SQLite and Postgres.
            (Decimal("599.00"), "599"),
            (Decimal("599.0000000000"), "599"),
            (Decimal("599"), "599"),
            (Decimal("62.50"), "62.5"),
            (Decimal("62.5000"), "62.5"),
            (Decimal("0.00"), "0"),
            (Decimal("1234.56"), "1234.56"),
            # Never exponent form, which is what a bare normalize() gives for
            # round numbers and would be unreadable in an export.
            (Decimal("1000.00"), "1000"),
            (Decimal("100000"), "100000"),
        ],
    )
    def test_decimals_export_as_their_value_not_their_scale(
        self, stored: Decimal, expected: str
    ) -> None:
        assert data_export._plain(stored) == expected

    def test_dates_become_iso_strings(self) -> None:
        assert data_export._plain(date(2026, 10, 15)) == "2026-10-15"
        assert data_export._plain(
            datetime(2026, 10, 15, 8, 30, tzinfo=timezone.utc)
        ).startswith("2026-10-15T08:30")
        assert data_export._plain(None) is None
        assert data_export._plain(7) == 7

    def test_walk_keys_reaches_nested_lists(self) -> None:
        # The exclusion test above is only as good as this.
        keys = data_export.walk_keys(
            {"a": 1, "b": [{"c": 2}, {"d": [{"code_hash": "x"}]}]}
        )
        assert "code_hash" in keys
        assert set(keys) >= {"a", "b", "c", "d"}
