/**
 * The app's half of verifiable parental consent.
 *
 * The server's rules (hashing, 10-minute expiry, 5 attempts, 60-second
 * resend) have their own tests and were exercised end to end against
 * Postgres. What is tested here is what only the app can get wrong: refusing
 * to spend one of the five attempts on an obvious typo, passing the server's
 * own wording through instead of a generic failure, and never reporting
 * success when a call failed.
 *
 * `fetch` is stubbed. These are contract tests, not a second copy of the
 * server's logic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// consent.ts reaches the API client, which reaches the Supabase client, which
// drags in the React Native bundle — and the suite parses plain TypeScript.
// Mocking at the token boundary keeps the module under test real.
vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => 'test-token',
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));

const original = globalThis.fetch;

/** Queue of responses, consumed in order; records what was sent. */
let queue: { status: number; body: unknown }[] = [];
let calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  queue = [];
  calls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const next = queue.shift() ?? { status: 200, body: {} };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    } as Response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = original;
  vi.resetModules();
});

const load = async () => await import('../consent.ts');

describe('confirmParentCode — refusing to waste an attempt', () => {
  it('rejects a short code without calling the server', async () => {
    const { confirmParentCode } = await load();
    const result = await confirmParentCode('123');
    expect(result).toEqual({ ok: false, detail: 'Enter the 6-digit code.' });
    // The server allows five attempts. Burning one on a typo the app could
    // see for itself would be its own small betrayal.
    expect(calls).toHaveLength(0);
  });

  it('rejects a non-numeric code without calling the server', async () => {
    const { confirmParentCode } = await load();
    expect((await confirmParentCode('12a456')).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('trims surrounding whitespace rather than rejecting a pasted code', async () => {
    const { confirmParentCode } = await load();
    queue = [{ status: 200, body: {} }];
    expect((await confirmParentCode('  676395 ')).ok).toBe(true);
    expect(calls[0]?.body).toEqual({ code: '676395' });
  });
});

describe('confirmParentCode — what the learner is told', () => {
  it('passes the server wording through, not a generic failure', async () => {
    const { confirmParentCode } = await load();
    // "expired" and "too many attempts" are different problems and the
    // learner has to know which one they have.
    queue = [{ status: 400, body: { detail: 'That code has expired. Ask for a new one.' } }];
    expect(await confirmParentCode('676395')).toEqual({
      ok: false,
      detail: 'That code has expired. Ask for a new one.',
    });
  });

  it('falls back to its own wording when the body is not JSON', async () => {
    const { confirmParentCode } = await load();
    globalThis.fetch = (async () =>
      ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      }) as unknown as Response) as typeof fetch;
    expect(await confirmParentCode('676395')).toEqual({
      ok: false,
      detail: 'That code did not work.',
    });
  });

  it('reports a dropped connection as such, never as a bad code', async () => {
    const { confirmParentCode } = await load();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const result = await confirmParentCode('676395');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toMatch(/connection/i);
  });
});

describe('sendParentCode', () => {
  it('records the birth year before asking for a code', async () => {
    // The server refuses a consent request unless it already knows the
    // account belongs to a minor, and it learns that from the birth year.
    const { sendParentCode } = await load();
    queue = [
      { status: 200, body: { is_minor: true } },
      { status: 202, body: { expires_in_seconds: 600, demo_code: '123456' } },
    ];
    const result = await sendParentCode({
      birthYear: 2009,
      parentContact: ' parent@example.com ',
      method: 'email',
    });

    expect(result).toEqual({ ok: true, expiresInSeconds: 600, demoCode: '123456' });
    expect(calls[0]?.url).toMatch(/\/account\/me$/);
    expect(calls[0]?.method).toBe('PATCH');
    expect(calls[0]?.body).toEqual({ birth_year: 2009 });
    expect(calls[1]?.url).toMatch(/\/account\/consent\/request$/);
    expect(calls[1]?.body).toEqual({ parent_contact: 'parent@example.com', method: 'email' });
  });

  it('does not ask for a code when the birth year would not save', async () => {
    const { sendParentCode } = await load();
    queue = [{ status: 403, body: { detail: 'This account is scheduled for deletion.' } }];
    const result = await sendParentCode({
      birthYear: 2009,
      parentContact: 'parent@example.com',
      method: 'email',
    });
    expect(result.ok).toBe(false);
    // One call, not two: no point asking for a code the server will refuse.
    expect(calls).toHaveLength(1);
  });

  it('flags a 429 so the UI can start the cooldown instead of retrying', async () => {
    const { sendParentCode } = await load();
    queue = [
      { status: 200, body: {} },
      { status: 429, body: { detail: 'A code was just sent. Wait a minute.' } },
    ];
    const result = await sendParentCode({
      birthYear: 2009,
      parentContact: 'parent@example.com',
      method: 'sms',
    });
    expect(result).toEqual({
      ok: false,
      detail: 'A code was just sent. Wait a minute.',
      tooSoon: true,
    });
  });

  it('surfaces a 422 from a malformed contact in the server wording', async () => {
    const { sendParentCode } = await load();
    queue = [
      { status: 200, body: {} },
      { status: 422, body: { detail: [{ msg: 'That is not an email address.' }] } },
    ];
    const result = await sendParentCode({
      birthYear: 2009,
      parentContact: 'nope',
      method: 'email',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toBe('That is not an email address.');
  });

  it('treats a missing demo code as absent, not as undefined', async () => {
    // demo_code is null whenever OTP_ECHO is off, which is always in
    // production. The UI must not render "the code is undefined".
    const { sendParentCode } = await load();
    queue = [{ status: 200, body: {} }, { status: 202, body: { expires_in_seconds: 600 } }];
    const result = await sendParentCode({
      birthYear: 2009,
      parentContact: 'parent@example.com',
      method: 'email',
    });
    expect(result).toEqual({ ok: true, expiresInSeconds: 600, demoCode: null });
  });
});

describe('alreadyConsented', () => {
  it('is true only when the server says consent was given', async () => {
    const { alreadyConsented } = await load();
    queue = [{ status: 200, body: { consent_given: true } }];
    expect(await alreadyConsented()).toBe(true);
  });

  it('is false when consent is still outstanding', async () => {
    const { alreadyConsented } = await load();
    queue = [{ status: 200, body: { consent_given: false } }];
    expect(await alreadyConsented()).toBe(false);
  });

  it('is false — never true — when the call fails', async () => {
    // Failing open would skip the consent step for a minor on a flaky
    // connection, which is the one outcome that must not happen.
    const { alreadyConsented } = await load();
    queue = [{ status: 500, body: {} }];
    expect(await alreadyConsented()).toBe(false);

    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await alreadyConsented()).toBe(false);
  });
});

describe('describeUnreachable', () => {
  it('distinguishes no server from no session', async () => {
    const { describeUnreachable } = await load();
    expect(describeUnreachable('not_configured')).toMatch(/no server/i);
    expect(describeUnreachable('no_session')).toMatch(/sign in/i);
  });
});
