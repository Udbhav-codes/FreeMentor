/**
 * Rewarded unlocks per task dropdown (owner, Nov 2026).
 *
 *   - Each task's dropdown on the Day view is unlocked on its own. Watching
 *     the ad for one task's notes does not unlock any other task.
 *   - An unlock lasts 30 minutes: the dropdown can be closed and opened again
 *     freely in that time. The learner is never shown the countdown.
 *   - A dropdown that is OPEN stays usable however long it stays open. The
 *     time is only checked when it is opened again, never while it is open,
 *     so an ad never interrupts study.
 *   - Only a learner whose trial ended with nothing bought sees any of this,
 *     and never for YouTube content (billing/entitlement.ts).
 *
 * In memory, not persisted: an app restart costs at most one more ad, and a
 * stored timestamp could only ever hide an ad that should show.
 */

export const UNLOCK_MS = 30 * 60 * 1000;

/** Whether an unlock made at `unlockedAt` still covers opening at `now`. */
export function isUnlockFresh(unlockedAt: number | undefined, now: number): boolean {
  if (unlockedAt === undefined) return false;
  // A timestamp in the future means the clock moved; it must not grant time.
  if (unlockedAt > now) return false;
  return now - unlockedAt < UNLOCK_MS;
}

const unlocks = new Map<string, number>();

/** `key` is one task on one day (the scheduler's item key). */
export function isDropdownUnlocked(key: string, now: number = Date.now()): boolean {
  return isUnlockFresh(unlocks.get(key), now);
}

/** Call only after a watched ad, never after an ad that failed to load. */
export function unlockDropdown(key: string, now: number = Date.now()): void {
  unlocks.set(key, now);
}

/** For tests. */
export function resetDropdownUnlocks(): void {
  unlocks.clear();
}
