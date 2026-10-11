/**
 * The route's week grouping, and the lock rule applied to a real plan.
 *
 * Grouping used to live inside RouteList.tsx, where the suite could not load
 * it — so the ISO-week assumption that weekLock depends on was untested.
 */
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../scheduler/plan.ts';
import { everyDay, loadGoal, progress, settings } from '../../scheduler/__tests__/fixtures.ts';
import { groupIntoWeeks } from '../routeWeeks.ts';
import { unlockedCount, weekLock } from '../weekLock.ts';

const TODAY = '2026-10-12'; // a Monday
const plan = buildPlan({
  goal: loadGoal('python'),
  settings: settings({ minutesByWeekday: everyDay(120) }),
  progress: progress(),
  today: TODAY,
});
const weeks = groupIntoWeeks(plan.days, TODAY);
const starts = weeks.map((w) => w.startDate);

describe('grouping', () => {
  it('produces several weeks, in order, each starting on a Monday', () => {
    expect(weeks.length).toBeGreaterThan(5);
    for (const w of weeks) {
      // weekLock derives the unlock date from the Monday, so this is load
      // bearing rather than cosmetic.
      expect(new Date(`${w.startDate}T00:00:00Z`).getUTCDay(), w.startDate).toBe(1);
    }
    expect([...starts].sort()).toEqual(starts);
  });

  it('marks exactly one week as containing today', () => {
    expect(weeks.filter((w) => w.containsToday)).toHaveLength(1);
  });
});

describe('the lock, on a real plan', () => {
  it('opens only the current week on day one', () => {
    expect(unlockedCount(starts, TODAY)).toBe(1);
  });

  it('never locks the week the learner is actually in', () => {
    const index = weeks.findIndex((w) => w.containsToday);
    expect(
      weekLock({ weekStart: weeks[index]!.startDate, isFirst: index === 0, today: TODAY }).locked,
    ).toBe(false);
  });

  it('opens one more week each Saturday, in step', () => {
    // Sat of wk1, Sun, Mon of wk2, Sat of wk2 — 2, 2, 2, then 3.
    expect(unlockedCount(starts, '2026-10-17')).toBe(2);
    expect(unlockedCount(starts, '2026-10-18')).toBe(2);
    expect(unlockedCount(starts, '2026-10-19')).toBe(2);
    expect(unlockedCount(starts, '2026-10-24')).toBe(3);
  });

  it('is still locking something far into a long plan', () => {
    // The point of the feature: a 20-week roadmap is not handed over at once.
    expect(unlockedCount(starts, TODAY)).toBeLessThan(weeks.length);
  });
});
