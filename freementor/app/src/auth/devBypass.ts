/**
 * A development-only way past Google sign-in.
 *
 * Why this exists: the web OAuth flow needs `exp://**` in Supabase's redirect
 * allowlist, and until that is set the browser comes back to "This site can't
 * be reached". That blocks testing everything *after* sign-in — the age gate,
 * profile details, goal choice, weekly time, the roadmap — none of which has
 * anything to do with auth.
 *
 * Two independent conditions must BOTH hold, so this cannot reach a store
 * build:
 *
 *   1. __DEV__ — false in any release bundle. Metro sets it; it is not an
 *      environment variable and cannot be switched on from outside.
 *   2. EXPO_PUBLIC_DEV_SKIP_AUTH === '1' — explicit opt-in, so an ordinary
 *      `npm start` does not quietly skip auth either.
 *
 * The persisted flag is ALSO re-checked against both conditions on read. That
 * matters: a phone that enabled the bypass in development keeps the value in
 * AsyncStorage, and installing a release build over the top must not inherit
 * it. Storage alone never grants anything.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'freementor.devBypass';

/**
 * The policy, as a pure function so it can be tested without a bundler or a
 * device. `isDev` is __DEV__; `envFlag` is EXPO_PUBLIC_DEV_SKIP_AUTH.
 */
export function bypassAllowed(isDev: boolean, envFlag: string | undefined): boolean {
  return isDev === true && envFlag === '1';
}

/** Whether this build may offer the bypass at all. */
// `__DEV__` bare, not behind a typeof guard: Metro substitutes a literal
// `false` in a release build, so the minifier can drop the whole branch
// instead of shipping unreachable code. vitest.config.ts defines it for Node.
export const devBypassAllowed = bypassAllowed(
  __DEV__,
  process.env.EXPO_PUBLIC_DEV_SKIP_AUTH,
);

/** Whether the learner has actually turned it on, on this device. */
export async function devBypassActive(): Promise<boolean> {
  // Checked first and returned unconditionally: a stale stored value must
  // never be honoured by a build that is not allowed the bypass.
  if (!devBypassAllowed) return false;
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setDevBypass(on: boolean): Promise<void> {
  if (!devBypassAllowed) return;
  try {
    if (on) await AsyncStorage.setItem(KEY, '1');
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // A device with no writable storage simply does not get the bypass.
  }
}

/** Always safe to call, including from a build where the bypass is forbidden. */
export async function clearDevBypass(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
