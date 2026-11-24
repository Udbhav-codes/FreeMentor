# Monetisation: current state (for owner review)

Snapshot of what the **code actually does** as of 2026-11-24 (updated to the owner's plan table), taken from
`freementor/app/src/billing/entitlement.ts`, `billing/pricing.ts`,
`billing/trial.ts`, `ads/rewarded.ts`, `components/ResourceLink.tsx` and the goal
files. Where docs and code disagree, this file says so (section 5).

## 1. Plans

One-time, per roadmap (goal), lifetime, GST-inclusive. No subscription.
Basic **₹599**, Premium **₹999**, upgrade Basic to Premium **₹400**.
Strike-through "previous" prices (₹1,299 / ₹3,999) are **off**
(`SHOW_PREVIOUS_PRICES = false`) until shown to be genuine.

Coupons: `^[A-Z]{6}[0-9]{3}$`, tiers 10/20/30/50/70/90%, each mapped to a
pre-made discounted Play product. Server validation is built; the Play
products do not exist yet.

## 2. What is locked, by state (owner's table, Basic revised, implemented Nov 2026)

| | Free trial (3 days) | Trial over, nothing bought | Basic ₹599 | Premium ₹999 |
|---|---|---|---|---|
| Roadmap, day plan, ticks, streak | ✅ | ✅ | ✅ | ✅ |
| YouTube videos | ✅ | ✅ after an ad | ✅ | ✅ |
| Main notes | ✅ | ✅ after an ad | ✅ | ✅ |
| Practice and tests | 🔒 | 🔒 | ✅ | ✅ |
| Extra notes (429) | 🔒 | 🔒 | 🔒 Premium only | ✅ |
| Detailed analytics | ❌ | ❌ | ❌ | ✅ |
| Ads | none | one per resource opened | none | none |

🔒 sends the learner to the Plans screen.

## 3. Where ads appear, and when they stop

- **Only** a learner whose 3-day trial has ended with **nothing bought** sees
  ads: one user-initiated rewarded ad each time they open a video or main note.
- **None** during the trial, **none** on Basic, **none** on Premium. Buying
  either plan ends the ads at once. There is no watch-count or timer.
- Never auto-played, never during a video, test or the checklist.
- Under-18: non-personalised, max rating G, child-directed tag. Unknown age is
  treated as under 18.
- If an ad fails to load, the resource opens anyway. A dismissed ad opens nothing.
- Planned cap "1 rewarded unlock per 10 min" is **not implemented**.
- **AdMob is not live.** Without `EXPO_PUBLIC_ADMOB_REWARDED_ID` a stub grants
  access immediately and says ads are not enabled in this build. Real AdMob
  needs an AdMob account, `react-native-google-mobile-ads`, a development
  build and the UMP consent flow.
- **Consequence:** ads are now a nudge to buy, not the way Basic pays its way,
  so expect little ad revenue. Premium differs from Basic only by extra notes
  and detailed analytics.

## 4. Content in each bucket (12 full goals, 4,122 resources)

| Type | Source | Count | Gate |
|---|---|---|---|
| video | YouTube | 1,172 | trial and Basic open; expired ad |
| notes (main) | web | 1,318 | trial and Basic open; expired ad |
| notes | YouTube | 21 | same as main notes |
| notes, `access: premium` (extra) | web | 429 | Premium only |
| practice | web / YouTube | 692 / 1 | locked until Basic, then open |
| test / mock | web | 489 | locked until Basic, then open |

The 429 extra notes: `jee-main` 104, `jee-advanced` 107, `neet-ug` 126,
`cuet-ug` 72, `python` 19, `sql` 1. Six goals have none, so Basic and Premium
differ there only by ads and analytics.

## 5. Open items before production

1. **YouTube API Services terms.** Videos are free for trial, Basic and Premium
   learners, but an unpaid learner after the trial meets a rewarded ad before each one. Charging for, or gating with ads, access to
   YouTube content is restricted; the defence is that you sell the roadmap and
   the videos stay free on YouTube. Get this confirmed. If not acceptable, make
   video links always open and gate only notes, practice and tests.
2. **Trial gives practice and tests nothing.** By the table, practice and
   tests are locked even during the trial. Confirm this is intended, since the
   trial then shows less than Basic does.
3. **Marketing claims.** "Free" copy must say where it is free
   (`marketing/compliance.ts` enforces this for in-app copy; the store listing
   and screenshots are on you).
4. **Trial clock is device-based** (with a high-water mark), so it can be
   gamed until purchases are server-verified.
5. **Comparison prices** in `pricing.ts` (coaching ₹6,000 to ₹40,000+) need a
   dated source or removal.
6. Lock copy was updated in English, Hindi and Hinglish; have a native speaker
   check the Hindi and Hinglish.

## 6. Not built yet

Play Billing (`react-native-iap`) and the real Play verifier, the Play and
coupon products, AdMob + UMP, the 10-minute ad cap, the 24 h trial-ending
reminder, restore purchases on a new device.
