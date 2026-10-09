# FreeMentor Resource Library

Pre-built learning roadmaps that the app downloads **one goal at a time**. Nothing is fetched from the internet at runtime — when a user picks a goal, only that goal's file is downloaded and cached for offline use.

**Last updated:** 8 October 2026 · Library schema `1.0`

## What ships to the app

| Path | What it is |
|---|---|
| `catalog.json` | All **73 goals** (exams, skills, programming languages): name, category, group, phases & modules, eligibility, estimated hours, and whether a full roadmap file exists. Small; ships inside the app. |
| `goals/<id>.json` | One full roadmap per built goal: ordered topics → learning blocks → resources, plus original recall questions. Only this file is downloaded when the goal is selected. |

Everything else in this folder is **build/tooling** and does **not** ship:

| Path | What it is |
|---|---|
| `schema/goal.schema.json` | JSON Schema every goal file must pass (validate in CI / the admin panel). All 12 built goals pass. |
| `tools/check_links.py` | Server-side checker: fills real YouTube durations via the YouTube Data API, marks broken links, writes a report. Run at least every 30 days. |
| `FREEMENTOR_LIBRARY_SPEC.md` | The build specification and status tracker — the single document any AI/engineer follows to build the remaining goals. |
| `FreeMentor_Library_Review.xlsx` | A human-review workbook: every goal and every resource, for QA sign-off. |

## Built so far (12 of 73 — `status: "full"`)

| Goal | Type | Topics | Resources | Recall Qs | Est. hours | Videos verified* |
|---|---|---:|---:|---:|---:|---|
| JEE Main | exam | 72 | 565 | 216 | 677 | pending link-check |
| JEE Advanced | exam | 93 | 710 | 279 | 1008 | pending link-check |
| NEET UG | exam | 82 | 622 | 246 | 740 | pending link-check |
| CUET UG | exam | 116 | 711 | 348 | 690 | commerce ✓ / sciences reuse |
| Full Stack Development | skill | 59 | 324 | 177 | 481 | ✓ all |
| Frontend Development | skill | 35 | 199 | 105 | 335 | ✓ all |
| Backend Development | skill | 31 | 164 | 93 | 410 | ✓ all |
| Cybersecurity | skill | 29 | 148 | 87 | 428 | ✓ all |
| Python | language | 34 | 169 | 102 | 117 | pending link-check |
| Java | language | 31 | 154 | 93 | 197 | ✓ all |
| C | language | 24 | 120 | 72 | 150 | ✓ all |
| SQL | language | 23 | 108 | 69 | 92 | ✓ all |

\* "Verified" means every video ID was confirmed to exist with the correct title and channel via the YouTube oEmbed endpoint (`status: "active"`, `verified_via: "youtube_oembed"`). Goals marked "pending link-check" were carried over from the earlier build and still need `tools/check_links.py` run with a YouTube Data API key to confirm durations and liveness. The remaining 61 goals are `status: "outline"` in the catalog (no file yet) — see the spec tracker.

## How the app uses a goal file

1. User picks a goal → app downloads `goals/<id>.json` and caches it offline.
2. The on-device **scheduler** walks topics in `order`, interleaves subjects (for exams), and packs each topic's **blocks** (learn → read → practice → recall → test/build) into days using the user's weekly minutes. **Goal files contain no fixed days** — only ordered topics and time estimates.
3. Spaced-revision blocks are inserted at +1 / +3 / +7 / +21 / +45 days, adjusted by the learner's confidence rating; weekly tests and mock milestones come after the phases listed in `milestones[].after_phase`.
4. Missed day → plan shifts forward. Availability change → recalculated from the next incomplete task; completed ticks are never touched.
5. Shown video time = real duration × 1.15, rounded **up** to 5 min. Until `check_links.py` fills real durations, `est_minutes` is an estimate.

## Access & policy rules encoded in the data

- `access: "all"` → Basic and Premium. `access: "premium"` → Premium only (extra notes).
- `ad_gate_allowed: false` on **every** YouTube resource — YouTube videos are never paywalled or ad-gated (YouTube API Services policy). Premium's benefit is an ad-free interface and premium notes, never blocking a video.
- Every resource URL is `https://`. Recall questions are original content written for FreeMentor.

## Multi-track goals (CUET UG)

CUET's domain subjects are **chapter-wise** and **track-gated**: each domain topic carries a `track_gate` (e.g. `domain:physics`), and the app downloads only the subjects the learner chooses. Physics, Chemistry, Maths and Biology reuse the Class 12 chapter roadmaps from the JEE/NEET goals (via `source_topic_id`); Accountancy, Business Studies and Economics are new NCERT chapter roadmaps; English is covered by the Language Test topics.

## Before launch — admin checklist

- [ ] Run `tools/check_links.py` on every goal with a server-side YouTube Data API key; fix every row in the broken-links report, and re-confirm the carried-over goals (JEE Main/Advanced, NEET, Python).
- [ ] Human review of each video for teaching quality and language tag (channel names are already recorded on built videos).
- [ ] Re-check 2027 syllabi (JEE/NEET/CUET) when NTA publishes them; bump `version` and `valid_for`.
- [ ] Have a subject teacher proof-read the recall questions.
- [ ] Build the remaining 61 `outline` goals following `FREEMENTOR_LIBRARY_SPEC.md`.
