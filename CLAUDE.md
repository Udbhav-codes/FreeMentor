# CLAUDE.md — FreeMentor

Project memory for Claude Code. Read this first, then `docs/APP_BUILD_SPEC.md`. Keep this file updated as the build progresses.

## What we are building
**FreeMentor** — an Android-first (iOS later) mobile app that gives a learner a **personal day-by-day roadmap** to an exam, skill or programming language using **only free, trusted resources** (public YouTube videos, official docs, free practice sites). The app ships a small catalog of 73 goals; when the user picks one, it downloads that goal's pre-built roadmap file and the on-device scheduler turns it into a daily plan.

Full product decisions are in `docs/FreeMentor_Product_Plan.md` — it is the source of truth for scope, pricing, policy and UX. This file is the engineering quick-reference.

## Tech stack (fixed — from the product plan §12)
- **App:** React Native + **TypeScript** (Expo, targeting Android 16 / API 36). Same codebase for iOS later.
- **Offline storage:** SQLite (`expo-sqlite` or WatermelonDB) for the downloaded library + progress + a sync queue.
- **Backend:** Python + **FastAPI** (REST), managed container host.
- **Database:** **PostgreSQL** on Supabase, row-level security.
- **Auth:** Supabase Auth — **Google sign-in** at start.
- **Storage/CDN:** Supabase Storage — versioned `goals/<id>.json` files + profile photos.
- **Push:** Firebase Cloud Messaging (+ local scheduled notifications for daily reminders).
- **Analytics/crashes:** Firebase Analytics + Crashlytics.
- **Payments:** Google Play Billing (`react-native-iap`) + FastAPI verification via the Google Play Developer API.
- **Ads:** Google AdMob (`react-native-google-mobile-ads`) with UMP consent. Premium = no ads.
- **Admin panel:** React web app on the same FastAPI APIs.

**Hard rule:** all secret keys (YouTube Data API, Google Play, Supabase service key) live **only on the server**, never in the app bundle.

## Repo layout to create
```
freementor/
  app/            # React Native (Expo) app — TypeScript
    src/
      screens/    # Roadmap, Progress, Reports, Practice, Profile (+ Day view, Onboarding, Paywall)
      scheduler/  # the on-device scheduler (pure, unit-tested) — see APP_BUILD_SPEC §Scheduler
      db/         # SQLite schema + queries + sync queue
      api/        # typed client for the FastAPI backend
      components/ # shared UI (checklist, progress ring, GPS route, confidence sheet)
      theme/      # colors/typography from the product plan §11 + design/brand
  server/         # FastAPI + PostgreSQL (Supabase) + Play/YouTube integrations
    app/
      routers/    # auth, catalog, enrollments, progress, purchases, coupons, library
      models/     # SQLAlchemy models mirroring docs/APP_BUILD_SPEC data model
      jobs/        # link checker, trial reminders, weekly reports, coupon expiry
  admin/          # React admin panel (coupons, library publishing, users)
  library/        # == the /library folder in this kit; source of goal JSON (published to Supabase Storage)
  shared/         # shared TypeScript types generated from schema/goal.schema.json
```

## The library (already built — in `library/FreeMentor_Library/`)
- `catalog.json` — 73 goals (ships in the app). 12 are `status: "full"` (have a roadmap file); 61 are `outline`.
- `goals/<id>.json` — one roadmap per full goal: `goal → phases → topics (ordered) → blocks (learn/read/practice/recall/test/build) → resources`. **No fixed days** — the scheduler builds days.
- `schema/goal.schema.json` — validate every goal file against this (CI + admin publish). Generate the app's TS types from it.
- `tools/check_links.py` — server cron: fills real YouTube durations via the YouTube Data API and flags dead links. Run monthly.
- Read `library/FreeMentor_Library/README.md` and `docs/FREEMENTOR_LIBRARY_SPEC.md` before touching library format or the scheduler.

Do **not** hand-edit goal JSON in the app repo. The library is authored/validated separately and published to Supabase Storage; the app only downloads and caches it.

## Non-negotiable product rules (enforce in code)
- **YouTube is never ad-gated or paywalled** (`ad_gate_allowed: false`, `access: "all"` on every video). Premium's value is an ad-free UI + premium *notes*, never blocking a video.
- **3-day free trial of Basic**, then one-time **Basic ₹599 / Premium ₹999** per roadmap, **lifetime** access. Switching goal = a new purchase.
- **16+ only**; users under 18 need parent consent and get **non-personalised, G-rated** ads.
- **Missed day → plan shifts forward**; recalculation starts from the next incomplete task; completed ticks are never changed.
- **Streak** = calendar days with a 1-day grace; rest days limited to 1/week and 4/month.
- **Video time shown = real duration × 1.15, rounded up to 5 min.** Until the checker fills durations, use `est_minutes`.
- Links open in the **YouTube app** (videos) or **Chrome Custom Tabs** (notes/practice) — never scrape or re-host content.
- Coupons: `^[A-Z]{6}[0-9]{3}$`, tiers 10/20/30/50/70/90% mapped to pre-made discounted Play products.

## Build order (MVP first — see product plan §17)
1. Scaffold the Expo app + FastAPI server + Supabase project; Google sign-in end to end.
2. Catalog screen from `catalog.json`; goal detail; download + cache a goal file into SQLite.
3. **Scheduler** (pure module, unit-tested against the rules above) → Day view with checklists + confidence rating.
4. Progress + streak; local daily-reminder notifications.
5. Play Billing (trial → Basic/Premium), server-side verification, restore purchases.
6. AdMob with UMP + under-18 rules; paywall/locks per the plan §10.
7. Reports; admin panel (coupons, library publishing); link-checker cron.

## Conventions
- TypeScript strict; the scheduler and billing logic must have unit tests.
- Keep the scheduler **pure and deterministic** (library + user settings + today's date → plan); no network inside it.
- Validate every goal file against the schema in CI.
- Never commit secrets; use env vars and the server for all privileged API calls.

## Status
- [x] Resource library built & validated (12 full goals, schema, tools, review workbook).
- [x] Product plan, brand assets, UI mockup (`design/`).
- [x] **M0** — `freementor/` npm-workspace monorepo; TS types generated from `goal.schema.json`;
      CI-ready validator (`npm run validate:library`) checking schema + catalog agreement +
      block-id uniqueness + the "no ad-gated YouTube" rule. All 12 goal files pass.
- [x] **M1** — on-device scheduler at `app/src/scheduler/`, pure and deterministic.
      **64 unit tests** against the real library. **All 13 rules** of APP_BUILD_SPEC §4 implemented,
      including rule 9 (the final 15% of the timeline reserved for mocks and revision).
- [x] **M2** — Expo SDK 57 app: theme tokens from the mockup (light + dark), 5-tab nav,
      SQLite schema + sync queue, catalog browse/search, goal download + cache, and the
      Roadmap home rendering a real plan offline. Android bundle builds (5 MB export).
- [x] **M3** — onboarding with the **16+ age gate + parent consent** (pure, tested: DPDP
      compliance), the if-then study-time plan, Day view (resources, recall reveal, score
      entry, confidence sheet), GPS roadmap route, **streak** (pure, tested: 1-day grace,
      rest-day protection, 66-day habit counter), Progress tab, local daily reminders.
      **112 tests.**
- [x] **UI build-out** — all eight screens of `design/FreeMentor_App_Preview.png` exist:
      opening animation, weekly-time picker + deadline calculator, Home with the progress
      ring, GPS route, Day view with the video hero card, weekly report, Plans. **149 tests.**
- [~] **M4 in progress** — `server/` FastAPI: Postgres schema with row-level security,
      auth, account + 16/18 age gate, parent-consent request/confirm, enrollments,
      **idempotent progress sync**, catalog/download. **88 server tests.** Runs in a
      *local mode* (SQLite + stub tokens) so the whole API works before any cloud
      account exists; `ENVIRONMENT=production` refuses to start without real secrets.
      **Supabase project is live**: `demkvsslqfkreicbjjmm` (ap-south-1, Postgres 17).
      All 17 tables created with RLS enabled and verified enforcing — an anonymous
      write returns 42501, not a constraint error. See `server/SETUP.md`.
      **Catalog seeded** (73 goals) and **library published** to Supabase Storage —
      the app now downloads roadmaps from a CDN, not from a laptop. Jobs:
      `python -m app.jobs.seed_catalog` · `python -m app.jobs.publish_library`.
      **Parental-consent OTP** (hashed, 10-min expiry, 5-attempt cap, resend limit) and
      **profile photos** (signed upload straight to a private `avatars` bucket) are live
      and verified against Supabase. Delivery is a console sender until there is an
      email/SMS subscription; `OTP_ECHO` returns the code for testing and **production
      refuses to start with it on**.
      **Google sign-in** is wired (web OAuth flow, works in Expo Go): sign-in screen
      before the age gate, real session token on sync, sign-out in Profile. Needs
      `exp://**` in Supabase Redirect URLs to complete in Expo Go, and still needs
      verifying on a device. Native one-tap waits for a dev build. See
      `server/GOOGLE_SIGNIN.md`.
      **Sync is wired** (`SyncProvider`): the queue drains on sign-in and on
      app foreground, with a 30s floor and no overlapping runs. Profile shows the
      last outcome and a Sync now button. Inert until `EXPO_PUBLIC_API_URL` is
      set — there is no deployed server yet.
      **Parent-consent OTP is wired** (`api/consent.ts` + `components/ParentConsent.tsx`):
      birth year -> code to the parent -> confirm, with a 60s resend cooldown
      mirroring the server, an already-consented check so a reinstall does not
      replace a confirmed row with a fresh request, and the server's own wording
      shown on failure. Verified end to end against Postgres: 429 on instant
      resend, wrong code rejected, correct code sets `consent_given`, replay
      idempotent. On a build with no server or no session it falls back to the
      declaration and says so.
      **Avatar upload is wired** (`api/avatar.ts`): the local file stays the
      display source and the upload is a *backup* — the server's read URL is
      signed with a 1 h TTL, so a stored URL would be a broken image by
      tomorrow; the path is stored and a URL minted on demand. Bytes go straight
      to Storage via a signed ticket, never through the API process. Restores
      only when there is no local file (reinstall, new phone) and never
      overwrites a photo already on screen. Verified against real Storage:
      ticket, PUT with `?token=`, 403 on another user's path, signed URL serving
      the bytes back, replacement deleting the old object, 204 on delete.
      **Still to do in M4:** FCM.
- [~] **M5 in progress** — everything except Google Play itself. Server:
      `/billing/coupons/validate`, `/billing/purchases` (verified, idempotent on
      the Play order id), `/billing/entitlement` (scoped per enrollment).
      Rules are pure in `app/billing.py`; the Play verifier is pluggable
      (`app/play.py`) with `GooglePlayVerifier` deliberately raising rather than
      pretending, and `LocalVerifier` accepting only a `test:` token. A
      production server with no Play credentials returns 503 for a purchase but
      still boots. App: `api/billing.ts`, real coupon validation on Plans,
      trial disclosure per §10.4, and `useEntitlement` now reads the verified
      plan from the server. **Blocked on a Play Console account** for
      `react-native-iap` and the real verifier — that is the remaining work.
- [ ] M6 Ads/Admin.

### Not yet built (known gaps)
- **Plans cannot take money yet.** Coupon validation, purchase recording and
  entitlement are built, tested and verified against Postgres; what is missing
  is Google Play Billing itself, which needs a Play Console account and a dev
  build. The buy button says exactly that rather than "coming soon". The **trial clock and the lock system now work**:
  `billing/trial.ts` (pure, 16 tests, clock-rewind resistant via a persisted
  high-water mark) drives `entitlementFor()`, and after 3 days everything but
  YouTube returns `needs_plan` and routes to Plans. Ads themselves are M6, so an
  `ad_gated` resource currently opens after a confirm dialog rather than an ad.
- Parent consent is **verified by OTP** when a server is reachable. With no
  `EXPO_PUBLIC_API_URL` or no session (including under the dev sign-in bypass) it
  degrades to the declaration, which says so plainly. Nothing records consent
  locally — the server is authoritative — so clearing app data re-asks, and the
  `alreadyConsented()` check then short-circuits it.
- A **downloadable export** of progress does not exist (the server has no export
  endpoint); sync itself does.
- No ads at all yet (M6), so the "notes after a rewarded ad" tier does nothing.
- Hindi UI strings are not translated; only the library's Hindi resources are used.

### Roadmap tab and week locking
The Roadmap tab is a **FlatList**, not a ScrollView: the dashboard is its
header and the route's weeks are its data. The route is inline there now (no
separate `/route` screen — it was deleted, not left unreachable), and the
today-only checklist was removed on the owner's instruction. A ScrollView
would mount all ~72 weeks of a long plan eagerly, which is what put the route
on its own screen in the first place.

`progress/weekLock.ts` is pure and date-driven: week 1 is always open, every
later week opens on the **Saturday of the week before it** (ISO weeks, so the
Monday minus two days). Nothing is persisted, so there is no unlock state to
drift when a missed day shifts the plan. `progress/routeWeeks.ts` holds
`groupIntoWeeks`, moved out of RouteList.tsx so the ISO-week assumption the
lock depends on is testable. The padlock is drawn from two Views in theme
colours — not the emoji (colour) and not an icon font (~1 MB of TTF).

### The new-user flow (verified end to end)
```
OpeningAnimation  (_layout.tsx)
  -> sign-in       Google OAuth; nothing personal is asked before it (§15)
  -> onboarding    age gate (16+) -> parent consent if 16/17 -> name + optional
                   photo -> language -> reminders
  -> choose        the 73-goal catalog
  -> goal/[id]     about -> QUALIFICATION -> weekly time + deadline -> build
  -> (tabs)        dashboard
```
Qualification sits in `goal/[id]`, not in onboarding, because
`catalog.json` gives each goal its own `qualification_options` — 4 distinct
sets across the 73 goals (JEE/NEET ask Class 10/11/12/Dropper; the
programming tracks ask college/graduated; two ask Working professional). It
cannot be answered before a goal exists.

### Testing the flow without Google sign-in
Google's web OAuth needs `exp://**` in Supabase -> Authentication -> URL
Configuration -> Redirect URLs. Until that is added the browser returns
"This site can't be reached". To test everything after sign-in:
```bash
EXPO_PUBLIC_DEV_SKIP_AUTH=1 npm start
```
A "Skip sign-in and continue" card then appears on the sign-in screen.
It is gated on `__DEV__` **and** that flag, re-checked whenever the stored
value is read, so a phone that enabled it in development cannot carry it into
a release build. Nothing syncs while it is active (there is no token) and
Profile says so. Remove `exp://**` before the production launch.

### Working notes
- Run from `freementor/`: `npm test -w app` · `npm run validate:library` · `npm run types`.
- **Server**: `cd server && .venv/Scripts/activate && pytest` · run it with
  `uvicorn app.main:app --reload --port 8000`. With no `.env` it uses SQLite and a stub
  token (`Authorization: Bearer local:<id>:<email>`), so the API is usable immediately.
  Postgres must be migrated with `migrations/0001_initial.sql`, never from the models —
  the SQL carries the RLS policies that SQLAlchemy knows nothing about.
- **To run the app on a phone** (two terminals, same Wi-Fi):
  `npm run library:serve` then
  `EXPO_PUBLIC_LIBRARY_URL=http://<your-lan-ip>:8787 npm start` and scan the QR in Expo Go.
  The serve script prints the LAN IP to use.
- **Amber (`#F2A900`) is a FILL, never text.** It is only 1.78:1 on our background,
  which fails text contrast and even the 3:1 floor for UI elements. Amber-coloured
  *words* use `colors.accentInk` (`#7A5600`, 5.9:1). Product plan §11.2 originally
  reserved amber for "streak and today"; it now also marks the active tab, an earned
  badge, a mock-test day, section rules and the weekly takeaway — always alongside a
  non-colour cue, so nothing is conveyed by amber alone.
- Routes live in `app/src/app/` (expo-router). Fonts are imported **per weight**
  (`@expo-google-fonts/inter/400Regular`) — importing the package root pulls in all 18
  weights and ~6 MB of unused TTFs.
- Goal files come from Supabase Storage (public bucket, CDN). `EXPO_PUBLIC_LIBRARY_URL`
  still overrides it, so `npm run library:serve` works offline and for library edits.
- **Library refresh**: `publish_library` writes `versions.json` (goal id -> version)
  beside the goal files, always last so it cannot advertise a file still uploading.
  The app checks it at startup and on foreground, at most every 6 h, and
  re-downloads only cached goals whose version differs — it never pre-fetches the
  other 72. A failed check is a no-op: the cached roadmap stays. When a goal is
  re-downloaded, `EnrollmentContext` reloads so the plan is rebuilt from the new
  file. `catalog.json` cannot do this job: it is 112 KB and ships in the bundle.
- **Supabase's direct host `db.<ref>.supabase.co` is IPv6-only.** On an IPv4-only network
  it fails with `getaddrinfo failed`, which looks like a bad hostname. Use the Supavisor
  pooler (`aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`). See server/SETUP.md.
- Server models use `Uuid(as_uuid=False)` for id columns, not `String(36)`, and
  `JSONCol` for jsonb columns, not `Text`: SQLite accepts the wrong one and Postgres
  rejects it, so a SQLite suite structurally cannot catch the difference. Both have
  shipped as bugs. `tests/test_schema_matches_migration.py` now compares the models'
  compiled Postgres DDL against the migration SQL by type family, with no database
  needed — add a model column and it is checked automatically.
- Every video in the library still has `duration_seconds: null`, so the scheduler uses
  `est_minutes`. `tools/check_links.py` must run before store launch or every shown
  video time is a planning estimate rather than the +15% rule.
