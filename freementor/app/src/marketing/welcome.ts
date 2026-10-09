/**
 * The welcome / value message on Home.
 *
 * Its job is to make two things obvious in the first five seconds: the study
 * resources are genuinely free and stay free, and the roadmap costs a fraction
 * of a course. That is the product's actual claim (plan §2: "we don't just
 * give you free trusted content — we tell you what to learn, when").
 *
 * Pure functions so the copy is testable: the goal name has to interpolate
 * correctly for all 73 goals, and the "free" disclosure the plan mandates must
 * never go missing.
 */
import type { GoalType } from '@freementor/shared';
import { COMPARISON, FREE_DISCLOSURE, PRICES, rupees, type GoalKind } from '../billing/pricing.ts';

export interface WelcomeCopy {
  /** Rendered as "Welcome to Free" + "Mentor" in amber. */
  brandLead: string;
  brandAccent: string;
  /** The main promise, with the learner's goal in it. */
  promise: string;
  /** The price comparison. */
  value: string;
  /** The warm, slightly cheeky line. */
  nudge: string;
  /** The disclosure the product plan requires wherever "free" appears. */
  disclosure: string;
}

/** Catalog types map onto the three comparison buckets. */
function kindOf(type: GoalType): GoalKind {
  return type === 'exam' ? 'exam' : type === 'language' ? 'language' : 'skill';
}

/**
 * What the learner is actually aiming at, in their words — "a seat at IIT"
 * reads better than "JEE Main". Falls back to the goal's own name, which is
 * always correct even when we have no special case for it.
 */
function aspirationFor(goalId: string, goalName: string, type: GoalType): string {
  const known: Record<string, string> = {
    'jee-main': 'a seat at NIT or IIIT',
    'jee-advanced': 'a seat at IIT',
    'neet-ug': 'an MBBS seat',
    'cuet-ug': 'your university admission',
  };
  if (known[goalId]) return known[goalId]!;
  if (type === 'exam') return `your ${goalName} goal`;
  return `your goal of becoming job-ready in ${goalName}`;
}

/**
 * The cheeky line. Deliberately concrete: "less than one pizza" lands harder
 * than "affordable", and it is true at ₹599.
 */
function nudgeFor(goalName: string, type: GoalType): string {
  const basic = rupees(PRICES.basic);
  if (type === 'exam') {
    return (
      `You don't need a ${rupees(COMPARISON.exam.low)}+ coaching course to start preparing ` +
      `for ${goalName}. Begin for less than one pizza with friends. 🍕`
    );
  }
  if (type === 'language') {
    return (
      `Learning ${goalName} properly doesn't need a paid course — the best material is ` +
      `already free. You're paying ${basic} for the plan, not the content. 🍕`
    );
  }
  return (
    `A ${goalName} bootcamp runs into tens of thousands. Yours costs about one weekend ` +
    `out — and the lessons stay free forever. 🍕`
  );
}

export function welcomeCopy({
  goalId,
  goalName,
  goalType,
}: {
  goalId: string;
  goalName: string;
  goalType: GoalType;
}): WelcomeCopy {
  const kind = kindOf(goalType);
  const comparison = COMPARISON[kind];

  return {
    brandLead: 'Welcome to Free',
    brandAccent: 'Mentor',
    promise:
      `Your day-by-day roadmap plus free resource links, for life — everything you need ` +
      `to reach ${aspirationFor(goalId, goalName, goalType)}.`,
    value:
      `Instead of paying ${rupees(comparison.low)} to ${rupees(comparison.high)}+ for ` +
      `${comparison.label}, get the whole day-wise plan, every resource link and your ` +
      `progress reports for ${rupees(PRICES.basic)} — one time, lifetime.`,
    nudge: nudgeFor(goalName, goalType),
    disclosure: FREE_DISCLOSURE,
  };
}
