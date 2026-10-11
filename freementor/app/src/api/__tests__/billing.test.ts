/**
 * The app's half of billing.
 *
 * The server's rules — coupon validity, idempotency, what a product grants —
 * are covered on that side and were exercised against real Postgres. What is
 * tested here is the app's own discipline:
 *
 *  · it never computes a price or a product id, only reports what it was told;
 *  · "no answer" and "nothing bought" stay distinguishable, so an unreachable
 *    server cannot revoke a plan somebody paid for;
 *  · a dropped connection during a purchase is reported as recoverable,
 *    because recording is idempotent and retrying is safe.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => token,
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));

let token: string | null = 'test-token';
let queue: { status: number; body: unknown }[] = [];
let calls: { url: string; method: string; body: unknown }[] = [];
const original = globalThis.fetch;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.test';
  token = 'test-token';
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

const load = async () => await import('../billing.ts');

describe('validateCoupon', () => {
  it('reports the product the server chose, and invents nothing', async () => {
    const { validateCoupon } = await load();
    queue = [
      {
        status: 200,
        body: { code: 'TOPPER426', discount_percent: 50, product_id: 'premium_off50', plan: 'premium' },
      },
    ];
    const result = await validateCoupon('topper426', 'premium');
    expect(result).toEqual({
      ok: true,
      code: 'TOPPER426',
      discountPercent: 50,
      productId: 'premium_off50',
      plan: 'premium',
    });
    expect(calls[0]?.body).toEqual({ code: 'topper426', plan: 'premium' });
  });

  it('distinguishes an unknown code from one that has lapsed', async () => {
    // A typo and a finished code need different responses from the learner.
    const { validateCoupon } = await load();
    queue = [{ status: 404, body: { detail: 'We do not recognise that code.' } }];
    const unknown = await validateCoupon('ABCDEF123', 'basic');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.unknown).toBe(true);

    queue = [{ status: 409, body: { detail: 'That code has expired.' } }];
    const lapsed = await validateCoupon('TOPPER426', 'basic');
    expect(lapsed.ok).toBe(false);
    if (!lapsed.ok) {
      expect(lapsed.unknown).toBe(false);
      expect(lapsed.detail).toBe('That code has expired.');
    }
  });

  it('does not call the server when there is no session', async () => {
    const { validateCoupon } = await load();
    token = null;
    const result = await validateCoupon('TOPPER426', 'basic');
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('survives a dropped connection without claiming the code is bad', async () => {
    const { validateCoupon } = await load();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const result = await validateCoupon('TOPPER426', 'basic');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/connection/i);
      expect(result.unknown).toBe(false);
    }
  });
});

describe('fetchEntitlement', () => {
  it('reports the plan the server verified', async () => {
    const { fetchEntitlement } = await load();
    queue = [
      {
        status: 200,
        body: { entitlement: 'premium', product_id: 'premium_off30', order_id: 'GPA.1' },
      },
    ];
    expect(await fetchEntitlement('enr-1')).toEqual({
      plan: 'premium',
      productId: 'premium_off30',
      orderId: 'GPA.1',
    });
    expect(calls[0]?.url).toContain('enrollment_id=enr-1');
  });

  it('reports a plan of null when nothing is bought', async () => {
    const { fetchEntitlement } = await load();
    queue = [{ status: 200, body: { entitlement: null } }];
    expect(await fetchEntitlement()).toEqual({ plan: null, productId: null, orderId: null });
  });

  it('returns null — not "nothing bought" — when the server cannot be reached', async () => {
    // The distinction that matters: an unreachable server must never revoke
    // a plan somebody paid for just because they are on a train.
    const { fetchEntitlement } = await load();
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    expect(await fetchEntitlement()).toBeNull();

    queue = [{ status: 500, body: {} }];
    const { fetchEntitlement: again } = await load();
    expect(await again()).toBeNull();
  });

  it('returns null when signed out, rather than a plan of null', async () => {
    const { fetchEntitlement } = await load();
    token = null;
    expect(await fetchEntitlement()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('refuses to believe a plan it does not recognise', async () => {
    // A server that answered "gold" must not unlock anything.
    const { fetchEntitlement } = await load();
    queue = [{ status: 200, body: { entitlement: 'gold' } }];
    const result = await fetchEntitlement();
    expect(result?.plan).toBeNull();
  });
});

describe('recordPurchase', () => {
  it('sends the token for the server to verify, in snake_case', async () => {
    const { recordPurchase } = await load();
    queue = [{ status: 201, body: { entitlement: 'basic' } }];
    const result = await recordPurchase({
      purchaseToken: 'GPA.3312',
      productId: 'basic_off20',
      enrollmentId: 'enr-1',
      couponCode: 'TOPPER426',
    });
    expect(result).toEqual({ ok: true, plan: 'basic' });
    expect(calls[0]?.body).toEqual({
      purchase_token: 'GPA.3312',
      product_id: 'basic_off20',
      enrollment_id: 'enr-1',
      coupon_code: 'TOPPER426',
    });
  });

  it('sends explicit nulls rather than omitting the optional fields', async () => {
    const { recordPurchase } = await load();
    queue = [{ status: 201, body: { entitlement: 'premium' } }];
    await recordPurchase({ purchaseToken: 'GPA.1', productId: 'premium' });
    expect(calls[0]?.body).toEqual({
      purchase_token: 'GPA.1',
      product_id: 'premium',
      enrollment_id: null,
      coupon_code: null,
    });
  });

  it('passes a verification failure through in the server wording', async () => {
    const { recordPurchase } = await load();
    queue = [{ status: 402, body: { detail: 'Google could not confirm that purchase.' } }];
    const result = await recordPurchase({ purchaseToken: 'bogus', productId: 'premium' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toBe('Google could not confirm that purchase.');
  });

  it('tells the learner their purchase is safe when the connection drops', async () => {
    // Recording is idempotent on the order id, so retrying really is safe —
    // and "your money is gone" is the worst thing this screen could imply.
    const { recordPurchase } = await load();
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const result = await recordPurchase({ purchaseToken: 'GPA.1', productId: 'premium' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).toMatch(/safe/i);
      expect(result.detail).not.toMatch(/lost|failed to pay/i);
    }
  });

  it('reports a plan of null if the server grants nothing', async () => {
    const { recordPurchase } = await load();
    queue = [{ status: 201, body: { entitlement: null } }];
    expect(await recordPurchase({ purchaseToken: 'test:x', productId: 'basic' })).toEqual({
      ok: true,
      plan: null,
    });
  });
});
