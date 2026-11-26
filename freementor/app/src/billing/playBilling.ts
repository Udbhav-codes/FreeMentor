/**
 * Google Play Billing — product plan §10.1 and §10.4.
 *
 * The flow, and why it is in this order:
 *
 *   1. Ask Play for the product (Play shows its own sheet and takes payment).
 *   2. Hand the purchase token to OUR server, which asks Google what it really
 *      is (server/app/play.py). Nothing the device says is trusted.
 *   3. Only after the server has recorded it, finish (acknowledge) it with
 *      Play. Play refunds anything not acknowledged within 3 days, so a
 *      purchase the server never saw is retried by `restorePurchases()` —
 *      called on the Plans screen and by the Restore button — rather than
 *      silently acknowledged and lost.
 *
 * react-native-iap is a native module. It is loaded lazily and every call
 * degrades to a clear "not available" result in Expo Go and under tests, the
 * same pattern as notifications/daily.ts.
 */
import { recordPurchase } from '../api/billing.ts';

/** The three products sold at launch. Ids must match the Play Console exactly. */
export const PRODUCTS = {
  basic: 'basic',
  premium: 'premium',
  upgrade: 'upgrade_basic_to_premium',
} as const;

export type ProductId = (typeof PRODUCTS)[keyof typeof PRODUCTS];
export type Plan = 'basic' | 'premium';

/**
 * Which product to sell for the plan the learner chose, given what they hold.
 * Null means there is nothing to buy: they already have that plan or better.
 * Pure, so the upgrade rule is tested rather than trusted.
 */
export function productFor(wanted: Plan, holding: Plan | null): ProductId | null {
  if (holding === 'premium') return null;
  if (holding === 'basic') return wanted === 'premium' ? PRODUCTS.upgrade : null;
  return wanted === 'premium' ? PRODUCTS.premium : PRODUCTS.basic;
}

export type BuyResult =
  | { kind: 'bought'; plan: Plan | null }
  | { kind: 'cancelled' }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string };

/** Turns a store error code into what the learner should read. */
export function describeStoreError(code: string | undefined): BuyResult {
  switch (code) {
    case 'user-cancelled':
      return { kind: 'cancelled' };
    case 'pending':
    case 'deferred-payment':
      return { kind: 'pending' };
    case 'already-owned':
      return {
        kind: 'failed',
        message: 'You already own this. Tap "Restore purchase" to unlock it on this phone.',
      };
    case 'network-error':
    case 'service-unavailable':
    case 'service-disconnected':
      return { kind: 'failed', message: 'Google Play could not be reached. Check your connection.' };
    case 'billing-unavailable':
    case 'iap-not-available':
      return {
        kind: 'failed',
        message: 'Google Play Billing is not available on this device or account.',
      };
    case 'item-unavailable':
      return { kind: 'failed', message: 'This plan is not available to buy yet.' };
    default:
      return { kind: 'failed', message: 'The purchase did not go through. You were not charged.' };
  }
}

// ----------------------------------------------------------- native layer --

type Iap = typeof import('react-native-iap');
type StorePurchase = {
  productId: string;
  purchaseToken?: string | null;
  purchaseState: string;
};

let iapModule: Iap | null | undefined;
let connected = false;

async function iap(): Promise<Iap | null> {
  if (iapModule !== undefined) return iapModule;
  try {
    iapModule = await import('react-native-iap');
  } catch {
    iapModule = null;
  }
  return iapModule;
}

async function connect(): Promise<Iap | null> {
  const mod = await iap();
  if (!mod) return null;
  if (connected) return mod;
  try {
    connected = Boolean(await mod.initConnection());
  } catch {
    connected = false;
  }
  return connected ? mod : null;
}

/** Whether this build can talk to Play Billing at all (false in Expo Go). */
export async function billingAvailable(): Promise<boolean> {
  return (await connect()) !== null;
}

/**
 * Server first, then acknowledge. Returns the plan the server recorded, or a
 * failure; never finishes a purchase the server has not accepted.
 */
async function settle(
  mod: Iap,
  purchase: StorePurchase,
  enrollmentId: string | null,
): Promise<BuyResult> {
  if (purchase.purchaseState === 'pending') return { kind: 'pending' };
  if (!purchase.purchaseToken) {
    return { kind: 'failed', message: 'Google Play returned no purchase token.' };
  }
  const recorded = await recordPurchase({
    purchaseToken: purchase.purchaseToken,
    productId: purchase.productId,
    enrollmentId,
  });
  if (!recorded.ok) return { kind: 'failed', message: recorded.detail };
  try {
    await mod.finishTransaction({
      purchase: purchase as Parameters<Iap['finishTransaction']>[0]['purchase'],
      isConsumable: false,
    });
  } catch {
    // The server acknowledged it as well (play.py), so this is not fatal.
  }
  return { kind: 'bought', plan: recorded.plan };
}

/**
 * Buys `productId` for this roadmap. Resolves once Play and our server have
 * both answered; never throws.
 */
export async function buy(productId: ProductId, enrollmentId: string | null): Promise<BuyResult> {
  const mod = await connect();
  if (!mod) {
    return {
      kind: 'failed',
      message: 'Purchases need the Play Store version of the app.',
    };
  }

  return new Promise<BuyResult>((resolve) => {
    let done = false;
    const finish = (result: BuyResult) => {
      if (done) return;
      done = true;
      updated.remove();
      failed.remove();
      resolve(result);
    };

    const updated = mod.purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== productId) return;
      void settle(mod, purchase as StorePurchase, enrollmentId).then(finish);
    });
    const failed = mod.purchaseErrorListener((error) => {
      finish(describeStoreError(error.code));
    });

    mod
      .requestPurchase({ request: { google: { skus: [productId] } }, type: 'in-app' })
      .catch((error: { code?: string }) => finish(describeStoreError(error?.code)));
  });
}

/**
 * Re-sends every purchase Play still holds to our server, then acknowledges
 * it. Covers a new phone, a reinstall, and a purchase whose server call
 * failed. Returns the best plan found, or null.
 */
export async function restorePurchases(enrollmentId: string | null): Promise<Plan | null> {
  const mod = await connect();
  if (!mod) return null;
  let purchases: StorePurchase[] = [];
  try {
    purchases = ((await mod.getAvailablePurchases()) ?? []) as StorePurchase[];
  } catch {
    return null;
  }
  let best: Plan | null = null;
  for (const purchase of purchases) {
    const result = await settle(mod, purchase, enrollmentId);
    if (result.kind === 'bought' && result.plan) {
      best = best === 'premium' ? best : result.plan;
    }
  }
  return best;
}
