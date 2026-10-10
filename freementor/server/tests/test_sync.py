"""The sync protocol.

These are the tests that matter most on the server. A learner ticks tasks on a
train with no signal; the queue replays later, possibly twice, possibly in
pieces. If sync loses a tick or double-counts one, the plan the scheduler
builds is wrong and the learner is the one who finds out.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth


def task(enrollment_id: str, block: str, day: str = "2026-10-08", minutes: int = 40) -> dict:
    return {
        "kind": "task_progress",
        "enrollment_id": enrollment_id,
        "block_id": block,
        "scheduled_date": day,
        "completed_at": day,
        "minutes_credited": minutes,
    }


async def post(client: AsyncClient, ops: list[dict]) -> dict:
    response = await client.post("/progress", json={"operations": ops}, headers=auth())
    assert response.status_code == 200, response.text
    return response.json()


async def snapshot(client: AsyncClient, enrollment_id: str) -> dict:
    response = await client.get(f"/progress/{enrollment_id}", headers=auth())
    assert response.status_code == 200, response.text
    return response.json()


class TestIdempotence:
    async def test_replaying_a_batch_twice_changes_nothing(
        self, client: AsyncClient, enrollment: str
    ):
        ops = [task(enrollment, "py-setup-learn"), task(enrollment, "py-setup-read")]

        first = await post(client, ops)
        after_first = await snapshot(client, enrollment)

        # The device uploaded, lost the response, and retried.
        second = await post(client, ops)
        after_second = await snapshot(client, enrollment)

        assert first["applied"] == 2
        assert second["applied"] == 2
        assert after_first == after_second
        assert len(after_second["completed"]) == 2

    async def test_a_split_batch_lands_the_same_as_a_whole_one(
        self, client: AsyncClient, enrollment: str
    ):
        ops = [task(enrollment, f"block-{i}") for i in range(6)]

        await post(client, ops[:3])
        await post(client, ops[3:])
        split = await snapshot(client, enrollment)

        assert len(split["completed"]) == 6

    async def test_order_within_a_batch_does_not_matter(
        self, client: AsyncClient, enrollment: str
    ):
        ops = [task(enrollment, f"block-{i}") for i in range(4)]
        await post(client, list(reversed(ops)))
        assert len((await snapshot(client, enrollment))["completed"]) == 4


class TestConflicts:
    async def test_a_later_tick_wins(self, client: AsyncClient, enrollment: str):
        await post(client, [task(enrollment, "b1", day="2026-10-08", minutes=40)])
        await post(client, [task(enrollment, "b1", day="2026-10-09", minutes=55)])

        entry = (await snapshot(client, enrollment))["completed"]["b1"]
        assert entry["completedAt"] == "2026-10-09"
        assert entry["minutesCredited"] == 55

    async def test_an_older_replay_never_moves_a_tick_backwards(
        self, client: AsyncClient, enrollment: str
    ):
        # A queue entry from before the device went offline arrives late.
        await post(client, [task(enrollment, "b1", day="2026-10-09", minutes=55)])
        await post(client, [task(enrollment, "b1", day="2026-10-08", minutes=40)])

        entry = (await snapshot(client, enrollment))["completed"]["b1"]
        assert entry["completedAt"] == "2026-10-09", "an old replay overwrote a newer tick"
        assert entry["minutesCredited"] == 55


class TestUnticking:
    async def test_a_task_can_be_unticked(self, client: AsyncClient, enrollment: str):
        await post(client, [task(enrollment, "b1")])
        await post(
            client,
            [{"kind": "task_progress_delete", "enrollment_id": enrollment, "block_id": "b1"}],
        )
        assert (await snapshot(client, enrollment))["completed"] == {}

    async def test_unticking_something_absent_is_not_an_error(
        self, client: AsyncClient, enrollment: str
    ):
        result = await post(
            client,
            [{"kind": "task_progress_delete", "enrollment_id": enrollment, "block_id": "ghost"}],
        )
        assert result["rejected"] == []


class TestOtherOperations:
    async def test_confidence_and_scores_and_rest_days_round_trip(
        self, client: AsyncClient, enrollment: str
    ):
        await post(
            client,
            [
                {
                    "kind": "confidence",
                    "enrollment_id": enrollment,
                    "topic_id": "py-setup",
                    "level": "mastered",
                    "rated_at": "2026-10-08",
                },
                {
                    "kind": "test_score",
                    "enrollment_id": enrollment,
                    "block_or_milestone_id": "weekly-test:2026-10-10",
                    "score": 7,
                    "max_score": 10,
                    "taken_at": "2026-10-10",
                },
                {
                    "kind": "rest_day",
                    "enrollment_id": enrollment,
                    "date": "2026-10-11",
                    "is_rest": True,
                },
            ],
        )

        snap = await snapshot(client, enrollment)
        assert snap["confidence"]["py-setup"]["level"] == "mastered"
        assert snap["test_scores"]["weekly-test:2026-10-10"]["score"] == 7
        assert snap["rest_days"] == ["2026-10-11"]

    async def test_a_rest_day_can_be_cancelled(self, client: AsyncClient, enrollment: str):
        base = {"kind": "rest_day", "enrollment_id": enrollment, "date": "2026-10-11"}
        await post(client, [{**base, "is_rest": True}])
        await post(client, [{**base, "is_rest": False}])
        assert (await snapshot(client, enrollment))["rest_days"] == []

    async def test_an_unknown_confidence_level_is_rejected_not_stored(
        self, client: AsyncClient, enrollment: str
    ):
        result = await post(
            client,
            [
                {
                    "kind": "confidence",
                    "enrollment_id": enrollment,
                    "topic_id": "py-setup",
                    "level": "extremely_confident",
                    "rated_at": "2026-10-08",
                }
            ],
        )
        assert result["applied"] == 0
        assert result["rejected"]
        assert (await snapshot(client, enrollment))["confidence"] == {}


class TestIsolation:
    async def test_one_learner_cannot_write_to_another_enrollment(
        self, client: AsyncClient, enrollment: str
    ):
        other = auth("learner-2", "two@example.com")
        response = await client.post(
            "/progress",
            json={"operations": [task(enrollment, "b1")]},
            headers=other,
        )

        assert response.status_code == 200
        assert response.json()["applied"] == 0, "wrote into someone else's enrollment"
        assert (await snapshot(client, enrollment))["completed"] == {}

    async def test_one_learner_cannot_read_another_snapshot(
        self, client: AsyncClient, enrollment: str
    ):
        other = auth("learner-2", "two@example.com")
        response = await client.get(f"/progress/{enrollment}", headers=other)
        assert response.status_code == 404


class TestGuards:
    async def test_a_request_without_a_token_is_refused(
        self, client: AsyncClient, enrollment: str
    ):
        response = await client.post("/progress", json={"operations": []})
        assert response.status_code == 401

    async def test_an_impossible_score_is_refused(self, client: AsyncClient, enrollment: str):
        response = await client.post(
            "/progress",
            json={
                "operations": [
                    {
                        "kind": "test_score",
                        "enrollment_id": enrollment,
                        "block_or_milestone_id": "t1",
                        "score": 12,
                        "max_score": 10,
                        "taken_at": "2026-10-10",
                    }
                ]
            },
            headers=auth(),
        )
        # Either schema-rejected or applied-and-rejected, but never stored.
        if response.status_code == 200:
            assert response.json()["applied"] == 0
        else:
            assert response.status_code == 422

    @pytest.mark.parametrize("minutes", [-1, 24 * 60 + 1])
    async def test_impossible_minutes_are_refused(
        self, client: AsyncClient, enrollment: str, minutes: int
    ):
        response = await client.post(
            "/progress",
            json={"operations": [task(enrollment, "b1", minutes=minutes)]},
            headers=auth(),
        )
        assert response.status_code == 422

    async def test_a_batch_is_bounded(self, client: AsyncClient, enrollment: str):
        ops = [task(enrollment, f"b{i}") for i in range(501)]
        response = await client.post(
            "/progress", json={"operations": ops}, headers=auth()
        )
        assert response.status_code == 422
