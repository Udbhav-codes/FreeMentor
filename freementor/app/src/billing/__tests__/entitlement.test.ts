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
  entitlementFor,
  hasDetailedAnalytics,
  showsAds,
  showsWelcomeCard,
  type Entitlement,
} from '../entitlement.ts';

/** Every state, including the one where nothing is bought and the trial is over. */
const ALL: Entitlement[] = ['trial', 'expired', 'basic', 'premium'];
/** The states that still have access at all — "expired" locks everything but video. */
const WITH_ACCESS: Entitlement[] = ['trial', 'basic', 'premium'];

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

  it('stays open when a YouTube link is typed as something else', () => {
    // The library holds 21 YouTube links typed as `notes`. Keying the rule on
    // type === 'video' locked them the moment the trial expired, i.e.
    // paywalled YouTube — the exact thing the rule forbids.
    for (const entitlement of ALL) {
      const mistyped = res({
        type: 'notes',
        url: 'https://www.youtube.com/watch?v=ENrzD9HAZK4',
        access: 'all',
        ad_gate_allowed: false,
      });
      expect(accessFor(mistyped, entitlement).kind, entitlement).toBe('open');
    }
  });

  it('stays open for youtu.be short links and for premium-marked ones', () => {
    for (const entitlement of ALL) {
      expect(accessFor(res({ type: 'notes', url: 'https://youtu.be/abc123' }), entitlement).kind).toBe('open');
      expect(
        accessFor(
          res({ type: 'notes', url: 'https://www.youtube.com/watch?v=x', access: 'premium' }),
          entitlement,
        ).kind,
      ).toBe('open');
    }
  });

  it('does not mistake a lookalike host for YouTube', () => {
    // notyoutube.com must still be gated normally, or the escape hatch is a
    // hole anybody could drive a premium resource through.
    expect(
      accessFor(res({ type: 'notes', url: 'https://notyoutube.com/x', access: 'premium' }), 'basic')
        .kind,
    ).toBe('premium_only');
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

describe('practice links are free on every plan that has access', () => {
  it.each(WITH_ACCESS)('opens on %s', (entitlement) => {
    expect(accessFor(res({ type: 'practice' }), entitlement).kind).toBe('open');
  });
});

describe('when the trial has ended', () => {
  it('locks notes, tests and practice behind buying a plan', () => {
    for (const type of ['notes', 'test', 'practice'] as const) {
      expect(accessFor(res({ type }), 'expired').kind, type).toBe('needs_plan');
    }
  });

  it('still opens every video — §10.1 "everything locks" cannot reach YouTube', () => {
    // The YouTube API Services policy forbids paywalling a video, and that
    // is not ours to trade away against a pricing table. This is the
    // assertion that keeps the two in the right order.
    expect(accessFor(res({ type: 'video', ad_gate_allowed: false }), 'expired').kind).toBe('open');
  });

  it('reports a premium resource as premium, not as a trial problem', () => {
    // Buying Basic would not open this, so "needs_plan" would misdirect them.
    expect(accessFor(res({ type: 'notes', access: 'premium' }), 'expired').kind).toBe(
      'needs_plan',
    );
  });
});

describe('the welcome card keeps showing until a plan is bought', () => {
  it('shows for anyone who has not paid, during the trial and after it', () => {
    expect(showsWelcomeCard('trial')).toBe(true);
    expect(showsWelcomeCard('expired')).toBe(true);
  });

  it('stops the moment they buy either plan', () => {
    expect(showsWelcomeCard('basic')).toBe(false);
    expect(showsWelcomeCard('premium')).toBe(false);
  });

  it('is driven only by entitlement, so it returns on every open', () => {
    // Nothing is persisted about dismissal: the same entitlement always
    // gives the same answer, which is what makes it reappear on reload.
    for (const entitlement of ALL) {
      expect(showsWelcomeCard(entitlement)).toBe(showsWelcomeCard(entitlement));
    }
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

  it('reserves detailed analytics from an expired trial too', () => {
    expect(hasDetailedAnalytics('expired')).toBe(false);
  });

  it('resolves the entitlement from the trial clock and the purchase', () => {
    // No purchase: the clock decides, and an ended trial is "expired" rather
    // than a trial that silently never ends.
    expect(entitlementFor({ trialPhase: 'active', purchase: null })).toBe('trial');
    expect(entitlementFor({ trialPhase: 'last_day', purchase: null })).toBe('trial');
    expect(entitlementFor({ trialPhase: 'expired', purchase: null })).toBe('expired');
  });

  it('lets a purchase outrank the clock, in both directions', () => {
    // Buying on day 2 must not leave someone on the trial...
    expect(entitlementFor({ trialPhase: 'active', purchase: 'basic' })).toBe('basic');
    // ...and buying after expiry must lift the lock at once.
    expect(entitlementFor({ trialPhase: 'expired', purchase: 'basic' })).toBe('basic');
    expect(entitlementFor({ trialPhase: 'expired', purchase: 'premium' })).toBe('premium');
  });
});
