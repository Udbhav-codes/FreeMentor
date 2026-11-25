"""Back up every table to one JSON file.

    python -m app.scripts.export_data
    python -m app.scripts.export_data --out backups/2026-12-01.json

Supabase's free tier has no automatic backups, and the `purchases` table holds
records the privacy policy promises to keep for 8 years. Run this monthly (and
before any migration) and keep the file somewhere private. It reads through
the same connection the API uses, so it needs only DATABASE_URL, not pg_dump.

The file contains personal data, consent-code hashes and purchase records.
It is git-ignored (`backups/`); do not commit it, email it or upload it to a
public place.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models import Base


def _plain(value: Any) -> Any:
    """JSON-safe: timestamps as ISO, decimals as strings (never lose a paisa)."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (bytes, bytearray)):
        return value.hex()
    return value


async def dump_tables(session: AsyncSession) -> dict[str, Any]:
    """Every table's rows, keyed by table name, in dependency order."""
    tables: dict[str, list[dict[str, Any]]] = {}
    for table in Base.metadata.sorted_tables:
        rows = (await session.execute(select(table))).mappings().all()
        tables[table.name] = [{k: _plain(v) for k, v in row.items()} for row in rows]
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "row_counts": {name: len(rows) for name, rows in tables.items()},
        "tables": tables,
    }


async def main(out: Path) -> None:
    async with SessionLocal() as session:
        document = await dump_tables(session)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(document, indent=2, ensure_ascii=False), encoding="utf-8")
    total = sum(document["row_counts"].values())
    print(f"Wrote {total} rows from {len(document['row_counts'])} tables to {out}")


if __name__ == "__main__":
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=Path(f"backups/freementor-{stamp}.json"))
    args = parser.parse_args()
    asyncio.run(main(args.out))
