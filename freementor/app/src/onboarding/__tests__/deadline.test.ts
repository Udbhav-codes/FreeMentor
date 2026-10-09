import { describe, expect, it } from 'vitest';
import { deadlineAdvice, formatMinutes, presetDeadlines } from '../deadline.ts';

const TODAY = '2026-10-08';

describe('deadline calculator', () => {
  it('reproduces the worked example from the product plan', () => {
    // NEET UG, ~740 h, in 10 months -> the plan quotes "about 2 h 25 m" a day.
    // 8 Oct 2026 -> 8 Aug 2027 is 304 days: 740 x 60 / 304 = 147 min. The
    // plan's figure is a round number, so assert we land within a few minutes
    // of it rather than inventing false precision.
    const advice = deadlineAdvice({
      estimatedHours: 740,
      today: TODAY,
      deadline: '2027-08-08',
      weeklyMinutes: 7 * 145,
    })!;
    expect(advice.daysLeft).toBe(304);
    expect(advice.requiredMinutesPerDay).toBeGreaterThanOrEqual(145);
    expect(advice.requiredMinutesPerDay).toBeLessThanOrEqual(150);
    expect(formatMinutes(advice.requiredMinutesPerDay)).toBe('2 h 27 m');
  });

  it('says you are on track when you have set enough time', () => {
    const advice = deadlineAdvice({
      estimatedHours: 100,
      today: TODAY,
      deadline: '2027-10-08',
      weeklyMinutes: 7 * 60,
    })!;
    expect(advice.onTrack).toBe(true);
    expect(advice.shortfallMinutesPerDay).toBe(0);
  });

  it('reports the shortfall when you have not', () => {
    const advice = deadlineAdvice({
      estimatedHours: 700,
      today: TODAY,
      deadline: '2026-12-08',
      weeklyMinutes: 7 * 60,
    })!;
    expect(advice.onTrack).toBe(false);
    expect(advice.shortfallMinutesPerDay).toBeGreaterThan(0);
    expect(advice.requiredMinutesPerDay).toBe(
      advice.plannedMinutesPerDay + advice.shortfallMinutesPerDay,
    );
  });

  it('returns nothing for a deadline that is today or past', () => {
    const args = { estimatedHours: 100, today: TODAY, weeklyMinutes: 600 };
    expect(deadlineAdvice({ ...args, deadline: TODAY })).toBeNull();
    expect(deadlineAdvice({ ...args, deadline: '2026-01-01' })).toBeNull();
  });

  it('rounds the requirement UP — never understates the work', () => {
    // 10 h over 3 days = 200 min/day exactly; 10 h over 7 days = 85.7 -> 86.
    expect(
      deadlineAdvice({ estimatedHours: 10, today: TODAY, deadline: '2026-10-15', weeklyMinutes: 0 })!
        .requiredMinutesPerDay,
    ).toBe(86);
  });
});

describe('formatMinutes', () => {
  it.each([
    [0, '0 m'],
    [45, '45 m'],
    [60, '1 h'],
    [145, '2 h 25 m'],
    [180, '3 h'],
  ])('formats %s as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe('preset deadlines', () => {
  it('offers 1, 3, 6 and 12 months out', () => {
    const presets = presetDeadlines(TODAY);
    expect(presets.map((p) => p.label)).toEqual(['1 month', '3 months', '6 months', '12 months']);
    expect(presets[0]!.date).toBe('2026-11-08');
    expect(presets[3]!.date).toBe('2027-10-08');
  });
});
