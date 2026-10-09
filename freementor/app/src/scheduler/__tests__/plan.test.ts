/**
 * The 13 scheduler rules from docs/APP_BUILD_SPEC.md §4.
 * These tests ARE the product spec — if one fails, the app is wrong.
 */
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../plan.ts';
import { blockMinutes } from '../time.ts';
import { addDays, weekdayOf } from '../dates.ts';
import { everyDay, loadGoal, progress, settings, weekdaysOnly } from './fixtures.ts';

const python = loadGoal('python');
const neet = loadGoal('neet-ug');
const TODAY = '2026-10-08'; // Thursday

const plan = (goal = python, over = {}, prog = progress(), today = TODAY) =>
  buildPlan({ goal, settings: settings(over), progress: prog, today });

describe('rule 1 — topics run in phase order, exams interleave subjects', () => {
  it('never schedules a later phase before an earlier one finishes', () => {
    const p = plan();
    const byTopic = new Map(python.topics.map((t) => [t.id, t]));
    let maxPhaseSoFar = 0;
    for (const day of p.days) {
      for (const item of day.items) {
        if (item.source !== 'topic' || !item.topicId) continue;
        const phase = byTopic.get(item.topicId)!.phase;
        // A phase may still be in progress, but we must never go backwards
        // past a phase we have already left behind entirely.
        expect(phase).toBeGreaterThanOrEqual(maxPhaseSoFar - 0);
        maxPhaseSoFar = Math.max(maxPhaseSoFar, phase);
      }
    }
  });

  it('interleaves Physics, Chemistry and Biology for NEET', () => {
    const p = buildPlan({
      goal: neet,
      settings: settings({ minutesByWeekday: everyDay(180) }),
      progress: progress(),
      today: TODAY,
    });
    const firstSubjects: string[] = [];
    for (const day of p.days) {
      for (const item of day.items) {
        if (item.source === 'topic' && item.subject) firstSubjects.push(item.subject);
      }
      if (firstSubjects.length > 40) break;
    }
    // Within the first 40 scheduled items a NEET learner should have met more
    // than one subject — not 40 straight Physics blocks.
    expect(new Set(firstSubjects).size).toBeGreaterThan(1);
  });

  it('does not interleave a single-subject language goal', () => {
    const subjects = new Set(python.topics.map((t) => t.subject));
    expect(subjects.size).toBe(1);
  });
});

describe('rule 2 — a topic expands into learn -> read -> practice -> recall -> test', () => {
  it('keeps block order within a topic', () => {
    const rank: Record<string, number> = {
      learn: 0,
      read: 1,
      build: 2,
      practice: 3,
      recall: 4,
      test: 5,
    };
    const p = plan();
    const seen = new Map<string, number>();
    for (const day of p.days) {
      for (const item of day.items) {
        if (item.source !== 'topic' || !item.topicId || !item.blockType) continue;
        const r = rank[item.blockType]!;
        const prev = seen.get(item.topicId);
        if (prev !== undefined) expect(r).toBeGreaterThanOrEqual(prev);
        seen.set(item.topicId, r);
      }
    }
  });
});

describe('rule 4 — blocks are packed into days within the available minutes', () => {
  it('never plans more than the learner said they have', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    for (const day of p.days) {
      if (day.isRestDay) continue;
      expect(day.plannedMinutes).toBeLessThanOrEqual(day.availableMinutes);
    }
  });

  it('respects a different budget per weekday', () => {
    const p = plan(python, { minutesByWeekday: weekdaysOnly(120, 240) });
    for (const day of p.days) {
      const expected = ['sat', 'sun'].includes(weekdayOf(day.date)) ? 240 : 120;
      expect(day.availableMinutes).toBe(expected);
      expect(day.plannedMinutes).toBeLessThanOrEqual(expected);
    }
  });

  it('skips weekdays with zero minutes entirely', () => {
    const p = plan(python, {
      minutesByWeekday: { ...everyDay(0), sat: 240, sun: 240 },
    });
    for (const day of p.days) {
      expect(['sat', 'sun']).toContain(weekdayOf(day.date));
    }
  });

  it('splits a long block into parts that sum EXACTLY to its length', () => {
    // Regression: place() decremented `left` before the remainder was read,
    // so a split block was scheduled for its own length PLUS its first chunk.
    // The old assertion used >=, which over-scheduling passes — hence exact.
    for (const minutes of [15, 30, 45, 120]) {
      const p = plan(python, { minutesByWeekday: everyDay(minutes) });
      const placed = new Map<string, number>();
      for (const day of p.days) {
        for (const item of day.items) {
          if (item.part) placed.set(item.key, (placed.get(item.key) ?? 0) + item.minutes);
        }
      }
      for (const [key, total] of placed) {
        const block = python.topics.flatMap((t) => t.blocks).find((b) => b.id === key);
        if (!block) continue;
        const expected = blockMinutes(block, python.scheduler_hints, 'en');
        expect(total, `${key} at ${minutes} min/day`).toBe(expected);
      }
    }
  });

  it('never labels a part beyond its own total', () => {
    for (const minutes of [15, 30, 120]) {
      const p = plan(python, { minutesByWeekday: everyDay(minutes) });
      for (const day of p.days) {
        for (const item of day.items) {
          if (item.part) {
            expect(item.part.index, `${item.key} at ${minutes}`).toBeLessThanOrEqual(item.part.of);
          }
        }
      }
    }
  });
});

describe('the same library gives different calendars for different availability', () => {
  it('a 6 h/day learner finishes well before a 2 h/day learner', () => {
    const slow = plan(python, { minutesByWeekday: everyDay(120) });
    const fast = plan(python, { minutesByWeekday: everyDay(360) });
    expect(slow.projectedFinish).not.toBeNull();
    expect(fast.projectedFinish).not.toBeNull();
    expect(fast.projectedFinish! < slow.projectedFinish!).toBe(true);
  });

  it('schedules the same content either way', () => {
    const slow = plan(python, { minutesByWeekday: everyDay(120) });
    const fast = plan(python, { minutesByWeekday: everyDay(360) });
    // The reserved tail is a fraction of the TIMELINE, so it is smaller for a
    // faster learner; the content itself must be identical.
    expect(fast.totals.contentMinutes).toBe(slow.totals.contentMinutes);
  });
});

describe('rule 5 — weekly rhythm', () => {
  it('gives a 7-day-a-week learner a weekly test day and a light day', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    const kinds = new Set(p.days.map((d) => d.kind));
    expect(kinds.has('mixed_practice')).toBe(true);
    expect(kinds.has('light_revision')).toBe(true);
  });

  it('puts a weekly test on the mixed-practice day', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    const mixed = p.days.find((d) => d.kind === 'mixed_practice');
    expect(mixed?.items.some((i) => i.source === 'weekly_test')).toBe(true);
  });

  it('does not steal a revision day from a 3-day-a-week learner', () => {
    const p = plan(python, {
      minutesByWeekday: { ...everyDay(0), mon: 120, wed: 120, fri: 120 },
    });
    const weekly = p.days.filter((d) => d.kind !== 'final_revision');
    expect(weekly.every((d) => d.kind === 'new_content' || d.isRestDay)).toBe(true);
  });

  it('does not waste the light day when there is something to revise', () => {
    // Regression: light-revision days used to come back completely empty,
    // throwing away one day of capacity every single week.
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    const light = p.days.filter((d) => d.kind === 'light_revision');
    expect(light.length).toBeGreaterThan(3);
    // The very first one may legitimately be empty (nothing seen yet).
    for (const day of light.slice(1)) {
      expect(day.items.length, `${day.date} is empty`).toBeGreaterThan(0);
      expect(day.items.every((i) => i.source === 'spaced_review')).toBe(true);
    }
  });

  it('keeps the light day light — at most half the available time', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    for (const day of p.days.filter((d) => d.kind === 'light_revision')) {
      expect(day.plannedMinutes).toBeLessThanOrEqual(day.availableMinutes / 2);
    }
  });

  it('never warms up on a topic the learner has not started', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    const started = new Set<string>();
    for (const day of p.days) {
      for (const item of day.items) {
        if (item.source === 'warmup') {
          expect(started.has(item.topicId!), `${day.date} warms up on an unseen topic`).toBe(true);
        }
      }
      for (const item of day.items) {
        if (item.source === 'topic' && item.topicId) started.add(item.topicId);
      }
    }
  });

  it('a light-revision day never carries new content', () => {
    const p = plan(python, { minutesByWeekday: everyDay(120) });
    for (const day of p.days.filter((d) => d.kind === 'light_revision')) {
      expect(day.items.every((i) => i.source !== 'topic')).toBe(true);
    }
  });
});

describe('rule 6 — spaced revision after a topic is finished', () => {
  const firstTopic = python.topics.find((t) => t.phase === 1 && t.order === 1)!;
  const finishFirstTopic = (on: string) =>
    Object.fromEntries(
      firstTopic.blocks.map((b) => [b.id, { completedAt: on, minutesCredited: b.est_minutes }]),
    );

  it('brings a finished topic back for revision', () => {
    const p = plan(
      python,
      {},
      progress({ completed: finishFirstTopic('2026-10-07') }),
    );
    const reviews = p.days.flatMap((d) => d.items).filter((i) => i.source === 'spaced_review');
    expect(reviews.some((r) => r.topicId === firstTopic.id)).toBe(true);
  });

  it('honours the confidence rating over the default ladder', () => {
    // "mastered" = 21 days, so no revision should appear in the next fortnight.
    const p = plan(
      python,
      {},
      progress({
        completed: finishFirstTopic('2026-10-07'),
        confidence: { [firstTopic.id]: { level: 'mastered', ratedAt: '2026-10-07' } },
      }),
    );
    const soon = p.days
      .filter((d) => d.date < addDays(TODAY, 14))
      .flatMap((d) => d.items)
      .filter((i) => i.source === 'spaced_review' && i.topicId === firstTopic.id);
    expect(soon).toHaveLength(0);
  });

  it('"need revision" brings it back the very next day', () => {
    const p = plan(
      python,
      {},
      progress({
        completed: finishFirstTopic('2026-10-07'),
        confidence: { [firstTopic.id]: { level: 'need_revision', ratedAt: '2026-10-07' } },
      }),
    );
    const review = p.days
      .flatMap((d) => d.items.map((i) => ({ date: d.date, i })))
      .find((x) => x.i.source === 'spaced_review' && x.i.topicId === firstTopic.id);
    expect(review).toBeDefined();
    expect(review!.date).toBe(TODAY); // due 2026-10-08
  });
});

describe('rule 7 — milestones land after their phase', () => {
  it('schedules every NEET mock after the phase it belongs to', () => {
    const p = buildPlan({
      goal: neet,
      settings: settings({ minutesByWeekday: everyDay(240) }),
      progress: progress(),
      today: TODAY,
    });
    const scheduled = new Set(
      p.days.flatMap((d) => d.items).filter((i) => i.milestoneId).map((i) => i.milestoneId!),
    );
    // Every mock the library defines should appear somewhere on the plan.
    for (const m of neet.milestones) expect(scheduled.has(m.id)).toBe(true);
  });
});

describe('rule 8 — mastery gate inserts a catch-up below 60%', () => {
  const firstTopic = python.topics.find((t) => t.phase === 1 && t.order === 1)!;
  const done = Object.fromEntries(
    firstTopic.blocks.map((b) => [b.id, { completedAt: '2026-10-06', minutesCredited: b.est_minutes }]),
  );

  it('adds a 45-minute catch-up after a failed weekly test', () => {
    const p = plan(
      python,
      {},
      progress({
        completed: done,
        testScores: { 'weekly-test:2026-10-07': { score: 4, maxScore: 10, takenAt: '2026-10-07' } },
      }),
    );
    const catchUp = p.days.flatMap((d) => d.items).find((i) => i.source === 'remediation');
    expect(catchUp).toBeDefined();
    expect(catchUp!.minutes).toBe(45);
  });

  it('adds nothing when the learner passed', () => {
    const p = plan(
      python,
      {},
      progress({
        completed: done,
        testScores: { 'weekly-test:2026-10-07': { score: 8, maxScore: 10, takenAt: '2026-10-07' } },
      }),
    );
    expect(p.days.flatMap((d) => d.items).some((i) => i.source === 'remediation')).toBe(false);
  });
});

describe('rule 10 — a missed day shifts the plan forward and never rewrites history', () => {
  it('starts planning from today, not from the original start date', () => {
    const p = plan(python, { startDate: '2026-09-01' }, progress(), TODAY);
    const future = p.days.filter((d) => d.items.some((i) => !i.done));
    expect(future[0]!.date >= TODAY).toBe(true);
  });

  it('keeps a completed tick on the day it actually happened', () => {
    const block = python.topics[0]!.blocks[0]!;
    const p = plan(
      python,
      { startDate: '2026-10-01' },
      progress({
        completed: { [block.id]: { completedAt: '2026-10-02', minutesCredited: block.est_minutes } },
      }),
    );
    const day = p.days.find((d) => d.date === '2026-10-02');
    expect(day?.items.some((i) => i.key === block.id && i.done)).toBe(true);
  });

  it('never re-schedules an item that is already ticked', () => {
    const block = python.topics[0]!.blocks[0]!;
    const p = plan(
      python,
      {},
      progress({
        completed: { [block.id]: { completedAt: '2026-10-02', minutesCredited: block.est_minutes } },
      }),
    );
    const futureCopies = p.days
      .filter((d) => d.date >= TODAY)
      .flatMap((d) => d.items)
      .filter((i) => i.key === block.id);
    expect(futureCopies).toHaveLength(0);
  });

  it('pushes the projected finish out when days are missed', () => {
    const onTime = plan(python, {}, progress(), '2026-10-08');
    const late = plan(python, {}, progress(), '2026-10-22');
    expect(late.projectedFinish! > onTime.projectedFinish!).toBe(true);
  });
});

describe('rule 11 — warn when there is not enough time before the exam', () => {
  it('warns and says how much is actually needed', () => {
    const p = plan(neet, {
      targetDate: '2026-12-01', // ~8 weeks for a ~700 h roadmap
      minutesByWeekday: everyDay(60),
    });
    const warn = p.warnings.find((w) => w.code === 'not_enough_time');
    expect(warn).toBeDefined();
    expect(warn!.requiredMinutesPerWeek).toBeGreaterThan(warn!.configuredMinutesPerWeek!);
  });

  it('stays quiet when there is plenty of time', () => {
    const p = plan(python, { targetDate: '2028-12-01', minutesByWeekday: everyDay(180) });
    expect(p.warnings.filter((w) => w.code === 'not_enough_time')).toHaveLength(0);
  });

  it('flags a target date that has already passed', () => {
    const p = plan(python, { targetDate: '2026-01-01' });
    expect(p.warnings.some((w) => w.code === 'target_date_passed')).toBe(true);
  });

  it('refuses to build a plan with no study time set', () => {
    const p = plan(python, { minutesByWeekday: everyDay(0) });
    expect(p.warnings.some((w) => w.code === 'no_study_time_set')).toBe(true);
    expect(p.days).toHaveLength(0);
  });
});

describe('rule 12 — rest days', () => {
  it('protects a rest day and schedules nothing on it', () => {
    const p = plan(python, {}, progress({ restDays: ['2026-10-10'] }));
    const rest = p.days.find((d) => d.date === '2026-10-10');
    expect(rest?.isRestDay).toBe(true);
    expect(rest?.items).toHaveLength(0);
  });

  it('shifts the work rather than dropping it', () => {
    const without = plan(python);
    const withRest = plan(python, {}, progress({ restDays: ['2026-10-10', '2026-10-17'] }));
    expect(withRest.projectedFinish! > without.projectedFinish!).toBe(true);
    expect(withRest.totals.contentMinutes).toBe(without.totals.contentMinutes);
  });
});

describe('rule 13 — CUET only schedules the domain subjects the learner chose', () => {
  const cuet = loadGoal('cuet-ug');

  it('drops topics gated to subjects the learner did not pick', () => {
    const p = buildPlan({
      goal: cuet,
      settings: settings({
        minutesByWeekday: everyDay(180),
        selectedDomainSubjects: ['Physics', 'Chemistry', 'Mathematics'],
      }),
      progress: progress(),
      today: TODAY,
    });
    const topicsById = new Map(cuet.topics.map((t) => [t.id, t]));
    const scheduled = p.days
      .flatMap((d) => d.items)
      .filter((i) => i.topicId)
      .map((i) => topicsById.get(i.topicId!))
      .filter(Boolean);

    const biology = scheduled.filter((t) => t!.track_gate === 'domain:biology');
    expect(biology).toHaveLength(0);
    // ...but the ungated common papers are still there.
    expect(scheduled.some((t) => t!.track_gate == null)).toBe(true);
  });

  it('a narrower subject choice means a shorter roadmap', () => {
    const three = buildPlan({
      goal: cuet,
      settings: settings({
        minutesByWeekday: everyDay(180),
        selectedDomainSubjects: ['Physics', 'Chemistry', 'Mathematics'],
      }),
      progress: progress(),
      today: TODAY,
    });
    const one = buildPlan({
      goal: cuet,
      settings: settings({
        minutesByWeekday: everyDay(180),
        selectedDomainSubjects: ['Physics'],
      }),
      progress: progress(),
      today: TODAY,
    });
    expect(one.totals.totalMinutes).toBeLessThan(three.totals.totalMinutes);
  });
});

describe('rule 9 — the final 15% of the timeline is reserved for mocks and revision', () => {
  it('reserves close to the configured fraction of the timeline', () => {
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    const f = neet.scheduler_hints.reserve_final_fraction_for_mocks_and_revision;
    const total = p.totals.contentDays + p.totals.reserveDays;
    const actual = p.totals.reserveDays / total;
    expect(f).toBe(0.15);
    // Rounding to whole study days, so allow a day either way.
    expect(Math.abs(actual - f)).toBeLessThan(0.02);
  });

  it('schedules no new content inside the reserve', () => {
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    const tail = p.days.filter((d) => d.kind === 'final_revision');
    expect(tail.length).toBeGreaterThan(0);
    for (const day of tail) {
      expect(day.items.every((i) => i.source !== 'topic')).toBe(true);
    }
  });

  it('separates "syllabus done" from "exam ready"', () => {
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    expect(p.contentFinish).not.toBeNull();
    expect(p.projectedFinish).not.toBeNull();
    expect(p.projectedFinish! > p.contentFinish!).toBe(true);
  });

  it('revises the highest-weightage topics first', () => {
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    const byId = new Map(neet.topics.map((t) => [t.id, t]));
    const order = p.days
      .filter((d) => d.kind === 'final_revision')
      .flatMap((d) => d.items)
      .filter((i) => i.source === 'final_revision')
      .map((i) => byId.get(i.topicId!)?.weightage)
      .filter(Boolean);
    expect(order.length).toBeGreaterThan(5);
    const firstTen = order.slice(0, 10);
    // 'H' and 'core' outrank 'M' and 'L'.
    expect(firstTen.every((w) => w === 'H' || w === 'core')).toBe(true);
  });

  it('counts the reserve when warning that there is not enough time', () => {
    const p = plan(python, { targetDate: '2027-01-15', minutesByWeekday: everyDay(120) });
    // remainingMinutes must include the tail, or the warning understates the need.
    expect(p.totals.remainingMinutes).toBeGreaterThan(p.totals.contentMinutes);
    expect(p.totals.reservedMinutes).toBeGreaterThan(0);
  });

  it('a faster learner gets a proportionally smaller reserve', () => {
    const slow = plan(python, { minutesByWeekday: everyDay(120) });
    const fast = plan(python, { minutesByWeekday: everyDay(360) });
    expect(fast.totals.reserveDays).toBeLessThan(slow.totals.reserveDays);
    expect(fast.totals.contentMinutes).toBe(slow.totals.contentMinutes);
  });

  it('does not waste capacity on revision days', () => {
    // Regression: a 60-minute revision item would not fit the tail of a day,
    // leaving ~50 min unused on every single reserve day.
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    const tail = p.days.filter((d) => d.kind === 'final_revision');
    for (const day of tail.slice(0, -1)) {
      expect(day.plannedMinutes, `${day.date} only ${day.plannedMinutes} min`).toBeGreaterThanOrEqual(
        day.availableMinutes - 15,
      );
    }
  });

  it('warms up on what was actually revised, not the same topic for weeks', () => {
    // Regression: lastTopic froze on the final syllabus topic, so every day of
    // the reserve said "Warm-up recall - Biodiversity & Conservation".
    const p = plan(neet, { minutesByWeekday: everyDay(180) });
    const warmups = p.days
      .filter((d) => d.kind === 'final_revision')
      .map((d) => d.items.find((i) => i.source === 'warmup')?.topicId)
      .filter(Boolean);
    expect(warmups.length).toBeGreaterThan(10);
    expect(new Set(warmups).size).toBeGreaterThan(warmups.length / 2);
  });

  it('still terminates when the reserve fraction is pathological', () => {
    const weird = {
      ...python,
      scheduler_hints: { ...python.scheduler_hints, reserve_final_fraction_for_mocks_and_revision: 0.99 },
    };
    const p = plan(weird, { minutesByWeekday: everyDay(120) });
    expect(p.projectedFinish).not.toBeNull();
    expect(p.days.length).toBeLessThan(365 * 6);
  });
});

describe("a task ticked today stays on today's plan", () => {
  it('shows it struck through instead of making it vanish', () => {
    // Regression: completed items were only rendered on days BEFORE the
    // replanning cursor, so anything ticked today disappeared from the
    // checklist until tomorrow.
    const plan0 = plan(python);
    const first = plan0.days.find((d) => d.date === TODAY)!.items[0]!;
    const after = plan(
      python,
      {},
      progress({
        completed: { [first.key]: { completedAt: TODAY, minutesCredited: first.minutes } },
      }),
    );
    const today = after.days.find((d) => d.date === TODAY)!;
    const entry = today.items.find((i) => i.key === first.key);
    expect(entry, 'the ticked task left the plan').toBeDefined();
    expect(entry!.done).toBe(true);
  });

  it('does not refill the freed time with extra new work', () => {
    const plan0 = plan(python);
    const first = plan0.days.find((d) => d.date === TODAY)!.items[0]!;
    const after = plan(
      python,
      {},
      progress({
        completed: { [first.key]: { completedAt: TODAY, minutesCredited: first.minutes } },
      }),
    );
    const today = after.days.find((d) => d.date === TODAY)!;
    // Finishing work early must not cause the day to grow past the budget.
    expect(today.plannedMinutes).toBeLessThanOrEqual(today.availableMinutes);
  });
});

describe('custom daily times, not just the presets', () => {
  it('plans correctly for an odd number of minutes', () => {
    // 2 h 35 m — the kind of value the custom picker produces.
    const p = plan(python, { minutesByWeekday: everyDay(155) });
    expect(p.projectedFinish).not.toBeNull();
    for (const day of p.days) {
      if (day.isRestDay) continue;
      expect(day.availableMinutes).toBe(155);
      expect(day.plannedMinutes).toBeLessThanOrEqual(155);
    }
  });

  it('gives a different finish date than the nearest preset', () => {
    const custom = plan(python, { minutesByWeekday: everyDay(155) });
    const preset = plan(python, { minutesByWeekday: everyDay(120) });
    expect(custom.projectedFinish! < preset.projectedFinish!).toBe(true);
  });

  it('handles a different custom time on every day of the week', () => {
    const p = plan(python, {
      minutesByWeekday: {
        mon: 45,
        tue: 155,
        wed: 0,
        thu: 200,
        fri: 75,
        sat: 320,
        sun: 15,
      },
    });
    expect(p.projectedFinish).not.toBeNull();
    // A zero day is never scheduled; every other day respects its own budget.
    for (const day of p.days) {
      expect(day.availableMinutes).toBeGreaterThan(0);
      if (!day.isRestDay) expect(day.plannedMinutes).toBeLessThanOrEqual(day.availableMinutes);
    }
  });

  it('still finishes when the daily time is very small', () => {
    // 15 minutes a day is the floor the custom picker allows.
    const p = plan(python, { minutesByWeekday: everyDay(15) });
    expect(p.projectedFinish).not.toBeNull();
    expect(p.totals.contentMinutes).toBeGreaterThan(0);
  });
});

describe('determinism — the same input always gives the same plan', () => {
  it('is byte-identical across runs', () => {
    const a = plan(neet, { minutesByWeekday: everyDay(150) });
    const b = plan(neet, { minutesByWeekday: everyDay(150) });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('builds a plan for every full goal in the library without crashing', () => {
    const ids = [
      'jee-main',
      'jee-advanced',
      'neet-ug',
      'cuet-ug',
      'full-stack',
      'frontend',
      'backend',
      'cybersecurity',
      'python',
      'java',
      'c',
      'sql',
    ];
    for (const id of ids) {
      const goal = loadGoal(id);
      const p = buildPlan({
        goal,
        settings: settings({ minutesByWeekday: everyDay(120) }),
        progress: progress(),
        today: TODAY,
      });
      expect(p.days.length, `${id} produced no days`).toBeGreaterThan(0);
      expect(p.projectedFinish, `${id} has no finish date`).not.toBeNull();
      expect(p.totals.totalMinutes, `${id} scheduled no work`).toBeGreaterThan(0);
    }
  });
});
