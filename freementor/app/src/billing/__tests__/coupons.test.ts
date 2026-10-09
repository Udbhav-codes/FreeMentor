import { describe, expect, it } from 'vitest';
import {
  allPlayProductIds,
  DISCOUNT_TIERS,
  isDiscountTier,
  isValidCouponCode,
  normaliseCouponCode,
  playProductId,
} from '../coupons.ts';

describe('coupon format — ^[A-Z]{6}[0-9]{3}$', () => {
  it('accepts the example from the product plan', () => {
    expect(isValidCouponCode('TOPPER426')).toBe(true);
  });

  it.each([
    ['topper426', 'lowercase'],
    ['TOPPER42', 'only two digits'],
    ['TOPPER4267', 'four digits'],
    ['TOPPE426', 'five letters'],
    ['TOPPERS426', 'seven letters'],
    ['TOP PER426', 'a space'],
    ['TOPPER-426', 'punctuation'],
    ['426TOPPER', 'digits first'],
    ['', 'empty'],
  ])('rejects %s (%s)', (code) => {
    expect(isValidCouponCode(code)).toBe(false);
  });

  it('normalises what a learner actually types', () => {
    expect(normaliseCouponCode('  topper426 ')).toBe('TOPPER426');
    expect(isValidCouponCode(normaliseCouponCode(' topper 426 '))).toBe(true);
  });
});

describe('Play product ids', () => {
  it('maps a tier to its pre-created product', () => {
    expect(playProductId('premium', 50)).toBe('premium_off50');
    expect(playProductId('basic', 10)).toBe('basic_off10');
  });

  it('falls back to the undiscounted product', () => {
    expect(playProductId('premium')).toBe('premium');
  });

  it('lists every product that must exist in the Play Console', () => {
    const ids = allPlayProductIds();
    // 2 base plans + the upgrade + 6 tiers x 2 plans.
    expect(ids).toHaveLength(3 + DISCOUNT_TIERS.length * 2);
    expect(ids).toContain('upgrade_basic_to_premium');
    expect(ids).toContain('premium_off90');
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('discount tiers', () => {
  it('only allows the six published tiers', () => {
    expect(DISCOUNT_TIERS).toEqual([10, 20, 30, 50, 70, 90]);
    expect(isDiscountTier(50)).toBe(true);
    expect(isDiscountTier(45)).toBe(false);
    expect(isDiscountTier(100)).toBe(false);
  });
});
