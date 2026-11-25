"""Operational endpoints and the backup export."""

from __future__ import annotations

import json

import pytest
from httpx import AsyncClient

from app.scripts.export_data import dump_tables
from tests.conftest import auth


class TestHealthDb:
    @pytest.mark.asyncio
    async def test_it_touches_the_database(self, client: AsyncClient):
        # /health never queries; this does, which is what a keep-alive for a
        # database that pauses when idle actually needs.
        response = await client.get("/health/db")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    @pytest.mark.asyncio
    async def test_it_is_503_when_the_database_is_unreachable(self, client: AsyncClient):
        from app.db import get_session
        from app.main import app

        class Broken:
            async def execute(self, *a, **k):
                raise OSError("db down")

        async def broken():
            yield Broken()

        app.dependency_overrides[get_session] = broken
        try:
            response = await client.get("/health/db")
        finally:
            app.dependency_overrides.pop(get_session, None)
        assert response.status_code == 503


class TestExport:
    @pytest.mark.asyncio
    async def test_it_dumps_every_table_with_row_counts(
        self, client: AsyncClient, session_factory
    ):
        await client.patch("/account/me", json={"birth_year": 2000}, headers=auth())
        async with session_factory() as session:
            document = await dump_tables(session)
        assert document["row_counts"]["users"] == 1
        assert "purchases" in document["tables"]
        # Must survive json.dumps: timestamps and decimals are made plain.
        json.dumps(document)

    @pytest.mark.asyncio
    async def test_purchases_are_in_the_backup(self, client: AsyncClient, session_factory):
        await client.post(
            "/billing/purchases",
            json={"purchase_token": "test:order-77", "product_id": "basic"},
            headers=auth(),
        )
        async with session_factory() as session:
            document = await dump_tables(session)
        orders = [row["play_order_id"] for row in document["tables"]["purchases"]]
        assert any("order-77" in str(o) for o in orders)
