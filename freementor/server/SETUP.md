# Connecting the server to Supabase

Project: **freementor App** · ref `demkvsslqfkreicbjjmm` · region `ap-south-1`
API URL: `https://demkvsslqfkreicbjjmm.supabase.co`

Four steps. Only the first needs the Supabase dashboard.

## 1. Apply the schema

Supabase dashboard → **SQL Editor** → New query → paste the whole of
`migrations/0001_initial.sql` → **Run**.

Use this file, not the SQLAlchemy models. The SQL carries the row-level
security policies that keep one learner from reading another's rows, and
`app/db.py` deliberately refuses to create tables against Postgres for that
reason.

It should report success and create 17 tables. Verify in **Table Editor**, and
check **Advisors → Security** shows no "RLS disabled" warnings.

## 2. Collect the secrets

| Where in the dashboard | Goes into `.env` as |
|---|---|
| Project Settings → Database → Connection string → **URI** | `DATABASE_URL` |
| Project Settings → API → **Project URL** | `SUPABASE_URL` |
| Project Settings → API → JWT Settings → **JWT Secret** | `SUPABASE_JWT_SECRET` |
| Project Settings → API → **service_role** key | `SUPABASE_SERVICE_KEY` |

The connection string contains your database password — if you have not set
one, the dashboard will offer to generate it.

## 3. Write `.env`

`.env` is git-ignored. Never commit it, and never put any of these in the app
bundle (CLAUDE.md: secrets live on the server only).

```
DATABASE_URL=postgresql://postgres:<password>@db.demkvsslqfkreicbjjmm.supabase.co:5432/postgres
SUPABASE_URL=https://demkvsslqfkreicbjjmm.supabase.co
SUPABASE_JWT_SECRET=<jwt secret>
SUPABASE_SERVICE_KEY=<service_role key>
SUPABASE_STORAGE_BUCKET=library
ENVIRONMENT=development
```

Set `ENVIRONMENT=production` only on the real deployment. It makes the server
refuse to start if any of the above are missing, so it can never run on the
local stub verifier in front of real learners.

## 4. Check it

```bash
uvicorn app.main:app --reload --port 8000
curl http://127.0.0.1:8000/health
```

Expect `"database":"postgres"` and `"verifies_real_tokens":true`. If either
still reads `sqlite` or `false`, the `.env` is not being picked up.

## Client-side keys (safe to ship)

These are designed to sit in the app bundle — they identify the project, they
do not grant access. Access is decided by row-level security.

```
Project URL:      https://demkvsslqfkreicbjjmm.supabase.co
Publishable key:  sb_publishable_npXHgnLqTnC2LyEfH3UxoQ_5m9u8S66
```

Prefer the publishable key over the legacy `anon` JWT: it can be rotated on
its own.

## Still to wire up

- **Google sign-in** — Authentication → Providers → Google, with a client from
  Google Cloud. Until then the app uses the local stub token.
- **Storage** — create a `library` bucket for `goals/<id>.json`, and one for
  profile photos.
- **Consent OTP** — the send side of `/account/consent/request`.
