/**
 * The welcome / value message on Home — written per goal.
 *
 * Two constraints pulling against each other, and the honest version wins
 * because it is also the more convincing one:
 *
 *   Attractive. A learner should see, in five seconds, what they get and why
 *   the price is small. Vague copy ("achieve your dreams!") persuades nobody.
 *
 *   Lawful. Consumer Protection Act 2019, the 2022 misleading-advertising
 *   guidelines and the 2023 dark-patterns guidelines. No promised outcomes,
 *   no manufactured urgency, no unqualified "free".
 *
 * The way out of that tension is FACTS. Every goal file knows its own topic
 * count, hours, phases and career outcomes, so each message is specific and
 * verifiable rather than hyped — "72 topics, 605 free links, about 680 hours"
 * beats any superlative, and nothing in it can be challenged.
 *
 * Every string produced here is run through marketing/compliance.ts in the
 * test suite, for all 73 goals.
 */
import type { CatalogGoal, GoalType } from '@freementor/shared';
import {
  COMPARISON,
  comparisonRange,
  FREE_DISCLOSURE,
  PRICES,
  rupees,
  type GoalKind,
} from '../billing/pricing.ts';

export interface WelcomeCopy {
  /** Rendered as "Welcome to Free" + "Mentor" in amber. */
  brandLead: string;
  brandAccent: string;
  /** What this goal is, and what the learner is working towards. */
  promise: string;
  /** Concrete, checkable facts about the roadmap. */
  facts: string;
  /** The price, framed against what this kind of course usually costs. */
  value: string;
  /** The warm line. Encouraging about effort, never about results. */
  nudge: string;
  /** Why the resources can be trusted. */
  trust: string;
  /** The disclosure the product plan requires wherever "free" appears. */
  disclosure: string;
}

/**
 * What the learner is preparing FOR, per goal.
 *
 * Phrased as preparation, never as attainment: "prepare for a seat at an IIT",
 * not "get your seat at an IIT". The difference is the whole compliance
 * question, and it costs nothing in warmth.
 */
const ASPIRATION: Record<string, string> = {
  // Engineering
  'jee-main': 'your shot at an NIT, IIIT or state engineering seat',
  'jee-advanced': 'your attempt at an IIT seat',
  gate: 'a PG seat or a PSU application',
  // Medical
  'neet-ug': 'your attempt at an MBBS or BDS seat',
  // Management, Law, University
  cat: 'your shot at an IIM call',
  clat: 'your attempt at a National Law University seat',
  'cuet-ug': 'admission to a central university',
  // Teaching and research
  'ugc-net': 'Assistant Professor eligibility or JRF',
  ctet: 'your teaching eligibility',
  // Government
  'upsc-cse': 'the Civil Services examination',
  'ssc-cgl': 'an SSC CGL posting',
  'ssc-chsl': 'an SSC CHSL posting',
  'rrb-ntpc': 'an RRB NTPC posting',
  // Banking
  'ibps-po': 'a Probationary Officer posting',
  'ibps-clerk': 'a bank clerical posting',
  'sbi-po': 'an SBI Probationary Officer posting',
  'sbi-clerk': 'an SBI clerical posting',
  // Defence
  nda: 'your NDA attempt',
  cds: 'your CDS attempt',
};

/** Per-group framing for skills and languages, so each family reads its own way. */
const GROUP_FRAMING: Record<string, string> = {
  'Technology & Development': 'building things you can actually ship',
  'Data & AI': 'working with real data and models',
  'Design & Creative': 'a portfolio you can show',
  'Business & Professional': 'skills employers list in the job ad',
  Languages: 'writing code you understand line by line',
};

function kindOf(type: GoalType): GoalKind {
  return type === 'exam' ? 'exam' : type === 'language' ? 'language' : 'skill';
}

function aspirationFor(goal: CatalogGoal): string {
  const curated = ASPIRATION[goal.id];
  if (curated) return curated;
  if (goal.type === 'exam') return `your ${goal.name} attempt`;
  const framing = GROUP_FRAMING[goal.group] ?? 'skills you can use at work';
  return `${goal.name} — ${framing}`;
}

/**
 * The warm line. Encourages the ATTEMPT and frames the cost, which is a claim
 * about our price (true, checkable) rather than about their result.
 */
function nudgeFor(goal: CatalogGoal): string {
  const basic = rupees(PRICES.basic);
  if (goal.type === 'exam') {
    return (
      `Serious preparation does not have to start with a big cheque. The lessons are free ` +
      `on YouTube and the official sites; ${basic} covers the plan that tells you which ` +
      `one to open today.`
    );
  }
  if (goal.type === 'language') {
    return (
      `The best ${goal.name} material on the internet is already free. You are paying ` +
      `${basic} for the order to learn it in, not for the content.`
    );
  }
  return (
    `Everything in this roadmap is public and free at its source. ${basic} buys the ` +
    `sequence, the daily plan and the tracking — once, for life.`
  );
}

/** Concrete, checkable facts. More persuasive than any adjective. */
function factsFor(goal: CatalogGoal): string {
  const phases = goal.phases?.length ?? 0;

  const base =
    phases > 0
      ? `${phases} phases, about ${goal.estimated_hours} hours of work, planned around the time you actually have.`
      : `About ${goal.estimated_hours} hours of work, planned around the time you actually have.`;

  // Skills and languages carry career outcomes, which make a good closing
  // fact. Exams carry an eligibility note instead, but those run to a full
  // paragraph (JEE Advanced's is six lines) — that belongs on the goal detail
  // screen, which already shows it, not on a welcome card.
  const outcome = goal.career_outcomes?.[0];
  return outcome ? `${base} By the end: ${lowerFirst(outcome)}.` : base;
}

function trustFor(goal: CatalogGoal): string {
  const source =
    goal.type === 'exam'
      ? 'NCERT, official exam portals and public lectures from established teachers'
      : 'official documentation, open textbooks and public lectures';
  return (
    `Every link opens the original free source — ${source}. We never copy or re-host ` +
    `anyone's material, and every video stays free on YouTube itself.`
  );
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function welcomeCopy(goal: CatalogGoal): WelcomeCopy {
  const comparison = COMPARISON[kindOf(goal.type)];

  return {
    brandLead: 'Welcome to Free',
    brandAccent: 'Mentor',
    promise:
      `A day-by-day roadmap for ${aspirationFor(goal)}, built from free resources ` +
      `and yours for life.`,
    facts: factsFor(goal),
    value:
      `${comparison.label[0]!.toUpperCase()}${comparison.label.slice(1)} for this commonly ` +
      `run from ${comparisonRange(comparison)}. FreeMentor is ` +
      `${rupees(PRICES.basic)} — one-time, inclusive of taxes, with lifetime access to this ` +
      `roadmap and your progress reports.`,
    nudge: nudgeFor(goal),
    trust: trustFor(goal),
    disclosure: FREE_DISCLOSURE,
  };
}

/** Every line of a goal's copy, for compliance checking. */
export function allCopyStrings(copy: WelcomeCopy): string[] {
  return Object.values(copy);
}
