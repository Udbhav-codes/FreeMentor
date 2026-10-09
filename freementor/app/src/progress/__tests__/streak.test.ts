/**
 * Streak rules — product plan decision #14, #15 and §8.8.
 * The forgiving behaviour is the point; these tests pin it down.
 */
import { describe, expect, it } from 'vitest';
import {
  computeStreak,
  consistency,
  nextMilestone,
  restDayBlockedReason,
} from '../streak.ts';

const TODAY = '2026-10-08'; // Thursday
const streak = (studyDates: string[], restDays: string[] = [], today = TODAY) =>
  computeStreak({ studyDates, restDays, today });

describe('counting', () => {
  it('is zero with no study at all', () => {
    const s = streak([]);
    expect(s.current).toBe(0);
    expect(s.best).toBe(0);
    expect(s.lastStudyDate).toBeNull();
  });

  it('counts consecutive days ending today', () => {
    expect(streak(['2026-10-06', '2026-10-07', '2026-10-08']).current).toBe(3);
  });

  it('counts a run that ended yesterday — today is not over yet', () => {
    // Not studying *yet* today must not wipe the streak at 00:01.
    expect(streak(['2026-10-05', '2026-10-06', '2026-10-07']).current).toBe(3);
  });

  it('ignores days after today', () => {
    expect(streak(['2026-10-08', '2026-10-09']).current).toBe(1);
  });
});

describe('the one-day grace', () => {
  it('forgives a single missed day', () => {
    // Missed the 6th, studied either side.
    const s = streak(['2026-10-05', '2026-10-07', '2026-10-08']);
    expect(s.current).toBe(3);
    expect(s.graceUsedOn).toBe('2026-10-06');
  });

  it('breaks on two consecutive missed days', () => {
    // Missed the 5th and 6th.
    expect(streak(['2026-10-04', '2026-10-07', '2026-10-08']).current).toBe(2);
  });

  it('only forgives once per run', () => {
    // Gaps on the 3rd and the 6th: the older gap ends the run.
    const s = streak(['2026-10-02', '2026-10-04', '2026-10-05', '2026-10-07', '2026-10-08']);
    expect(s.current).toBe(4);
  });

  it('does not count the forgiven day towards the streak', () => {
    const s = streak(['2026-10-07', '2026-10-08']);
    expect(s.current).toBe(2);
  });
});

describe('rest days', () => {
  it('protects the streak without incrementing it', () => {
    // Studied 5th, 6th, rested 7th, studied 8th.
    const s = streak(['2026-10-05', '2026-10-06', '2026-10-08'], ['2026-10-07']);
    expect(s.current).toBe(3); // three studied days, the rest day bridges them
    expect(s.graceUsedOn).toBeNull(); // grace untouched — the rest day covered it
  });

  it('leaves the grace available after a rest day', () => {
    // Rest on the 7th, missed the 5th: both absorbed.
    const s = streak(['2026-10-03', '2026-10-04', '2026-10-06', '2026-10-08'], ['2026-10-07']);
    expect(s.current).toBe(4);
  });

  it('several rest days in a row still do not break it', () => {
    const s = streak(['2026-10-04', '2026-10-08'], ['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(s.current).toBe(2);
  });
});

describe('best streak', () => {
  it('remembers a longer past run', () => {
    const past = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const s = streak([...past, '2026-10-08']);
    expect(s.current).toBe(1);
    expect(s.best).toBe(5);
  });

  it('never reports a best lower than the current run', () => {
    const s = streak(['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(s.best).toBeGreaterThanOrEqual(s.current);
  });
});

describe('habit counter', () => {
  it('counts total days studied, not the run', () => {
    const s = streak(['2026-01-05', '2026-05-05', '2026-10-07', '2026-10-08']);
    expect(s.habitDays).toBe(4);
    expect(s.current).toBe(2);
  });
});

describe('milestones', () => {
  it.each([
    [0, 3],
    [3, 7],
    [7, 14],
    [30, 66],
    [66, 100],
    [100, null],
  ])('after %s days the next badge is %s', (current, expected) => {
    expect(nextMilestone(current)).toBe(expected);
  });
});

describe('rest-day limits (1 per week, 4 per month)', () => {
  it('allows the first rest day of the week', () => {
    expect(restDayBlockedReason('2026-10-08', [])).toBeNull();
  });

  it('blocks a second rest day in the same week', () => {
    // 2026-10-06 (Tue) and 2026-10-08 (Thu) are the same ISO week.
    expect(restDayBlockedReason('2026-10-08', ['2026-10-06'])).toMatch(/this week/);
  });

  it('allows one in each of two different weeks', () => {
    expect(restDayBlockedReason('2026-10-15', ['2026-10-06'])).toBeNull();
  });

  it('blocks a fifth rest day in the same month', () => {
    const four = ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22'];
    expect(restDayBlockedReason('2026-10-29', four)).toMatch(/this month/);
  });

  it('does not count the day itself when re-checking', () => {
    expect(restDayBlockedReason('2026-10-08', ['2026-10-08'])).toBeNull();
  });
});

describe('consistency window', () => {
  it('counts study days in the last 7 days', () => {
    const dates = ['2026-10-08', '2026-10-07', '2026-10-05', '2026-10-02'];
    expect(consistency(dates, TODAY)).toEqual({ studied: 4, of: 7 });
  });

  it('ignores anything older than the window', () => {
    expect(consistency(['2026-09-01'], TODAY)).toEqual({ studied: 0, of: 7 });
  });
});
