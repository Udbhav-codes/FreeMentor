/**
 * The API client's token handling.
 *
 * One rule, and it is the reason this file exists: **a hardcoded fallback
 * token must never be usable in a release build.**
 *
 * `EXPO_PUBLIC_*` variables are inlined into the bundle at build time, so a
 * release built on a machine with EXPO_PUBLIC_DEV_TOKEN set would otherwise
 * ship a real bearer token inside the APK and send it on every call. Nothing
 * had stopped that; auth/devBypass.ts had the equivalent hole covered for
 * EXPO_PUBLIC_DEV_SKIP_AUTH and this file had been missed.
 *
 * `__DEV__` is defined by vitest.config.ts for Node, and substituted as a
 * literal by Metro, so the two states can be exercised by re-importing the
 * module with it flipped.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Swapped per test to simulate signed out / signed in. */
let sessionToken: string | null = null;

vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => sessionToken,
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));

const originalDevToken = process.env.EXPO_PUBLIC_DEV_TOKEN;
const originalDev = (globalThis as { __DEV__?: boolean }).__DEV__;

/** Loads client.ts fresh, with __DEV__ set as a release/dev bundle would. */
async function loadWith({ isDev }: { isDev: boolean }) {
  (globalThis as { __DEV__?: boolean }).__DEV__ = isDev;
  vi.resetModules();
  return import('../client.ts');
}

beforeEach(() => {
  sessionToken = null;
  delete process.env.EXPO_PUBLIC_DEV_TOKEN;
});

afterEach(() => {
  if (originalDevToken === undefined) delete process.env.EXPO_PUBLIC_DEV_TOKEN;
  else process.env.EXPO_PUBLIC_DEV_TOKEN = originalDevToken;
  (globalThis as { __DEV__?: boolean }).__DEV__ = originalDev;
  vi.restoreAllMocks();
});

describe('the development fallback token', () => {
  it('is IGNORED in a release build even when it is set', async () => {
    // The whole point of the file.
    process.env.EXPO_PUBLIC_DEV_TOKEN = 'leaked-bearer-token';
    const { authToken } = await loadWith({ isDev: false });
    expect(await authToken()).toBeNull();
  });

  it('never reaches the Authorization header in a release build', async () => {
    // Asserted on the actual request, not just the helper, because the header
    // is what would have gone out over the wire.
    process.env.EXPO_PUBLIC_DEV_TOKEN = 'leaked-bearer-token';
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    const { api } = await loadWith({ isDev: false });

    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await api('/account/me');

    expect(sentHeaders).not.toHaveProperty('Authorization');
    expect(JSON.stringify(sentHeaders)).not.toContain('leaked-bearer-token');
  });

  it('is available in development, which is what it is for', async () => {
    process.env.EXPO_PUBLIC_DEV_TOKEN = 'local:abc:dev@example.com';
    const { authToken } = await loadWith({ isDev: true });
    expect(await authToken()).toBe('local:abc:dev@example.com');
  });

  it('is not invented when it is unset', async () => {
    const { authToken } = await loadWith({ isDev: true });
    expect(await authToken()).toBeNull();
  });
});

describe('a real session', () => {
  it('wins over the development token', async () => {
    sessionToken = 'real-supabase-jwt';
    process.env.EXPO_PUBLIC_DEV_TOKEN = 'local:abc:dev@example.com';
    const { authToken } = await loadWith({ isDev: true });
    expect(await authToken()).toBe('real-supabase-jwt');
  });

  it('is used in a release build, where the fallback is not', async () => {
    sessionToken = 'real-supabase-jwt';
    const { authToken } = await loadWith({ isDev: false });
    expect(await authToken()).toBe('real-supabase-jwt');
  });

  it('is not required — an unauthenticated call simply carries no header', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.com';
    const { api } = await loadWith({ isDev: false });
    let sentHeaders: Record<string, string> = {};
    globalThis.fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      sentHeaders = (init?.headers ?? {}) as Record<string, string>;
      return { ok: true, status: 401, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await api('/account/me');
    expect(sentHeaders).not.toHaveProperty('Authorization');
  });
});
