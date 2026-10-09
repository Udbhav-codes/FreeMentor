/**
 * Prices — product plan §10.1. One source of truth, so marketing copy and the
 * plans screen can never drift apart.
 *
 * All one-time, per roadmap, lifetime access (decision #6). GST-inclusive
 * (open item #1 default).
 */

export const PRICES = {
  basic: 599,
  premium: 999,
  /** Basic -> Premium is a dedicated Play product for the difference. */
  upgrade: 400,
} as const;

/**
 * Prices the product plan lists as "original". They are only shown
 * struck-through if they were GENUINELY charged before — Indian
 * consumer-protection guidance on dark patterns (§10.4) — so they stay off
 * until that is confirmed.
 */
export const PREVIOUS_PRICES = { basic: 1299, premium: 3999 } as const;
export const SHOW_PREVIOUS_PRICES = false;

/** "₹599" */
export function rupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * The disclosure the product plan REQUIRES wherever "free" appears in
 * marketing (see the tagline note at the top of the plan). Not optional
 * copy — it is what keeps "free" honest, since the resources are free but the
 * roadmap is not.
 */
export const FREE_DISCLOSURE =
  `All study resources are free to open. Your personal roadmap and tracking are ` +
  `free for 3 days, then Basic ${rupees(PRICES.basic)} or Premium ` +
  `${rupees(PRICES.premium)} (one-time).`;

/**
 * What a paid course for this kind of goal typically costs, used for the
 * value comparison on Home.
 *
 * CLAIMS MADE TO USERS MUST BE SUBSTANTIABLE. India's consumer-protection
 * rules on misleading advertising apply to comparative price claims, so these
 * numbers need a documented source (a survey of listed prices, dated) before
 * the store launch. They are deliberately in one place, named, and easy to
 * change or remove — do not scatter them through the UI.
 */
export const COMPARISON = {
  exam: { low: 6_000, high: 40_000, label: 'coaching courses' },
  skill: { low: 10_000, high: 50_000, label: 'bootcamps' },
  language: { low: 3_000, high: 15_000, label: 'paid courses' },
} as const;

export type GoalKind = keyof typeof COMPARISON;
