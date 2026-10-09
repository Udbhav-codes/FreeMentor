/**
 * What the learner is currently entitled to — product plan §10.1.
 *
 * One place decides this, so the gating rules live in one place too. Until
 * Play Billing lands at M5 there is no purchase to read, so everyone is on
 * the trial; `currentEntitlement` is the single function M5 replaces.
 *
 * The rules, from §10.1:
 *
 *                            trial    basic              premium
 *   roadmap, day plan, recall  yes     yes                yes
 *   YouTube videos             yes     yes                yes     (never gated)
 *   main notes                 yes     after rewarded ad  yes
 *   extra notes                NO      NO                 yes
 *   practice links             yes     yes                yes
 *   test & mock links          yes     after rewarded ad  yes
 *   detailed analytics         NO      NO                 yes
 *   ads                        yes     yes                none
 */
import type { Resource } from '@freementor/shared';

export type Entitlement = 'trial' | 'basic' | 'premium';

/**
 * M5 replaces this with the verified purchase for the active enrollment.
 * Hardcoding the trial is deliberate and visible rather than hidden behind a
 * flag that might be read as "already done".
 */
export function currentEntitlement(): Entitlement {
  return 'trial';
}

export type Access =
  /** Open it. */
  | { kind: 'open' }
  /** Basic can open this, but only after a user-initiated rewarded ad. */
  | { kind: 'ad_gated' }
  /** Premium only. Shows a lock and a route to the plans screen. */
  | { kind: 'premium_only' };

/**
 * The ONLY place that decides whether a resource is gated.
 *
 * A video is always `open`, whatever the library file says and whatever plan
 * the learner is on. That is a YouTube API Services policy requirement, not a
 * product preference, so it is the first branch and it has no escape hatch.
 */
export function accessFor(resource: Resource, entitlement: Entitlement): Access {
  if (resource.type === 'video') return { kind: 'open' };

  if (resource.access === 'premium') {
    return entitlement === 'premium' ? { kind: 'open' } : { kind: 'premium_only' };
  }

  // Premium removes ads entirely; the trial runs as full Basic but ad-free
  // gating only starts once ads exist (M6), so the trial opens freely.
  if (entitlement === 'basic' && resource.ad_gate_allowed === true) {
    return { kind: 'ad_gated' };
  }

  return { kind: 'open' };
}

/** Premium removes every ad (§10.1). */
export function showsAds(entitlement: Entitlement): boolean {
  return entitlement !== 'premium';
}

/** Detailed analytics and advanced reports are Premium (§10.1). */
export function hasDetailedAnalytics(entitlement: Entitlement): boolean {
  return entitlement === 'premium';
}
