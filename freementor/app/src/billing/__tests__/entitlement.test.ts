/**
 * Gating rules — product plan §10.1.
 *
 * The first describe block is the one that matters most: it is a policy
 * requirement, not a product preference, that a YouTube video is never put
 * behind an ad or a paywall on any plan. These tests exist so that can never
 * regress quietly.
 */
import { describe, expect, it } from 'vitest';
import type { Resource } from '@freementor/shared';
import {
  accessFor,
  currentEntitlement,
  hasDetailedAnalytics,
  showsAds,
  type Entitlement,
} from '../entitlement.ts';

const ALL: Entitlement[] = ['trial', 'basic', 'premium'];

const res = (over: Partial<Resource>): Resource => ({
  type: 'notes',
  title: 'r',
  url: 'https://example.org',
  lang: 'en',
  provider: 'p',
  access: 'all',
  status: 'active',
  ...over,
});

describe('a video is never gated, on any plan', () => {
  it.each(ALL)('opens freely on %s', (entitlement) => {
    const video = res({ type: 'video', access: 'all', ad_gate_allowed: false });
    expect(accessFor(video, entitlement).kind).toBe('open');
  });

  it('stays open even if a library file wrongly marks it premium', () => {
    // Defence in depth: the library validator rejects this, but if a bad file
    // ever reached a device the app must still not paywall a video.
    const video = res({ type: 'video', access: 'premium' });
    for (const entitlement of ALL) {
      expect(accessFor(video, entitlement).kind).toBe('open');
    }
  });

  it('stays open even if a library file wrongly allows ad-gating it', () => {
    const video = res({ type: 'video', ad_gate_allowed: true });
    for (const entitlement of ALL) {
      expect(accessFor(video, entitlement).kind).toBe('open');
    }
  });
});

describe('extra notes are Premium only', () => {
  const extra = res({ type: 'notes', access: 'premium' });

  it('is locked on the trial and on Basic', () => {
    expect(accessFor(extra, 'trial').kind).toBe('premium_only');
    expect(accessFor(extra, 'basic').kind).toBe('premium_only');
  });

  it('opens on Premium', () => {
    expect(accessFor(extra, 'premium').kind).toBe('open');
  });
});

describe('main notes and tests', () => {
  it('open freely on the trial', () => {
    expect(accessFor(res({ type: 'notes' }), 'trial').kind).toBe('open');
    expect(accessFor(res({ type: 'test' }), 'trial').kind).toBe('open');
  });

  it('sit behind a rewarded ad on Basic when the library allows it', () => {
    const notes = res({ type: 'notes', ad_gate_allowed: true });
    expect(accessFor(notes, 'basic').kind).toBe('ad_gated');
  });

  it('open on Basic when the library does not allow gating', () => {
    expect(accessFor(res({ type: 'notes', ad_gate_allowed: false }), 'basic').kind).toBe('open');
  });

  it('never gates anything on Premium', () => {
    const notes = res({ type: 'notes', ad_gate_allowed: true });
    expect(accessFor(notes, 'premium').kind).toBe('open');
  });
});

describe('practice links are free on every plan', () => {
  it.each(ALL)('opens on %s', (entitlement) => {
    expect(accessFor(res({ type: 'practice' }), entitlement).kind).toBe('open');
  });
});

describe('plan-level entitlements', () => {
  it('removes ads only for Premium', () => {
    expect(showsAds('trial')).toBe(true);
    expect(showsAds('basic')).toBe(true);
    expect(showsAds('premium')).toBe(false);
  });

  it('reserves detailed analytics for Premium', () => {
    expect(hasDetailedAnalytics('trial')).toBe(false);
    expect(hasDetailedAnalytics('basic')).toBe(false);
    expect(hasDetailedAnalytics('premium')).toBe(true);
  });

  it('still reports the trial until billing is wired up', () => {
    expect(currentEntitlement()).toBe('trial');
  });
});
