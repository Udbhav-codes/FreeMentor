# FreeMentor master plan — Android v1 to Play Store

Written 25 Nov 2026, from a full review of the repository. This replaces every
earlier plan and checklist (`LAUNCH_CHECKLIST.md`, the phase lists in chat).
Where they disagree, this file wins.

**Goal:** FreeMentor v1 live on Google Play, Android only, with real payments
and ads, at the lowest possible cost.
**Target:** production rollout in about **5 weeks** (late December 2026), at
20+ hours a week from the owner. The fixed floor is Google's 14-day closed test.

---

## 1. Decisions locked for v1

| Area | Decision |
|---|---|
| Platform | Android only. No iOS, no Apple account. |
| Play account | Personal (individual developer). Needs a 14-day closed test with 12+ testers. |
| Goals | 12 full roadmaps playable; the other 61 show "Coming soon" (already built). |
| Plans | 3-day free trial, then one-time **Basic ₹599** or **Premium ₹999** per roadmap; **Upgrade ₹400**. |
| Plan rules | Trial: videos + main notes open, no ads. After trial, nothing bought: videos + main notes after a rewarded ad; practice, tests, extra notes locked. Basic: everything except extra notes, no ads. Premium: everything + analytics, no ads. (`docs/MONETIZATION_STATE.md`) |
| Ads | **At launch.** AdMob rewarded ads, only for unpaid post-trial learners, with consent (UMP) and under-18 settings. |
| Coupons | **After launch (v1.1).** Code exists; switched off for v1. Only 3 Play products at launch. |
| Parent consent | Email codes only (Gmail SMTP). No SMS. |
| Website | Free Cloudflare address (`freementor.freementorteam.workers.dev`). No domain. |
| Skipped | Trademark, lawyer review, paid plans of any service. |

**Accepted risks** (owner's choice, recorded so nobody rediscovers them):
- Putting a rewarded ad before YouTube videos for unpaid learners may conflict
  with YouTube API Services terms. The defence: the roadmap is what is sold,
  videos stay free on YouTube.
- No lawyer review of the policies.
- Supabase free tier: pauses after ~7 idle days (keep-alive built) and has no
  automatic backups (monthly export script built).

---

## 2. Tools and services — the complete list

Everything is free except the Play registration, which is already paid.

| Tool / service | What it does for us | Status | Cost |
|---|---|---|---|
| **Expo SDK 57 + React Native + TypeScript** | The app | Built | Free |
| **EAS Build** (Expo) | Builds the APK/AAB in the cloud | Working (first dev build done) | Free tier (limited builds/month) |
| **Google Play Console** | Store listing, testing tracks, in-app products | Account created | $25 one-time (paid) |
| **Google Play Billing** (`react-native-iap`) | Takes payment | **Not built** | Google keeps ~15% per sale |
| **Google Play Developer API** | Server checks each purchase is real | Stub only | Free |
| **AdMob** (`react-native-google-mobile-ads`) + **UMP** consent | Rewarded ads | **Not built** (stub) | Free (it pays you) |
| **Supabase** (Postgres, Auth, Storage) | Database, Google sign-in, roadmap file CDN | Live | Free tier |
| **Google Cloud: OAuth client** | Google sign-in | Guide written; owner setting up | Free |
| **Google Cloud Run** | Runs the FastAPI server | Deploy guide written; not deployed | Free tier (card on file, ₹100 budget alert) |
| **Google Secret Manager** | Server secrets | Not created | Free tier |
| **Firebase** (Analytics, Crashlytics, Cloud Messaging) | Analytics, crash reports, push | Project + config wired; push not wired | Free (Spark) |
| **Gmail SMTP** (app password) | Parent-consent emails | Code done; password created | Free (~500 emails/day) |
| **Cloudflare Workers** | Hosts the 4 policies + account-deletion page | Site address exists | Free |
| **GitHub** | Code, keep-alive job, CI | Repo exists | Free |
| **YouTube Data API key** | Monthly link/duration check | Durations already filled (1,172/1,172) | Free |
| Local: Node, npm, Python 3.11, EAS CLI, **gcloud CLI** | Development and deploy | gcloud not installed yet | Free |
| An Android phone | Testing | Have one | — |

**Not needed** (do not buy or install): Android Studio, a domain, Supabase Pro,
EAS paid plan, SMS provider, Apple account, trademark, lawyer.

---

## 3. Where we stand

**Done and tested** (500 app tests, 342 server tests):
- **Learner app:**
  - onboarding, 16+ age gate and parent consent
  - the 73-goal catalog
  - the scheduler, roadmap, day view, streaks and reports
  - English, Hindi and Hinglish
  - data export and account deletion
  - the plan locks, trial clock, trial reminder and 10-minute ad window
- **Server:** auth, sync, consent email, coupon/purchase/entitlement rules, the
  server-verified trial, push scaffolding, backups and health checks.
- **Supabase:** live, with RLS; the catalog is seeded and the library published.
- **Builds and assets:** the first EAS development build installs on a phone.
  Icons, splash and Firebase config are in.

**Not done — this plan covers all of it:**
- Google sign-in verified on a device.
- Server deployed.
- Play Billing.
- AdMob.
- Push (FCM).
- Legal placeholders.
- Play listing and policies.
- Closed test.
- Release.

**Uncommitted right now:** the Render Error fix (`_layout.tsx`) and the website
address filled into two legal files.

---

## 4. The plan — 5 weeks

Each week ends with a check. Do not start the next week's release steps until
the check passes.

### Week 1 (25 Nov – 1 Dec): working app on a phone, server live, Play app created

**Owner**
1. Google sign-in. Create the Web OAuth client and the consent screen
   (`server/GOOGLE_SIGNIN.md` steps 1, 2, 4), and enable Google in Supabase.
   Add your Gmail as a test user.
2. Reload the dev build. Sign in, finish onboarding, pick a goal, and report
   anything broken.
3. Send Claude the legal details: name, address, city, support/grievance email
   (a separate free Gmail is best), and the publish date.
4. Install the gcloud CLI and deploy the server with Claude (`server/DEPLOY.md`).
   Use the Gmail app password for `SMTP_PASSWORD`.
5. Add the GitHub variable `API_URL` = the Cloud Run address (repo → Settings
   → Secrets and variables → Actions → Variables).
6. In Play Console:
   - Create the app: FreeMentor: Study Roadmap, App, Free.
   - Start the store listing.
   - Answer the content rating questionnaire.
   - Set the target audience to 16+.
   - Answer the ads declaration: "Yes, contains ads".
7. Create the AdMob account, register the Android app, and create **one
   rewarded ad unit**. Send Claude the App ID and ad unit ID. Neither is
   secret.
8. Recruit **15 testers** (12 required; extra cover drop-outs). Collect their
   Gmail addresses.

**Claude**
1. Commit the Render Error fix. Add a check so a screen can't render outside
   its providers again.
2. Fill the legal placeholders, rebuild `web/dist`, and give you the files to
   upload to the Cloudflare site.
3. Point the app at the server (`EXPO_PUBLIC_API_URL`) and the website
   (`EXPO_PUBLIC_WEB_URL`) in EAS.
4. Build Play Billing in the app with `react-native-iap`, for 3 products:
   - purchase
   - acknowledge
   - restore
   - error states
5. Build the real `GooglePlayVerifier` on the server, using the Play Developer
   API.
6. Build AdMob: the real `AdMobRewardedAds`, the UMP consent flow, and the
   under-18 request settings. Use Google's test ad IDs until yours arrive.
7. Add a free GitHub Actions CI job: app tests, server tests and library
   validation on every push.
8. Correct the stale lines in `CLAUDE.md` (for example, durations are now
   filled).

**Check:** sign-in works on your phone; `/health/db` is OK on Cloud Run; the
policy pages load from the workers.dev address.

### Week 2 (2 – 8 Dec): payments and ads working, closed test starts

**Owner**
1. Upload the first **production build (AAB)** that Claude makes to the
   **internal testing** track. Play only lets you create in-app products after
   a build with billing has been uploaded.
2. Create the 3 in-app products: `basic`, `premium`, `upgrade_basic_to_premium`
   at ₹599, ₹999 and ₹400.
3. Link the Play service account so the server can verify purchases. Claude
   gives exact clicks; the key goes into Secret Manager.
4. Add yourself as a **license tester**, and buy each product with test cards.
5. Fill the **Data safety** form. Claude drafts every answer.
6. Publish the OAuth consent screen ("In production"). Basic scopes need no
   Google review.
7. Create the **closed testing** track, add the 15 testers, publish the build,
   and send them the opt-in link. **The 14-day clock starts here. Aim for
   5 December, 8 December at the latest.**

**Claude**
1. Make the production build and the closed-test build.
2. Wire FCM push: register the device token and send through the server.
3. Write the full store listing text, plus the Data safety and content-rating
   answers.
4. Fix anything found in your test purchases and ad tests.

**Check:**
- A test purchase unlocks Basic, survives a reinstall through Restore, and
  shows in Postgres.
- A test rewarded ad plays after the trial ends and opens a video.
- The closed test is live with 12+ opted-in testers.

### Weeks 3–4 (9 – 22 Dec): closed test running (14 days)

**Owner**
1. Keep the testers active. Google looks at engagement, so ask them to open the
   app on several days.
2. Collect feedback and screenshots, and pass them to Claude.
3. Have a native speaker read the Hindi and Hinglish screens.
4. Take the store screenshots (Claude lists which screens).
5. Swap in your real AdMob IDs once AdMob approves the app.

**Claude**
1. Fix every bug the testers find, and ship updates to the closed track (an
   update does not reset the 14 days).
2. Check performance on a low-end phone, accessibility labels and offline mode.
3. Remove `exp://**` from Supabase redirects. Confirm the dev sign-in bypass
   can't reach a release build.
4. Run the monthly link check before release.

**Check:** 14 consecutive days with 12+ testers opted in; no crash in
Crashlytics; no open blocker.

### Week 5 (23 – 31 Dec): production

**Owner**
1. Apply for **production access**. Play asks about the closed test; Claude
   drafts the answers. Review can take up to about 7 days.
2. Once approved, release to production at **10%**, then 50%, then 100% over a
   few days.
3. Upgrade Supabase to Pro (~₹2,100/month) when real paying users arrive. This
   is the only recurring cost in the plan, and it's optional until then.

**Claude**
1. **Turn the 3-day free trial back on** (`app/src/billing/trial.ts`,
   `TRIAL_ENABLED = true`). It was switched off on 27 Nov 2026 for testing.
   The production build refuses to start until this is done.
2. Make the release build, and watch Crashlytics and the server logs during the
   rollout.
3. Run the first monthly database backup.

**Check:** FreeMentor is live on Google Play.

---

## 5. After launch (v1.1 and on)

1. **Coupons:** create the tier products in Play and turn the coupon field on.
2. **Monthly:** run the link check, the database backup, and confirm the
   keep-alive job is still enabled.
3. **Next goals:** SSC CGL, CAT, Data Analytics, JavaScript, Advanced Excel.
4. **Later:** a custom domain, native Google one-tap sign-in, and v2 features
   (AI tutor, adaptive plan, mistake book). iOS only when revenue pays for the
   Apple account.

---

## 6. Cost summary

| | Cost |
|---|---|
| Play Console registration | $25, already paid |
| Everything else in section 2 | ₹0 |
| **Extra money needed to launch** | **₹0** |
| Optional after paying users arrive | Supabase Pro ~₹2,100/month |
| Per sale | Google keeps ~15%; the price includes GST |
