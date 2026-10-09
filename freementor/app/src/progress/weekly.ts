/**
 * The weekly report — product plan §8.7 and screen 6 of the preview.
 *
 * "Study time 16.5/18 h · Tasks done 24/28 · daily hours vs target · topic
 * test scores · one recommendation."
 *
 * Pure: the plan and the ticks go in, the report comes out. The single
 * recommendation is the point of the whole screen — a wall of charts with no
 * advice is exactly what this product exists to replace.
 */
import { addDays, startOfWeek, type IsoDate } from '../scheduler/dates.ts';
import type { Plan, ProgressState } from '../scheduler/types.ts';

export interface WeeklyReport {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  studiedMinutes: number;
  plannedMinutes: number;
  tasksDone: number;
  tasksPlanned: number;
  /** Mon..Sun, for the bar chart. */
  dailyMinutes: { label: string; studied: number; planned: number }[];
  /** Average planned minutes per study day — the dashed target line. */
  targetMinutes: number;
  subjectScores: { label: string; percent: number }[];
  /** e.g. "Wednesday: you studied 1 h extra than planned. Nice!" */
  highlight: string | null;
  recommendation: string;
}

const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weeklyReport(
  plan: Plan,
  progress: ProgressState,
  today: IsoDate,
): WeeklyReport {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const days = plan.days.filter((d) => d.date >= weekStart && d.date <= weekEnd);

  const dailyMinutes = LABELS.map((label, i) => {
    const date = addDays(weekStart, i);
    const day = days.find((d) => d.date === date);
    return {
      label,
      studied: day?.items.filter((x) => x.done).reduce((s, x) => s + x.minutes, 0) ?? 0,
      planned: day?.plannedMinutes ?? 0,
    };
  });

  const studiedMinutes = dailyMinutes.reduce((s, d) => s + d.studied, 0);
  const plannedMinutes = dailyMinutes.reduce((s, d) => s + d.planned, 0);
  const items = days.flatMap((d) => d.items);
  const tasksDone = items.filter((i) => i.done).length;

  const activeDays = dailyMinutes.filter((d) => d.planned > 0);
  const targetMinutes =
    activeDays.length > 0
      ? Math.round(activeDays.reduce((s, d) => s + d.planned, 0) / activeDays.length)
      : 0;

  const subjectScores = scoresBySubject(plan, progress, weekStart, weekEnd);

  return {
    weekStart,
    weekEnd,
    studiedMinutes,
    plannedMinutes,
    tasksDone,
    tasksPlanned: items.length,
    dailyMinutes,
    targetMinutes,
    subjectScores,
    highlight: highlightFor(dailyMinutes),
    recommendation: recommend({ studiedMinutes, plannedMinutes, tasksDone, items, subjectScores }),
  };
}

function highlightFor(daily: { studied: number; planned: number }[]): string | null {
  let bestIndex = -1;
  let bestExtra = 0;
  daily.forEach((d, i) => {
    const extra = d.studied - d.planned;
    if (d.planned > 0 && extra > bestExtra) {
      bestExtra = extra;
      bestIndex = i;
    }
  });
  if (bestIndex < 0 || bestExtra < 15) return null;
  const hours = Math.round((bestExtra / 60) * 10) / 10;
  return `${DAY_NAMES[bestIndex]}: you studied ${hours} h extra than planned. Nice!`;
}

function scoresBySubject(
  plan: Plan,
  progress: ProgressState,
  from: IsoDate,
  to: IsoDate,
): { label: string; percent: number }[] {
  const subjectOf = new Map<string, string>();
  for (const day of plan.days) {
    for (const item of day.items) {
      if (item.subject) subjectOf.set(item.key, item.subject);
    }
  }

  const buckets = new Map<string, { score: number; max: number }>();
  for (const [id, record] of Object.entries(progress.testScores)) {
    if (record.takenAt < from || record.takenAt > to) continue;
    if (record.maxScore <= 0) continue;
    const subject = subjectOf.get(id) ?? 'Mixed';
    const bucket = buckets.get(subject) ?? { score: 0, max: 0 };
    bucket.score += record.score;
    bucket.max += record.maxScore;
    buckets.set(subject, bucket);
  }

  return [...buckets]
    .map(([label, b]) => ({ label, percent: Math.round((b.score / b.max) * 100) }))
    .sort((a, b) => b.percent - a.percent);
}

/**
 * Exactly one recommendation (§8.7), ordered by what actually helps most: a
 * failing subject first, then falling behind, then consistency, then praise.
 */
function recommend({
  studiedMinutes,
  plannedMinutes,
  tasksDone,
  items,
  subjectScores,
}: {
  studiedMinutes: number;
  plannedMinutes: number;
  tasksDone: number;
  items: { done: boolean }[];
  subjectScores: { label: string; percent: number }[];
}): string {
  const weakest = subjectScores[subjectScores.length - 1];
  if (weakest && weakest.percent < 60) {
    return `Spend 30 more minutes on ${weakest.label} next week — you scored ${weakest.percent}%.`;
  }

  if (items.length === 0) {
    return 'Nothing was scheduled this week. Pick your study days and we will build the plan around them.';
  }

  const completion = tasksDone / items.length;
  if (completion < 0.5) {
    return `You finished ${Math.round(completion * 100)}% of this week's tasks. Try lowering your daily target — a plan you can keep beats one you cannot.`;
  }

  if (plannedMinutes > 0 && studiedMinutes < plannedMinutes * 0.8) {
    const short = Math.round((plannedMinutes - studiedMinutes) / 60);
    return `You were about ${short} h short of your plan. Protect one fixed slot a day and the rest follows.`;
  }

  if (completion >= 1) {
    return 'You cleared everything this week. Keep the same pace — consistency is what moves the finish date.';
  }

  return 'Solid week. Finish the few tasks still open before new content piles up.';
}
