# FreeMentor — Final Product Plan

**Personal roadmap & learning app with free resources**
Version 1.0 · 6 October 2026 · Built from *PERSONALIZED ROADMAP.docx* plus the decisions taken in Steps 1–7.

> **Tagline options:** "Free resources. Clear roadmap. Every day." · "Stop searching. Start following — with free\* resources." · "One goal. One roadmap. One step at a time."
> \*Shown wherever "free" appears in marketing: *"All study resources are free to open. Your personal roadmap and tracking are free for 3 days, then Basic ₹599 or Premium ₹999 (one-time)."*

---

## Contents
1. [Decision log](#1-decision-log)
2. [Product overview & positioning](#2-product-overview--positioning)
3. [Target users](#3-target-users)
4. [Goal catalogue](#4-goal-catalogue)
5. [User flow & onboarding](#5-user-flow--onboarding)
6. [Learning method (the science)](#6-learning-method-the-science)
7. [Roadmap engine & roadmap design](#7-roadmap-engine--roadmap-design)
8. [App sections & features](#8-app-sections--features)
9. [Resource library](#9-resource-library)
10. [Monetisation, plans, ads & coupons](#10-monetisation-plans-ads--coupons)
11. [UI / UX & visual design](#11-ui--ux--visual-design)
12. [Tech stack & architecture](#12-tech-stack--architecture)
13. [Database design](#13-database-design)
14. [Admin panel (CMS)](#14-admin-panel-cms)
15. [Security, privacy & legal](#15-security-privacy--legal)
16. [Google Play publishing checklist](#16-google-play-publishing-checklist)
17. [Release scope: MVP, v2, v3](#17-release-scope-mvp-v2-v3)
18. [Development plan & timeline](#18-development-plan--timeline)
19. [Open items](#19-open-items)
20. [Deliverables & sources](#20-deliverables--sources)

---

## 1. Decision log

| # | Topic | Decision |
|---|---|---|
| 1 | App name | **FreeMentor** (one word). Play title: *"FreeMentor: Study Roadmap"* (≤ 30 chars). Backup name if Play rejects "Free" in the title: **PadhaiGPS**. |
| 2 | Platforms | **Android first**, iOS later from the same codebase. |
| 3 | Tech stack | As in the source document: **React Native** app, **Python + FastAPI** backend, **PostgreSQL**, **Supabase Auth & Storage**, **Firebase Cloud Messaging & Analytics** (details in §12). |
| 4 | Sign-in | **Google sign-in at the start** (right after Welcome). |
| 5 | Business model | **3-day free trial of Basic**, then the user must buy **Basic ₹599** or **Premium ₹999** (one-time, per roadmap). Premium = ad-free with everything unlocked. |
| 6 | Purchase validity | **Lifetime access** to the purchased roadmap. **Every goal switch is a new purchase**; old progress is archived, never deleted. |
| 7 | YouTube | YouTube videos are **never paywalled or ad-gated** on any plan (YouTube API Services policy). |
| 8 | Coupons | **Google Play Billing + fixed discount tiers** (10/20/30/50/70/90 %). Admin still sets usage limit and validity. |
| 9 | Age | **16+ only. Parent consent required for users under 18** (DPDP Rules, full compliance by 13 May 2027). Under-18s get non-personalised ads only. |
| 10 | Knowledge level | Everyone starts as a **beginner** (not asked). |
| 11 | Missed day | **Plan shifts forward**; projected finish date updates. |
| 12 | Short on time before a fixed exam | **Warn** and offer 3 choices: increase hours · prioritise high-weightage topics · target the next exam cycle. |
| 13 | Tracking | Study time = estimated time of **ticked tasks**; test scores are **entered by the user** after each test. |
| 14 | Streak | **Calendar days + 1-day grace**: +1 for every calendar day with ≥ 1 completed task; one missed day is forgiven if the user studies the next day; approved rest days never break it. |
| 15 | Rest days | Max **1 per week and 4 per month**. |
| 16 | Video time shown | YouTube duration **+ 15 %**, rounded **up to the nearest 5 min** (e.g. 1 h 40 m → 1 h 55 m). |
| 17 | Recall questions | Included: 3 one-line recall questions per topic, written by FreeMentor (original content). |
| 18 | Library | Pre-built per goal and **downloaded only when the user selects that goal**; never scraped at runtime. Structure for all 73 goals; full links for **JEE Main, NEET UG, Python** in v1 pilot. |
| 19 | Fonts | **Inter** (UI) + **DM Sans** (headings, italic for warm moments) + **Noto Sans Devanagari** (Hindi). SF Pro is not used (Apple licence forbids Android). |
| 20 | Style | Black/white + Navy **#0A2463**, soft-minimal with light neumorphism. |

---

## 2. Product overview & positioning

**What it is:** a "Personal Learning GPS". The user tells FreeMentor *where they want to go* (an exam or a skill) and *how much time they have*; FreeMentor gives them **exactly what to do each day** — which video, which notes, which questions, when to revise — using only free, trusted resources.

**Core promise:** "We don't just give you free trusted content. We tell you what to learn, when to learn it, how much time to spend, and what to do next."

**Product principle (core advantage):** never "here are 100 videos, choose one". Always:
"Watch this video today." → "Read these notes." → "Solve these questions." → "Revise for 10 minutes." → "Tomorrow, we move to the next step."

**Differentiation**

| Typical learning app | FreeMentor |
|---|---|
| Course → videos → finish | Goal → available time → personal roadmap → daily tasks → practice → revision → progress → adaptation → goal |
| User decides what to watch | App decides the next step |
| Paid content | Free public content, organised; you pay only for the roadmap & tracking |

**One goal per user** at a time (multiple goals = future feature).

---

## 3. Target users

- **Students:** Class 11–12, college (UG/PG), competitive-exam aspirants (age 16+).
- **Job seekers:** technical, non-technical, government and private jobs.
- **Working professionals:** upskill, reskill, change career, certifications.
- **Beginners:** zero prior knowledge — every roadmap starts from scratch.

Primary market: **Indian students**, English / Hindi / Hinglish.

---

## 4. Goal catalogue

73 goals in three discovery sections. Searchable (global search across exams, skills, languages and topics).

### 4.1 Entrance exams (19)
| Group | Exams |
|---|---|
| Engineering | JEE Main ✅ *(full library)*, JEE Advanced, GATE |
| Medical | NEET UG ✅ *(full library)* |
| Management | CAT |
| Law | CLAT |
| University admission | CUET UG |
| Teaching / Research | UGC NET, CTET |
| Government | UPSC Civil Services, SSC CGL, SSC CHSL, RRB NTPC |
| Banking *(replaces the duplicate "Banking Exams" item)* | IBPS PO, IBPS Clerk, SBI PO, SBI Clerk |
| Defence | NDA, CDS |

Each exam shows an **eligibility note** (e.g. UPSC/CAT need graduation; NDA age limits). If a user's qualification doesn't match, show a gentle note — never block.

### 4.2 Skills (37)
- **Technology & Development:** Full Stack, Frontend, Backend, Mobile App, Web Development, Game Development, IoT, DevOps, Cloud Computing, Cybersecurity, Ethical Hacking, Robotics
- **Data & AI:** Data Science, Data Analytics, Business Analytics, Artificial Intelligence, Machine Learning, Financial Analysis, FinTech
- **Design & Creative:** UI/UX Design, Video Editing, Motion Design, Multimedia, Animation, VFX
- **Business & Professional:** CRM & Sales, Digital Marketing, SEO, Content Writing, Copywriting, Accounting & Taxation, Financial Modelling, Stock Market, Equity Research, Advanced Excel, MIS Reporting, Tally Prime with GST

### 4.3 Programming languages (17)
Python ✅ *(full library)*, JavaScript, Java, TypeScript, C#, C++, C, SQL *(listed once)*, PHP, Ruby, Swift, R, Kotlin, Go, Rust, Dart, Perl.

Every skill/language roadmap includes **projects** and a **"What you can do after this roadmap"** card with career paths (from `catalog.json`).

---

## 5. User flow & onboarding

Onboarding feels like a short chat: **one question per screen**, progress bar, back button, Hinglish-friendly copy.

```
App open → System splash → Opening animation (first launch only)
→ Welcome → Google sign-in → Age & consent → Name → Goal → Qualification
→ Weekly time (+ deadline calculator) → When & where you'll study → Language
→ Notification permission → Building your roadmap… → Roadmap ready → Home
```

| # | Screen | Details |
|---|---|---|
| 0 | **Opening animation** | After Android 12+ system splash: a dotted route draws itself to an amber flag, "FreeMentor" wordmark + tagline fade in. ~1.2 s on first launch, 0.4 s afterwards, skippable. Lottie. |
| 1 | **Welcome** | "Welcome to FreeMentor. Let's build your roadmap with free, trusted resources." → **Get started** |
| 2 | **Google sign-in** | One tap. Links to Privacy Policy & Terms. Account = backup of progress + purchases. |
| 3 | **Age & consent** | Birth year only. **Under 16 → cannot continue** ("FreeMentor is for ages 16+"). **16–17 → parent consent step** (parent email/phone OTP + consent checkbox) before personal data beyond sign-in is stored. 18+ → continue. |
| 4 | **Name** | "What should we call you?" → used everywhere ("Good morning, Anubhav"). |
| 5 | **Select your aim** | Tabs: Entrance Exams · Skills · Programming Languages. Search bar "What do you want to learn?". Categories with groups. One primary goal. |
| 6 | **Qualification** | Dynamic per goal. Default: Currently in Class 11/12 · Completed Class 12 · In college/university · Graduated · Not graduated · Other. JEE/NEET: Class 10 · Class 11 · Class 12 · Dropper · Other. CAT/UPSC: Final-year · Graduate · Working professional · Other. |
| 7 | **Weekly time** | Toggle "Each day" / "Same every day". Per-day hours (e.g. Mon–Fri 2 h, Sat–Sun 4 h → 18 h/week) or one value (e.g. 2 h 30 m daily). |
| 7a | **Deadline calculator** *(optional card on the same screen)* | User enters a deadline (1/3/6/12 months, exam date or custom date). Calculator shows the **average daily time needed** = library hours ÷ days left. Advice only; user then sets their own hours. Example: NEET UG in 10 months → ~2 h 25 m/day with the current library estimate. |
| 8 | ~~**When & where**~~ **— removed from onboarding (Oct 2026)** | Was "When will you usually study?" + "Where?". Cut on the product owner's decision to keep onboarding to the essentials. The **reminder time moved to Profile → Notifications**, where the daily-reminder toggle lives; the "where" part is gone entirely. Trade-off accepted knowingly: this was the if-then plan below, the one evidence-backed habit mechanism in onboarding, and asking later means fewer learners set it. |
| 9 | **Language** | English · Hindi · Bilingual (Hindi + English). Affects UI text where available, roadmap descriptions, notes choice, notifications. |
| 10 | **Notifications** | Explain value first, then Android 13+ permission prompt. |
| 11 | **Generating** | "Building your personalised roadmap…" → Analysing your goal → Calculating your available time → Planning your learning sequence → Selecting resources → Creating your roadmap. (Library file downloads here.) |
| 12 | **Roadmap ready** | Summary: phases, weeks, projected finish date, hours/week. If time is short for a fixed exam date → warning with 3 options (§7.7). → **Start Day 1** |

Removed from the original flow: "Current knowledge level" (everyone is a beginner) and "Age" + "DOB" duplication (birth year only).

---

## 6. Learning method (the science)

Built on the most cited evidence about how people learn (Dunlosky et al., 2013, *Psychological Science in the Public Interest*):

| Rating | Technique | How FreeMentor uses it |
|---|---|---|
| **High** | Practice testing (active recall) | Daily warm-up recall, recall check after each topic, topic tests, weekly tests, mocks |
| **High** | Distributed practice (spacing) | Automatic revision at +1, +3, +7, +21, +45 days |
| Moderate | Interleaving | JEE/NEET days rotate subjects; weekly mixed-practice session |
| Moderate | Self-explanation / elaboration | "Explain each heading in 2–3 lines" when reading notes |
| Low | Re-reading, highlighting, summarising | Not used as main activities |

Other evidence used:
- **Spacing timing** — best review gap ≈ 20 % of how long you need to remember (Cepeda et al., 2008).
- **Short segments** — engagement drops sharply after ~6 minutes of video (Guo, Kim & Rubin, 2014) → long lectures split into ≤ 45–60-min parts with recall pauses.
- **Fixed breaks** — 25 min focus / 5 min break reduced fatigue vs self-chosen breaks (Biwer et al., 2023).
- **If-then plans** — "If it's 8 pm, I study at my desk" (d = 0.65, Gollwitzer & Sheeran, 2006) → **no longer in onboarding** (step 8 was removed). Only the time survives, as the reminder picker in Profile → Notifications, and the learner has to go looking for it. The effect this cites depends on committing to *when and where* up front, so treat it as not currently implemented rather than merely moved.
- **Habits** — median 66 days to form; one missed day doesn't hurt (Lally et al., 2010) → forgiving streak; "Your study habit: 23/66 days".
- **Mastery learning** — weekly test < 60 % → catch-up block before moving on.
- **Self-rating** — 5-level confidence sheet controls when a topic returns for revision.

---

## 7. Roadmap engine & roadmap design

### 7.1 Structure
```
GOAL → PHASE → MONTH → WEEK → DAY → TASK (block) → RESOURCE
```
- **Library file** (pre-built): Goal → Phases → Topics (ordered) → Blocks. It does **not** contain fixed days.
- **On-device scheduler** turns the library into the user's personal calendar (months/weeks/days) from their weekly minutes. Same JEE file → different calendars for a 2 h/day and a 6 h/day student.

### 7.2 Block types (tasks)
| Block | What the user does | Typical time |
|---|---|---|
| Warm-up recall | Answer yesterday's recall questions from memory | 10 min |
| Learn | Watch the main video (alt video available) | YouTube time + 15 % |
| Read | NCERT/official notes; self-explain each heading | 20–90 min |
| Practice | Free question links (PYQs, exercises) | 20–150 min |
| Recall check | 3 questions → reveal answers | 10 min |
| Test | Timed topic test → **enter score** | 20–30 min |
| Build | Project (skills) with "done when" checklist | hours |
| Spaced revision | Auto-inserted review of earlier topics | 10–15 min |

### 7.3 Daily template (example: 2 hours)
| Time | Block |
|---|---|
| 10 min | Warm-up recall of yesterday |
| 60 min | Watch lesson part (e.g. 0:00–0:52 → 52 × 1.15 = 59.8 → **60 min**), shown as 25-min focus blocks + 5-min breaks |
| 20 min | Read notes + self-explain |
| 20 min | Practice questions |
| 10 min | Spaced revision |
| — | Rate confidence + mark day complete |

Every item has its own **checkbox**; the user ticks manually. "Mark day complete" is enabled when all tasks are ticked (or the user chooses "finish tomorrow").

### 7.4 Weekly rhythm
**Week visibility (added Oct 2026).** The route shows **this week only**; every
later week carries a lock. Each week unlocks on the **Saturday of the week
before it**, so next week's plan appears as this one finishes. Weeks are ISO
weeks, so the unlock date is a week's Monday minus two days — nothing is
stored, so a shifted plan cannot leave stale unlock state behind, and a learner
returning after a gap finds everything up to now already open. Tapping a locked
week says when it opens rather than doing nothing.

Days 1–5 new content · Day 6 mixed practice + weekly test · Day 7 **leads with**
light revision, then continues with new content.

> **Changed Oct 2026 on the product owner's instruction.** Day 7 used to be
> revision and nothing else. Reported from the app: *"in every course in the
> first week it is showing Light Revision and do not have anything as planned"*
> — and it was also throwing away most of the day's committed time (60 of 120
> minutes on Python, 30 of 120 on JEE Main, every week). Day 7 now opens with a
> spaced-revision pass capped at **half** the day, so revision still sets the
> tone, and then takes new content for the rest. The rule is now: **no day is
> revision and nothing else**, except the reserved tail at the end of the plan,
> where the syllabus is finished and revision IS the plan (rule 9). A lighter
> day means less new content on it, not no progress on it. The cost: the weekly
> timeline is slightly shorter and there is no longer a true rest-style day in
> the rhythm — a learner wanting one takes a rest day, which is a separate
> feature (§7.4, 1/week). Week view shows progress % and each day with a tick box (✓ done, → today, faded future); tapping a week expands it.

### 7.5 Confidence sheet → next revision
| Rating | Returns in |
|---|---|
| Need revision | 1 day |
| A little afraid | 2 days |
| I'm confident | 4 days |
| All cleared | 7 days |
| Mastered | 21 days |
Available on every topic, video and test.

### 7.6 Phase shapes
- **Exams:** Class 11 Foundation → Class 11 Advanced → Class 12 Core → Class 12 Advanced → PYQs & Full Mocks → Final Revision. Last ~15 % of the timeline is reserved for mocks and revision. Subjects interleaved.
- **Skills:** Fundamentals → Intermediate → Advanced → Tools/Libraries → Final project; a **project at the end of each phase**; career-outcome card at the end.

### 7.7 Rules
| Situation | Behaviour |
|---|---|
| **Missed day** | Unfinished tasks move to the next study day; whole plan shifts forward; projected finish date updates. |
| **Availability changed** | Ask: "Finish earlier" or "Keep target date and reduce daily workload". Recalculate **from the next incomplete task only**; completed ticks and past days are never changed. |
| **Not enough time before a fixed exam** | Show warning: "You need ~X h/week; you've set Y". Options: ① Increase hours ② Prioritise high-weightage topics (topics tagged H first, L marked "if time permits") ③ Prepare for the next exam cycle instead. |
| **Weekly test < 60 %** | Insert a 45-min catch-up block on weakest topic before continuing. |
| **Rest day** | User can mark any day as rest (max 1/week, 4/month). Plan shifts; streak preserved. |
| **Goal switch** | New purchase required; old enrollment archived with progress (can be viewed, not continued unless re-activated by purchase). |

### 7.8 Time & progress tracking
- **Study time** = sum of estimated minutes of ticked tasks (video time uses the +15 % rule).
- **Today card:** "You planned 2 h · 1 h 30 m done · **30 min to go**". If over target: "Congratulations, you studied **1 h extra** than planned today!"
- **Scores** come from the user's score entry after tests/mocks; they power accuracy, weak topics and recommendations.

---

## 8. App sections & features

### 8.1 Bottom navigation (5 tabs)
**Roadmap · Progress · Reports · Practice · Profile** — current tab highlighted (navy, bold). The Home dashboard is the top of the Roadmap tab. Settings live inside Profile.

### 8.2 Home (Roadmap tab top)
Greeting with name · Goal · Overall progress ring · Current streak · Today's target and checklist · "Continue today's task →" (single main action) · projected finish date.

### 8.3 Roadmap
GPS-style vertical route: done stops solid, today amber, future faded, milestone flags per phase. Phase → Month → Week (expand) → Day → Day view.

### 8.4 Day view
Title, subject, weightage tag, total time; each block with resource buttons (Open in YouTube / Open notes / Open practice); checkboxes; confidence rating; mark day complete. Links open in the **YouTube app** (videos) or **Chrome Custom Tabs** (notes/practice).

### 8.5 Practice
Today's practice ("solve at least …"), chapter-wise PYQ links, mock-test links, coding practice (skills), external resources — all links, no copied content.

### 8.6 Progress
Overall %, weekly %, monthly %, topics completed/remaining, study hours, current & best streak, achievements, progress bar ("████████░░ 72% · Week 4 of 6 · 18/25 topics"). Exam outcome card: target exam, syllabus %, papers solved, mocks taken, weak topics.

### 8.7 Reports
Daily study hours vs target (bar chart), tasks completed vs planned, test scores over time, subject performance, consistency (days studied), **weekly report** every Sunday: study time, tasks, papers solved, most/least completed area, one recommendation ("Spend 30 more minutes on Mathematics next week"). Detailed analytics = Premium.

### 8.8 Streak
Calendar-day streak with 1-day grace and rest-day protection. Milestones: 3, 7, 14, 30, 66 ("habit formed"), 100 days.

### 8.9 Profile & settings
Profile: photo (optional), name, birth year, gender (optional), qualification, goal, target date, language, total hours, streak.
Settings: Appearance (Light / Dark / System) · Language · Notifications (daily, study reminder, weekly report, streak, test reminder — each toggleable, plus quiet hours) · Account (edit profile, change goal → purchase, reset roadmap, export progress, restore purchases, **delete account**) · Privacy (ad personalisation, data download) · Help & feedback.

### 8.10 Notifications (playful, configurable, max 2 per day)
- Day reminder: "Yo 👀 Your Day 12 roadmap is sitting there waiting for you."
- Time plan: "You said you'd give me 2 hours today. No pressure… but your roadmap remembers. 😌"
- Progress: "85% of this week's roadmap? Okayyy, look at you showing off. 🔥"
- Pending task: "Umm… your task is still waiting. 👀 Wanna get that awkward reunion over with?"
- Weekly report: "Your weekly report just dropped. Come see how much of a productivity legend you were this week. 😎"
Daily reminders are **local scheduled notifications** (work offline, no exact-alarm permission); server pushes via FCM. Hindi versions for Hindi users.

### 8.11 Gamification (v1 light, v2 full)
v1: streaks + milestone badges (First Week Complete, 10-Day Streak, First Mock Test, 100 Hours Studied, first project built). Badges reward **task completion and study time — never "videos watched"** (YouTube policy). v2: XP, levels, challenges, achievement cards.

### 8.12 Offline
Library file cached after download → roadmap, tasks, recall questions, progress work offline; ticks sync when online. Videos and web links need internet.

### 8.13 Search
Global: exams, skills, languages, topics, resources (e.g. "Python" → Python roadmap, Python practice, Python projects).

---

## 9. Resource library

### 9.1 Rules
1. **Links only** — never copy or re-host copyrighted material.
2. Trusted, free sources only: official bodies (NCERT, NTA, docs), open-licence textbooks (OpenStax CC BY), reputable free platforms, public YouTube lectures from established educators.
3. No Telegram/Google-Drive "coaching PDFs" (usually pirated).
4. Every resource stores: URL, type, title, provider, language, duration, access tier, status, last-checked date.
5. Link checker runs at least **every 30 days** (YouTube policy) — weekly recommended; broken links go to the admin queue for replacement.

### 9.2 What's built (v1 pilot)
| Goal | Topics | Links | Videos | Recall Qs | Mocks | Est. hours* |
|---|---|---|---|---|---|---|
| JEE Main | 72 | 605 | 144 | 216 | 20 | ~680 |
| NEET UG | 82 | 662 | 164 | 246 | 20 | ~740 |
| Python | 34 (5 projects) | 170 | 52 | 102 | 1 cert | ~120 |
| Other 70 goals | Structure (phases + modules) | — | — | — | — | planning estimates |
\*Estimates until the checker fills real video durations. JEE/NEET videos are chapter "one-shot" lectures; add detailed lecture playlists as alternatives for absolute beginners (open item).

### 9.3 Sources per goal
- **JEE Main / NEET UG:** main + alternative chapter videos (YouTube) · NCERT chapter PDFs in **English and Hindi** · OpenStax chapters (Premium extra notes) · chapter-wise PYQs (ExamSIDE, free) · official NTA portals for full papers.
- **Python:** Corey Schafer, freeCodeCamp (English) and CodeWithHarry (Hindi) videos · docs.python.org, W3Schools · Think Python 3e (Premium extra notes) · Exercism, HackerRank, Kaggle Learn practice · W3Schools quiz, HackerRank certificate.

### 9.4 Files (in `FreeMentor_Library.zip`)
`catalog.json` (all 73 goals, ships with app) · `goals/jee-main.json`, `goals/neet-ug.json`, `goals/python.json` (12–27 KB gzipped each) · `schema/goal.schema.json` · `tools/check_links.py` · `README.md`. A readable copy is in `FreeMentor_Library_Review.xlsx`.

### 9.5 Next library work
Run checker → human review of every video → fill channels/durations → add free notes for p-block → build remaining goals in priority order (suggested: CUET UG, SSC CGL, CAT, Full Stack, Data Analytics, JavaScript, SQL, Advanced Excel …) → re-check JEE/NEET 2027 syllabus when NTA publishes it.

---

## 10. Monetisation, plans, ads & coupons

### 10.1 Plans (one-time payment per roadmap, lifetime access)
| | Free trial | Basic | Premium |
|---|---|---|---|
| Price | 3 days free | ~~₹1,299~~ **₹599** | ~~₹3,999~~ **₹999** |
| After trial | Everything locks until a plan is bought | — | — |

> **How "everything locks" is implemented (Oct 2026).** Taken literally it
> would paywall YouTube, which **YouTube API Services policy forbids** — that
> is not ours to trade against a pricing table, so the video branch wins and
> `accessFor()` checks it first. On expiry: notes, extra notes, practice and
> test links lock; **every YouTube link stays open**, including the 21 that are
> typed as `notes`. The roadmap, the day plan and the learner's own ticks also
> stay visible: the table does not say which it meant, and taking away the
> record of work somebody already did is a different thing from locking the
> resources. Detailed analytics stay Premium throughout.
| Roadmap, day plan, checklist, recall | ✅ | ✅ | ✅ |
| Main & alternative YouTube videos | ✅ (never ad-gated) | ✅ (never ad-gated) | ✅ |
| Main notes | ✅ | ✅ after rewarded ad | ✅ |
| Extra notes (OpenStax / Think Python) | 🔒 | 🔒 | ✅ |
| Test & mock links | ✅ | ✅ after rewarded ad | ✅ |
| Practice links | ✅ | ✅ | ✅ |
| Progress & basic graphs, streak | ✅ | ✅ | ✅ |
| Detailed analytics & advanced reports | 🔒 | 🔒 | ✅ |
| Smart recalculation / adaptive plan | basic shift | basic shift | ✅ full |
| Ads | Yes | Yes | **No ads** |
| AI assistant | — | — | future |
Upgrade Basic → Premium: pay the difference (₹400) via a dedicated Play product.

### 10.2 Ad rules (AdMob)
- Formats: **rewarded interactive (priority)** or **rewarded video**, always user-initiated ("Watch a short ad to open notes"); one native/banner ad on non-learning screens at most.
- Never during videos, tests, questions, the day checklist or explanations. Never on YouTube links.
- Under-18 users: **non-personalised ads**, max ad content rating **G**, tagged for under age of consent.
- Frequency cap: max 1 rewarded unlock per 10 min.

### 10.3 Coupons (admin-generated)
- Format: **6 letters + 3 digits**, uppercase (regex `^[A-Z]{6}[0-9]{3}$`), e.g. `TOPPER426`.
- Admin: Coupon → Generate → choose **discount tier** (10/20/30/50/70/90 %) · max number of users · valid from/to → Generate.
- Each tier maps to a pre-created discounted Google Play product per plan (e.g. `premium_off50`); app validates coupon with backend → launches that product.
- Status: **Active · Archived · Expired (auto) · Deleted**; usage counter; export.

### 10.4 Billing & policy
- Google Play Billing (one-time in-app products), server-side purchase verification via Google Play Developer API, acknowledge within 3 days, restore purchases on new device.
- Strike-through prices must be real previous prices (Indian consumer-protection "dark patterns" guidelines) — or remove the strike-through.
- Clear disclosure of trial end, price and what locks; reminder notification 24 h before trial ends.
- Refunds via Google Play policy + support email.

### 10.5 Future revenue (not now)
Premium courses, mock-test packages, certificates, partner/affiliate courses, career counselling, resume services, placement partnerships, institutional plans.

---

## 11. UI / UX & visual design

### 11.1 Style
**Soft minimal + light neumorphism.** Neumorphic shadows only on large cards, progress ring and checkboxes. Primary buttons are **solid navy** (clear tap affordance). Dark mode uses soft elevation, not neumorphic shadows.

### 11.2 Colour tokens (contrast checked)

Ratios are measured against the surface each token actually sits on — the light
`#EEF1F7` background or the white `#FFFFFF` card. Implemented in
`freementor/app/src/theme/tokens.ts`; that file and this table must agree.

| Role | Light | Dark |
|---|---|---|
| Primary / brand | Navy `#0A2463` (12.8:1 on base, 14.5:1 on card) | Sky `#8FB3FF` (9.1:1) |
| On primary | `#FFFFFF` | `#0B1020` |
| Background | `#EEF1F7` | `#0B1020` |
| Card / surface | `#FFFFFF` | `#141B2D` |
| Text | Ink `#0B1220` (16.5:1) | `#E8ECF4` (16.0:1) |
| Secondary text | `#5B6475` (5.3:1) | `#9AA4B8` (7.6:1) |
| Border / hairline | `#DCE1EC` | `#243049` |
| Success / done | Green `#127A45` (4.8:1) | `#4ADE80` (10.9:1) |
| Success chip | bg `#DCF3E6`, text `#127A45` (4.6:1) | bg `#13351F`, text `#4ADE80` (7.7:1) |
| Error | `#B3261E` (5.8:1) | `#FF6B6B` (6.8:1) |
| Neutral chip | bg `#E2E8F5`, text `#0A2463` (11.8:1) | bg `#1E2940`, text `#8FB3FF` (7.0:1) |
| Inactive tab label | `#667085` (5.0:1 on the card) | `#6B778F` |
| Muted / placeholder | `#A8B0C0` *(non-text only)* | `#4A566F` |

#### Amber is a fill colour, not a text colour

The brand amber `#F2A900` measures **1.8:1 on `#EEF1F7`** and **2.0:1 on white**.
That fails text contrast outright, and falls below even the 3:1 floor for
meaningful UI elements. It is therefore split into three tokens:

| Role | Light | Dark | Ratio |
|---|---|---|---|
| `accent` — **fills only**, never words | Amber `#F2A900` | same | decorative |
| `accentSoft` + `onAccent` — chips | bg `#FFF1C7`, text `#6B4A00` | bg `#3A2E12`, text `#FFD98A` | 7.2:1 / 9.8:1 |
| `accentInk` — amber **text** | `#7A5600` | `#FFC861` | 5.9:1 / 12.3:1 |

Dark ink on a solid amber fill is 9.3:1, so amber may be used as a button or
badge background with `#0B1220` text.

#### Where amber is allowed

Amber marks **"this is the live one"**. It appears in eight places and nowhere
else; adding a ninth is a deliberate decision, not a styling choice:

1. The streak counter
2. "Today" — on the route, and today's stop marker
3. The active tab (a 3 dp bar above the icon)
4. An earned achievement (the ★ and its chip)
5. A mock-test day (the ⚑ chip)
6. A short rule before a section heading
7. The ✓ on the trust line in the welcome card
8. The weekly report's single recommendation

**Every amber element is paired with a non-colour cue.** The active tab is also
navy and bold; an earned badge also reads "Earned"; a mock day also reads "Mock
test". Nothing in the app is conveyed by amber alone — which is what makes a
2:1 decorative fill acceptable where 2:1 text would not be.

> *Amended from the original "Accent (streak, 'today' only)". The widening was
> deliberate; the fill-versus-text split was forced by the measurement above,
> which found amber being used for the wordmark and for Cybersecurity safety
> warnings at 1.8:1.*

### 11.3 Typography
Inter (UI, body) · DM Sans (headings; *italic* for warm moments like "Your *roadmap* is ready") · Noto Sans Devanagari (Hindi). Minimum 14 sp body; supports system font scaling.

### 11.4 UX rules for Indian students
One main action per screen · chat-style onboarding · Hinglish micro-copy · 48 dp touch targets · app size < 25 MB, smooth on 3–4 GB RAM phones · low-data mode · offline roadmap · no spammy notifications.

### 11.5 Visual preview
See **`FreeMentor_App_Preview.png`**: opening animation, onboarding weekly time + calculator, home, roadmap route, day view, weekly report, plans screen, style sheet.

---

## 12. Tech stack & architecture

As specified in the source document, with the supporting libraries needed to build it:

| Layer | Choice |
|---|---|
| Mobile app | **React Native** (TypeScript). Use a React Native / Expo version that targets **Android 16 (API 36)**. Same codebase for iOS later. |
| Local storage (offline) | SQLite (e.g. `expo-sqlite` / WatermelonDB) for library + progress; sync queue |
| Backend | **Python + FastAPI** (REST), hosted on a managed container service |
| Database | **PostgreSQL** (Supabase-hosted) with row-level security |
| Authentication | **Supabase Auth** — Google sign-in |
| File storage / CDN | **Supabase Storage** — library JSON files (versioned), profile photos |
| Push notifications | **Firebase Cloud Messaging** (server pushes) + local scheduled notifications (daily reminders) |
| Analytics & crashes | **Firebase Analytics** + Crashlytics |
| Payments | Google Play Billing (`react-native-iap`) + FastAPI verification via Google Play Developer API |
| Ads | Google AdMob (`react-native-google-mobile-ads`) with UMP consent |
| Admin panel | Web app (React) on the same FastAPI APIs |
| Scheduled jobs | Link checker (`check_links.py`, YouTube Data API key on server), trial-end reminders, weekly reports, coupon expiry |

**Key rule:** API keys (YouTube, Google Play, Supabase service key) live **only on the server**, never in the app.

```
App (React Native) ──HTTPS──> FastAPI ──> PostgreSQL (Supabase)
   │  Google sign-in (Supabase Auth)        │
   │  download goals/<id>.json (Storage/CDN) ├─> Google Play Developer API (purchases)
   │  local SQLite + scheduler              ├─> YouTube Data API (link checker, server only)
   └─ FCM / AdMob / Firebase Analytics      └─> FCM (pushes)
```

---

## 13. Database design

| Table | Key fields |
|---|---|
| users | id, auth_id, email, name, photo_url, birth_year, gender (optional), qualification, language, is_minor, created_at, deleted_at |
| parent_consents | id, user_id, parent_contact, method (email/OTP), consented_at, revoked_at |
| goals | id, name, category, group, type, status (full/outline), est_hours, official_url, eligibility_note |
| library_versions | id, goal_id, version, valid_for, file_url, checksum, published_at |
| enrollments | id, user_id, goal_id, library_version_id, start_date, target_date, status (trial/active/archived), purchase_id |
| schedules | id, enrollment_id, mode (each_day/same), minutes_by_weekday (json), study_time, study_place, effective_from |
| task_progress | id, enrollment_id, block_id, scheduled_date, completed_at, minutes_credited |
| confidence_ratings | id, enrollment_id, topic_id, level, rated_at, next_review_on |
| test_scores | id, enrollment_id, block_or_milestone_id, score, max_score, taken_at |
| rest_days | id, enrollment_id, date |
| streaks | user_id, current, best, last_study_date, grace_used_on |
| purchases | id, user_id, enrollment_id, play_order_id, product_id, plan (basic/premium), coupon_id, price_paid, purchase_state, acknowledged_at |
| coupons | id, code, discount_tier, max_uses, used_count, valid_from, valid_to, status (active/archived/expired/deleted), created_by |
| resources | id, goal_id, url, type, provider, lang, access, status, duration_seconds, last_checked |
| link_reports | id, resource_id, problem, reported_by (checker/user), resolved_at |
| notification_prefs | user_id, daily, study, weekly_report, streak, test, quiet_hours |
| admin_users / audit_log | admin actions (coupons, library publishes, user changes) |

Recall questions and block definitions live inside the versioned library files (not per-user tables).

---

## 14. Admin panel (CMS)

- **Dashboard:** users, active users (DAU/WAU), roadmaps, courses, questions, videos; most popular / most completed / most abandoned goals; trial→paid conversion; revenue.
- **Content:** exams, skills, languages, phases, topics, blocks, videos, notes, practice, test links, recall questions; import/export JSON; validate against schema; publish new library version.
- **Link health:** checker results, broken-link queue, one-click replace, last-checked dates.
- **Users:** search, view progress, consent status, delete/export on request.
- **Coupons:** generate, tiers, limits, validity, archive/delete, usage.
- **Reports:** goal popularity, drop-off by week, average study time.
- Roles: Super admin, Content editor, Support (least privilege), full audit log.

---

## 15. Security, privacy & legal

**Security:** HTTPS everywhere · Supabase JWT auth · row-level security · server-side API calls only · input validation · rate limiting · encrypted secrets · purchase verification on server · audit log for admin.

**Privacy (DPDP Act 2023 + Rules 2025, full compliance by 13 May 2027):**
- Collect the minimum: name, email (Google), birth year, qualification, goal, schedule, progress, optional photo/gender.
- Users **16+ only**; **verifiable parental consent for 16–17** before processing their data; no behavioural tracking or targeted ads for minors.
- Clear privacy notice: what, why, how used, how long kept, who it's shared with (Google/Firebase/AdMob/Supabase), how to delete.
- In-app **and** web **account deletion**; data export; consent withdrawal.
- Retention: deleted accounts purged within 30 days (purchase records kept as required by law).

**Legal documents needed:** Privacy Policy, Terms of Service, Refund policy, Content/copyright policy ("we link, we don't host" + takedown contact), Grievance officer contact (India).

**Content compliance:** links only; YouTube videos never gated; rewards for completing tasks, not for watching videos; durations refreshed ≤ 30 days.

---

## 16. Google Play publishing checklist

- [ ] Play Console account (personal accounts: **closed test with 12 testers for 14 continuous days** before production)
- [ ] Target **API 36 (Android 16)**; Android App Bundle; Play App Signing
- [ ] Package name (e.g. `com.freementor.app`)
- [ ] Store listing: title "FreeMentor: Study Roadmap" (≤ 30 chars, no "#1/best/no ads"), short & full description with honest trial/pricing, icon, feature graphic, screenshots (from the preview)
- [ ] Privacy policy URL · **Data safety form** (incl. AdMob & Firebase SDK data) · Ads declaration ("contains ads")
- [ ] Target audience: **16+** (not designed for children; Families policy not applicable) · content rating questionnaire
- [ ] In-app products: basic, premium, upgrade, coupon tier products
- [ ] Account deletion: in-app + web link in the listing
- [ ] Permissions: Internet, notifications (POST_NOTIFICATIONS), AD_ID (declared); no exact alarms
- [ ] Crash reporting, pre-launch report, production rollout in stages (10 % → 50 % → 100 %)
- [ ] Re-check current Developer Program Policies before submission

---

## 17. Release scope: MVP, v2, v3

**MVP (v1):** onboarding (incl. Google sign-in, age/consent, calculator), goal selection (73 goals visible; JEE Main, NEET UG, Python fully playable — others marked "Coming soon / notify me"), personalised roadmap & scheduler, week/day views, videos/notes/practice/test links, recall checks, daily checklist, confidence sheet, progress & basic graphs, weekly report, streak, rest days, notifications, profile/settings, offline roadmap, trial + Basic/Premium + coupons, ads, admin panel, link checker.

**v2:** AI tutor (roadmap-aware, Hindi/English), AI-generated practice, adaptive roadmap advisor, mistake book, smart revision recommendations, full gamification (XP, levels, challenges), multiple goals, projects showcase, certificates, advanced analytics, leaderboard (personal milestones first), iOS release.

**v3:** AI voice tutor, career & job recommendations, resume builder, interview prep, coding environment, peer community, mentors, live classes, paid courses.

---

## 18. Development plan & timeline

Indicative for a small team (2 mobile devs, 1 backend dev, 1 designer, 1–2 content curators):

| Weeks | Milestone |
|---|---|
| 1–2 | Final UI designs (Figma) from the preview; design tokens; legal docs drafted; Play Console & Supabase/Firebase projects |
| 3–6 | App foundation: navigation, Google sign-in, onboarding, catalog, library download & local DB, scheduler engine with unit tests |
| 5–8 | Backend: FastAPI, Postgres schema, sync APIs, consent flow, purchases verification, coupons; admin panel v1 |
| 7–10 | Roadmap/week/day screens, checklist, recall, confidence, tests & score entry, progress, reports, streak, notifications |
| 9–11 | Billing, trial logic, AdMob + consent, paywall; link checker job; library review of 3 pilot goals |
| 11–12 | Offline sync, performance (low-end phones), accessibility, Hindi strings, analytics events |
| 13–14 | Internal testing → **closed test (12+ testers, 14 days)** → fixes |
| 15–16 | Production launch (staged rollout); start next goal libraries |

---

## 19. Open items

| # | Item | Suggested default |
|---|---|---|
| 1 | Prices include 18 % GST? | Show GST-inclusive prices (₹599 / ₹999) |
| 2 | Refund window | Google Play standard + 48 h manual refund on request |
| 3 | Legal entity, support email, grievance officer | Needed before Play listing |
| 4 | Detailed beginner playlists for JEE/NEET alongside one-shots | Add as "Detailed lectures" option in v1.1 |
| 5 | Hindi UI translation scope at launch | Full UI in English + Hindi; Hinglish notifications |
| 6 | Strike-through "original" prices (₹1,299 / ₹3,999) | Keep only if they were genuinely charged; else remove |
| 7 | Next goals to build after the pilot | CUET UG, SSC CGL, CAT, Full Stack, Data Analytics, JavaScript, SQL, Advanced Excel |
| 8 | Trademark search for "FreeMentor" (classes 9 & 41) and domain | Before branding spend |

---

## 20. Deliverables & sources

**Deliverables (in your Roadmap folder):**
- `FreeMentor_Product_Plan.md` — this document
- `FreeMentor_Library.zip` — catalog + 3 full roadmaps + schema + link checker
- `FreeMentor_Library_Review.xlsx` — readable library for review
- `FreeMentor_App_Preview.png` / `.html` — visual preview of the app
- `Brand/` — logo (icon SVG + PNG 512/1024, wordmark on light and on navy), Play Store icon 512×512 (full-bleed, 32-bit), Play feature graphic 1024×500, banner 2048×1000, A4 poster (PNG 300 dpi + PDF)

**Sources:**
- Google Play: [Target API level](https://support.google.com/googleplay/android-developer/answer/11926878) · [Metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842) · [Store listing best practices](https://support.google.com/googleplay/android-developer/answer/13393723) · [Billing for users in India](https://support.google.com/googleplay/android-developer/answer/13306652) · [Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818)
- [YouTube API Services Developer Policies](https://developers.google.com/youtube/terms/developer-policies)
- DPDP: [Rules 2025 timeline](https://www.tcsa.in/resources/dpdp-rules-2025-implementation-roadmap) · [Verifiable parental consent](https://www.consently.in/blog/verifiable-parental-consent-dpdp-rules-2025-edtech-gaming)
- Learning science: [Dunlosky et al. 2013](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html) · [Cepeda et al. 2008](https://files.eric.ed.gov/fulltext/ED505660.pdf) · [Guo, Kim & Rubin 2014](https://dl.acm.org/doi/10.1145/2556325.2566239) · [Biwer et al. 2023](https://cris.maastrichtuniversity.nl/en/publications/understanding-effort-regulation-comparing-pomodoro-breaks-and-sel/) · [Gollwitzer & Sheeran 2006](https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0065260106380021) · [Lally et al. 2010](https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674)
- Syllabus: [JEE Main 2027 syllabus status](https://engineering.careers360.com/articles/jee-main-changes-in-syllabus-2027) · [JEE Main deleted topics](https://blog.mtg.in/jee-main-deleted-syllabus/)
- Library sources: [NCERT textbooks](https://ncert.nic.in/textbook.php) · [OpenStax](https://openstax.org/) · [ExamSIDE JEE Main](https://questions.examside.com/past-years/jee/jee-main) · [ExamSIDE NEET](https://questions.examside.com/past-years/medical/neet) · [Think Python 3e](https://allendowney.github.io/ThinkPython/) · [Python docs](https://docs.python.org/3/tutorial/)
