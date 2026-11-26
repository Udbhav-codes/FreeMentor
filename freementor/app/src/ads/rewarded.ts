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

type AdsModule = typeof import('react-native-google-mobile-ads');

/** How long to wait for an ad to load before giving the learner the resource. */
export const LOAD_TIMEOUT_MS = 12_000;

/**
 * The real implementation, on react-native-google-mobile-ads.
 *
 * Before the first request, once per app run:
 *   - the UMP consent flow (`AdsConsent.gatherConsent`), which shows Google's
 *     consent form only where the law requires it (EEA/UK) and is a no-op in
 *     India. If it says ads cannot be requested, the result is 'unavailable'
 *     and the resource opens, per the rule at the top of this file.
 *   - the SDK is initialised.
 *
 * Per request, the under-18 settings from `requestOptionsFor` are applied both
 * as the global request configuration (content rating, child-directed and
 * under-age-of-consent tags) and on the request itself (non-personalised).
 *
 * The SDK is loaded lazily: it does not exist in Expo Go or under tests, and a
 * missing module must mean "no ad", never a crash.
 */
export class AdMobRewardedAds implements RewardedAds {
  readonly available = true;
  private ready: Promise<AdsModule | null> | null = null;

  constructor(private readonly adUnitId: string) {
    if (!adUnitId) throw new Error('AdMobRewardedAds needs a rewarded ad unit id.');
  }

  private prepare(): Promise<AdsModule | null> {
    if (!this.ready) {
      this.ready = (async () => {
        try {
          const mod = await import('react-native-google-mobile-ads');
          const consent = await mod.AdsConsent.gatherConsent().catch(() => null);
          if (consent && consent.canRequestAds === false) return null;
          await mod.default().initialize();
          return mod;
        } catch {
          return null;
        }
      })();
    }
    return this.ready;
  }

  async show(options: RequestOptions): Promise<Outcome> {
    const mod = await this.prepare();
    if (!mod) {
      // Let a later tap try again (network back, consent changed).
      this.ready = null;
      return { kind: 'unavailable', reason: 'Ads could not be set up on this device.' };
    }

    try {
      await mod.default().setRequestConfiguration({
        maxAdContentRating:
          options.maxAdContentRating === 'G'
            ? mod.MaxAdContentRating.G
            : options.maxAdContentRating === 'PG'
              ? mod.MaxAdContentRating.PG
              : options.maxAdContentRating === 'T'
                ? mod.MaxAdContentRating.T
                : mod.MaxAdContentRating.MA,
        tagForChildDirectedTreatment: options.tagForChildDirectedTreatment,
        tagForUnderAgeOfConsent: options.nonPersonalized,
      });
    } catch {
      // A failed configuration must not leave a minor on default settings.
      if (options.nonPersonalized) {
        return { kind: 'unavailable', reason: 'Ad settings could not be applied.' };
      }
    }

    const ad = mod.RewardedAd.createForAdRequest(this.adUnitId, {
      requestNonPersonalizedAdsOnly: options.nonPersonalized,
    });

    return new Promise<Outcome>((resolve) => {
      let earned = false;
      let settled = false;
      const unsubscribers: Array<() => void> = [];
      const finish = (outcome: Outcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        unsubscribers.forEach((off) => off());
        resolve(outcome);
      };
      const timer = setTimeout(
        () => finish({ kind: 'unavailable', reason: 'The ad took too long to load.' }),
        LOAD_TIMEOUT_MS,
      );

      unsubscribers.push(
        ad.addAdEventListener(mod.RewardedAdEventType.LOADED, () => {
          clearTimeout(timer);
          ad.show().catch(() =>
            finish({ kind: 'unavailable', reason: 'The ad could not be shown.' }),
          );
        }),
        ad.addAdEventListener(mod.RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        }),
        ad.addAdEventListener(mod.AdEventType.CLOSED, () => {
          finish(earned ? { kind: 'rewarded' } : { kind: 'dismissed' });
        }),
        ad.addAdEventListener(mod.AdEventType.ERROR, () => {
          finish({ kind: 'unavailable', reason: 'No ad was available right now.' });
        }),
      );
      ad.load();
    });
  }
}

/** Google's public test rewarded unit. Safe to load; never pays out. */
export const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/5224354917';

/**
 * The implementation this build should use.
 *
 * `EXPO_PUBLIC_ADMOB_REWARDED_ID` is a public identifier, not a secret — ad
 * unit ids are visible in any app bundle by design. A development build with
 * no id uses Google's test unit, so the flow can be exercised before the real
 * AdMob account exists. A release build with no id uses the stub: no ads, and
 * the resource opens.
 */
export function getRewardedAds(expoGo = false): RewardedAds {
  // Expo Go has no native ads module. The caller says so (notifications/daily
  // already knows), which keeps expo-constants out of this testable module.
  if (expoGo) return new StubRewardedAds();
  const unitId =
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || (__DEV__ ? TEST_REWARDED_UNIT : '');
  if (!unitId) return new StubRewardedAds();
  try {
    return new AdMobRewardedAds(unitId);
  } catch (error) {
    // Never throw out of here. This is called at module scope, and a throw
    // would take the whole bundle down at import.
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
