/**
 * Advertising rules, as code.
 *
 * Everything FreeMentor says to a learner about money or outcomes has to hold
 * up under:
 *   - Consumer Protection Act 2019 and the CCPA Guidelines for Prevention of
 *     Misleading Advertisements and Endorsements, 2022 — claims must be
 *     truthful, substantiable, and must not promise a result.
 *   - CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023 —
 *     no false urgency, no confirm shaming, no drip pricing, no bait and
 *     switch, no nagging.
 *   - Product plan §10.4, which applies the same thinking to strike-through
 *     prices.
 *
 * This matters more for an education app than for most: an exam aspirant is
 * exactly the person who will believe a promise of results, and that promise
 * is both the easiest thing to write and the least defensible.
 *
 * These checks run in the test suite over every goal's copy, so a tempting
 * line cannot quietly ship.
 */

export interface Violation {
  rule: string;
  match: string;
  why: string;
}

interface Rule {
  name: string;
  pattern: RegExp;
  why: string;
}

const RULES: Rule[] = [
  {
    name: 'outcome-guarantee',
    // "guaranteed selection", "you will clear", "assured rank", "100% result"
    pattern:
      /\b(guarantee[sd]?|assured|assurance|100\s*%|sure[-\s]?shot|certain(?:ly)?\s+(?:clear|crack|pass))\b|\b(?:you\s+will|we'?ll\s+make\s+you)\s+(?:clear|crack|pass|qualify|get\s+in|succeed)\b/i,
    why: 'Promising a result is a misleading claim under the 2022 CCPA guidelines. No study plan can guarantee a rank or a seat.',
  },
  {
    name: 'rank-promise',
    pattern: /\b(top\s+(?:rank|10|100)|rank\s*1\b|air\s*1\b|selection\s+guaranteed)\b/i,
    why: 'Implies a specific competitive outcome the app cannot deliver.',
  },
  {
    name: 'false-urgency',
    pattern:
      /\b(hurry|limited\s+time|only\s+\d+\s+(?:left|seats?|spots?)|last\s+chance|offer\s+ends|act\s+now|don'?t\s+miss\s+out|few\s+seats\s+left)\b/i,
    why: 'False urgency is a named dark pattern (2023 guidelines). Our price is not time-limited, so saying otherwise is untrue as well as unlawful.',
  },
  {
    name: 'confirm-shaming',
    pattern:
      /\b(do\s+you\s+(?:really\s+)?not\s+want|no,?\s*i\s+(?:don'?t|do\s+not)\s+want\s+to\s+(?:succeed|improve|learn)|not\s+serious\s+about)\b/i,
    why: 'Guilting a learner who declines is a named dark pattern.',
  },
  {
    name: 'disparagement',
    // Naming a competitor to put them down.
    pattern: /\b(?:unlike|better\s+than|cheaper\s+than)\s+(allen|aakash|byju'?s|unacademy|physics\s*wallah|vedantu|coursera|udemy)\b/i,
    why: 'Comparative advertising may not disparage an identifiable competitor.',
  },
  {
    name: 'free-without-qualification',
    // "completely free" / "100% free" overstates: the roadmap is paid.
    pattern: /\b(completely|totally|entirely|fully)\s+free\b/i,
    why: 'The resources are free; the roadmap is not. An unqualified "completely free" is misleading.',
  },
  {
    name: 'unqualified-free-access',
    // Added Oct 2026, after the locking model changed under copy that had
    // been written for the old one. Until then the app opened every video on
    // every plan, and four separate strings said so. Now a resource is free
    // for three days and then it is not, so a claim of free access has to say
    // WHERE it is free — "free on YouTube" is true, "free to open" is not.
    //
    // The inner lookahead is what makes "on" a qualifier only when it names a
    // source: "free to open on YouTube" passes, "free to open on every plan"
    // does not.
    pattern:
      /\bfree\s+to\s+(?:open|access|watch|use)\b(?!\s+(?:on|at|from|in)\s+(?!every\s+plan|any\s+plan|all\s+plans)\S)|\bfree\s+(?:on\s+every\s+plan|always|forever|for\s+lifetime)\b|\bnever\s+(?:be\s+)?(?:put\s+)?behind\s+(?:an?\s+)?(?:ads?\b|advert|paywall)/i,
    why: 'Resources are free at their source, not inside the app — after the 3-day trial they lock until a plan is bought. A claim of free access must name where it is free.',
  },
  {
    name: 'fake-scarcity-price',
    pattern: /\b(special\s+price\s+(?:for\s+you|today)|price\s+(?:goes\s+up|increases)\s+(?:soon|tomorrow))\b/i,
    why: 'Invented price pressure is both false urgency and a misleading price claim.',
  },
];

/** Returns every rule a piece of copy breaks. Empty means it is clean. */
export function checkCopy(text: string): Violation[] {
  const found: Violation[] = [];
  for (const rule of RULES) {
    const match = rule.pattern.exec(text);
    if (match) found.push({ rule: rule.name, match: match[0], why: rule.why });
  }
  return found;
}

/** Convenience for tests and dev-time assertions. */
export function assertCompliant(label: string, text: string): void {
  const violations = checkCopy(text);
  if (violations.length === 0) return;
  throw new Error(
    `Non-compliant copy in ${label}:\n` +
      violations.map((v) => `  [${v.rule}] "${v.match}" — ${v.why}`).join('\n'),
  );
}

/**
 * A price statement must be unambiguous about the TOTAL and that it is not
 * recurring — drip pricing and subscription traps are both named dark
 * patterns, and §10.1 is a one-time payment.
 */
export function statesPriceHonestly(text: string): boolean {
  return /one[-\s]time/i.test(text) && /lifetime|for life/i.test(text);
}
