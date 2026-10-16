/**
 * The one place that knows how to call the FastAPI backend.
 *
 * Extracted from sync.ts so the account and consent calls do not grow a
 * second copy of the base URL and the bearer-token logic — two copies of auth
 * is how one of them ends up subtly wrong.
 */
import { accessToken } from '../auth/supabase.ts';

/** Where the API lives. Set per build; empty means "not configured yet". */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

/** True when this build can reach a server at all. */
export const apiConfigured = apiBaseUrl.length > 0;

/**
 * Whether a hardcoded fallback token may be used at all.
 *
 * `__DEV__` is substituted by Metro as a literal `false` in a release bundle,
 * so the minifier drops the branch rather than shipping it — the same
 * mechanism auth/devBypass.ts relies on, and written the same way here on
 * purpose.
 *
 * This guard was missing. `EXPO_PUBLIC_*` variables are inlined into the
 * bundle at build time, so a release built on a machine that happened to have
 * EXPO_PUBLIC_DEV_TOKEN set would have shipped a real bearer token inside the
 * APK and sent it on every API call — for whoever's account minted it. It was
 * never set in any build we made, so nothing shipped; the hole was that
 * nothing stopped it. EXPO_PUBLIC_DEV_SKIP_AUTH two files away had this
 * covered and documented, which is why the gap is worth naming rather than
 * quietly closing.
 */
const devTokenAllowed = __DEV__;

/**
 * The signed-in learner's access token.
 *
 * Falls back to EXPO_PUBLIC_DEV_TOKEN **in development only**, so the API can
 * be exercised against a server in local mode. A real session always wins.
 * Null when the learner is not signed in — including under the development
 * sign-in bypass, which has no token by design.
 */
export async function authToken(): Promise<string | null> {
  const token = await accessToken().catch(() => null);
  if (token) return token;
  return devTokenAllowed ? (process.env.EXPO_PUBLIC_DEV_TOKEN ?? null) : null;
}

export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await authToken();
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

/**
 * The server's own message for a failed call, or a fallback.
 *
 * FastAPI puts a human-readable string in `detail` for an HTTPException and a
 * list of field errors there for a 422. Showing the server's wording matters
 * for the OTP: "that code has expired" and "too many attempts" are different
 * problems and the learner needs to be told which.
 */
export async function errorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    const detail = body.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
  } catch {
    // Not JSON, or an empty body. Fall through.
  }
  return fallback;
}
