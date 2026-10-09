/**
 * Streaks — product plan decision #14 and §8.8.
 *
 *   "+1 for every calendar day with at least one completed task; one missed
 *    day is forgiven if the user studies the next day; approved rest days
 *    never break it."
 *
 * The research this is built on (Lally et al. 2010: a habit takes a median 66
 * days to form, and one missed day does not hurt) is the reason the streak is
 * deliberately forgiving. A streak that snaps on the first bad day punishes
 * exactly the learner the app exists to help.
 *
 * Pure, like the scheduler: dates in, numbers out, no clock.
 */
import { addDays, isoWeekKey, monthKey, type IsoDate } from '../scheduler/dates.ts';

export interface StreakState {
  current: number;
  best: number;
  lastStudyDate: IsoDate | null;
  /** The missed day most recently forgiven by the 1-day grace, if any. */
  graceUsedOn: IsoDate | null;
  /** Days studied in total — "Your study habit: 23/66 days". */
  habitDays: number;
}

export const HABIT_TARGET_DAYS = 66;
export const STREAK_MILESTONES = [3, 7, 14, 30, 66, 100] as const;

interface Input {
  /** Calendar days with at least one completed task. */
  studyDates: Iterable<IsoDate>;
  /** Days the learner marked as rest. These protect but do not increment. */
  restDays: Iterable<IsoDate>;
  today: IsoDate;
}

export function computeStreak({ studyDates, restDays, today }: Input): StreakState {
  const studied = new Set(studyDates);
  const rested = new Set(restDays);

  if (studied.size === 0) {
    return { current: 0, best: 0, lastStudyDate: null, graceUsedOn: null, habitDays: 0 };
  }

  const sorted = [...studied].sort();
  const run = runEndingAt(today, studied, rested, true);

  return {
    current: run.length,
    best: Math.max(run.length, bestRun(sorted, studied, rested)),
    lastStudyDate: sorted[sorted.length - 1]!,
    graceUsedOn: run.graceUsedOn,
    habitDays: studied.size,
  };
}

/**
 * Walks back from `end`, counting studied days. A rest day is stepped over
 * without breaking or incrementing. One missed day is forgiven; a second
 * consecutive miss ends the run.
 */
function runEndingAt(
  end: IsoDate,
  studied: Set<IsoDate>,
  rested: Set<IsoDate>,
  isToday: boolean,
): { length: number; graceUsedOn: IsoDate | null } {
  let count = 0;
  let cursor = end;
  let graceLeft = 1;
  let graceUsedOn: IsoDate | null = null;
  /**
   * The grace is only really "used" if it bridges two studied days. At the far
   * end of a run the walk always stops on a missed day, and reporting that one
   * would tell the learner they had burned their grace when they had not.
   */
  let pendingGrace: IsoDate | null = null;
  // A streak cannot be longer than the history that produced it.
  let guard = 0;

  while (guard++ < 5000) {
    if (studied.has(cursor)) {
      count += 1;
      if (pendingGrace) {
        graceUsedOn = pendingGrace;
        pendingGrace = null;
      }
    } else if (rested.has(cursor)) {
      // Protected: the plan shifts, the streak holds (product plan §7.7).
    } else if (isToday && cursor === end) {
      // Today is not over yet, so not studying *yet* is not a miss.
    } else if (graceLeft > 0) {
      graceLeft -= 1;
      pendingGrace = cursor;
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }

  return { length: count, graceUsedOn };
}

function bestRun(sorted: IsoDate[], studied: Set<IsoDate>, rested: Set<IsoDate>): number {
  let best = 0;
  // Every run ends on some studied day, so only those are worth testing.
  for (const day of sorted) {
    best = Math.max(best, runEndingAt(day, studied, rested, false).length);
  }
  return best;
}

/** The next badge the learner is working towards (§8.8). */
export function nextMilestone(current: number): number | null {
  return STREAK_MILESTONES.find((m) => m > current) ?? null;
}

/**
 * Rest days are capped at 1 per week and 4 per month (decision #15). Returns
 * why a date cannot be taken off, or null when it can.
 */
export function restDayBlockedReason(
  date: IsoDate,
  restDays: Iterable<IsoDate>,
  limits = { per_week: 1, per_month: 4 },
): string | null {
  const existing = [...restDays].filter((d) => d !== date);

  const inWeek = existing.filter((d) => isoWeekKey(d) === isoWeekKey(date)).length;
  if (inWeek >= limits.per_week) {
    return `You have already used your rest day this week (${limits.per_week} per week).`;
  }

  const inMonth = existing.filter((d) => monthKey(d) === monthKey(date)).length;
  if (inMonth >= limits.per_month) {
    return `You have used all ${limits.per_month} rest days this month.`;
  }

  return null;
}

/** "You studied 4 of the last 7 days" — the consistency figure in Reports. */
export function consistency(
  studyDates: Iterable<IsoDate>,
  today: IsoDate,
  windowDays = 7,
): { studied: number; of: number } {
  const studied = new Set(studyDates);
  let count = 0;
  for (let i = 0; i < windowDays; i++) {
    if (studied.has(addDays(today, -i))) count += 1;
  }
  return { studied: count, of: windowDays };
}

