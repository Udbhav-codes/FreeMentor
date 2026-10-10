# freementor-server

FastAPI backend for FreeMentor. Read `../../CLAUDE.md` first, then
`../../docs/APP_BUILD_SPEC.md` §7.

The app works offline; this server exists for the things a phone cannot do by
itself: sign-in, delivering library files, keeping progress safe across
devices, verifying purchases, and the jobs that keep links alive.

## Run it

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate elsewhere
pip install -e ".[dev]"
cp .env.example .env          # then fill it in
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Without a `.env`, the server starts in **local mode**: SQLite instead of
Postgres and a stub verifier instead of Supabase JWTs, so the whole API can be
exercised before any cloud account exists.

```bash
pytest
```

## Hard rule

Secrets live here and only here (CLAUDE.md). The Supabase service key, the
YouTube Data API key and the Play service account must never reach the app
bundle. `.env` is git-ignored; `.env.example` holds names only, never values.
