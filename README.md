# FreeMentor — App Development Kit

Everything needed to build the **FreeMentor** mobile app with Claude Code, in one folder.

## How to use this with Claude Code
1. Open this folder (`FreeMentor_App_Dev_Kit`) as your project in Claude Code / the desktop Code tab.
2. Claude Code automatically reads **`CLAUDE.md`** — it's the project brief (what we're building, the fixed tech stack, repo layout, the non-negotiable product rules, and the build order).
3. Point it at **`docs/APP_BUILD_SPEC.md`** to start building: architecture, the data model, the on-device scheduler rules (the core of the app), every screen, the backend endpoints, and the MVP definition of done.
4. Ask it to scaffold the app following the "Build order" in `CLAUDE.md` (Expo app + FastAPI server + Supabase), starting with Google sign-in and the catalog screen.

A good first prompt:
> Read CLAUDE.md and docs/APP_BUILD_SPEC.md. Scaffold the repo layout from CLAUDE.md (Expo + TypeScript app, FastAPI server). Then implement step 1 of the build order: the Expo app, the FastAPI server, a Supabase project, and Google sign-in working end to end. Keep the scheduler pure and test-driven when we get to it.

## What's in here
```
FreeMentor_App_Dev_Kit/
  CLAUDE.md                     # Claude Code project brief (read first)
  README.md                     # this file
  docs/
    FreeMentor_Product_Plan.md  # full product decisions — source of truth (scope, pricing, policy, UX)
    APP_BUILD_SPEC.md           # engineering spec: architecture, data model, scheduler, screens, APIs
    FREEMENTOR_LIBRARY_SPEC.md  # how the resource library is built/validated + status tracker
  design/
    FreeMentor_App_Preview.png  # UI mockup render
    freementor_mockup.html      # interactive HTML mockup (open in a browser)
    brand/                      # logo, app icon, banner, Play Store feature graphic, poster
  library/
    FreeMentor_Library/         # the resource library the app ships & downloads
      catalog.json              # 73 goals (ships in the app)
      goals/<id>.json           # 12 full roadmaps (JEE Main/Advanced, NEET, CUET, Full-Stack,
                                #   Frontend, Backend, Cybersecurity, Python, Java, C, SQL)
      schema/goal.schema.json   # validation schema (generate app TS types from this)
      tools/check_links.py      # YouTube duration + dead-link checker (server cron)
      README.md · FREEMENTOR_LIBRARY_SPEC.md · FreeMentor_Library_Review.xlsx
```

## The short version
- **App:** React Native + TypeScript (Expo, Android first). **Backend:** FastAPI + PostgreSQL on Supabase. **Auth:** Supabase/Google. **Payments:** Play Billing. **Push:** FCM. **Ads:** AdMob (Premium = none).
- The app ships the catalog, downloads one goal's roadmap file on demand, stores it in SQLite, and an **on-device scheduler** turns the ordered topics/blocks into a personal day-by-day plan.
- **Golden rules:** YouTube is never ad-gated; 3-day trial → ₹599 Basic / ₹999 Premium one-time per goal; 16+ with parent consent under 18; missed day shifts the plan forward; video time = duration × 1.15 rounded up to 5 min.

## Before store launch
Run `library/FreeMentor_Library/tools/check_links.py` with a YouTube Data API key to fill real durations and re-verify the four carried-over goals (JEE Main/Advanced, NEET, Python). The other eight goals' videos are already verified. See the library spec's status tracker and the product plan's Google Play checklist (§16).
