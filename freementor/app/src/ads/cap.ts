/**
 * The rewarded-ad frequency cap — product plan §10.2: "max 1 rewarded unlock
 * per 10 min".
 *
 * Read as a WINDOW, which is the only reading that is kind to the learner: a
 * completed ad opens that resource and keeps further videos and notes open for
 * ten minutes, rather than blocking them for ten minutes or showing a second
 * ad straight away. Someone working through a topic's video and its notes sees
 * one ad, not two.
 *
 * Pure functions plus a tiny in-memory record. It is deliberately not
 * persisted: ten minutes is shorter than any app restart worth protecting, and
 * a stale persisted timestamp could only ever hide an ad that should show.
 */

/** §10.2. */
export const AD_WINDOW_MS = 10 * 60 * 1000;

/** Whether a rewarded ad was completed recently enough to cover this open. */
export function isWithinAdWindow(lastRewardedAt: number | null, now: number): boolean {
  if (lastRewardedAt === null) return false;
  // A timestamp in the future means the clock moved; do not let that grant a
  // free window for longer than the cap.
  if (lastRewardedAt > now) return false;
  return now - lastRewardedAt < AD_WINDOW_MS;
}

/** Milliseconds until the window closes, for tests and any "next ad" text. */
export function msUntilNextAd(lastRewardedAt: number | null, now: number): number {
  if (!isWithinAdWindow(lastRewardedAt, now)) return 0;
  return AD_WINDOW_MS - (now - (lastRewardedAt as number));
}

let lastRewardedAt: number | null = null;

export function windowOpen(now: number = Date.now()): boolean {
  return isWithinAdWindow(lastRewardedAt, now);
}

/** Call only when an ad was actually watched, never for an "unavailable". */
export function noteRewarded(now: number = Date.now()): void {
  lastRewardedAt = now;
}

/** For tests. */
export function resetAdWindow(): void {
  lastRewardedAt = null;
}
