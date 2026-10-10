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
      **idempotent progress sync**, catalog/download. **38 server tests.** Runs in a
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
      **Still to do in M4:** Google sign-in, FCM.
- [ ] M5 Billing · [ ] M6 Ads/Admin.

### Not yet built (known gaps)
- **Plans is UI only** — no Play Billing, no purchase verification, no coupon redemption,
  no trial countdown and nothing actually locks after 3 days. All of that is M5.
- Parent consent records the claim but does not yet **verify** it (OTP needs the backend).
- No Google sign-in, no server sync — the sync queue fills up but nothing drains it.
- Qualification (onboarding step 6) is not collected.
- No ads at all yet (M6), so the "notes after a rewarded ad" tier does nothing.
- Hindi UI strings are not translated; only the library's Hindi resources are used.

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
- **Supabase's direct host `db.<ref>.supabase.co` is IPv6-only.** On an IPv4-only network
  it fails with `getaddrinfo failed`, which looks like a bad hostname. Use the Supavisor
  pooler (`aws-0-<region>.pooler.supabase.com`, user `postgres.<ref>`). See server/SETUP.md.
- Server models use `Uuid(as_uuid=False)` for id columns, not `String(36)`: SQLite accepts
  the latter and Postgres rejects it, so the test suite cannot catch the difference.
- Every video in the library still has `duration_seconds: null`, so the scheduler uses
  `est_minutes`. `tools/check_links.py` must run before store launch or every shown
  video time is a planning estimate rather than the +15% rule.
