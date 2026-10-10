/**
 * When each goal's trial actually began.
 *
 * Anchoring the trial to `enrollment.created_at` alone is a loophole:
 * "Reset this roadmap" deletes the enrollment row, so re-enrolling the same
 * goal mints a new created_at and therefore a brand-new 3-day trial, as often
 * as the learner likes.
 *
 * So the first start per goal is remembered here, in AsyncStorage, which
 * resetDatabase() does not touch — the same reasoning as the clock
 * high-water mark. Re-enrolling a goal reuses its original start; a genuinely
 * different goal gets its own three days, which is right, because pricing is
 * per roadmap and switching goal is a separate purchase (§10.1).
 *
 * This is still device-local and so still only a deterrent: clearing app data
 * resets it, and the real answer is a server-recorded trial start, which
 * arrives with Play Billing at M5. It closes the one-tap loophole, not a
 * determined one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'freementor.trialStarts';

type Starts = Record<string, string>;

let cache: Starts | null = null;

async function read(): Promise<Starts> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    cache = parsed && typeof parsed === 'object' ? (parsed as Starts) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/**
 * The trial start for a goal: whatever was recorded the first time, or
 * `enrolledAt` recorded now if this is the first time.
 *
 * Returns the EARLIER of the two when both exist, so a re-enrollment can
 * never move the start later and buy extra days.
 */
export async function trialStartFor(goalId: string, enrolledAt: string): Promise<string> {
  const starts = await read();
  const known = starts[goalId];

  if (known && known <= enrolledAt) return known;

  // Either nothing recorded yet, or the enrollment is older than what we
  // stored (a restored backup, say) — keep the earlier one.
  const earliest = known && known < enrolledAt ? known : enrolledAt;
  cache = { ...starts, [goalId]: earliest };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Unwritable storage just means the deterrent is absent on this device.
  }
  return earliest;
}

/** Development only — lets the trial be replayed while testing. */
export async function clearTrialStarts(): Promise<void> {
  cache = null;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
