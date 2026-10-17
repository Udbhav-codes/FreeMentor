/**
 * The rewarded-ad policy.
 *
 * No ads exist yet, so what is tested is the part that will be wrong if
 * anything is: who gets non-personalised ads, and what happens when an ad
 * cannot be shown.
 *
 * The under-18 rules are the ones with legal weight — DPDP Act §9(3) forbids
 * behavioural advertising directed at children — and they are decided in one
 * pure function precisely so they can be checked here rather than trusted
 * across call sites.
 */
import { describe, expect, it } from 'vitest';
import {
  ADULT_AGE,
  grantsAccess,
  requestOptionsFor,
  StubRewardedAds,
  type Outcome,
} from '../rewarded.ts';

describe('under-18 ad settings', () => {
  it('asks for non-personalised, G-rated ads for a minor', () => {
    const options = requestOptionsFor(16);
    expect(options.nonPersonalized).toBe(true);
    expect(options.maxAdContentRating).toBe('G');
    expect(options.tagForChildDirectedTreatment).toBe(true);
  });

  it('treats an unknown age as a minor', () => {
    // Guessing the other way serves a child a personalised ad, so the
    // default has to fail in this direction.
    const options = requestOptionsFor(null);
    expect(options.nonPersonalized).toBe(true);
    expect(options.maxAdContentRating).toBe('G');
  });

  it('relaxes only once the learner is actually 18', () => {
    expect(requestOptionsFor(ADULT_AGE - 1).nonPersonalized).toBe(true);
    expect(requestOptionsFor(ADULT_AGE).nonPersonalized).toBe(false);
    expect(requestOptionsFor(ADULT_AGE).maxAdContentRating).toBe('PG');
    expect(requestOptionsFor(ADULT_AGE).tagForChildDirectedTreatment).toBe(false);
  });

  it('matches the onboarding age gate', () => {
    // 16+ to use the app at all, 18 for personalised ads. If these ever
    // disagree, one of them is wrong.
    expect(ADULT_AGE).toBe(18);
  });

  it('never returns a rating above PG, whatever the age', () => {
    for (const age of [18, 25, 40, 99]) {
      expect(['G', 'PG']).toContain(requestOptionsFor(age).maxAdContentRating);
    }
  });
});

describe('what grants access to the resource', () => {
  it('grants on a completed view', () => {
    expect(grantsAccess({ kind: 'rewarded' })).toBe(true);
  });

  it('does NOT grant when the learner closed the ad early', () => {
    expect(grantsAccess({ kind: 'dismissed' })).toBe(false);
  });

  it('grants when no ad could be shown', () => {
    // The learner paid for Basic. An ad we failed to serve is our problem,
    // and withholding access for a reason they cannot act on is the shape of
    // a dark pattern.
    const outcome: Outcome = { kind: 'unavailable', reason: 'no fill' };
    expect(grantsAccess(outcome)).toBe(true);
  });
});

describe('the stub standing in until AdMob exists', () => {
  it('says plainly that it cannot show ads', () => {
    // So the UI can tell the truth rather than implying one was shown.
    expect(new StubRewardedAds().available).toBe(false);
  });

  it('resolves unavailable, which opens the resource', async () => {
    const outcome = await new StubRewardedAds().show();
    expect(outcome.kind).toBe('unavailable');
    expect(grantsAccess(outcome)).toBe(true);
  });

  it('exercises the same path a real ad failure will take', async () => {
    // The point of choosing 'unavailable' over a fake 'rewarded': the
    // failure branch is live now, not first run on launch day.
    const outcome = await new StubRewardedAds().show();
    expect(outcome.kind === 'unavailable' && outcome.reason).toBeTruthy();
  });
});
