/**
 * What the learner is currently entitled to — product plan §10.1.
 *
 * One place decides this, so the gating rules live in one place too.
 *
 * ## The model (changed Oct 2026 on the product owner's instruction)
 *
 *                              trial     expired   basic              premium
 *   roadmap, day plan, ticks    yes       yes       yes                yes
 *   YouTube videos              yes       LOCKED    after rewarded ad  yes
 *   main notes                  yes       LOCKED    after rewarded ad  yes
 *   extra notes                 yes       LOCKED    after rewarded ad  yes
 *   practice links              yes       LOCKED    after rewarded ad  yes
 *   test & mock links           yes       LOCKED    after rewarded ad  yes
 *   detailed analytics          NO        NO        NO                 yes
 *   ads                         none      —         yes                none
 *
 * **The trial is Basic, free, for three days** — everything open and no ads,
 * so a learner sees the real product before paying. When it ends, every
 * resource locks until they buy; one payment then unlocks that roadmap for
 * life.
 *
 * The roadmap, the day plan and the learner's own ticks stay visible when the
 * trial expires. Only the *resources* lock. Taking away the record of work
 * somebody already did is a different thing from locking what they have not
 * paid for, and it is the kind of thing that draws refund requests.
 *
 * ## What changed, and what it cost
 *
 * This file used to open every YouTube link on every plan, unconditionally,
 * and said so in the first branch. That was a deliberate rule in CLAUDE.md
 * and §10.1, and the owner has since decided the opposite: paying unlocks
 * everything, including videos.
 *
 * Two things to keep in view, recorded here because the code is where they
 * will be rediscovered:
 *
 *  1. The YouTube Data API's terms restrict charging for access to YouTube
 *     content. Linking is ordinarily fine; putting the links behind a paywall
 *     is greyer. What is sold is the roadmap — the sequence, the schedule,
 *     the tracking — and every video remains free on YouTube itself. That is
 *     the defensible reading, and it is the one the Terms of Service state.
 *  2. Marketing copy may no longer describe the resources as free "for
 *     lifetime" without qualification. src/marketing/ is checked against the
 *     CCPA advertising rules by its own tests.
 */
import type { Resource } from '@freementor/shared';
import type { TrialPhase } from './trial.ts';

export type Entitlement =
  /** Inside the 3-day free trial: everything open, no ads. */
  | 'trial'
  /** Trial over, nothing bought. Every resource locks. */
  | 'expired'
  /** Paid Basic: everything, after a user-initiated rewarded ad. */
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
 *  1. `expired` first — the trial is over and nothing is bought, so nothing
 *     opens. This is the state that sends a learner to the plans screen.
 *  2. `premium` opens everything, with no ads. That is what it is for.
 *  3. `trial` opens everything too, with no ads. It is Basic made free for
 *     three days so the learner sees the real product, not a hobbled one.
 *  4. `basic` reaches everything through a rewarded ad.
 */
export function accessFor(resource: Resource, entitlement: Entitlement): Access {
  if (entitlement === 'expired') return { kind: 'needs_plan' };
  if (entitlement === 'premium') return { kind: 'open' };
  if (entitlement === 'trial') return { kind: 'open' };

  // Basic. Everything is reachable, and an ad is the price of reaching it.
  // Resources the library marks `access: "premium"` are the one exception —
  // they are what Premium is for, so an ad does not substitute for the plan.
  if (resource.access === 'premium') return { kind: 'premium_only' };
  return { kind: 'ad_gated' };
}

/** Premium removes every ad (§10.1). The trial has none either. */
export function showsAds(entitlement: Entitlement): boolean {
  return entitlement === 'basic';
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
