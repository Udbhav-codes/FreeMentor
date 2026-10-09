/**
 * Achievements — product plan §8.11 (v1 "light" gamification).
 *
 *   First Week Complete · 10-Day Streak · First Mock Test · 100 Hours Studied
 *   · first project built
 *
 * THE RULE THAT MATTERS: badges reward task completion and study time, and
 * must NEVER reward "videos watched". Rewarding video consumption would
 * breach the YouTube API Services policy, so no badge here may depend on a
 * video resource — only on ticked work, hours and scores.
 */
import type { Plan } from '../scheduler/types.ts';
import type { ProgressState } from '../scheduler/types.ts';
import { computeStreak } from './streak.ts';
import type { IsoDate } from '../scheduler/dates.ts';

export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  /** 0..1 — how close they are, for the ones that are a count. */
  progress: number;
}

export function badgesFor(plan: Plan, progress: ProgressState, today: IsoDate): Badge[] {
  const studyDates = new Set(
    Object.values(progress.completed).map((r) => r.completedAt),
  );
  const streak = computeStreak({ studyDates, restDays: progress.restDays, today });

  const hours = plan.totals.completedMinutes / 60;
  const doneKeys = new Set(Object.keys(progress.completed));
  const allItems = plan.days.flatMap((d) => d.items);

  const mocksTaken = allItems.filter((i) => i.milestoneId && doneKeys.has(i.key)).length;
  const projectsBuilt = allItems.filter(
    (i) => i.blockType === 'build' && doneKeys.has(i.key),
  ).length;

  // "First week complete" = seven distinct days with work done, not a
  // calendar week — a learner studying Mon/Wed/Fri still earns it.
  const daysStudied = studyDates.size;

  return [
    badge('first-week', 'First Week Complete', 'Study on seven different days', daysStudied, 7),
    badge('streak-10', '10-Day Streak', 'Keep a ten-day streak', streak.best, 10),
    badge('first-mock', 'First Mock Test', 'Finish your first full mock', mocksTaken, 1),
    badge('hours-100', '100 Hours Studied', 'Clock up 100 hours of ticked work', hours, 100),
    badge('first-project', 'First Project Built', 'Complete a project', projectsBuilt, 1),
  ];
}

function badge(
  id: string,
  name: string,
  description: string,
  value: number,
  target: number,
): Badge {
  return {
    id,
    name,
    description,
    earned: value >= target,
    progress: Math.max(0, Math.min(1, target > 0 ? value / target : 0)),
  };
}
