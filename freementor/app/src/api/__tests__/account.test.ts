/**
 * The app's half of account deletion.
 *
 * The endpoint itself is covered by the server suite — it was verified against
 * real Postgres, including that it cannot delete anybody but the token holder,
 * and that the pg_cron purge keeps purchase records while erasing the person.
 *
 * What is tested here is the thing that was actually broken: the app never
 * called it. A learner tapped "Delete my account", the device was wiped, and
 * the server row survived a deletion they believed had happened.
 *
 * So the rule under test is: **a local wipe is only allowed when the server
 * is genuinely done, or when there is no server to involve.** Anything else
 * has to surface rather than wipe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => token,
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));

let token: string | null = 'test-token';

const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalDevToken = process.env.EXPO_PUBLIC_DEV_TOKEN;

/** Re-imported per test, because client.ts reads the base URL at module load. */
async function load() {
  vi.resetModules();
  return import('../account.ts');
}

function respondWith(status: number, body: unknown = {}) {
  const calls: { url: string; method?: string }[] = [];
  globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  token = 'test-token';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
  delete process.env.EXPO_PUBLIC_DEV_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  if (originalDevToken === undefined) delete process.env.EXPO_PUBLIC_DEV_TOKEN;
  else process.env.EXPO_PUBLIC_DEV_TOKEN = originalDevToken;
  vi.restoreAllMocks();
});

describe('asking the server to delete the account', () => {
  it('calls DELETE on the account route', async () => {
    const calls = respondWith(202, { status: 'scheduled', purge_within_days: '30' });
    const { requestAccountDeletion } = await load();

    const outcome = await requestAccountDeletion();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.example.com/account/me');
    expect(calls[0]!.method).toBe('DELETE');
    expect(outcome).toEqual({ kind: 'scheduled', purgeWithinDays: '30' });
  });

  it('reports the purge window the server stated, not a hardcoded one', async () => {
    respondWith(202, { status: 'scheduled', purge_within_days: '7' });
    const { requestAccountDeletion } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome).toEqual({ kind: 'scheduled', purgeWithinDays: '7' });
  });

  it('falls back to 30 days if the server omits the window', async () => {
    respondWith(202, {});
    const { requestAccountDeletion } = await load();
    expect(await requestAccountDeletion()).toEqual({ kind: 'scheduled', purgeWithinDays: '30' });
  });

  it('treats a second attempt as done, not as an error', async () => {
    // current_user refuses an account already marked for deletion, so a
    // double tap — or a tap after using the web page — arrives as a 403.
    // Showing the learner a failure there would be simply wrong.
    respondWith(403, { detail: 'This account is scheduled for deletion.' });
    const { requestAccountDeletion, isErased } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome.kind).toBe('already_scheduled');
    expect(isErased(outcome)).toBe(true);
  });
});

describe('when the server cannot be reached', () => {
  it('reports the failure rather than claiming success', async () => {
    respondWith(503, { detail: 'Service unavailable' });
    const { requestAccountDeletion } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.reason).toContain('Service unavailable');
  });

  it('survives a thrown network error', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    const { requestAccountDeletion } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.reason).toBe('Network request failed');
  });

  it('does NOT let the device be wiped on a failure', async () => {
    // The whole point. Wiping here would destroy the signed-in app that
    // could retry, while the account stayed exactly where it was.
    respondWith(500);
    const { requestAccountDeletion, mayWipeDevice, isErased } = await load();
    const outcome = await requestAccountDeletion();
    expect(mayWipeDevice(outcome)).toBe(false);
    expect(isErased(outcome)).toBe(false);
  });
});

describe('builds with nothing to call', () => {
  it('permits a device wipe when no server is configured', async () => {
    // The shipped build today. Refusing to wipe would leave the learner with
    // no way to delete anything at all.
    delete process.env.EXPO_PUBLIC_API_URL;
    const { requestAccountDeletion, mayWipeDevice, isErased } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome.kind).toBe('no_server');
    expect(mayWipeDevice(outcome)).toBe(true);
    // ...but it is not an erasure, and must not be reported as one.
    expect(isErased(outcome)).toBe(false);
  });

  it('permits a device wipe when nobody is signed in', async () => {
    // Includes the development sign-in bypass, which has no token by design.
    token = null;
    const { requestAccountDeletion, mayWipeDevice, isErased } = await load();
    const outcome = await requestAccountDeletion();
    expect(outcome.kind).toBe('not_signed_in');
    expect(mayWipeDevice(outcome)).toBe(true);
    expect(isErased(outcome)).toBe(false);
  });

  it('makes no network call when there is no server', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    const calls = respondWith(202);
    const { requestAccountDeletion } = await load();
    await requestAccountDeletion();
    expect(calls).toEqual([]);
  });
});
