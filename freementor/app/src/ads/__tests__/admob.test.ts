/**
 * AdMobRewardedAds against a fake AdMob SDK.
 *
 * What matters: a watched ad grants, a closed-early ad does not, a failed ad
 * opens the resource anyway, and a minor's request really carries the
 * non-personalised, G-rated, child-directed settings.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (...args: unknown[]) => void;
const sdk = vi.hoisted(() => ({
  config: null as unknown,
  requestOptions: null as unknown,
  script: 'reward' as 'reward' | 'close' | 'error',
  consentCanRequest: true,
}));

vi.mock('react-native-google-mobile-ads', () => {
  const RewardedAdEventType = { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' };
  const AdEventType = { CLOSED: 'closed', ERROR: 'error' };
  class FakeAd {
    private listeners = new Map<string, Listener>();
    addAdEventListener(type: string, fn: Listener) {
      this.listeners.set(type, fn);
      return () => this.listeners.delete(type);
    }
    load() {
      queueMicrotask(() => {
        if (sdk.script === 'error') this.listeners.get(AdEventType.ERROR)?.(new Error('no fill'));
        else this.listeners.get(RewardedAdEventType.LOADED)?.();
      });
    }
    async show() {
      if (sdk.script === 'reward') this.listeners.get(RewardedAdEventType.EARNED_REWARD)?.();
      this.listeners.get(AdEventType.CLOSED)?.();
    }
  }
  return {
    default: () => ({
      initialize: async () => [],
      setRequestConfiguration: async (config: unknown) => {
        sdk.config = config;
      },
    }),
    AdsConsent: { gatherConsent: async () => ({ canRequestAds: sdk.consentCanRequest }) },
    MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
    RewardedAdEventType,
    AdEventType,
    RewardedAd: {
      createForAdRequest: (_unit: string, options: unknown) => {
        sdk.requestOptions = options;
        return new FakeAd();
      },
    },
  };
});

import { AdMobRewardedAds, getRewardedAds, requestOptionsFor, StubRewardedAds } from '../rewarded.ts';

beforeEach(() => {
  sdk.script = 'reward';
  sdk.consentCanRequest = true;
  sdk.config = null;
  sdk.requestOptions = null;
});

describe('the real rewarded ad', () => {
  it('grants after the ad is watched to the end', async () => {
    const outcome = await new AdMobRewardedAds('unit').show(requestOptionsFor(25));
    expect(outcome.kind).toBe('rewarded');
  });

  it('does not grant when the learner closes it early', async () => {
    sdk.script = 'close';
    const outcome = await new AdMobRewardedAds('unit').show(requestOptionsFor(25));
    expect(outcome.kind).toBe('dismissed');
  });

  it('opens the resource when no ad can be loaded', async () => {
    sdk.script = 'error';
    const outcome = await new AdMobRewardedAds('unit').show(requestOptionsFor(25));
    expect(outcome.kind).toBe('unavailable');
  });

  it('opens the resource when consent says ads cannot be requested', async () => {
    sdk.consentCanRequest = false;
    const outcome = await new AdMobRewardedAds('unit').show(requestOptionsFor(25));
    expect(outcome.kind).toBe('unavailable');
  });

  it('sends a minor a non-personalised, G-rated, child-directed request', async () => {
    await new AdMobRewardedAds('unit').show(requestOptionsFor(16));
    expect(sdk.requestOptions).toEqual({ requestNonPersonalizedAdsOnly: true });
    expect(sdk.config).toMatchObject({
      maxAdContentRating: 'G',
      tagForChildDirectedTreatment: true,
      tagForUnderAgeOfConsent: true,
    });
  });

  it('allows personalised, PG ads only for an adult', async () => {
    await new AdMobRewardedAds('unit').show(requestOptionsFor(30));
    expect(sdk.requestOptions).toEqual({ requestNonPersonalizedAdsOnly: false });
    expect(sdk.config).toMatchObject({ maxAdContentRating: 'PG' });
  });
});

describe('choosing the implementation', () => {
  it('uses the stub in Expo Go, which has no ads module', () => {
    expect(getRewardedAds(true)).toBeInstanceOf(StubRewardedAds);
  });

  it('uses the real one in a dev build, on Google\'s test unit', () => {
    expect(getRewardedAds(false)).toBeInstanceOf(AdMobRewardedAds);
  });
});
