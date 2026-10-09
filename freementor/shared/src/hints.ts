/**
 * `scheduler_hints` is `{type: "object"}` in the JSON Schema, so the generated
 * type is useless. Every one of the 12 built goal files carries the same 14
 * keys, and the scheduler depends on all of them — so they are typed strictly
 * here and parsed defensively at load time.
 *
 * Values come from docs/APP_BUILD_SPEC.md §4 and the product plan §7.
 */

export const CONFIDENCE_LEVELS = [
  'need_revision',
  'little_afraid',
  'confident',
  'all_cleared',
  'mastered',
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export interface SchedulerHints {
  /** Shown video time = real duration x this. Product rule: 1.15. */
  video_time_multiplier: number;
  /** ...then rounded UP to this many minutes. Product rule: 5. */
  round_up_to_minutes: number;
  warmup_recall_minutes: number;
  focus_block_minutes: number;
  break_minutes: number;
  /** Days after a topic completes at which review blocks are inserted. */
  spaced_review_offsets_days: number[];
  /** A learner's rating overrides the offsets above with a single next date. */
  confidence_to_next_review_days: Record<ConfidenceLevel, number>;
  weekly_pattern: {
    new_content_days: number;
    mixed_practice_and_weekly_test_days: number;
    light_revision_or_rest_days: number;
  };
  rest_day_limits: { per_week: number; per_month: number };
  /** Exams rotate subjects day to day; skills/languages run in order. */
  interleave_by: 'subject' | 'none';
  reserve_final_fraction_for_mocks_and_revision: number;
  mastery_gate: {
    weekly_test_min_score_pct: number;
    remediation_block_minutes: number;
  };
  missed_day_policy: 'shift_forward';
  recalculate_from: 'next_incomplete_task';
}

/** Used when a field is absent; mirrors every built library file. */
export const DEFAULT_HINTS: SchedulerHints = {
  video_time_multiplier: 1.15,
  round_up_to_minutes: 5,
  warmup_recall_minutes: 10,
  focus_block_minutes: 25,
  break_minutes: 5,
  spaced_review_offsets_days: [1, 3, 7, 21, 45],
  confidence_to_next_review_days: {
    need_revision: 1,
    little_afraid: 2,
    confident: 4,
    all_cleared: 7,
    mastered: 21,
  },
  weekly_pattern: {
    new_content_days: 5,
    mixed_practice_and_weekly_test_days: 1,
    light_revision_or_rest_days: 1,
  },
  rest_day_limits: { per_week: 1, per_month: 4 },
  interleave_by: 'subject',
  reserve_final_fraction_for_mocks_and_revision: 0.15,
  mastery_gate: { weekly_test_min_score_pct: 60, remediation_block_minutes: 45 },
  missed_day_policy: 'shift_forward',
  recalculate_from: 'next_incomplete_task',
};

/**
 * Fills any missing hint from DEFAULT_HINTS so a slightly older library file
 * can never crash the scheduler on a user's phone.
 */
export function parseHints(raw: unknown): SchedulerHints {
  const h = (raw ?? {}) as Partial<SchedulerHints>;
  return {
    ...DEFAULT_HINTS,
    ...h,
    confidence_to_next_review_days: {
      ...DEFAULT_HINTS.confidence_to_next_review_days,
      ...(h.confidence_to_next_review_days ?? {}),
    },
    weekly_pattern: { ...DEFAULT_HINTS.weekly_pattern, ...(h.weekly_pattern ?? {}) },
    rest_day_limits: { ...DEFAULT_HINTS.rest_day_limits, ...(h.rest_day_limits ?? {}) },
    mastery_gate: { ...DEFAULT_HINTS.mastery_gate, ...(h.mastery_gate ?? {}) },
    spaced_review_offsets_days:
      h.spaced_review_offsets_days?.length
        ? [...h.spaced_review_offsets_days].sort((a, b) => a - b)
        : DEFAULT_HINTS.spaced_review_offsets_days,
  };
}
