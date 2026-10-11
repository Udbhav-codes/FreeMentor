# FreeMentor — App Build Spec (engineering)

A distilled, build-focused companion to `FreeMentor_Product_Plan.md`. When in doubt, the product plan wins. This spec is written so Claude Code (or any engineer) can start building the app directly.

## 1. Architecture

```
App (React Native + TS) ──HTTPS──> FastAPI ──> PostgreSQL (Supabase, RLS)
  │  Google sign-in (Supabase Auth)            │
  │  download goals/<id>.json (Supabase Storage/CDN)
  │  local SQLite + on-device scheduler        ├─> Google Play Developer API (verify purchases)
  └─ FCM push · AdMob · Firebase Analytics     ├─> YouTube Data API (link checker — server only)
                                               └─> FCM (server pushes)
```
The app works **offline** after a goal is downloaded: the catalog ships in the bundle, the goal file + all progress live in SQLite, and the scheduler runs on-device. The server is for auth, downloading/updating library files, purchases, coupons, pushes and reports.

## 2. Library data model (input to the app)
Authoritative schema: `../library/FreeMentor_Library/schema/goal.schema.json`. Shape:
```
goal { id, name, category, group, type(exam|skill|language), version, valid_for, languages, estimated_hours, ... }
phases[] { id, order, name, topic_ids[] }
topics[] {
  id, subject, title, phase, order, kind(learn|project), weightage, est_minutes_total,
  blocks[] { id, type(learn|read|practice|recall|test|build), title, est_minutes,
             note?, done_when?[], score_entry?,
             resources[] { type(video|notes|practice|test), role, url, lang, provider, channel?,
                           youtube_id?, est_minutes?, access(all|premium), ad_gate_allowed, status } },
  recall[] { q, a }       // exactly 3 per topic for built skill/language goals
  domain_subject?, track_gate?, source_topic_id?, safety_note?   // CUET / cyber / reuse
}
milestones[] { id, after_phase, type, title, est_minutes, resources[] }   // mocks (exams)
scheduler_hints { ... }   // see §4
```
Generate TypeScript types from the schema into `shared/` and use them in both app and admin.

## 3. On-device SQLite (per user, offline)
Mirror of the server tables that the app needs offline, plus cached library. Core tables:
- `cached_goal(goal_id, version, json, downloaded_at)` — the downloaded roadmap.
- `enrollment(id, goal_id, version, start_date, target_date, status)`.
- `schedule(enrollment_id, mode, minutes_by_weekday_json, study_time, study_place, effective_from)`.
- `task_progress(enrollment_id, block_id, scheduled_date, completed_at, minutes_credited)`.
- `confidence(enrollment_id, topic_id, level, rated_at, next_review_on)`.
- `test_score(enrollment_id, block_or_milestone_id, score, max_score, taken_at)`.
- `rest_day(enrollment_id, date)` · `streak(current, best, last_study_date, grace_used_on)`.
- `sync_queue(id, kind, payload_json, created_at)` — replays writes to the server when online.
Server-side Postgres tables are listed in the product plan §13; keep names aligned.

## 4. The scheduler (the heart of the app)
A **pure, deterministic, unit-tested** module: `(cachedGoal, schedule, progress, confidence, today) → { days: [...], projectedFinish }`. No network, no clock reads except the injected `today`.

Rules (from product plan §7 and `scheduler_hints` in each file):
1. Walk `topics` in `order`. For exams, **interleave subjects** (`interleave_by: "subject"`). Keep topics within their phase order.
2. Expand each topic into its blocks in order: learn → read → practice → recall → (test). A `project` topic has a `build` block (hours) + recall.
3. **Video time** shown = `duration × 1.15` rounded **up** to 5 min (use `est_minutes` until `check_links.py` fills real `duration_seconds`).
4. Pack blocks into days using `minutes_by_weekday`. Render focus blocks of `focus_block_minutes` (25) + `break_minutes` (5). A block may span days.
5. **Weekly pattern:** 5 new-content days, 1 mixed-practice + weekly-test day, 1 light-revision day (`weekly_pattern`). The light day **leads with** revision, capped at half the day, then takes new content — it is never revision-only. See the note in product plan §7.4.
6. **Spaced revision:** after a topic is done, schedule review blocks at `spaced_review_offsets_days` [1,3,7,21,45], overridden by the learner's confidence rating → `confidence_to_next_review_days` (need_revision 1 / little_afraid 2 / confident 4 / all_cleared 7 / mastered 21).
7. **Milestones (mocks):** insert after the phase in `milestones[].after_phase`.
8. **Mastery gate:** weekly test < `weekly_test_min_score_pct` (60) → insert a `remediation_block_minutes` (45) review.
9. **Reserve** the final `reserve_final_fraction_for_mocks_and_revision` (0.15) of time for mocks/revision.
10. **Missed day → shift forward:** recompute from `recalculate_from: "next_incomplete_task"`; never move completed ticks. Availability change → recompute from the next incomplete block.
11. **Short on time before an exam** (target_date too close): warn and offer — increase daily hours, prioritise high-weightage topics, or switch to the next exam cycle.
12. **Streak:** calendar days with a 1-day grace; rest days limited to 1/week, 4/month (`rest_day_limits`); don't break the streak on a protected rest day.
13. **CUET / multi-track:** only schedule topics whose `track_gate` matches the learner's chosen domain subjects.
Write the test suite first from these rules; they are the product.

## 5. Screens (product plan §8)
Bottom nav: **Roadmap · Progress · Reports · Practice · Profile**.
- **Onboarding:** Google sign-in → age/qualification (16+ gate, parent consent if <18) → pick goal → download file → set weekly minutes/study time → start 3-day trial.
- **Roadmap (home):** greeting, goal, progress ring, streak, today's checklist, "Continue today's task →", projected finish. GPS-style route: done = solid, today = amber, future = faded, milestone flags per phase. Phase → Month → Week → Day.
- **Day view:** blocks with resource buttons (Open in YouTube / notes / practice), per-item checkboxes, confidence sheet, "mark day complete" (enabled when all ticked or "finish tomorrow"). Videos → YouTube app; notes/practice → Chrome Custom Tabs.
- **Practice:** today's practice, chapter-wise PYQ links, mocks, coding practice (skills).
- **Progress:** overall/weekly/monthly %, topics done/remaining, hours, streak, achievements; exam outcome card.
- **Reports:** charts (hours vs target, tasks, test scores, subject performance, consistency) + Sunday weekly report with one recommendation. Detailed analytics = Premium.
- **Profile/Settings:** appearance (Light/Dark/System), language, notifications + quiet hours, account (edit, change goal → purchase, restore purchases, delete account), legal.

## 6. Monetisation & gating (product plan §10)
- Trial (3 days, full Basic) → locks until purchase. Basic ₹599 / Premium ₹999, one-time, lifetime, per roadmap. Upgrade Basic→Premium = ₹400 Play product.
- Gating: videos & practice always free/ungated; Basic unlocks notes/tests **after a rewarded ad**; Premium removes ads, unlocks extra notes + detailed analytics + full adaptive recalculation.
- Ads (AdMob): user-initiated rewarded only, never during learning/tests/videos; under-18 → non-personalised, G-rated; cap 1 unlock/10 min.
- Play Billing: verify server-side via Google Play Developer API, acknowledge within 3 days, restore on new device. Strike-through prices must be real previous prices.

## 7. Backend (FastAPI) — first endpoints
`/auth/*` (Supabase session exchange) · `/catalog` · `/goals/{id}/download` (signed Storage URL + version) · `/enrollments` · `/progress` (batch sync from `sync_queue`) · `/purchases/verify` · `/coupons/validate` · `/reports/weekly`. Admin: `/admin/coupons`, `/admin/library/publish` (validate against schema, bump version, upload to Storage), `/admin/users`.

## 8. Definition of done (MVP)
Google sign-in → pick a goal → download → scheduler builds a correct daily plan → complete tasks with confidence ratings → progress + streak update → trial → purchase (verified) unlocks → works offline → no YouTube link is ad-gated. Scheduler and billing have passing unit tests; every library file validates against the schema in CI.
