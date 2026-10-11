/**
 * Which weeks of the route a learner may open yet.
 *
 * The first week is open from the start. Every later week opens on the
 * **Saturday of the week before it**, so next week's plan appears as this one
 * is finishing, instead of handing someone 72 weeks of roadmap on day one.
 *
 * Route weeks are ISO weeks (Monday–Sunday, see `isoWeekKey`), so Saturday is
 * day 6 and a week's unlock date is simply its Monday minus two days. That is
 * the whole rule; it needs no plan-relative counting and no knowledge of how
 * many weeks there are.
 *
 * Pure and date-driven on purpose: nothing is stored, so there is no unlock
 * state to get out of step with the plan when a missed day shifts it forward.
 * A learner who comes back after a month finds everything up to that point
 * already open, because those Saturdays are in the past.
 */
import { addDays, weekdayOf, type IsoDate } from '../scheduler/dates.ts';

export interface WeekLock {
  locked: boolean;
  /** When it opens. null for the first week, which is never locked. */
  unlocksOn: IsoDate | null;
}

/**
 * The Saturday of the week before `weekStart`.
 *
 * `weekStart` is an ISO week's Monday, so this is just two days earlier. It is
 * asserted rather than assumed: a non-Monday would silently shift every
 * unlock date by a day or two.
 */
export function unlockDateFor(weekStart: IsoDate): IsoDate {
  const saturday = addDays(weekStart, -2);
  if (weekdayOf(saturday) !== 'sat') {
    // Belt and braces. If grouping ever stops using ISO weeks, fail loudly
    // here rather than quietly unlocking weeks on a Thursday.
    throw new RangeError(
      `week start ${weekStart} is not a Monday (gives ${saturday}, a ${weekdayOf(saturday)})`,
    );
  }
  return saturday;
}

export function weekLock(input: {
  weekStart: IsoDate;
  /** True for the earliest week of the plan. */
  isFirst: boolean;
  today: IsoDate;
}): WeekLock {
  if (input.isFirst) return { locked: false, unlocksOn: null };
  const unlocksOn = unlockDateFor(input.weekStart);
  return { locked: input.today < unlocksOn, unlocksOn };
}

/** How many weeks of a route are open today. Useful for a summary line. */
export function unlockedCount(weekStarts: IsoDate[], today: IsoDate): number {
  return weekStarts.filter((start, i) => !weekLock({ weekStart: start, isFirst: i === 0, today }).locked)
    .length;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Unlocks Sat 18 Oct" — what the lock row says. */
export function describeUnlock(unlocksOn: IsoDate): string {
  const [, month, day] = unlocksOn.split('-');
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `Unlocks Sat ${Number(day)} ${monthName}`;
}
