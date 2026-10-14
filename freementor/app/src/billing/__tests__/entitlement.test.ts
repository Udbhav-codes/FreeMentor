/**
 * The gate — product plan §10.1.
 *
 * The model changed in Oct 2026 on the product owner's instruction: the trial
 * is Basic made free for three days, and when it ends EVERYTHING locks,
 * videos included. Before that, YouTube was never gated on any plan. These
 * tests encode the new rule; the old ones are gone rather than loosened, so
 * nobody has to guess which was intended.
 */
import { describe, expect, it } from 'vitest';
import type { Resource } from '@freementor/shared';
import {
  accessFor,
  entitlementFor,
  hasDetailedAnalytics,
  needsPlan,
  showsAds,
  showsWelcomeCard,
  type Entitlement,
} from '../entitlement.ts';

const ALL: Entitlement[] = ['trial', 'expired', 'basic', 'premium'];

const res = (over: Partial<Resource> = {}): Resource =>
  ({
    type: 'notes',
    title: 'A resource',
    url: 'https://example.com/x',
    lang: 'en',
    provider: 'example.com',
    access: 'all',
    status: 'active',
    ...over,
  }) as unknown as Resource;

const KINDS = ['video', 'notes', 'practice', 'test'] as const;

describe('the three-day trial', () => {
  it('opens everything, including videos', () => {
    // It is Basic made free, so the learner sees the real product rather than
    // a hobbled one. That is what makes the paywall at the end fair.
    for (const type of KINDS) {
      expect(accessFor(res({ type }), 'trial').kind, type).toBe('open');
    }
  });

  it('shows no ads', () => {
    // Paying is what removes ads on Basic; the trial has none at all, so the
    // three days are a clean look at the product.
    expect(showsAds('trial')).toBe(false);
  });

  it('opens even Premium-marked resources', () => {
    expect(accessFor(res({ access: 'premium' }), 'trial').kind).toBe('open');
  });
});

describe('when the trial has ended and nothing is bought', () => {
  it('locks every kind of resource', () => {
    for (const type of KINDS) {
      expect(accessFor(res({ type }), 'expired').kind, type).toBe('needs_plan');
    }
  });

  it('locks videos too — the rule the owner changed', () => {
    // This file used to assert the exact opposite. Spelled out so a reader
    // who remembers the old behaviour knows it was a decision, not a slip.
    expect(accessFor(res({ type: 'video' }), 'expired').kind).toBe('needs_plan');
    expect(
      accessFor(res({ type: 'notes', url: 'https://www.youtube.com/watch?v=x' }), 'expired')
        .kind,
    ).toBe('needs_plan');
  });

  it('sends the learner somewhere they can act, not just a dead end', () => {
    // needs_plan is what routes to the Plans screen. A lock with no route is
    // the worst version of this screen.
    expect(needsPlan('expired')).toBe(true);
    expect(showsWelcomeCard('expired')).toBe(true);
  });
});

describe('Basic', () => {
  it('reaches everything through a rewarded ad', () => {
    for (const type of KINDS) {
      expect(accessFor(res({ type }), 'basic').kind, type).toBe('ad_gated');
    }
  });

  it('still cannot reach Premium-only resources', () => {
    // An ad does not substitute for the plan, or Premium would have nothing
    // left to sell.
    expect(accessFor(res({ access: 'premium' }), 'basic').kind).toBe('premium_only');
  });

  it('is the only plan that sees ads', () => {
    expect(showsAds('basic')).toBe(true);
    expect(showsAds('trial')).toBe(false);
    expect(showsAds('premium')).toBe(false);
  });
});

describe('Premium', () => {
  it('opens everything with no ad and no lock', () => {
    for (const type of KINDS) {
      expect(accessFor(res({ type }), 'premium').kind, type).toBe('open');
    }
    expect(accessFor(res({ access: 'premium' }), 'premium').kind).toBe('open');
  });

  it('is the only plan with detailed analytics', () => {
    for (const entitlement of ALL) {
      expect(hasDetailedAnalytics(entitlement)).toBe(entitlement === 'premium');
    }
  });
});

describe('the welcome card keeps showing until a plan is bought', () => {
  it('shows during the trial and after it ends', () => {
    expect(showsWelcomeCard('trial')).toBe(true);
    expect(showsWelcomeCard('expired')).toBe(true);
  });

  it('stops the moment they buy either plan', () => {
    expect(showsWelcomeCard('basic')).toBe(false);
    expect(showsWelcomeCard('premium')).toBe(false);
  });
});

describe('resolving the entitlement', () => {
  it('follows the clock when nothing is bought', () => {
    expect(entitlementFor({ trialPhase: 'active', purchase: null })).toBe('trial');
    expect(entitlementFor({ trialPhase: 'last_day', purchase: null })).toBe('trial');
    expect(entitlementFor({ trialPhase: 'expired', purchase: null })).toBe('expired');
  });

  it('lets a purchase outrank the clock, in both directions', () => {
    // Buying on day 2 must not leave someone on the trial...
    expect(entitlementFor({ trialPhase: 'active', purchase: 'basic' })).toBe('basic');
    // ...and buying after expiry must lift the lock at once.
    expect(entitlementFor({ trialPhase: 'expired', purchase: 'premium' })).toBe('premium');
  });
});

describe('no state is a dead end', () => {
  it('every entitlement resolves every resource to a defined outcome', () => {
    // A missing branch would surface as `undefined` and a blank row in the UI.
    for (const entitlement of ALL) {
      for (const type of KINDS) {
        for (const access of ['all', 'premium'] as const) {
          const kind = accessFor(res({ type, access }), entitlement).kind;
          expect(['open', 'ad_gated', 'premium_only', 'needs_plan']).toContain(kind);
        }
      }
    }
  });
});
