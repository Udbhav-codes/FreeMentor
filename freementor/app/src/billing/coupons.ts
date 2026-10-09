/**
 * Coupon codes — product plan §10.3.
 *
 *   Six uppercase letters then three digits: ^[A-Z]{6}[0-9]{3}$, e.g. TOPPER426.
 *
 * Each discount tier maps to a PRE-CREATED discounted Google Play product.
 * The app never computes a price: it validates the code with the server, gets
 * back a product id, and launches that Play product. Pricing logic on the
 * client would be both wrong and trivially tamperable.
 */

export const COUPON_PATTERN = /^[A-Z]{6}[0-9]{3}$/;

export const DISCOUNT_TIERS = [10, 20, 30, 50, 70, 90] as const;
export type DiscountTier = (typeof DISCOUNT_TIERS)[number];

export type Plan = 'basic' | 'premium';

export function isValidCouponCode(code: string): boolean {
  return COUPON_PATTERN.test(code);
}

/** Tidies what a learner typed before validating: trims and upper-cases. */
export function normaliseCouponCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * The Play product id for a plan at a tier, e.g. `premium_off50`. These must
 * already exist in the Play Console — the server returns the id, the app just
 * launches it.
 */
export function playProductId(plan: Plan, tier?: DiscountTier): string {
  return tier ? `${plan}_off${tier}` : plan;
}

/** Every product that has to be created in the Play Console before launch. */
export function allPlayProductIds(): string[] {
  const ids: string[] = ['basic', 'premium', 'upgrade_basic_to_premium'];
  for (const plan of ['basic', 'premium'] as Plan[]) {
    for (const tier of DISCOUNT_TIERS) ids.push(playProductId(plan, tier));
  }
  return ids;
}

export function isDiscountTier(value: number): value is DiscountTier {
  return (DISCOUNT_TIERS as readonly number[]).includes(value);
}
