import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../scheduler/plan.ts';
import { everyDay, loadGoal, progress, settings } from '../../scheduler/__tests__/fixtures.ts';
import { badgesFor } from '../badges.ts';

const python = loadGoal('python');
const TODAY = '2026-10-08';

const planFor = (prog = progress()) =>
  buildPlan({
    goal: python,
    settings: settings({ minutesByWeekday: everyDay(120) }),
    progress: prog,
    today: TODAY,
  });

const byId = (prog = progress()) =>
  Object.fromEntries(badgesFor(planFor(prog), prog, TODAY).map((b) => [b.id, b]));

describe('badges', () => {
  it('starts with none earned', () => {
    const badges = badgesFor(planFor(), progress(), TODAY);
    expect(badges).toHaveLength(5);
    expect(badges.every((b) => !b.earned)).toBe(true);
    expect(badges.every((b) => b.progress === 0)).toBe(true);
  });

  it('awards the first week after seven distinct study days', () => {
    const dates = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ];
    const completed = Object.fromEntries(
      dates.map((d, i) => [`task-${i}`, { completedAt: d, minutesCredited: 30 }]),
    );
    expect(byId(progress({ completed }))['first-week']!.earned).toBe(true);
  });

  it('counts distinct days, not tasks — six tasks in one day is not a week', () => {
    const completed = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        `task-${i}`,
        { completedAt: '2026-10-07', minutesCredited: 30 },
      ]),
    );
    expect(byId(progress({ completed }))['first-week']!.earned).toBe(false);
  });

  it('awards 100 hours on ticked minutes', () => {
    const completed = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [
        `task-${i}`,
        { completedAt: '2026-10-07', minutesCredited: 60 },
      ]),
    );
    const badges = byId(progress({ completed }));
    expect(badges['hours-100']!.earned).toBe(true);
  });

  it('reports partial progress towards a target', () => {
    const completed = Object.fromEntries(
      ['2026-10-05', '2026-10-06', '2026-10-07'].map((d, i) => [
        `task-${i}`,
        { completedAt: d, minutesCredited: 30 },
      ]),
    );
    const week = byId(progress({ completed }))['first-week']!;
    expect(week.earned).toBe(false);
    expect(week.progress).toBeCloseTo(3 / 7, 5);
  });

  it('never clamps progress above 1', () => {
    const completed = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `task-${i}`,
        { completedAt: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, minutesCredited: 600 },
      ]),
    );
    for (const b of badgesFor(planFor(progress({ completed })), progress({ completed }), TODAY)) {
      expect(b.progress).toBeLessThanOrEqual(1);
    }
  });
});

describe('the YouTube policy constraint', () => {
  it('no badge is awarded for watching a video', () => {
    // Ticking ONLY the lesson blocks must not earn anything: badges reward
    // completed work and hours, never video consumption (§8.11).
    const plan = planFor();
    const learnItems = plan.days
      .flatMap((d) => d.items)
      .filter((i) => i.blockType === 'learn')
      .slice(0, 3);
    const completed = Object.fromEntries(
      learnItems.map((i) => [i.key, { completedAt: '2026-10-07', minutesCredited: i.minutes }]),
    );
    const badges = byId(progress({ completed }));
    expect(badges['first-mock']!.earned).toBe(false);
    expect(badges['first-project']!.earned).toBe(false);
    expect(badges['first-week']!.earned).toBe(false);
  });
});
