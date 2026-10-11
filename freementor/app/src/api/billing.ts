/**
 * Coupons, purchases and the server-verified entitlement — §10.1, §10.3.
 *
 * The app does not decide what anything costs and does not decide what a
 * learner is entitled to. It asks for a *product id* and launches that; it
 * asks for an entitlement and trusts the answer. Both come from the server,
 * because both are things a modified client would otherwise simply assert.
 *
 * Play Billing itself is not here yet — that needs a Play Console account and
 * a development build. What is here is everything around it, so plugging in
 * react-native-iap is the last step rather than the whole job.
 */
import { api, apiConfigured, authToken, errorDetail } from './client.ts';

export type Plan = 'basic' | 'premium';

export type CouponResult =
  | { ok: true; code: string; discountPercent: number; productId: string; plan: Plan }
  | { ok: false; detail: string; unknown: boolean };

/**
 * Checks a coupon and returns the Play product it unlocks.
 *
 * Does not consume it — the server only spends a use when a purchase is
 * recorded, so a learner can check a code and change their mind.
 */
export async function validateCoupon(code: string, plan: Plan): Promise<CouponResult> {
  if (!apiConfigured || !(await authToken())) {
    return {
      ok: false,
      unknown: false,
      detail: 'Coupons need a connection and a signed-in account.',
    };
  }
  try {
    const response = await api('/billing/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, plan }),
    });
    if (!response.ok) {
      return {
        ok: false,
        // 404 is a code we do not know; 409 is a real code that cannot be
        // used now. Worth distinguishing — one is a typo, the other is not.
        unknown: response.status === 404,
        detail: await errorDetail(response, 'We could not check that code.'),
      };
    }
    const body = (await response.json()) as {
      code: string;
      discount_percent: number;
      product_id: string;
      plan: Plan;
    };
    return {
      ok: true,
      code: body.code,
      discountPercent: body.discount_percent,
      productId: body.product_id,
      plan: body.plan,
    };
  } catch {
    return { ok: false, unknown: false, detail: 'No connection. Try again in a moment.' };
  }
}

export interface ServerEntitlement {
  /** null when nothing is bought — the local trial clock decides from there. */
  plan: Plan | null;
  productId: string | null;
  orderId: string | null;
}

/**
 * What the server says the learner holds, for this enrollment.
 *
 * Returns null — not "nothing bought" — when the server cannot be reached, so
 * the caller can tell "no plan" from "no answer". Those must behave
 * differently: an unreachable server must never revoke a plan somebody paid
 * for just because they are on a train.
 */
export async function fetchEntitlement(
  enrollmentId?: string | null,
): Promise<ServerEntitlement | null> {
  if (!apiConfigured || !(await authToken())) return null;
  try {
    const query = enrollmentId ? `?enrollment_id=${encodeURIComponent(enrollmentId)}` : '';
    const response = await api(`/billing/entitlement${query}`);
    if (!response.ok) return null;
    const body = (await response.json()) as {
      entitlement?: string | null;
      product_id?: string | null;
      order_id?: string | null;
    };
    const plan = body.entitlement === 'basic' || body.entitlement === 'premium'
      ? body.entitlement
      : null;
    return { plan, productId: body.product_id ?? null, orderId: body.order_id ?? null };
  } catch {
    return null;
  }
}

export type PurchaseResult =
  | { ok: true; plan: Plan | null }
  | { ok: false; detail: string };

/**
 * Hands a completed Play purchase to the server to verify and record.
 *
 * The token is what Play Billing returns; the server asks Google what it
 * actually represents. Nothing the app sends here is taken on trust.
 */
export async function recordPurchase(input: {
  purchaseToken: string;
  productId: string;
  enrollmentId?: string | null;
  couponCode?: string | null;
}): Promise<PurchaseResult> {
  if (!apiConfigured || !(await authToken())) {
    return { ok: false, detail: 'Sign in to finish your purchase.' };
  }
  try {
    const response = await api('/billing/purchases', {
      method: 'POST',
      body: JSON.stringify({
        purchase_token: input.purchaseToken,
        product_id: input.productId,
        enrollment_id: input.enrollmentId ?? null,
        coupon_code: input.couponCode ?? null,
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: await errorDetail(response, 'We could not confirm that purchase.'),
      };
    }
    const body = (await response.json()) as { entitlement?: string | null };
    const plan =
      body.entitlement === 'basic' || body.entitlement === 'premium' ? body.entitlement : null;
    return { ok: true, plan };
  } catch {
    // The purchase may well have succeeded at Play's end. Recording is
    // idempotent on the order id, so retrying is always safe.
    return {
      ok: false,
      detail: 'No connection. Your purchase is safe — reopen the app to finish.',
    };
  }
}
