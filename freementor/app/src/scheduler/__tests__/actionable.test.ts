/**
 * Nothing on a plan may be a dead end.
 *
 * If FreeMentor puts a task in front of a learner, that task must be
 * actionable: a link to open, recall questions to answer, or project criteria
 * to work against. The one exception is revision, which is legitimately
 * "sit with what you already have" — and which must say so, so the learner
 * knows the blank space is deliberate rather than broken.
 *
 * This caught a real one: the weekly test was synthesised by the scheduler
 * with no resources at all, yet asked the learner to enter a score. In
 * Cybersecurity that meant being asked to grade a test that did not exist.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../plan.ts';
import { indexGoal, resolveItem } from '../lookup.ts';
import { everyDay, loadGoal, progress, settings } from './fixtures.ts';
import type { PlannedItem } from '../types.ts';

// Read from the catalog rather than hardcoded: a 13th goal promoted to
// "full" must be covered by this rule automatically, not silently skipped
// because nobody remembered to extend a list here.
const CATALOG = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../../../library/FreeMentor_Library/catalog.json'),
    'utf8',
  ),
) as { goals: { id: string; status: string }[] };

const GOAL_IDS = CATALOG.goals.filter((g) => g.status === 'full').map((g) => g.id);

const TODAY = '2026-10-08';

describe('coverage', () => {
  it('found the full goals in the catalog at all', () => {
    // it.each([]) silently runs nothing, so an empty list would turn this
    // whole file into a no-op that still reports as passing.
    expect(GOAL_IDS.length).toBeGreaterThanOrEqual(12);
  });
});

/** Revision is allowed to have no link; everything else is not. */
const SELF_DIRECTED: PlannedItem['source'][] = ['spaced_review', 'final_revision', 'warmup'];

function plansFor(id: string) {
  const goal = loadGoal(id);
  const index = indexGoal(goal);
  // Two very different budgets: packing changes what lands on a day.
  return [60, 180].map((minutes) => ({
    goal,
    index,
    minutes,
    plan: buildPlan({
      goal,
      settings: settings({ minutesByWeekday: everyDay(minutes) }),
      progress: progress(),
      today: TODAY,
    }),
  }));
}

describe('every scored task has something to sit', () => {
  it.each(GOAL_IDS)('%s never asks for a score with no link', (id) => {
    const offenders: string[] = [];

    for (const { goal, index, minutes, plan } of plansFor(id)) {
      for (const day of plan.days) {
        for (const item of day.items) {
          if (!item.scoreEntry) continue;
          const resolved = resolveItem(item, goal, index, 'en');
          if (resolved.resources.length === 0) {
            offenders.push(`${minutes}min/day ${day.date} ${item.key} "${item.title}"`);
          }
        }
      }
    }

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('every task is actionable, or says it is self-directed', () => {
  it.each(GOAL_IDS)('%s has no dead-end tasks', (id) => {
    const offenders: string[] = [];

    for (const { goal, index, minutes, plan } of plansFor(id)) {
      for (const day of plan.days) {
        for (const item of day.items) {
          const r = resolveItem(item, goal, index, 'en');

          const hasLink = r.resources.length > 0;
          const hasQuestions = (r.topic?.recall?.length ?? 0) > 0 && r.block?.type === 'recall';
          const hasCriteria = (r.block?.done_when?.length ?? 0) > 0;
          const isSelfDirected = SELF_DIRECTED.includes(item.source);
          // A synthesised slot with no material must name itself as revision.
          const saysSelfRevision = /self-revision/i.test(item.title);

          if (!hasLink && !hasQuestions && !hasCriteria && !isSelfDirected && !saysSelfRevision) {
            offenders.push(`${minutes}min/day ${day.date} [${item.source}] "${item.title}"`);
          }
        }
      }
    }

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('no day is revision and nothing else', () => {
  // Reported from the app: "in every course in the first week it is showing
  // Light Revision and do not have anything as planned". The light day was
  // revision-only by design, which read as a day with nothing planned and
  // left most of the learner's committed time unused.
  //
  // The reserved tail is exempt: by then the syllabus is finished and
  // revision IS the plan, which is rule 9.
  it.each(GOAL_IDS)('%s never plans a revision-only day', (id) => {
    const offenders: string[] = [];

    for (const { minutes, plan } of plansFor(id)) {
      for (const day of plan.days) {
        if (day.kind === 'final_revision' || day.isRestDay || day.items.length === 0) continue;
        if (day.items.every((i) => i.source === 'spaced_review')) {
          offenders.push(`${minutes}min/day ${day.date} [${day.kind}]`);
        }
      }
    }

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it.each(GOAL_IDS)('%s never wastes a light day', (id) => {
    // The waste that mattered was systematic: a revision-only light day used
    // half its time or less, once a week, for the whole plan.
    //
    // Scoped to light days on purpose. Every goal also has ONE short day
    // where the syllabus runs out just before the reserved tail begins — a
    // warm-up plus the last mock, say — and that is a stage boundary, not
    // wasted capacity.
    const offenders: string[] = [];

    for (const { minutes, plan } of plansFor(id)) {
      for (const day of plan.days) {
        if (day.kind !== 'light_revision' || day.isRestDay || day.items.length === 0) continue;
        if (day.plannedMinutes < day.availableMinutes * 0.6) {
          offenders.push(
            `${minutes}min/day ${day.date} ${day.plannedMinutes}/${day.availableMinutes}`,
          );
        }
      }
    }

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it.each(GOAL_IDS)('%s plans something real in the first week', (id) => {
    // The exact report was about week 1, so it gets its own assertion.
    for (const { minutes, plan } of plansFor(id)) {
      const week1 = plan.days.slice(0, 7);
      for (const day of week1) {
        expect(day.items.length, `${id} ${minutes}min ${day.date} is empty`).toBeGreaterThan(0);
        const hasRealWork = day.items.some((i) => i.source !== 'spaced_review');
        expect(hasRealWork, `${id} ${minutes}min ${day.date} is revision only`).toBe(true);
      }
    }
  });
});

describe('the weekly test specifically', () => {
  it('carries the week\'s own practice and test links', () => {
    const { goal, index, plan } = plansFor('jee-main')[1]!;
    const weekly = plan.days
      .flatMap((d) => d.items)
      .filter((i) => i.source === 'weekly_test' && i.scoreEntry);

    expect(weekly.length).toBeGreaterThan(0);
    for (const item of weekly.slice(0, 10)) {
      const r = resolveItem(item, goal, index, 'en');
      expect(r.resources.length, item.key).toBeGreaterThan(0);
      expect(r.resources.every((x) => x.type === 'test' || x.type === 'practice')).toBe(true);
    }
  });

  it('never appears before any topic has been studied', () => {
    for (const id of GOAL_IDS) {
      for (const { plan } of plansFor(id)) {
        const first = plan.days.find((d) =>
          d.items.some((i) => i.source === 'weekly_test'),
        );
        if (!first) continue;
        const earlierTopics = plan.days
          .filter((d) => d.date < first.date)
          .flatMap((d) => d.items)
          .filter((i) => i.source === 'topic');
        expect(earlierTopics.length, `${id} tested before studying anything`).toBeGreaterThan(0);
      }
    }
  });

  it('falls back to named self-revision when a goal has nothing scorable', () => {
    // Synthetic goal whose topics carry only videos and notes.
    const base = loadGoal('python');
    const stripped = {
      ...base,
      topics: base.topics.map((t) => ({
        ...t,
        blocks: t.blocks.map((b) => ({
          ...b,
          score_entry: false,
          resources: b.resources.filter((r) => r.type === 'video' || r.type === 'notes'),
        })),
      })),
      milestones: [],
    };

    const plan = buildPlan({
      goal: stripped,
      settings: settings({ minutesByWeekday: everyDay(180) }),
      progress: progress(),
      today: TODAY,
    });

    const weekly = plan.days.flatMap((d) => d.items).filter((i) => i.source === 'weekly_test');
    expect(weekly.length).toBeGreaterThan(0);
    for (const item of weekly) {
      expect(item.scoreEntry, 'asked for a score with nothing to sit').toBeFalsy();
      expect(item.title).toMatch(/self-revision/i);
    }
  });
});
