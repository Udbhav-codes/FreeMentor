/**
 * The gate — product plan §10.1, owner's plan table (Nov 2026).
 *
 * Trial: videos and main notes open, no ads; practice, tests and extra notes
 * locked. Expired: videos and main notes open after an ad; the rest locked.
 * Basic: everything but extra notes, each behind an ad. Premium: everything.
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

const OPEN_TYPES = ['video', 'notes'] as const;
const PLAN_TYPES = ['practice', 'test'] as const;

describe('the three-day trial', () => {
  it('opens videos and main notes', () => {
    for (const type of OPEN_TYPES) {
      expect(accessFor(res({ type }), 'trial').kind, type).toBe('open');
    }
  });

  it('locks practice and tests', () => {
    for (const type of PLAN_TYPES) {
      expect(accessFor(res({ type }), 'trial').kind, type).toBe('needs_plan');
    }
  });

  it('locks extra notes (Premium)', () => {
    expect(accessFor(res({ access: 'premium' }), 'trial').kind).toBe('premium_only');
  });

  it('shows no ads', () => {
    expect(showsAds('trial')).toBe(false);
  });
});

describe('when the trial has ended and nothing is bought', () => {
  it('opens videos and main notes after an ad', () => {
    for (const type of OPEN_TYPES) {
      expect(accessFor(res({ type }), 'expired').kind, type).toBe('ad_gated');
    }
    // A YouTube-hosted note is still a note: same rule, no special case.
    expect(
      accessFor(res({ type: 'notes', url: 'https://www.youtube.com/watch?v=x' }), 'expired')
        .kind,
    ).toBe('ad_gated');
  });

  it('locks practice, tests and extra notes', () => {
    for (const type of PLAN_TYPES) {
      expect(accessFor(res({ type }), 'expired').kind, type).toBe('needs_plan');
    }
    expect(accessFor(res({ access: 'premium' }), 'expired').kind).toBe('premium_only');
  });

  it('shows ads, and still routes to the plans screen', () => {
    expect(showsAds('expired')).toBe(true);
    expect(needsPlan('expired')).toBe(true);
    expect(showsWelcomeCard('expired')).toBe(true);
  });
});

describe('Basic', () => {
  it('reaches videos, notes, practice and tests through a rewarded ad', () => {
    for (const type of KINDS) {
      expect(accessFor(res({ type }), 'basic').kind, type).toBe('ad_gated');
    }
  });

  it('still cannot reach Premium-only resources', () => {
    expect(accessFor(res({ access: 'premium' }), 'basic').kind).toBe('premium_only');
  });

  it('sees ads; Premium and the trial do not', () => {
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
