"""Publish the goal files to Supabase Storage and record their versions.

This is what replaces the dev file server. Once a goal file is here, the app
downloads it over a CDN instead of from somebody's laptop, and
`libraryBaseUrl` in the app stops pointing at a LAN address.

Two things happen per goal, in this order:

  1. the JSON is uploaded to the `library` bucket as `goals/<id>.json`
  2. a `library_versions` row records the version and a checksum

Order matters. A version row pointing at a file that is not there yet would
send every device to a 404; a file with no version row is simply unreferenced
and harmless.

The bucket is PUBLIC, and that is deliberate: these files contain only links
to material that is already public, no learner data, and the app must be able
to fetch one before a learner has paid. What is paid for is the roadmap's
scheduling and tracking, not secrecy over a list of URLs.

    python -m app.jobs.publish_library            # changed files only
    python -m app.jobs.publish_library --force    # re-upload everything
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
from pathlib import Path

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.db import SessionLocal
from app.models import Goal, LibraryVersion

LIBRARY = Path(__file__).resolve().parents[4] / "library" / "FreeMentor_Library"
GOALS_DIR = LIBRARY / "goals"
BUCKET_IS_PUBLIC = True


def checksum(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def ensure_bucket(client: httpx.AsyncClient, base: str, name: str) -> None:
    response = await client.get(f"{base}/storage/v1/bucket/{name}")
    if response.status_code == 200:
        return

    created = await client.post(
        f"{base}/storage/v1/bucket",
        json={
            "id": name,
            "name": name,
            "public": BUCKET_IS_PUBLIC,
            # A goal file is well under this; the cap stops a bad publish
            # from filling the bucket.
            "file_size_limit": 5 * 1024 * 1024,
            "allowed_mime_types": ["application/json"],
        },
    )
    if created.status_code not in (200, 201):
        raise RuntimeError(f"could not create bucket '{name}': {created.status_code} {created.text}")
    print(f"  created bucket '{name}' (public={BUCKET_IS_PUBLIC})")


async def upload(
    client: httpx.AsyncClient, base: str, bucket: str, path: str, data: bytes
) -> str:
    """Uploads, overwriting. Returns the public URL."""
    response = await client.post(
        f"{base}/storage/v1/object/{bucket}/{path}",
        content=data,
        headers={
            "Content-Type": "application/json",
            # Overwrite rather than fail when republishing a version.
            "x-upsert": "true",
            # Goal files change rarely and are versioned by content.
            "cache-control": "max-age=3600",
        },
    )
    if response.status_code not in (200, 201):
        raise RuntimeError(f"upload failed for {path}: {response.status_code} {response.text}")
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


async def publish(force: bool = False) -> None:
    settings = get_settings()
    if not settings.supabase_service_key or not settings.supabase_url:
        raise SystemExit(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set — see SETUP.md."
        )

    base = settings.supabase_url.rstrip("/")
    bucket = settings.supabase_storage_bucket
    files = sorted(GOALS_DIR.glob("*.json"))
    if not files:
        raise SystemExit(f"no goal files found in {GOALS_DIR}")

    headers = {
        "Authorization": f"Bearer {settings.supabase_service_key}",
        "apikey": settings.supabase_service_key,
    }

    uploaded = skipped = 0

    async with httpx.AsyncClient(headers=headers, timeout=60) as client:
        await ensure_bucket(client, base, bucket)

        async with SessionLocal() as session:
            known_goals = {
                row for row in (await session.execute(select(Goal.id))).scalars().all()
            }
            versions = {
                (v.goal_id, v.version): v
                for v in (await session.execute(select(LibraryVersion))).scalars().all()
            }

            for path in files:
                goal_id = path.stem
                data = path.read_bytes()
                digest = checksum(data)
                version = json.loads(data)["goal"]["version"]

                if goal_id not in known_goals:
                    # library_versions.goal_id is a foreign key; seed first.
                    print(f"  {goal_id}: not in the goals table — run seed_catalog first")
                    continue

                existing = versions.get((goal_id, version))
                if existing and existing.checksum == digest and not force:
                    skipped += 1
                    continue

                url = await upload(client, base, bucket, f"goals/{goal_id}.json", data)

                if existing:
                    existing.checksum = digest
                    existing.file_url = url
                    action = "re-uploaded"
                else:
                    session.add(
                        LibraryVersion(
                            goal_id=goal_id,
                            version=version,
                            file_url=url,
                            checksum=digest,
                        )
                    )
                    action = "published"

                uploaded += 1
                print(f"  {goal_id:<16} {version:<10} {len(data) // 1024:>4} KB  {action}")

            await session.commit()

    print(f"\n{uploaded} uploaded, {skipped} unchanged")
    if uploaded:
        print(f"public base: {base}/storage/v1/object/public/{bucket}/goals/")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-upload unchanged files")
    args = parser.parse_args()
    asyncio.run(publish(force=args.force))


if __name__ == "__main__":
    main()
