/**
 * Rewarded ads — the thing a Basic learner watches to open a resource.
 *
 * Same shape as the server's `play.Verifier` and `push.Sender`: the policy is
 * here and pure, the SDK call is behind an interface, and the stub says what
 * it is rather than pretending. `react-native-google-mobile-ads` needs an
 * AdMob account and a development build, neither of which exists yet; until
 * then `StubRewardedAds` resolves immediately and the UI says so out loud.
 *
 * ## The rules, from product plan §10.2, enforced here
 *
 *  1. **User-initiated only.** An ad plays because somebody tapped a locked
 *     resource and chose to watch one. Nothing auto-plays, ever.
 *  2. **Never during study.** No ad interrupts a video, a test or the
 *     checklist. This module is only ever reached from the gate on opening a
 *     resource, which is before study starts, not during it.
 *  3. **The reward is granted only on a completed view.** A dismissed ad
 *     opens nothing — but see `Outcome.unavailable` below, which does.
 *  4. **Under-18 learners get non-personalised, G-rated ads.** That is a
 *     request parameter, and `requestOptionsFor` is the one place it is
 *     decided. DPDP Act §9(3) forbids behavioural advertising directed at
 *     children; `maxAdContentRating: 'G'` and `requestNonPersonalizedAdsOnly`
 *     are how AdMob is told.
 *  5. **Premium sees none of this.** `showsAds` in billing/entitlement.ts
 *     already decides that; this module is never reached on Premium.
 *
 * ## Why a failed ad opens the resource
 *
 * If the ad fails to load — no fill, no network, SDK not initialised — the
 * learner gets their resource anyway. They paid for Basic; the ad is how we
 * are paid, and a network problem on our side is not their debt. Refusing
 * would also be the exact shape of a dark pattern: payment taken, access
 * withheld for a reason the learner cannot act on.
 */

/** What happened when we tried to show an ad. */
export type Outcome =
  /** Watched to the end. Grant the reward. */
  | { kind: 'rewarded' }
  /** Closed early. No reward; the learner may try again. */
  | { kind: 'dismissed' }
  /** No ad could be shown. Grant access anyway — see the note above. */
  | { kind: 'unavailable'; reason: string };

export interface RewardedAds {
  /** Whether this build can show ads at all. */
  readonly available: boolean;
  show(options: RequestOptions): Promise<Outcome>;
}

export interface RequestOptions {
  /** Under-18 learners must not receive personalised ads (DPDP §9(3)). */
  nonPersonalized: boolean;
  /** AdMob's content rating ceiling: 'G' | 'PG' | 'T' | 'MA'. */
  maxAdContentRating: 'G' | 'PG' | 'T' | 'MA';
  /** AdMob's own flag for content directed at children. */
  tagForChildDirectedTreatment: boolean;
}

/** Below this age the stricter settings apply. Matches the onboarding gate. */
export const ADULT_AGE = 18;

/**
 * The request settings for a learner of this age.
 *
 * Pure, and the only place the under-18 rules are decided — so they are
 * testable without an SDK, and cannot be half-applied at one call site.
 *
 * `age === null` means we do not know, which happens if the profile row is
 * missing. It is treated as a minor: guessing wrong in the other direction
 * means serving a child a personalised ad.
 */
export function requestOptionsFor(age: number | null): RequestOptions {
  const minor = age === null || age < ADULT_AGE;
  return {
    nonPersonalized: minor,
    maxAdContentRating: minor ? 'G' : 'PG',
    tagForChildDirectedTreatment: minor,
  };
}

/**
 * A learner's age from their birth year, or null if unknown.
 *
 * Deliberately crude — year arithmetic, no birthday — and it rounds the wrong
 * way on purpose: somebody born this year counts as a year younger, so a
 * learner on the 17/18 boundary stays on the stricter settings until they are
 * unambiguously 18. Matches onboarding/age.ts.
 */
export function ageFromBirthYear(birthYear: number | null, today: Date = new Date()): number | null {
  if (birthYear === null) return null;
  return today.getFullYear() - birthYear - 1;
}

/** Whether an outcome means the resource should open. */
export function grantsAccess(outcome: Outcome): boolean {
  // 'unavailable' grants: the learner bought Basic and an ad we could not
  // serve is our problem, not theirs.
  return outcome.kind === 'rewarded' || outcome.kind === 'unavailable';
}

/**
 * The stand-in until there is an AdMob account and a development build.
 *
 * Reports `available: false` so the UI can say plainly that ads are not live
 * yet rather than implying one was shown. It resolves `unavailable`, which
 * grants access — the same path a real ad failure takes, so the code that
 * handles it is exercised now instead of on launch day.
 */
export class StubRewardedAds implements RewardedAds {
  readonly available = false;

  async show(): Promise<Outcome> {
    return { kind: 'unavailable', reason: 'Ads are not enabled in this build.' };
  }
}

/**
 * The real implementation.
 *
 * Deliberately not written against a guess at the SDK's API. Wiring it needs:
 *   - an AdMob account, an app id and a rewarded ad unit id
 *   - `react-native-google-mobile-ads` plus `expo-tracking-transparency`
 *   - a development build; it will not run in Expo Go
 *   - the UMP consent flow before the first request, which is a legal
 *     requirement for EU users and good practice everywhere
 * Until all of that exists, constructing this throws rather than silently
 * behaving like the stub — a wrong `adUnitId` in production must be loud.
 */
export class AdMobRewardedAds implements RewardedAds {
  readonly available = true;

  // Not stored yet: the constructor throws before it could be used, and an
  // unread private field is a type error. It becomes a field when show() is
  // implemented against the SDK.
  constructor(adUnitId: string) {
    if (!adUnitId) throw new Error('AdMobRewardedAds needs a rewarded ad unit id.');
    throw new Error(
      'AdMob is not wired up yet: it needs an AdMob account, ' +
        'react-native-google-mobile-ads and a development build. ' +
        'See src/ads/rewarded.ts.',
    );
  }

  async show(): Promise<Outcome> {
    throw new Error('unreachable');
  }
}

/**
 * The implementation this build should use.
 *
 * `EXPO_PUBLIC_ADMOB_REWARDED_ID` is a public identifier, not a secret — ad
 * unit ids are visible in any app bundle by design.
 */
export function getRewardedAds(): RewardedAds {
  const unitId = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID;
  if (!unitId) return new StubRewardedAds();
  try {
    return new AdMobRewardedAds(unitId);
  } catch (error) {
    // Never throw out of here. This is called at module scope, and a throw
    // would take the whole bundle down at import — turning "ads are
    // misconfigured" into "the app does not start", which is a far worse
    // failure for a learner who only wanted to open a note.
    //
    // Still loud: the reason travels in every Outcome, so it reaches the
    // dialog and the logs rather than passing as a silent free unlock.
    return new BrokenRewardedAds(
      error instanceof Error ? error.message : 'ad setup failed',
    );
  }
}

/**
 * A configured-but-unusable ad provider.
 *
 * Reports `available: true` — this build *claims* to serve ads — while every
 * request fails with the reason. That keeps the UI honest about intent and
 * keeps the learner unblocked.
 */
export class BrokenRewardedAds implements RewardedAds {
  readonly available = true;

  constructor(private readonly reason: string) {}

  async show(): Promise<Outcome> {
    return { kind: 'unavailable', reason: this.reason };
  }
}
