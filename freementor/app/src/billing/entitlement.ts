/**
 * What the learner is currently entitled to — product plan §10.1.
 *
 * One place decides this, so the gating rules live in one place too.
 *
 * ## The model (owner's plan table, Nov 2026, Basic revised)
 *
 *                              trial    expired (nothing bought)   basic             premium
 *   roadmap, day plan, ticks    yes      yes                        yes               yes
 *   YouTube videos              yes      after an ad                yes               yes
 *   main notes                  yes      after an ad                yes               yes
 *   practice & test links       LOCKED   LOCKED                     yes               yes
 *   extra notes (premium)       LOCKED   LOCKED                     LOCKED (Premium)  yes
 *   detailed analytics          no       no                         no                yes
 *   ads                         none     yes, one per resource      none              none
 *
 * **The trial is three days, free, with no ads.** When it ends with nothing
 * bought, videos and main notes keep opening, but each one costs a rewarded
 * ad; practice, tests, extra notes and analytics need a plan. Buying Basic
 * removes the ads and opens practice and tests. Premium adds extra notes and
 * detailed analytics. So the ad exists only for a learner who has not paid,
 * and buying any plan ends it.
 *
 * The roadmap, the day plan and the learner's own ticks are always visible.
 *
 * ## History
 *
 * Until Oct 2026 YouTube was never gated. The owner then reversed that, and in
 * Nov 2026 settled on the table above. Linking to YouTube behind an ad for
 * unpaid learners is still a reading of the YouTube API terms the owner should
 * confirm; see docs/MONETIZATION_STATE.md.
 */
import type { Resource } from '@freementor/shared';
import type { TrialPhase } from './trial.ts';

export type Entitlement =
  /** Inside the 3-day free trial: videos and main notes open, no ads. */
  | 'trial'
  /** Trial over, nothing bought. Videos and main notes open after an ad; the rest locks. */
  | 'expired'
  /** Paid Basic: everything but extra notes, no ads. */
  | 'basic'
  /** Paid Premium: everything, no ads. */
  | 'premium';

/**
 * The entitlement for an enrollment, from its trial clock and its purchase.
 *
 * Pure, so the whole state machine is testable.
 */
export function entitlementFor(input: {
  trialPhase: TrialPhase;
  /** The verified plan for this enrollment, or null if nothing is bought. */
  purchase: 'basic' | 'premium' | null;
}): Entitlement {
  // A purchase outranks the clock: buying on day 2 must not leave someone on
  // the trial, and buying after expiry must lift the lock immediately.
  if (input.purchase) return input.purchase;
  return input.trialPhase === 'expired' ? 'expired' : 'trial';
}

export type Access =
  /** Open it. */
  | { kind: 'open' }
  /** Basic can open this, but only after a user-initiated rewarded ad. */
  | { kind: 'ad_gated' }
  /** Premium only. Shows a lock and a route to the plans screen. */
  | { kind: 'premium_only' }
  /** The trial has ended and nothing is bought. Routes to the plans screen. */
  | { kind: 'needs_plan' };

/**
 * The ONLY place that decides whether a resource is gated.
 *
 * Order matters and is deliberate:
 *
 *  1. `premium` opens everything, with no ads.
 *  2. Extra notes (`access: "premium"`) are Premium-only on every other state,
 *     trial included. An ad never substitutes for the plan.
 *  3. Practice and test links need a plan: locked in the trial and after it,
 *     open on Basic.
 *  4. Videos and main notes: open in the trial and on Basic, ad-gated only
 *     once the trial has ended with nothing bought.
 */
export function accessFor(resource: Resource, entitlement: Entitlement): Access {
  if (entitlement === 'premium') return { kind: 'open' };
  if (resource.access === 'premium') return { kind: 'premium_only' };

  if (resource.type === 'practice' || resource.type === 'test') {
    return entitlement === 'basic' ? { kind: 'open' } : { kind: 'needs_plan' };
  }

  return entitlement === 'expired' ? { kind: 'ad_gated' } : { kind: 'open' };
}

/**
 * Only a learner whose trial has ended with nothing bought sees ads: one
 * rewarded ad per video or note. The trial, Basic and Premium have none.
 */
export function showsAds(entitlement: Entitlement): boolean {
  return entitlement === 'expired';
}

/** Whether a plan still needs buying — drives the paywall and the lock UI. */
export function needsPlan(entitlement: Entitlement): boolean {
  return entitlement === 'trial' || entitlement === 'expired';
}

/** Detailed analytics and advanced reports are Premium (§10.1). */
export function hasDetailedAnalytics(entitlement: Entitlement): boolean {
  return entitlement === 'premium';
}

/**
 * Whether Home shows the welcome / value card.
 *
 * It shows on EVERY open and every reload for as long as the learner has not
 * bought a plan, and stops the moment they do. It is the only place the app
 * explains what it costs and why, so hiding it permanently after one tap left
 * a learner with no way back to that explanation.
 *
 * The ✕ hides it for the current session only. Nothing about the dismissal is
 * persisted, deliberately.
 */
export function showsWelcomeCard(entitlement: Entitlement): boolean {
  return needsPlan(entitlement);
}
