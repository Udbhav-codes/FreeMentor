/**
 * What the learner is currently entitled to — product plan §10.1.
 *
 * One place decides this, so the gating rules live in one place too. Until
 * Play Billing lands at M5 there is no purchase to read, so everyone is on
 * the trial; `currentEntitlement` is the single function M5 replaces.
 *
 * The rules, from §10.1:
 *
 *                            trial   expired   basic              premium
 *   roadmap, day plan, recall  yes     yes       yes                yes
 *   YouTube videos             yes     yes       yes                yes   (never gated)
 *   main notes                 yes     LOCKED    after rewarded ad  yes
 *   extra notes                NO      LOCKED    NO                 yes
 *   practice links             yes     LOCKED    yes                yes
 *   test & mock links          yes     LOCKED    after rewarded ad  yes
 *   detailed analytics         NO      NO        NO                 yes
 *   ads                        yes     yes       yes                none
 *
 * "expired" is the state §10.1 describes as "everything locks until a plan is
 * bought". Note the roadmap, the day plan and the learner's own ticks are NOT
 * locked here: taking away the record of work somebody already did is a
 * different thing from locking the resources, and §10.1's table does not
 * actually say which it meant. That reading is recorded in the plan.
 */
import type { Resource } from '@freementor/shared';
import type { TrialPhase } from './trial.ts';

/**
 * Any youtube.com / youtu.be link, whatever `type` claims it is.
 *
 * Checking `type === 'video'` is not enough. The library holds 21 YouTube
 * links typed as `notes`, and keying on type let them be treated as ordinary
 * notes — which paywalled them the moment the trial expired. The policy
 * attaches to the link, so the check has to as well.
 */
function isYouTube(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export type Entitlement =
  /** Inside the 3-day free trial: full Basic, ad-free because ads do not exist yet. */
  | 'trial'
  /** Trial over, nothing bought. Everything but YouTube locks (§10.1). */
  | 'expired'
  | 'basic'
  | 'premium';

/**
 * The entitlement for an enrollment, from its trial clock and its purchase.
 *
 * Pure, so the whole state machine is testable. M5 supplies `purchase` from a
 * server-verified Play purchase; until then it is always null and a learner
 * moves trial -> expired, which is the honest state rather than a permanent
 * trial that never ends.
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
 * A video is always `open`, whatever the library file says and whatever plan
 * the learner is on. That is a YouTube API Services policy requirement, not a
 * product preference, so it is the first branch and it has no escape hatch.
 *
 * "A video" means anything pointing at YouTube, not just `type: "video"`.
 * Keying on the type alone let 21 YouTube links typed as `notes` be locked
 * once the trial expired.
 */
export function accessFor(resource: Resource, entitlement: Entitlement): Access {
  if (resource.type === 'video' || isYouTube(resource.url)) return { kind: 'open' };

  // §10.1 says "everything locks" after the trial, which taken literally
  // would paywall YouTube — and that is forbidden by YouTube API Services
  // policy, not merely discouraged by us. The policy wins, so "everything"
  // means everything the rule permits us to lock. The video branch above
  // runs first precisely so this cannot be got wrong by reordering.
  if (entitlement === 'expired') return { kind: 'needs_plan' };

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

/** Premium removes every ad (§10.1). Everyone else sees them. */
export function showsAds(entitlement: Entitlement): boolean {
  return entitlement !== 'premium';
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
 * a learner with no way back to that explanation — which is also the opposite
 * of helpful if they were still deciding.
 *
 * The ✕ hides it for the current session only. Nothing about the dismissal is
 * persisted, deliberately.
 *
 * Note this is NOT nagging in the dark-patterns sense: it appears once per
 * open, in place, never as an interstitial or a popup, and it never blocks
 * the day's tasks.
 */
export function showsWelcomeCard(entitlement: Entitlement): boolean {
  return needsPlan(entitlement);
}
