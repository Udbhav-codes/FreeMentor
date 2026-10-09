/**
 * buildPlan — the heart of FreeMentor.
 *
 * PURE: (library + settings + progress + today) -> a day-by-day plan.
 * No clock, no network, no database. Rules are numbered as in
 * docs/APP_BUILD_SPEC.md §4.
 *
 * The central design choice, which makes rule 10 ("missed day -> shift
 * forward, never move a completed tick") fall out for free: completed items
 * are rendered on the date they were ACTUALLY completed, and everything still
 * outstanding is re-packed from today forward. Nothing in the past is ever
 * recomputed, so a missed day simply pushes the queue along.
 */
import type { GoalFile, Topic } from '@freementor/shared';
import { addDays, daysBetween, isoWeekKey, maxDate, weekdayOf, type IsoDate } from './dates.ts';
import {
  expandMilestone,
  expandTopic,
  finalRevisionItems,
  remediationItem,
  reviewItem,
  warmupItem,
  type PendingItem,
} from './expand.ts';
import { orderUnits } from './order.ts';
import type {
  DayKind,
  Plan,
  PlannedDay,
  PlannedItem,
  PlanWarning,
  SchedulerInput,
  StudySettings,
} from './types.ts';

const DEFAULT_MAX_DAYS = 365 * 6;
const WEEKLY_TEST_MINUTES = 30;

export const totalWeeklyMinutes = (s: StudySettings): number =>
  Object.values(s.minutesByWeekday).reduce((a, b) => a + b, 0);

/**
 * Rule 5's weekly rhythm (5 new-content / 1 mixed-practice+test / 1 light),
 * scaled to however many days a learner actually studies in a calendar week.
 *
 * The spec states the pattern for a 7-day week. Interpretation for fewer
 * days, so a 3-day-a-week learner does not spend a third of their time on
 * revision: the weekly test appears only once there are >= 4 study days, and
 * the light day only once there are >= 6.
 */
export function dayKindFor(index: number, studyDaysThisWeek: number): DayKind {
  const last = studyDaysThisWeek - 1;
  if (studyDaysThisWeek >= 6) {
    if (index === last) return 'light_revision';
    if (index === last - 1) return 'mixed_practice';
  } else if (studyDaysThisWeek >= 4) {
    if (index === last) return 'mixed_practice';
  }
  return 'new_content';
}

/** Maps each study day in `from`'s ISO week to its position within that week. */
function studyDayIndexes(
  from: IsoDate,
  minutesByWeekday: StudySettings['minutesByWeekday'],
): Map<IsoDate, { index: number; count: number }> {
  const week = isoWeekKey(from);
  const days: IsoDate[] = [];
  for (let i = -7; i <= 7; i++) {
    const d = addDays(from, i);
    if (isoWeekKey(d) === week && (minutesByWeekday[weekdayOf(d)] ?? 0) > 0) days.push(d);
  }
  days.sort();
  const out = new Map<IsoDate, { index: number; count: number }>();
  days.forEach((d, index) => out.set(d, { index, count: days.length }));
  return out;
}

/** A topic counts as finished when every one of its items is ticked. */
function completedTopics(
  goal: GoalFile,
  itemsByTopic: Map<string, PendingItem[]>,
  completed: Record<string, { completedAt: IsoDate }>,
): Map<string, { topic: Topic; finishedOn: IsoDate }> {
  const out = new Map<string, { topic: Topic; finishedOn: IsoDate }>();
  for (const topic of goal.topics) {
    const items = itemsByTopic.get(topic.id) ?? [];
    if (items.length === 0) continue;
    let finishedOn: IsoDate | null = null;
    for (const item of items) {
      const rec = completed[item.key];
      if (!rec) {
        finishedOn = null;
        break;
      }
      finishedOn = finishedOn ? maxDate(finishedOn, rec.completedAt) : rec.completedAt;
    }
    if (finishedOn) out.set(topic.id, { topic, finishedOn });
  }
  return out;
}

/** A review/remediation key is `<kind>:<topicId>:<dueDate>`. */
const dueDateOf = (key: string): IsoDate => key.slice(key.lastIndexOf(':') + 1);

/**
 * Rule 6 — spaced revision. A finished topic returns at +1, +3, +7, +21, +45
 * days, unless the learner rated their confidence, which replaces the whole
 * ladder with a single next visit (product plan §7.5).
 */
function dueReviews(
  goal: GoalFile,
  finished: Map<string, { topic: Topic; finishedOn: IsoDate }>,
  input: SchedulerInput,
): PendingItem[] {
  const hints = goal.scheduler_hints;
  const { progress, today } = input;
  const minutes = Math.max(10, Math.round(hints.warmup_recall_minutes * 1.5));
  const out: PendingItem[] = [];

  for (const { topic, finishedOn } of finished.values()) {
    const rating = progress.confidence[topic.id];

    if (rating) {
      const due = addDays(rating.ratedAt, hints.confidence_to_next_review_days[rating.level]);
      const item = reviewItem(topic, due, minutes);
      if (!progress.completed[item.key]) out.push(item);
      continue;
    }

    for (const offset of hints.spaced_review_offsets_days) {
      const due = addDays(finishedOn, offset);
      const item = reviewItem(topic, due, minutes);
      if (progress.completed[item.key]) continue;
      // Only the next due visit matters; the rest are scheduled once this one
      // is ticked and the plan is rebuilt. An overdue one is pulled to today.
      out.push(due >= today ? item : reviewItem(topic, today, minutes));
      break;
    }
  }
  return out;
}

/**
 * Rule 8 — mastery gate. A weekly test below 60% forces a 45-minute catch-up
 * on the weakest topic covered that week, before new content continues.
 */
function remediations(
  goal: GoalFile,
  input: SchedulerInput,
  finished: Map<string, { topic: Topic; finishedOn: IsoDate }>,
): PendingItem[] {
  const hints = goal.scheduler_hints;
  const topicsById = new Map(goal.topics.map((t) => [t.id, t]));
  const out: PendingItem[] = [];

  for (const [id, score] of Object.entries(input.progress.testScores)) {
    if (score.maxScore <= 0) continue;
    if ((score.score / score.maxScore) * 100 >= hints.mastery_gate.weekly_test_min_score_pct) {
      continue;
    }

    // Weakest topic = the one that test covered, else the most recently
    // finished topic at the time the test was taken.
    const topic =
      topicsById.get(id.replace(/-(test|weekly)$/, '')) ??
      [...finished.values()]
        .filter((f) => f.finishedOn <= score.takenAt)
        .sort((a, b) => (a.finishedOn < b.finishedOn ? 1 : -1))[0]?.topic;
    if (!topic) continue;

    const item = remediationItem(topic, score.takenAt, hints.mastery_gate.remediation_block_minutes);
    if (!input.progress.completed[item.key]) out.push(item);
  }
  return out;
}

/** Rule 11 — not enough time before a fixed exam date. */
function timeWarnings(
  goal: GoalFile,
  input: SchedulerInput,
  remainingMinutes: number,
  projectedFinish: IsoDate | null,
): PlanWarning[] {
  const { settings, today } = input;
  const weekly = totalWeeklyMinutes(settings);

  if (weekly <= 0) {
    return [
      {
        code: 'no_study_time_set',
        message: 'You have not set any study time yet, so no plan can be built.',
      },
    ];
  }

  const target = settings.targetDate;
  if (!target) return [];

  if (target < today) {
    return [
      { code: 'target_date_passed', message: `Your target date (${target}) has already passed.` },
    ];
  }

  const weeksLeft = Math.max(1, daysBetween(today, target)) / 7;
  const requiredPerWeek = Math.ceil(remainingMinutes / weeksLeft);

  if (requiredPerWeek > weekly) {
    return [
      {
        code: 'not_enough_time',
        message:
          `To finish ${goal.goal.name} by ${target} you need about ` +
          `${Math.round(requiredPerWeek / 60)} h/week; you have set ` +
          `${Math.round(weekly / 60)} h/week.`,
        requiredMinutesPerWeek: requiredPerWeek,
        configuredMinutesPerWeek: weekly,
      },
    ];
  }

  if (projectedFinish && projectedFinish > target) {
    return [
      {
        code: 'plan_exceeds_target',
        message: `At your current pace you would finish on ${projectedFinish}, after your target of ${target}.`,
      },
    ];
  }
  return [];
}

export function buildPlan(input: SchedulerInput): Plan {
  const { goal, settings, progress, today } = input;
  const hints = goal.scheduler_hints;
  const maxDays = input.maxDays ?? DEFAULT_MAX_DAYS;

  // --- rules 1, 2, 7, 13: what to schedule, in what order ----------------
  const units = orderUnits(goal, settings);
  const itemsByTopic = new Map<string, PendingItem[]>();
  const topicOfItem = new Map<string, Topic>();
  const queue: PendingItem[] = [];

  for (const unit of units) {
    if (unit.kind === 'topic' && unit.topic) {
      const items = expandTopic(unit.topic, hints, settings);
      itemsByTopic.set(unit.topic.id, items);
      for (const i of items) topicOfItem.set(i.key, unit.topic);
      queue.push(...items);
    } else if (unit.milestone) {
      queue.push(...expandMilestone(unit.milestone));
    }
  }

  const allItems = new Map(queue.map((i) => [i.key, i]));
  const finished = completedTopics(goal, itemsByTopic, progress.completed);

  // --- the past: completed ticks, rendered where they actually happened --
  const pastByDate = new Map<IsoDate, PlannedItem[]>();
  for (const [key, rec] of Object.entries(progress.completed)) {
    const base = allItems.get(key);
    const item: PlannedItem = base
      ? { ...base, done: true, minutes: rec.minutesCredited || base.minutes }
      : {
          key,
          source: key.startsWith('review:')
            ? 'spaced_review'
            : key.startsWith('warmup:')
              ? 'warmup'
              : key.startsWith('weekly-test:')
                ? 'weekly_test'
                : 'topic',
          subject: '',
          title: key,
          minutes: rec.minutesCredited,
          done: true,
        };
    const list = pastByDate.get(rec.completedAt);
    if (list) list.push(item);
    else pastByDate.set(rec.completedAt, [item]);
  }

  // --- the future: everything outstanding, packed from today forward -----
  const pending = queue.filter((i) => !progress.completed[i.key]);
  const reviews = dueReviews(goal, finished, input);
  const catchUps = remediations(goal, input, finished);
  const restDays = new Set(progress.restDays);

  const days: PlannedDay[] = [];
  let cursor = maxDate(today, settings.startDate);
  let qi = 0;
  let carry: { item: PendingItem; left: number; partIndex: number; parts: number } | null = null;
  /** Topic of the last content item placed on the PREVIOUS day — what the
   *  warm-up recalls. Tracking it per day (rather than as a running value)
   *  stops a block that spans two days from warming up on the same topic twice. */
  let lastTopic: Topic | undefined;
  let topicThisDay: Topic | undefined;
  /** Most-recent-first, for light-revision days. */
  const recentTopics: Topic[] = [];
  let currentWeek = isoWeekKey(cursor);
  let weekIndexes = studyDayIndexes(cursor, settings.minutesByWeekday);
  let guard = 0;

  const contentLeft = () =>
    qi < pending.length || carry !== null || reviews.length > 0 || catchUps.length > 0;

  // --- rule 9: the reserved tail ------------------------------------------
  // The last `reserve_final_fraction_for_mocks_and_revision` of the TIMELINE
  // is held back for mocks and revision, so new content never runs right up to
  // the exam. Content is packed first; once it is done we know how many study
  // days it took (D), and the tail is R = D * f / (1 - f) further study days,
  // which makes the reserve exactly f of the whole timeline.
  const reserveFraction = Math.min(
    0.9,
    Math.max(0, hints.reserve_final_fraction_for_mocks_and_revision),
  );
  const scheduledTopics = units
    .filter((u) => u.kind === 'topic' && u.topic)
    .map((u) => u.topic!);
  const revision = finalRevisionItems(scheduledTopics);
  let nextRevision: PendingItem | null = null;
  const takeRevision = (): PendingItem | null => {
    if (!nextRevision) {
      const r = revision.next();
      nextRevision = r.done ? null : r.value;
    }
    return nextRevision;
  };

  let stage: 'content' | 'reserve' = 'content';
  let contentDays = 0;
  let reserveDays = 0;
  let reserveDaysNeeded = 0;
  let contentFinish: IsoDate | null = null;

  while (guard < maxDays && totalWeeklyMinutes(settings) > 0) {
    guard += 1;

    if (stage === 'content' && !contentLeft()) {
      reserveDaysNeeded = Math.ceil((contentDays * reserveFraction) / (1 - reserveFraction));
      stage = 'reserve';
    }
    if (stage === 'reserve' && reserveDays >= reserveDaysNeeded) break;

    if (isoWeekKey(cursor) !== currentWeek) {
      currentWeek = isoWeekKey(cursor);
      weekIndexes = studyDayIndexes(cursor, settings.minutesByWeekday);
    }

    const available = settings.minutesByWeekday[weekdayOf(cursor)] ?? 0;
    if (available <= 0) {
      cursor = addDays(cursor, 1);
      continue;
    }

    // Rule 12 — an approved rest day consumes the date but no work.
    if (restDays.has(cursor)) {
      days.push({
        date: cursor,
        kind: 'rest',
        items: [],
        plannedMinutes: 0,
        availableMinutes: available,
        isRestDay: true,
      });
      cursor = addDays(cursor, 1);
      continue;
    }

    const pos = weekIndexes.get(cursor);
    const kind = dayKindFor(pos?.index ?? 0, pos?.count ?? 7);
    const items: PlannedItem[] = [];
    const placedKeys = new Set<string>();

    // Work already ticked on this date (normally today) still occupies the
    // day: it is shown struck through, and it eats into what is left to plan.
    // Without this, finishing an hour this morning would silently add another
    // hour of new work to the same day.
    const alreadyDone = pastByDate.get(cursor) ?? [];
    const alreadyDoneMinutes = alreadyDone.reduce((s, i) => s + i.minutes, 0);
    let left = Math.max(0, available - alreadyDoneMinutes);
    topicThisDay = undefined;

    const place = (it: PendingItem, minutes: number, part?: PlannedItem['part']) => {
      items.push({ ...it, minutes, done: false, ...(part ? { part } : {}) });
      placedKeys.add(it.key);
      left -= minutes;
    };

    /** Records which topic a day actually touched, for tomorrow's warm-up. */
    const touch = (key: string) => {
      const t = topicOfItem.get(key);
      if (!t) return;
      topicThisDay = t;
      if (recentTopics[0]?.id !== t.id) {
        recentTopics.unshift(t);
        if (recentTopics.length > 12) recentTopics.pop();
      }
    };

    // Warm-up recall of yesterday's topic (product plan §7.3). Skipped when
    // it would eat the whole day: on a 15-minute budget a 10-minute warm-up
    // leaves no room for content, and the plan would warm up forever without
    // ever moving forward.
    if (kind === 'new_content' && lastTopic && left >= hints.warmup_recall_minutes * 2) {
      const w = warmupItem(hints, lastTopic, cursor);
      if (w && w.minutes <= left && !progress.completed[w.key]) place(w, w.minutes);
    }

    // Rule 8 — catch-ups come before any new content.
    while (catchUps.length > 0 && catchUps[0]!.minutes <= left) {
      const c = catchUps.shift()!;
      place(c, c.minutes);
    }

    // Rule 6 — revisions due on or before this day.
    for (let i = 0; i < reviews.length && left > 0; ) {
      const r = reviews[i]!;
      if (dueDateOf(r.key) <= cursor && r.minutes <= left) {
        place(r, r.minutes);
        reviews.splice(i, 1);
      } else {
        i += 1;
      }
    }

    // Rule 5 — the weekly test slot.
    if (kind === 'mixed_practice' && left >= WEEKLY_TEST_MINUTES) {
      const key = `weekly-test:${cursor}`;
      if (!progress.completed[key]) {
        place(
          {
            key,
            source: 'weekly_test',
            subject: 'Mixed practice',
            title: "Weekly test · mixed practice on this week's topics",
            minutes: WEEKLY_TEST_MINUTES,
            scoreEntry: true,
          },
          WEEKLY_TEST_MINUTES,
        );
      }
    }

    // A light-revision day never takes on new content.
    const takesNewContent = kind === 'new_content' || kind === 'mixed_practice';

    // Rule 4 — finish a block that was split across days first.
    if (carry && takesNewContent && left > 0) {
      const chunk = Math.min(carry.left, left);
      const isLast = carry.left - chunk <= 0;
      // The up-front estimate assumes later days are free, but warm-ups,
      // revisions and weekly tests take room, so a block can need more parts
      // than predicted. Raise the total rather than print "part 10 of 9", and
      // on the final chunk report the real count.
      if (carry.partIndex > carry.parts) carry.parts = carry.partIndex;
      place(carry.item, chunk, {
        index: carry.partIndex,
        of: isLast ? carry.partIndex : carry.parts,
      });
      touch(carry.item.key);
      carry.left -= chunk;
      carry.partIndex += 1;
      if (carry.left <= 0) carry = null;
    }

    let contentPlaced = carry !== null;
    while (takesNewContent && !carry && qi < pending.length && left > 0) {
      const item = pending[qi]!;
      if (item.minutes <= left) {
        place(item, item.minutes);
        touch(item.key);
        contentPlaced = true;
        qi += 1;
      } else if (left >= hints.focus_block_minutes || !contentPlaced) {
        // A long block may span days, but only in chunks worth sitting down
        // for — UNLESS nothing has been placed today at all. A learner with
        // 15 minutes a day cannot fit a whole focus block, and refusing to
        // start would stall the plan forever and hand back an empty roadmap.
        // Capture the chunk BEFORE placing it: place() decrements `left`, so
        // reading `left` afterwards gave a remainder of the WHOLE block and
        // every split block was over-scheduled by its first chunk.
        const chunk = left;
        const remaining = item.minutes - chunk;
        const parts = 1 + Math.max(1, Math.ceil(remaining / Math.max(1, available)));
        place(item, chunk, { index: 1, of: parts });
        touch(item.key);
        contentPlaced = true;
        carry = { item, left: remaining, partIndex: 2, parts };
        qi += 1;
      } else {
        break;
      }
    }

    // Rule 9 — in the reserved tail there is no new content left, so the day
    // is filled with mocks (already placed by rule 7) and final revision.
    if (stage === 'reserve') {
      const MIN_REVISION = 15;
      let next = takeRevision();
      while (next && left >= MIN_REVISION) {
        // The last item of a day is trimmed to fit rather than dropped, which
        // would otherwise waste ~50 min of every revision day.
        const minutes = Math.min(next.minutes, left);
        if (!progress.completed[next.key] && !placedKeys.has(next.key)) {
          place(next, minutes);
          // Tomorrow's warm-up recalls what was revised today, instead of
          // repeating the last topic of the syllabus for weeks on end.
          if (next.topicId) {
            topicThisDay = goal.topics.find((t) => t.id === next!.topicId) ?? topicThisDay;
          }
        }
        nextRevision = null;
        next = takeRevision();
      }
    }

    // A light day with nothing due would otherwise be blank. Fill it with a
    // light pass over what the learner saw this week — "light revision OR
    // rest" (product plan §7.4) — capped at half the day so it stays light.
    if (stage === 'content' && kind === 'light_revision' && items.length === 0 && recentTopics.length > 0) {
      const reviewMinutes = Math.max(10, Math.round(hints.warmup_recall_minutes * 1.5));
      const cap = Math.floor(available / 2);
      let used = 0;
      for (const topic of recentTopics) {
        if (used + reviewMinutes > cap) break;
        const item = reviewItem(topic, cursor, reviewMinutes);
        if (placedKeys.has(item.key) || progress.completed[item.key]) continue;
        place(item, reviewMinutes);
        used += reviewMinutes;
      }
    }

    lastTopic = topicThisDay ?? lastTopic;

    // Completed items first, so the day reads in the order it happened.
    const dayItems = [...alreadyDone, ...items];
    days.push({
      date: cursor,
      kind: stage === 'reserve' ? 'final_revision' : kind,
      items: dayItems,
      plannedMinutes: dayItems.reduce((s, i) => s + i.minutes, 0),
      availableMinutes: available,
      isRestDay: false,
    });

    if (stage === 'content') {
      contentDays += 1;
      if (items.some((i) => i.source === 'topic' || i.source === 'milestone')) {
        contentFinish = cursor;
      }
    } else {
      // A reserve day that could not fit even one revision item would spin
      // forever; counting every elapsed day keeps the loop bounded.
      reserveDays += 1;
    }

    cursor = addDays(cursor, 1);
  }

  // --- stitch the past onto the front ------------------------------------
  const firstFuture = days[0]?.date ?? today;
  const pastDays: PlannedDay[] = [...pastByDate.entries()]
    .filter(([d]) => d < firstFuture)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, its]) => ({
      date,
      kind: 'new_content' as DayKind,
      items: its,
      plannedMinutes: its.reduce((s, i) => s + i.minutes, 0),
      availableMinutes: settings.minutesByWeekday[weekdayOf(date)] ?? 0,
      isRestDay: false,
    }));

  const scheduled = days.filter((d) => d.items.length > 0);
  const projectedFinish = scheduled.at(-1)?.date ?? null;

  const totalMinutes = queue.reduce((s, i) => s + i.minutes, 0);
  const contentRemaining = pending.reduce((s, i) => s + i.minutes, 0);
  const completedMinutes = Object.values(progress.completed).reduce(
    (s, r) => s + r.minutesCredited,
    0,
  );
  const reservedMinutes = days
    .flatMap((d) => d.items)
    .filter((i) => i.source === 'final_revision')
    .reduce((s, i) => s + i.minutes, 0);

  // The learner must fit the reserve too, so rule 11 warns against the whole
  // timeline, not just the content.
  const remainingMinutes = contentRemaining + reservedMinutes;

  return {
    goalId: goal.goal.id,
    days: [...pastDays, ...days],
    contentFinish,
    projectedFinish,
    warnings: timeWarnings(goal, input, remainingMinutes, projectedFinish),
    totals: {
      totalMinutes: totalMinutes + reservedMinutes,
      completedMinutes,
      remainingMinutes,
      topicsTotal: itemsByTopic.size,
      topicsCompleted: finished.size,
      contentMinutes: totalMinutes,
      reservedMinutes,
      contentDays,
      reserveDays,
    },
  };
}
