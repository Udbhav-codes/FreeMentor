/**
 * The pure half of Play Billing: what to sell, and what an error means.
 * The native half needs a device; billingAvailable() proves it degrades here.
 */
import { describe, expect, it, vi } from 'vitest';

// The native module does not exist under Node, exactly as in Expo Go.
vi.mock('react-native-iap', () => {
  throw new Error('native module missing');
});
vi.mock('../../auth/supabase.ts', () => ({
  accessToken: async () => null,
  supabase: {},
  bindTokenRefreshToAppState: () => undefined,
  SUPABASE_URL: 'https://example.supabase.co',
}));
import {
  PRODUCTS,
  billingAvailable,
  buy,
  describeStoreError,
  productFor,
  restorePurchases,
} from '../playBilling.ts';

describe('which product to sell', () => {
  it('sells Basic or Premium to someone who holds nothing', () => {
    expect(productFor('basic', null)).toBe(PRODUCTS.basic);
    expect(productFor('premium', null)).toBe(PRODUCTS.premium);
  });

  it('sells the ₹400 upgrade, not full Premium, to a Basic holder', () => {
    expect(productFor('premium', 'basic')).toBe(PRODUCTS.upgrade);
  });

  it('sells nothing that is already owned or a downgrade', () => {
    expect(productFor('basic', 'basic')).toBeNull();
    expect(productFor('basic', 'premium')).toBeNull();
    expect(productFor('premium', 'premium')).toBeNull();
  });

  it('uses the ids the server sells', () => {
    // Must match server/app/billing.py: PLANS and UPGRADE_PRODUCT.
    expect(PRODUCTS).toEqual({
      basic: 'basic',
      premium: 'premium',
      upgrade: 'upgrade_basic_to_premium',
    });
  });
});

describe('store errors', () => {
  it('treats a cancel as a cancel, not a failure to shout about', () => {
    expect(describeStoreError('user-cancelled')).toEqual({ kind: 'cancelled' });
  });

  it('reports a pending payment separately (UPI not yet cleared)', () => {
    expect(describeStoreError('pending').kind).toBe('pending');
    expect(describeStoreError('deferred-payment').kind).toBe('pending');
  });

  it('points an already-owned purchase at Restore', () => {
    const r = describeStoreError('already-owned');
    expect(r.kind).toBe('failed');
    expect(r.kind === 'failed' && r.message).toMatch(/restore/i);
  });

  it('always tells the learner they were not charged on an unknown error', () => {
    const r = describeStoreError('something-new');
    expect(r.kind === 'failed' && r.message).toMatch(/not charged/i);
  });
});

describe('without the native module (Expo Go, tests)', () => {
  it('reports billing as unavailable and never throws', async () => {
    expect(await billingAvailable()).toBe(false);
    const result = await buy(PRODUCTS.basic, null);
    expect(result.kind).toBe('failed');
    expect(await restorePurchases(null)).toBeNull();
  });
});
