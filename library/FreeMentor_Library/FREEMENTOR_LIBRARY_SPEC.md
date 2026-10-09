# FreeMentor Library — Build Specification & Status Tracker

**For:** any person or AI system that builds or updates the FreeMentor resource library.
**Version:** 1.1 · 8 October 2026 · Library schema `1.0`
**Status legend:** `[x]` = done · `[ ]` = pending · ⚠️ = needs attention

> **If you are an AI assistant reading this:** build **one goal at a time**. Output one JSON file per goal (`goals/<id>.json`) that validates against `schema/goal.schema.json`. Never invent URLs — every link must come from a page you actually opened or a real search result, and must obey the rules in §4. Verify every YouTube video with the oEmbed endpoint before marking it `active`. When a goal is finished, tick it in §13 and set its `status`, `file`, `file_size_kb` and `estimated_hours` in `catalog.json`.

---

## 1. What the library is

FreeMentor gives a learner a **personal day-by-day roadmap** to an exam, skill or programming language using **only free, trusted resources**. The library is the pre-built content behind every roadmap:

- one small **`catalog.json`** listing all 73 goals (ships inside the app), and
- one **goal file** per goal (`goals/<id>.json`) holding ordered topics, the learning blocks for each topic, the resources (video, notes, practice, test) and original recall questions.

The app **never searches the internet at runtime**. Selecting a goal downloads only that goal's file, cached offline.

**Core principle:** never "here are 100 videos, pick one". Each learn topic gives **one** main video (+ one alternative, ideally Hindi), **one** main notes source, **one** practice set and (per phase) **one** test — so the app can say "do this today".

## 2. How the app uses it

1. `catalog.json` ships in the app → shows Entrance Exams / Skills / Programming Languages with search.
2. User picks a goal → downloads `goals/<id>.json` (gzip ~10–60 KB).
3. The on-device **scheduler** reads topics **in `order`**, interleaves subjects (exams), and packs each topic's **blocks** into days using the user's minutes per weekday. **The library must contain no fixed days** — only ordered topics and blocks with `est_minutes`.
4. Scheduler inserts spaced-revision blocks (+1/+3/+7/+21/+45 days), adjusts by confidence rating, and adds weekly tests plus milestones (mocks) after `milestones[].after_phase`.
5. Shown video time = real duration × 1.15, rounded **up** to 5 min. Until durations are filled, `est_minutes` is used.
6. `access: "all"` shows on Basic & Premium; `access: "premium"` on Premium only. Every YouTube resource is `access: "all"` with `ad_gate_allowed: false`.
7. Missed day → plan shifts forward. Changed availability → recalculated from the next incomplete block; completed ticks never change.

## 3. Folder structure

```
FreeMentor_Library/
  catalog.json              # 73 goals (ships in app)
  goals/<id>.json           # one full roadmap per built goal (downloaded on demand)
  schema/goal.schema.json   # validation schema (build-time)
  tools/check_links.py      # YouTube duration + broken-link checker (server-side)
  FREEMENTOR_LIBRARY_SPEC.md
  README.md
  FreeMentor_Library_Review.xlsx
```

## 4. Content rules

- **Free & legal only.** Official docs, open-licence books/courses, reputable free practice platforms, and public YouTube videos. No re-hosted copyrighted material.
- **YouTube is never ad-gated or paywalled** (`ad_gate_allowed: false`, `access: "all"`). Premium = ad-free interface + premium *notes*, never blocking a video.
- **Every URL is `https://`.** No `http://`, no login-walled or region-locked pages where avoidable.
- **Verify every video.** Confirm the ID via `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json`; use the returned title and channel; set `status: "active"`, `verified_via: "youtube_oembed"`, `last_checked`. Drop anything that fails.
- **Language.** Provide a main video (English or Hindi) and one alternative, ideally in the other language, so Hindi-first learners are served.
- **Recall questions are original** — three short Q&A per topic, written for FreeMentor.
- **Safety (Cybersecurity and similar).** Every offensive topic carries a `safety_note`; the goal carries a `safety_policy`. Link only to legal practice platforms (TryHackMe, PortSwigger Academy, OverTheWire, picoCTF) and never to material for attacking real third-party systems.

## 5. The learning pattern each topic follows

A **learn** topic has blocks in this order: `learn` (watch) → `read` (notes, try examples) → `practice` → `recall` (answer from memory) → optional `test` (score entry). A **project** topic has a `build` block with a `brief` and `done_when` criteria, then `recall`. Blocks carry `est_minutes`; a `note` can tell the learner e.g. "watch both videos" or which section of a one-shot to watch.

## 6. Data format

See `schema/goal.schema.json` (authoritative). Key optional fields it now documents: resource `channel`, `youtube_id`, `verified_via`, `role`, `last_checked`, `segments`; block `note`, `done_when`; topic `kind`, `domain_subject`, `track_gate`, `source_topic_id`, `coverage_note`, `source_note`, `safety_note`, `prerequisite_note`, `instructions`, `deprecated`; goal `group`, `official_url`, `video_language_note`, `career_outcomes`, `resource_policy`, `reviewed_by`, `prerequisite_note`, `safety_policy`, `domain_subjects_full_roadmap`, `domain_note`. `goal.type` is one of `exam | skill | language`.

## 7. catalog.json

Each goal row: `id`, `name` (no marketing suffixes like "Beginner to Master"), `category`, `group`, `type`, `status` (`full` once a file exists, else `outline`), `estimated_hours`, `estimate_basis`, `file`/`file_size_kb` (set when built), `eligibility_note`, `qualification_options`, `phases` (outline), and `career_outcomes` for skills.

## 8. IDs, naming & estimation

- Goal id = kebab-case (`full-stack`, `cuet-ug`). Topic id = `<goalprefix>-<slug>`; project topics start `proj-`.
- Estimated hours (built goals) = content + mocks/milestones + 12% spaced-revision allowance, from the blocks (bottom-up), not a guess.
- Skill/language depth = **beginner → job-ready** (roughly: SQL ~90h, C ~150h, Java ~200h, Frontend ~335h, Backend ~410h, Cybersecurity ~430h, Full Stack ~480h).

## 9. Approved sources by goal type

- **Exams (JEE/NEET/CUET):** NCERT (official, EN+HI), OpenStax, ExamSIDE/official PYQs, NTA portals; YouTube from reputable educators. CUET commerce: Rajat Arora, Next Toppers, Sunil Panda, Blade Learner.
- **Web/dev skills & languages:** MDN, web.dev, react.dev, nodejs.org, expressjs.com, postgresql.org, dev.java, docs.oracle.com, Beej's Guide, learn-c.org, OWASP, javascript.info; practice from Exercism, freeCodeCamp, Frontend Mentor, PortSwigger, pgexercises, HackerRank, GitHub Skills; YouTube from freeCodeCamp, Bro Code, Web Dev Simplified, Kevin Powell, Traversy, Coding with John, Fireship, CodeWithHarry, Chai aur Code, Apna College, Kunal Kushwaha, etc.
- **Cybersecurity:** NIST, CISA, OWASP, MITRE ATT&CK, Cloudflare Learning, CS50 Cybersecurity, Microsoft Learn; practice only on TryHackMe, PortSwigger Academy, OverTheWire, picoCTF; YouTube from Professor Messer, Practical Networking, NetworkChuck, Chris Greer, 13Cubed.

## 10. Build workflow (one goal)

1. Confirm scope/depth and the phase outline from `catalog.json`.
2. **Research first:** gather real URLs (open pages / search). Verify every YouTube ID via oEmbed.
3. Write the topics (one main video + alt, notes, practice, 3 recall Q; projects get `done_when`).
4. Build the file with the shared builder pattern; compute hours bottom-up.
5. Validate against the schema. Run the audit (unique videos per topic, link status).
6. Update §13 and `catalog.json`.

## 11. Validation & definition of done

A goal is **done** when: it validates against the schema; every video is oEmbed-verified (`active`); every URL is `https://`; no YouTube resource is ad-gated; each topic has 3 original recall Qs; hours are bottom-up; and its catalog row is updated.

## 12. Maintenance

Run `tools/check_links.py` monthly with a YouTube Data API key to fill real durations and flag dead links. Re-check exam syllabi yearly and bump `version`/`valid_for`.

---

## 13. Status tracker — every goal


**12 of 73 goals built.** The rest are `outline` (catalog entry only, no file yet).

### Entrance Exams (4/19 built)

| ✓ | Goal | Status | Topics | Resources | Recall Qs | Est. hrs |
|---|---|---|---:|---:|---:|---:|
| [x] | CUET UG | full | 116 | 711 | 348 | 690 |
| [x] | JEE Advanced | full | 93 | 710 | 279 | 1008 |
| [x] | JEE Main | full | 72 | 565 | 216 | 677 |
| [x] | NEET UG | full | 82 | 622 | 246 | 740 |
| [ ] | CAT | outline | — | — | — | ~450 |
| [ ] | CDS | outline | — | — | — | ~500 |
| [ ] | CLAT | outline | — | — | — | ~500 |
| [ ] | CTET | outline | — | — | — | ~250 |
| [ ] | GATE | outline | — | — | — | ~900 |
| [ ] | IBPS Clerk | outline | — | — | — | ~350 |
| [ ] | IBPS PO | outline | — | — | — | ~500 |
| [ ] | NDA | outline | — | — | — | ~600 |
| [ ] | RRB NTPC | outline | — | — | — | ~400 |
| [ ] | SBI Clerk | outline | — | — | — | ~350 |
| [ ] | SBI PO | outline | — | — | — | ~500 |
| [ ] | SSC CGL | outline | — | — | — | ~600 |
| [ ] | SSC CHSL | outline | — | — | — | ~400 |
| [ ] | UGC NET | outline | — | — | — | ~450 |
| [ ] | UPSC Civil Services | outline | — | — | — | ~2500 |

### Skills (4/37 built)

| ✓ | Goal | Status | Topics | Resources | Recall Qs | Est. hrs |
|---|---|---|---:|---:|---:|---:|
| [x] | Backend Development | full | 31 | 164 | 93 | 410 |
| [x] | Cybersecurity | full | 29 | 148 | 87 | 428 |
| [x] | Frontend Development | full | 35 | 199 | 105 | 335 |
| [x] | Full Stack Development | full | 59 | 324 | 177 | 481 |
| [ ] | Accounting & Taxation | outline | — | — | — | ~250 |
| [ ] | Advanced Excel | outline | — | — | — | ~80 |
| [ ] | Animation | outline | — | — | — | ~350 |
| [ ] | Artificial Intelligence | outline | — | — | — | ~500 |
| [ ] | Business Analytics | outline | — | — | — | ~250 |
| [ ] | CRM & Sales | outline | — | — | — | ~120 |
| [ ] | Cloud Computing | outline | — | — | — | ~300 |
| [ ] | Content Writing | outline | — | — | — | ~100 |
| [ ] | Copywriting | outline | — | — | — | ~100 |
| [ ] | Data Analytics | outline | — | — | — | ~300 |
| [ ] | Data Science | outline | — | — | — | ~500 |
| [ ] | DevOps | outline | — | — | — | ~350 |
| [ ] | Digital Marketing | outline | — | — | — | ~200 |
| [ ] | Equity Research | outline | — | — | — | ~250 |
| [ ] | Ethical Hacking | outline | — | — | — | ~400 |
| [ ] | FinTech | outline | — | — | — | ~250 |
| [ ] | Financial Analysis | outline | — | — | — | ~250 |
| [ ] | Financial Modelling | outline | — | — | — | ~150 |
| [ ] | Game Development | outline | — | — | — | ~500 |
| [ ] | IoT | outline | — | — | — | ~300 |
| [ ] | MIS Reporting | outline | — | — | — | ~100 |
| [ ] | Machine Learning | outline | — | — | — | ~400 |
| [ ] | Mobile App Development | outline | — | — | — | ~450 |
| [ ] | Motion Design | outline | — | — | — | ~200 |
| [ ] | Multimedia | outline | — | — | — | ~200 |
| [ ] | Robotics | outline | — | — | — | ~450 |
| [ ] | SEO | outline | — | — | — | ~120 |
| [ ] | Stock Market | outline | — | — | — | ~150 |
| [ ] | Tally Prime with GST | outline | — | — | — | ~80 |
| [ ] | UI/UX Design | outline | — | — | — | ~300 |
| [ ] | VFX | outline | — | — | — | ~400 |
| [ ] | Video Editing | outline | — | — | — | ~150 |
| [ ] | Web Development | outline | — | — | — | ~300 |

### Programming Languages (4/17 built)

| ✓ | Goal | Status | Topics | Resources | Recall Qs | Est. hrs |
|---|---|---|---:|---:|---:|---:|
| [x] | C Programming | full | 24 | 120 | 72 | 150 |
| [x] | Java Programming | full | 31 | 154 | 93 | 197 |
| [x] | Python | full | 34 | 169 | 102 | 117 |
| [x] | SQL | full | 23 | 108 | 69 | 92 |
| [ ] | C# | outline | — | — | — | ~200 |
| [ ] | C++ | outline | — | — | — | ~220 |
| [ ] | Dart | outline | — | — | — | ~120 |
| [ ] | Go | outline | — | — | — | ~150 |
| [ ] | JavaScript | outline | — | — | — | ~200 |
| [ ] | Kotlin | outline | — | — | — | ~180 |
| [ ] | PHP | outline | — | — | — | ~150 |
| [ ] | Perl | outline | — | — | — | ~120 |
| [ ] | R | outline | — | — | — | ~150 |
| [ ] | Ruby | outline | — | — | — | ~150 |
| [ ] | Rust | outline | — | — | — | ~220 |
| [ ] | Swift | outline | — | — | — | ~180 |
| [ ] | TypeScript | outline | — | — | — | ~120 |

### Verification notes

- Built & fully oEmbed-verified videos: **Frontend, Backend, Full Stack, Cybersecurity, Java, C, SQL**, and CUET's new commerce chapters (Accountancy, Business Studies, Economics).
- Built earlier, **videos pending `check_links.py`**: JEE Main, JEE Advanced, NEET UG, Python. CUET's Physics/Chemistry/Maths/Biology reuse the JEE/NEET Class 12 topics, so they inherit that pending status.
- All 12 built files validate against `schema/goal.schema.json`; all URLs are `https://`; no YouTube resource is ad-gated.

## 14. Ready-to-use AI prompt

> Build the FreeMentor goal file for **<goal name>** (`<id>`), beginner → job-ready, following FREEMENTOR_LIBRARY_SPEC.md. Research real free resources first and verify every YouTube video via the oEmbed endpoint. Output `goals/<id>.json` validating against schema/goal.schema.json: ordered topics with one main video (+ Hindi alternative), one notes source, one practice set, three original recall questions each, projects with done_when criteria, hours computed bottom-up. Then tick it in §13 and update catalog.json. Never invent URLs; never ad-gate YouTube.