import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../scheduler/plan.ts';
import { everyDay, loadGoal, progress, settings } from '../../scheduler/__tests__/fixtures.ts';
import { weeklyReport } from '../weekly.ts';

const python = loadGoal('python');
const TODAY = '2026-10-08'; // Thursday; its week starts Monday 2026-10-05

const planFor = (prog = progress()) =>
  buildPlan({
    goal: python,
    settings: settings({ minutesByWeekday: everyDay(120) }),
    progress: prog,
    today: TODAY,
  });

describe('weekly report', () => {
  it('covers Monday to Sunday of the current week', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(r.weekStart).toBe('2026-10-05');
    expect(r.weekEnd).toBe('2026-10-11');
    expect(r.dailyMinutes).toHaveLength(7);
  });

  it('counts planned work even when nothing is done', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(r.plannedMinutes).toBeGreaterThan(0);
    expect(r.studiedMinutes).toBe(0);
    expect(r.tasksDone).toBe(0);
    expect(r.tasksPlanned).toBeGreaterThan(0);
  });

  it('credits a ticked task to the day it was done', () => {
    const plan = planFor();
    const first = plan.days.find((d) => d.date === TODAY)!.items[0]!;
    const prog = progress({
      completed: { [first.key]: { completedAt: TODAY, minutesCredited: first.minutes } },
    });
    const r = weeklyReport(planFor(prog), prog, TODAY);
    expect(r.tasksDone).toBe(1);
    expect(r.studiedMinutes).toBe(first.minutes);
  });

  it('derives the target line from the planned study days', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(r.targetMinutes).toBeGreaterThan(0);
    expect(r.targetMinutes).toBeLessThanOrEqual(120);
  });

  it('never reports more tasks done than were planned', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(r.tasksDone).toBeLessThanOrEqual(r.tasksPlanned);
  });
});

describe('the single recommendation', () => {
  it('always gives exactly one, and never an empty one', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(typeof r.recommendation).toBe('string');
    expect(r.recommendation.length).toBeGreaterThan(10);
  });

  it('points at a failing subject before anything else', () => {
    const scored = planFor()
      .days.flatMap((d) => d.items)
      .find((i) => i.subject)!;
    const prog = progress({
      testScores: { [scored.key]: { score: 3, maxScore: 10, takenAt: '2026-10-07' } },
    });
    const r = weeklyReport(planFor(prog), prog, TODAY);
    expect(r.subjectScores[0]!.percent).toBe(30);
    expect(r.recommendation).toMatch(/30 more minutes/);
  });

  it('suggests lowering the target when most tasks are missed', () => {
    const r = weeklyReport(planFor(), progress(), TODAY);
    expect(r.recommendation).toMatch(/lowering your daily target/);
  });
});

describe('the extra-effort highlight', () => {
  it('stays quiet when nothing notable happened', () => {
    expect(weeklyReport(planFor(), progress(), TODAY).highlight).toBeNull();
  });
});
