# FreeMentor — public web pages

The policies and the account-deletion route, as a static site. **No server of
ours is involved**, which is why this costs nothing to host and cannot go down
with the API.

Google Play requires two publicly reachable URLs before the listing goes live:
a privacy policy, and an account-deletion route that works without the app
installed. This is both of them.

## Build

```bash
python web/build.py
```

Renders `docs/legal/*.md` into `web/dist/`, copies the deletion page and
styles, and tells you how many `[PLACEHOLDERS]` are still unfilled. The
markdown stays the single source of truth — edit the documents, not the HTML.

Pages are rendered to **static HTML**, not fetched and rendered client-side. A
Play reviewer or anyone with JavaScript off has to be able to read a privacy
policy.

## Deploy — free, and it does not sleep

Point any of these at `web/dist/`. All are genuinely free for a site this
size, give you HTTPS, and never sleep:

| Host | How |
|---|---|
| **Cloudflare Pages** | connect the repo, build command `python web/build.py`, output `web/dist` |
| **Netlify** | same; `_headers` is already in place |
| **GitHub Pages** | commit `web/dist/` and serve it from the branch |

Then point `freementor.app` at it. The app links to
`https://freementor.app/privacy`, which `build.py` produces as an alias of the
privacy policy — an already-installed build cannot be changed, so that alias
has to keep working.

## How deletion works without a backend

The page signs the learner in with Supabase and sets `deleted_at` on **their
own row**. That is safe because the `users` table has row-level security: the
policy `users_self` permits an update only where `auth_id = auth.uid()`. A
tampered copy of this page cannot touch anybody else's account — the database
refuses it, not the page.

The erasure itself is **not** done by the browser. `purge_deleted_accounts()`
runs as a `pg_cron` job inside Postgres (migration `0004_account_purge.sql`),
daily at 03:15 UTC. It anonymises the row after 30 days and keeps the purchase
record that tax law requires. A browser must not be trusted to decide what
survives.

### One thing you must do before it works

Add the deployed URL to **Supabase → Authentication → URL Configuration →
Redirect URLs**:

```
https://freementor.app/delete-account.html
```

Without it, Google sign-in returns to a blank page — the same failure as a
missing `exp://**` for the app.

## Before publishing

1. Fill every `[PLACEHOLDER]` in `docs/legal/` — entity name, registered
   address, **grievance officer** (mandatory in India), support email.
2. Have a qualified Indian lawyer review them.
3. Rebuild, redeploy, and check `/privacy` and `/delete-account.html` load.
4. Put the privacy-policy URL in the Play Console listing.

## The API serves these too

`server/app/routers/web.py` serves the same pages for local development, so
the server is testable on its own. Production should use this static site: it
is free, it has no cold start, and a learner deleting their account should not
depend on the API being up.
