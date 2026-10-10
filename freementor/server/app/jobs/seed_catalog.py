"""Seed the goals table from the library's catalog.json.

The catalog also ships inside the app bundle, so this table is not what the
learner browses — it is what the server needs in order to answer "is there a
newer version of this roadmap?" and to let enrollments reference a real goal.

Idempotent: run it again after the library changes and it updates in place
rather than duplicating. Enrollments point at goals.id, so a goal is never
deleted here even if it leaves the catalog — that would orphan a learner's
roadmap.

    python -m app.jobs.seed_catalog
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Goal

# ../../../../ from app/jobs/ is the kit root, which holds library/.
LIBRARY = Path(__file__).resolve().parents[4] / "library" / "FreeMentor_Library"
CATALOG = LIBRARY / "catalog.json"


async def seed() -> tuple[int, int, int]:
    """Returns (inserted, updated, untouched)."""
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    inserted = updated = untouched = 0

    async with SessionLocal() as session:
        existing = {
            goal.id: goal for goal in (await session.execute(select(Goal))).scalars().all()
        }

        for entry in catalog["goals"]:
            fields = {
                "name": entry["name"],
                "category": entry["category"],
                "group": entry.get("group"),
                "type": entry["type"],
                "status": entry["status"],
                "est_hours": entry.get("estimated_hours"),
                "official_url": entry.get("official_url"),
                "eligibility_note": entry.get("eligibility_note"),
            }

            current = existing.get(entry["id"])
            if current is None:
                session.add(Goal(id=entry["id"], **fields))
                inserted += 1
                continue

            changed = [k for k, v in fields.items() if getattr(current, k) != v]
            if changed:
                for key, value in fields.items():
                    setattr(current, key, value)
                updated += 1
            else:
                untouched += 1

        await session.commit()

    # A goal that vanished from the catalog is reported, never deleted:
    # enrollments reference it, and dropping it would orphan a roadmap.
    catalog_ids = {entry["id"] for entry in catalog["goals"]}
    stale = sorted(set(existing) - catalog_ids)
    if stale:
        print(f"  note: {len(stale)} goal(s) in the database are no longer in the catalog:")
        for goal_id in stale:
            print(f"    {goal_id}  (left in place — enrollments may reference it)")

    return inserted, updated, untouched


async def main() -> None:
    inserted, updated, untouched = await seed()
    total = inserted + updated + untouched
    print(f"catalog seeded: {total} goals  ({inserted} new, {updated} updated, {untouched} same)")


if __name__ == "__main__":
    asyncio.run(main())
