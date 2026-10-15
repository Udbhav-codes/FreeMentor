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
 *
 * The first sentence used to read "All study resources are free to open",
 * which was true of the app until Oct 2026 and is now true only of the
 * sources. Where a resource is free has to be said explicitly, because in
 * FreeMentor it is free for three days and then it is not.
 */
export const FREE_DISCLOSURE =
  `Every resource we link to is free at its own source. Your personal roadmap ` +
  `and tracking are free for 3 days, then Basic ${rupees(PRICES.basic)} or Premium ` +
  `${rupees(PRICES.premium)} — a one-time payment, inclusive of taxes, with lifetime ` +
  `access to that roadmap. No subscription, no renewal.`;

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

/**
 * "₹6,000 to ₹40,000+". The trailing plus matters: the upper end of these
 * ranges has no real ceiling, and quoting a flat maximum would understate it
 * — a claim we would then have to defend.
 */
export function comparisonRange(c: { low: number; high: number }): string {
  return `${rupees(c.low)} to ${rupees(c.high)}+`;
}

export type GoalKind = keyof typeof COMPARISON;
