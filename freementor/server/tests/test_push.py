"""Push: the send policy, device registration, and notification preferences.

FCM itself is not implemented — there is no Firebase project — and `FcmSender`
raises rather than pretending. What IS testable, and is what will be wrong if
anything is, is the policy deciding whether a message may be sent at all, and
the device-token bookkeeping underneath it.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app import push
from app.config import Settings
from app.models import DeviceToken
from tests.conftest import auth, auth_id


def msg(category: push.Category = push.Category.STREAK) -> push.Message:
    return push.Message(title="t", body="b", category=category)


class TestQuietHours:
    """A direct port of the app's notifications/quiet.ts; kept identical."""

    @pytest.mark.parametrize(
        "hour,expected",
        [(21, False), (22, True), (23, True), (0, True), (6, True), (7, False), (12, False)],
    )
    def test_a_window_that_wraps_midnight(self, hour: int, expected: bool) -> None:
        # 22:00 -> 07:00, which is what a learner actually sets.
        assert push.is_quiet(hour, 22, 7) is expected

    @pytest.mark.parametrize(
        "hour,expected",
        # Half-open: the `from` hour is quiet, the `to` hour is not.
        [(8, False), (9, True), (12, True), (16, True), (17, False)],
    )
    def test_a_window_inside_one_day(self, hour: int, expected: bool) -> None:
        assert push.is_quiet(hour, 9, 17) is expected

    def test_no_window_is_never_quiet(self) -> None:
        assert push.is_quiet(3, None, None) is False

    def test_half_a_window_is_treated_as_none(self) -> None:
        # Which is exactly why the API refuses to store half a window.
        assert push.is_quiet(3, 22, None) is False
        assert push.is_quiet(3, None, 7) is False


class TestMaySend:
    def test_sends_when_nothing_objects(self) -> None:
        assert push.may_send(msg(), prefs=None, local_hour=10).send is True

    def test_a_learner_with_no_prefs_row_gets_everything(self) -> None:
        # Matches the column defaults: all switches on.
        for category in push.Category:
            assert push.may_send(msg(category), prefs=None, local_hour=10).send is True

    def test_respects_the_switch_for_its_own_category(self) -> None:
        decision = push.may_send(
            msg(push.Category.STREAK), prefs={"streak": False}, local_hour=10
        )
        assert decision.send is False
        assert "streak" in decision.reason

    def test_a_switch_does_not_silence_other_categories(self) -> None:
        prefs = {"streak": False}
        assert push.may_send(msg(push.Category.WEEKLY_REPORT), prefs=prefs, local_hour=10).send

    def test_quiet_hours_stop_a_wanted_message(self) -> None:
        # The reason this policy lives on the server at all: a push arrives
        # from outside the app, so nothing on the phone can suppress it.
        decision = push.may_send(
            msg(), prefs={"quiet_from": 22, "quiet_to": 7}, local_hour=23
        )
        assert decision.send is False
        assert decision.reason == "quiet hours"

    def test_outside_quiet_hours_it_sends(self) -> None:
        assert push.may_send(
            msg(), prefs={"quiet_from": 22, "quiet_to": 7}, local_hour=12
        ).send

    def test_every_category_maps_to_a_real_prefs_column(self) -> None:
        # A new category must be given a switch rather than quietly
        # bypassing the learner's choices.
        from app.models import NotificationPrefs

        columns = set(NotificationPrefs.__table__.columns.keys())
        for category in push.Category:
            assert category.value in columns, category


class TestLocalHour:
    def test_converts_utc_to_india(self) -> None:
        # 18:30 UTC is midnight IST.
        assert push.local_hour(datetime(2026, 10, 16, 18, 30, tzinfo=timezone.utc)) == 0
        assert push.local_hour(datetime(2026, 10, 16, 4, 0, tzinfo=timezone.utc)) == 9

    def test_wraps_rather_than_overflowing(self) -> None:
        assert 0 <= push.local_hour(datetime(2026, 10, 16, 23, 59, tzinfo=timezone.utc)) <= 23


class TestTheSender:
    def test_the_real_one_refuses_rather_than_pretending(self) -> None:
        # Delivering nothing while reporting success is the failure nobody
        # notices for weeks.
        sender = push.FcmSender("proj", "{}")
        with pytest.raises(NotImplementedError, match="Firebase"):
            import asyncio

            asyncio.run(sender.send("token", msg()))

    def test_without_credentials_the_console_sender_stands_in(self) -> None:
        assert isinstance(push.get_sender("local", "", ""), push.ConsoleSender)
        assert isinstance(push.get_sender("production", "", ""), push.ConsoleSender)

    def test_with_credentials_the_real_one_is_chosen(self) -> None:
        assert isinstance(push.get_sender("production", "proj", "{}"), push.FcmSender)


class TestDeviceRegistration:
    @pytest.mark.asyncio
    async def test_registers_a_device(self, client: AsyncClient, session_factory) -> None:
        await client.get("/account/me", headers=auth())
        response = await client.post(
            "/push/devices", headers=auth(), json={"token": "fcm-token-abc123"}
        )
        assert response.status_code == 200

        async with session_factory() as session:
            rows = (await session.execute(select(DeviceToken))).scalars().all()
            assert len(rows) == 1
            assert rows[0].token == "fcm-token-abc123"

    @pytest.mark.asyncio
    async def test_registering_twice_does_not_duplicate(self, client: AsyncClient, session_factory) -> None:
        # Called on every app start, because FCM rotates the token on
        # restore, reinstall or a data clear.
        await client.get("/account/me", headers=auth())
        for _ in range(3):
            await client.post("/push/devices", headers=auth(), json={"token": "same-token"})

        async with session_factory() as session:
            rows = (await session.execute(select(DeviceToken))).scalars().all()
            assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_a_shared_device_moves_rather_than_duplicating(
        self, client: AsyncClient, session_factory
    ) -> None:
        # The same phone, a different learner signing in. Leaving the old row
        # would send the new learner's notifications to the old account too.
        await client.get("/account/me", headers=auth(user="first", email="a@example.com"))
        await client.post(
            "/push/devices", headers=auth(user="first", email="a@example.com"),
            json={"token": "one-phone"},
        )
        await client.get("/account/me", headers=auth(user="second", email="b@example.com"))
        await client.post(
            "/push/devices", headers=auth(user="second", email="b@example.com"),
            json={"token": "one-phone"},
        )

        async with session_factory() as session:
            rows = (await session.execute(select(DeviceToken))).scalars().all()
            assert len(rows) == 1, "the device was duplicated across accounts"
            from app.models import User

            second = (
                await session.execute(select(User).where(User.auth_id == auth_id("second")))
            ).scalar_one()
            assert rows[0].user_id == second.id

    @pytest.mark.asyncio
    async def test_unregisters_on_sign_out(self, client: AsyncClient, session_factory) -> None:
        await client.get("/account/me", headers=auth())
        await client.post("/push/devices", headers=auth(), json={"token": "bye-bye-token"})
        response = await client.request(
            "DELETE", "/push/devices", headers=auth(), json={"token": "bye-bye-token"}
        )
        assert response.status_code == 204

        async with session_factory() as session:
            assert (await session.execute(select(DeviceToken))).scalars().all() == []

    @pytest.mark.asyncio
    async def test_cannot_unregister_somebody_elses_device(
        self, client: AsyncClient, session_factory
    ) -> None:
        await client.get("/account/me", headers=auth(user="owner", email="o@example.com"))
        await client.post(
            "/push/devices", headers=auth(user="owner", email="o@example.com"),
            json={"token": "victim-device"},
        )
        await client.get("/account/me", headers=auth(user="nosy", email="n@example.com"))
        await client.request(
            "DELETE", "/push/devices", headers=auth(user="nosy", email="n@example.com"),
            json={"token": "victim-device"},
        )

        async with session_factory() as session:
            assert len((await session.execute(select(DeviceToken))).scalars().all()) == 1

    @pytest.mark.asyncio
    async def test_an_unsigned_request_registers_nothing(self, client: AsyncClient) -> None:
        assert (await client.post("/push/devices", json={"token": "x" * 10})).status_code == 401

    @pytest.mark.asyncio
    async def test_refuses_an_unknown_platform(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        response = await client.post(
            "/push/devices", headers=auth(), json={"token": "tok12345", "platform": "symbian"}
        )
        assert response.status_code == 422


class TestPreferences:
    @pytest.mark.asyncio
    async def test_defaults_to_everything_on(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        body = (await client.get("/push/prefs", headers=auth())).json()
        assert body["daily"] is True
        assert body["streak"] is True
        assert body["quiet_from"] is None

    @pytest.mark.asyncio
    async def test_updates_only_what_was_sent(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        await client.patch("/push/prefs", headers=auth(), json={"streak": False})
        body = (await client.get("/push/prefs", headers=auth())).json()
        assert body["streak"] is False
        assert body["daily"] is True, "an unsent field was overwritten"

    @pytest.mark.asyncio
    async def test_stores_quiet_hours(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        body = (
            await client.patch(
                "/push/prefs", headers=auth(), json={"quiet_from": 22, "quiet_to": 7}
            )
        ).json()
        assert (body["quiet_from"], body["quiet_to"]) == (22, 7)

    @pytest.mark.asyncio
    async def test_refuses_half_a_quiet_window(self, client: AsyncClient) -> None:
        # is_quiet reads a half-set window as "no quiet hours", so storing one
        # would silently not silence anything.
        await client.get("/account/me", headers=auth())
        response = await client.patch("/push/prefs", headers=auth(), json={"quiet_from": 22})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_refuses_an_hour_outside_the_clock(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        response = await client.patch(
            "/push/prefs", headers=auth(), json={"quiet_from": 25, "quiet_to": 7}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_one_learners_prefs_are_their_own(self, client: AsyncClient) -> None:
        await client.get("/account/me", headers=auth())
        await client.patch("/push/prefs", headers=auth(), json={"daily": False})
        other = auth(user="other", email="other@example.com")
        await client.get("/account/me", headers=other)
        assert (await client.get("/push/prefs", headers=other)).json()["daily"] is True


class TestProductionSafety:
    def test_production_without_firebase_still_boots(self) -> None:
        # Push is not load-bearing: a server with no Firebase should run and
        # simply not send, the same way it returns 503 for a purchase.
        settings = Settings(
            environment="production",
            database_url="postgresql://x/y",
            supabase_jwt_secret="s",
            supabase_url="https://x.supabase.co",
            otp_echo=False,
        )
        settings.assert_safe()
        assert settings.firebase_project_id == ""
