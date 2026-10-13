# FreeMentor admin

Coupons, learners and the published library — product plan §10.3 and §16.

**Local only.** This is not hosted and should not be. It mints discount codes
and lists learners, so Vite binds to `127.0.0.1` rather than `0.0.0.0` and the
page is `noindex`. Nothing here is part of the app bundle.

## Running it

Two terminals, from `freementor/`:

```bash
cd server && .venv/Scripts/activate && uvicorn app.main:app --port 8000
```

```bash
npm run dev -w admin          # http://127.0.0.1:5173
```

The panel calls `/api/...` and Vite proxies that to port 8000, so the browser
only ever makes same-origin requests and CORS never arises. Point it elsewhere
with `ADMIN_API_URL`.

## Getting in

Access is an email allowlist, matched against the **verified** JWT. Add
yourself in `server/.env`:

```
ADMIN_EMAILS=you@example.com
```

An empty setting means **nobody** is an admin — the safe reading of a check
that might be missing. Then mint a token:

```bash
cd server && python -m app.scripts.admin_token
```

Paste it into the panel. It lasts an hour by default (`--minutes`), is kept in
`sessionStorage`, and is dropped when you close the tab.

There is no sign-in form on purpose: a password would be a second credential
to look after, and the server already verifies Supabase JWTs. If the panel
ever needs to be more than a local tool, swap the paste box for Supabase
Google sign-in rather than inventing an admin password.

## What it does

| Tab | |
|---|---|
| Dashboard | learners, enrollments, confirmed purchases, active coupons, goals published |
| Coupons | create at the six tiers, see usage, archive and reactivate |
| Learners | read only, searchable by email |
| Library | the current published version of each goal |

Coupon codes are generated server-side with a CSPRNG, or you can supply one in
the `^[A-Z]{6}[0-9]{3}$` format. Only the six tiers with pre-made Play products
are offered — a coupon for any other percentage would dead-end at the payment
sheet. Archiving keeps the row, because purchases reference it and usage
history has to survive; it stops the code working for learners immediately.

Every create and status change writes an `audit_log` row naming the admin. A
90%-off code is worth real money, so "who made this" stays answerable.

## What it does not do

Publishing the library is still `python -m app.jobs.publish_library` — the
panel shows what is published but does not publish. Giving a web button the
service key to overwrite the CDN is a bigger decision than it looks, and the
job is one command.
