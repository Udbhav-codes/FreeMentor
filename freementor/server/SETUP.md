# Connecting the server to Supabase

Project: **freementor App** · ref `demkvsslqfkreicbjjmm` · region `ap-south-1`
API URL: `https://demkvsslqfkreicbjjmm.supabase.co`

Four steps. Only the first needs the Supabase dashboard.

## 1. Apply the schema

Supabase dashboard → **SQL Editor** → New query → paste the whole of
`migrations/0001_initial.sql` → **Run**.

The editor will warn that the query "creates tables without enabling Row
Level Security". That warning fires on the `create table` statements and does
not look ahead: this file enables RLS on **all 17 tables** at the bottom, in
the same transaction. **Run it as written — do not let the editor add its own
RLS statements.** Its version would enable RLS without creating the policies,
which locks the server out of its own tables.

Use this file, not the SQLAlchemy models. The SQL carries the row-level
security policies that keep one learner from reading another's rows, and
`app/db.py` deliberately refuses to create tables against Postgres for that
reason.

It should report success and create 17 tables. Verify in **Table Editor**,
then check **Advisors → Security** — it should show no "RLS disabled"
warnings. That is an independent check on the policies, so it is worth doing
rather than taking the migration's word for it.

Four tables — `coupons`, `resources`, `link_reports`, `audit_log` — have RLS
enabled with **no policy at all**. That is deliberate: it denies every anon
and authenticated client while the service key, which bypasses RLS, still
works for the server and the admin panel.

## 2. Collect the secrets

| Where in the dashboard | Goes into `.env` as |
|---|---|
| Project Settings → Database → Connection string → **URI** | `DATABASE_URL` |
| Project Settings → API → **Project URL** | `SUPABASE_URL` |
| Project Settings → API → JWT Settings → **JWT Secret** | `SUPABASE_JWT_SECRET` |
| Project Settings → API → **service_role** key | `SUPABASE_SERVICE_KEY` |

The connection string contains your database password — if you have not set
one, the dashboard will offer to generate it.

### Use the pooler, not the direct host

The dashboard's **direct** connection string points at
`db.<ref>.supabase.co`, which Supabase now resolves to an **IPv6 address
only**. On a network without IPv6 — which includes most Indian home and
office connections — that fails with `getaddrinfo failed`, and the error says
nothing about IPv6.

Use the **Connection pooling** string instead. It is IPv4:

```
postgresql://postgres.<ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

Note the username is `postgres.<ref>`, not `postgres`.

Port **5432 is session mode** and is what this server wants: one backend per
connection, so prepared statements work normally. Port **6543 is transaction
mode**, where a connection can move between backends mid-session — asyncpg's
prepared-statement cache then fails under load with "prepared statement does
not exist". `app/db.py` detects port 6543 and disables that cache, so either
port works, but session mode is the better default for a long-lived server.

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

## Verifying RLS actually works

Configuration is not proof. An empty table returns `[]` to a blocked client
and to an allowed one alike, so a read test tells you nothing until there is
data. Attempt a **write** instead, with a value that would fail a CHECK
constraint anyway — then nothing can persist whichever way it goes:

```bash
U=https://demkvsslqfkreicbjjmm.supabase.co/rest/v1
K=sb_publishable_npXHgnLqTnC2LyEfH3UxoQ_5m9u8S66

curl -s -X POST -H "apikey: $K" -H "Authorization: Bearer $K" \
  -H "Content-Type: application/json" \
  -d '{"code":"bad","discount_tier":90}' "$U/coupons"
```

Expected:

```
{"code":"42501","message":"new row violates row-level security policy for table \"coupons\""}
```

`42501` is the proof. A **400 constraint violation** instead would mean RLS
let the write through and only the CHECK stopped it — the table would be
writable by anyone holding the publishable key, which ships in the app.

Worth re-running after any schema change. Last verified: all 17 tables RLS
enabled, `coupons` and `users` both rejecting anonymous writes.

---

## Deploying the API

`Dockerfile` builds the API. **Build from the repository root**, not from
`server/`:

```bash
docker build -f freementor/server/Dockerfile -t freementor-api .
```

That is the one thing most likely to go wrong, and it fails loudly rather
than quietly: the policy pages live in `docs/legal/`, outside `server/`, so a
context of `server/` alone cannot COPY them and the build stops. An image
without them serves 404 at `/privacy` and `/terms`, which Google Play refuses
a listing for.

### Environment the container needs

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Supavisor pooler, not `db.<ref>.supabase.co` — that host is IPv6-only |
| `SUPABASE_URL` | yes | |
| `SUPABASE_JWT_SECRET` | yes | Without it the server accepts stub tokens; `assert_safe()` refuses to start |
| `SUPABASE_SERVICE_KEY` | yes | Storage uploads |
| `SUPABASE_PUBLISHABLE_KEY` | yes | Injected into the deletion page |
| `OTP_ECHO` | **must be `false`** | `assert_safe()` refuses production with it on |
| `ENVIRONMENT` | `production` | Already set in the image |
| `ADMIN_EMAILS` | no | Empty means nobody is an admin — the safe default |
| `CORS_ORIGINS` | no | The admin panel's origin, if ever hosted. A `*` is refused |
| `FORWARDED_ALLOW_IPS` | **yes, behind a proxy** | See below |
| `EXPOSE_API_DOCS` | no | `/docs` is off in production regardless |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` | no | Without them push logs to the console instead of sending |
| `YOUTUBE_API_KEY` | no | Only the link checker uses it, and that runs separately |

### `FORWARDED_ALLOW_IPS` is not optional behind a proxy

`app/limits.py` keys rate limits on `request.client.host` and deliberately
does **not** trust `X-Forwarded-For`, because any client can send that header
and would otherwise reset its own counter at will. The consequence is that
behind a load balancer every request appears to come from the proxy, so one
noisy client rate-limits everybody. Set this to the proxy's address so uvicorn
resolves the real peer.

### Secrets are never in the image

`.dockerignore` at the repository root excludes `.env`. It is there rather
than beside the Dockerfile on purpose: BuildKit would read
`Dockerfile.dockerignore`, but the classic builder would not, and a
`.dockerignore` that is silently skipped bakes the Postgres password and the
service key into a layer. Layers are not secret.

### Before the first production boot

1. Run `migrations/0001_initial.sql` through `0005_device_tokens.sql` against
   Postgres, in order. **Never** create the schema from the models — the SQL
   carries the RLS policies that SQLAlchemy knows nothing about.
2. Check `/health` reports `"verifies_real_tokens": true` and
   `"otp_echo": false`. A staging box quietly running the local stub verifier
   is exactly the thing nobody notices until it matters.

### Not yet verified

The image has **not been built**: Docker is not installed on the development
machine. Every path it references was checked to exist and `.dockerignore`
was checked to exclude `.env`, but the first real `docker build` may still
surface something — most likely a missing system library for `asyncpg` or
`cryptography`, which is what the two-stage build exists to handle.
