# Launch checklist: first Play Store release

Decisions so far: launch ASAP, India first, all 12 full goals (the other 61 show
as outlines), solo developer, publishing as an **individual**, AdMob included,
server host undecided. Order matters: items near the top unblock the rest.

## A. Decisions only you can make
- [ ] Confirm YouTube links behind a rewarded ad are acceptable (`MONETIZATION_STATE.md` section 5).
- [ ] Review and approve the lock table in `MONETIZATION_STATE.md`.
- [ ] Pick a server host (Dockerfile exists). Needs a public HTTPS URL.
- [ ] Decide what "outline" goals do at launch (hidden, or "coming soon").

## B. Accounts (start now: these have waiting periods)
- [ ] Google Play Console, personal account. One-time fee; identity verification
      takes days. Individual accounts created recently must run a **closed test
      with a minimum number of testers for 14 days** before production access.
      Check the exact current numbers in Play Console. Recruit testers early.
- [ ] Play payments profile (India): PAN/bank details; check whether GST
      registration is needed at your revenue.
- [ ] AdMob account linked to the Play app; create a rewarded ad unit. (Only unpaid post-trial learners see ads, so this can follow the first release if you want to ship sooner.)
- [ ] Firebase project for FCM and Crashlytics.
- [ ] Add `exp://**` to Supabase redirect URLs (testing only; remove before launch).

## C. Build
- [ ] Create an EAS development build (Expo Go cannot run Play Billing or AdMob).
- [ ] Verify Google sign-in on a device with the dev build; native sign-in.
- [ ] Integrate `react-native-iap`; create products (basic, premium, upgrade,
      coupon-discount products); implement the real `GooglePlayVerifier`.
- [ ] Integrate AdMob with UMP consent; implement `AdMobRewardedAds`; add the
      10-minute rewarded cap if you keep it.
- [ ] Trial-ending reminder (24 h before) and restore purchases.
- [ ] Deploy the server; set production secrets (Supabase service key, Play
      service account, YouTube key). `OTP_ECHO` must be off.
- [ ] Real email/SMS delivery for parental-consent OTP (console sender today).
- [ ] FCM end to end.
- [ ] Remove the dev sign-in bypass from release builds (already `__DEV__` gated; confirm).
- [ ] Re-run `check_links.py`; commit refreshed durations and link repairs.

## D. Play Console listing and policy
- [ ] Privacy policy URL (`web/` builds `/privacy`; host it publicly).
- [ ] Account-deletion page URL (built) and in-app deletion path.
- [ ] Data safety form (account, progress, purchases, photos, ads identifiers).
- [ ] Content rating questionnaire; target audience 16+ / ads declaration.
- [ ] Store listing: title, descriptions, screenshots, feature graphic (in `design/brand`).
- [ ] Listing copy must say where resources are free (see compliance rule).
- [ ] Source the comparison prices used in the app or remove them.
- [ ] Decide on strike-through prices: only if genuinely charged earlier.

## E. Quality gates
- [ ] `npm test -w app`, `npm run validate:library`, server `pytest` all green.
- [ ] Test on at least two real Android devices and one low-end.
- [ ] Purchase flow with Play license testers and test cards.
- [ ] Under-18 flow: consent, non-personalised ads, G rating.
- [ ] Trial expiry, lock screens and Plans routing.
- [ ] Offline behaviour of cached goals.

## F. Release
- [ ] Internal test, then closed test (14-day clock if required), then production.
- [ ] Crashlytics and server logs watched during the first week.
