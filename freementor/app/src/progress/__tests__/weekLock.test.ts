/**
 * Only this week is open; each later week opens on the Saturday before it.
 */
import { describe, expect, it } from 'vitest';
import { describeUnlock, unlockDateFor, unlockedCount, weekLock } from '../weekLock.ts';

// Consecutive ISO Mondays.
const W1 = '2026-10-05';
const W2 = '2026-10-12';
const W3 = '2026-10-19';
const W4 = '2026-10-26';
const STARTS = [W1, W2, W3, W4];

const lock = (weekStart: string, today: string, isFirst = false) =>
  weekLock({ weekStart, isFirst, today });

describe('unlockDateFor', () => {
  it('is the Saturday of the previous week', () => {
    expect(unlockDateFor(W2)).toBe('2026-10-10');
    expect(unlockDateFor(W3)).toBe('2026-10-17');
  });

  it('refuses a week start that is not a Monday', () => {
    // Grouping uses ISO weeks; if that ever changes, every unlock date would
    // silently drift rather than fail.
    expect(() => unlockDateFor('2026-10-13')).toThrow(/not a Monday/);
  });
});

describe('the first week', () => {
  it('is never locked, even on day one', () => {
    expect(lock(W1, W1, true)).toEqual({ locked: false, unlocksOn: null });
  });
});

describe('the user\'s own example: a 5-week course', () => {
  it('shows week 1 and locks the rest on the Monday of week 1', () => {
    const today = W1;
    expect(lock(W1, today, true).locked).toBe(false);
    expect(lock(W2, today).locked).toBe(true);
    expect(lock(W3, today).locked).toBe(true);
    expect(lock(W4, today).locked).toBe(true);
    expect(unlockedCount(STARTS, today)).toBe(1);
  });

  it('unlocks week 2 on the Saturday of week 1 — and no more than that', () => {
    const saturday = '2026-10-10';
    expect(lock(W2, saturday).locked).toBe(false);
    expect(lock(W3, saturday).locked).toBe(true);
    expect(unlockedCount(STARTS, saturday)).toBe(2);
  });

  it('stays unlocked on the Sunday too', () => {
    // "when it's saturday or sunday of the 1st week then it unlocks the 2nd"
    expect(lock(W2, '2026-10-11').locked).toBe(false);
  });

  it('is still locked on the Friday, one day early', () => {
    expect(lock(W2, '2026-10-09').locked).toBe(true);
  });

  it('unlocks week 3 on the Saturday of week 2, not before', () => {
    expect(lock(W3, '2026-10-16').locked).toBe(true);
    expect(lock(W3, '2026-10-17').locked).toBe(false);
    expect(unlockedCount(STARTS, '2026-10-17')).toBe(3);
  });

  it('opens one more week per week, never two', () => {
    // The whole point: the roadmap is revealed a week at a time.
    const counts = ['2026-10-05', '2026-10-10', '2026-10-17', '2026-10-24'].map((d) =>
      unlockedCount(STARTS, d),
    );
    expect(counts).toEqual([1, 2, 3, 4]);
  });
});

describe('a learner who comes back after a long gap', () => {
  it('finds everything up to now already open', () => {
    // Those Saturdays are in the past, so nothing has to be "caught up".
    const today = '2026-12-01';
    expect(unlockedCount(STARTS, today)).toBe(4);
  });
});

describe('describeUnlock', () => {
  it('reads as a date a learner can act on', () => {
    expect(describeUnlock('2026-10-10')).toBe('Unlocks Sat 10 Oct');
    expect(describeUnlock('2026-01-03')).toBe('Unlocks Sat 3 Jan');
  });
});
