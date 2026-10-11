/**
 * Grouping a plan's days into the route's weeks.
 *
 * Pure, and in its own .ts file rather than inside RouteList.tsx, so it can
 * be unit-tested: the suite parses plain TypeScript and cannot load JSX.
 *
 * Weeks are ISO weeks (Monday–Sunday). That matters beyond presentation —
 * progress/weekLock.ts derives each week's unlock date from its Monday.
 */
import { isoWeekKey, startOfWeek, type PlannedDay } from '../scheduler/index.ts';

export interface RouteWeek {
  key: string;
  startDate: string;
  days: PlannedDay[];
  doneFraction: number;
  containsToday: boolean;
  /** Set when today falls inside this week, so the row can highlight it. */
  todayDate: string | null;
  label: string;
}

export function groupIntoWeeks(days: PlannedDay[], today: string): RouteWeek[] {
  const byWeek = new Map<string, PlannedDay[]>();
  for (const day of days) {
    const key = isoWeekKey(day.date);
    const list = byWeek.get(key);
    if (list) list.push(day);
    else byWeek.set(key, [day]);
  }

  return [...byWeek.entries()].map(([key, weekDays]) => {
    const items = weekDays.flatMap((d) => d.items);
    const done = items.filter((i) => i.done).length;
    const subjects = [...new Set(items.map((i) => i.subject).filter(Boolean))];
    const containsToday = weekDays.some((d) => d.date === today);
    return {
      key,
      startDate: startOfWeek(weekDays[0]!.date),
      days: weekDays,
      doneFraction: items.length > 0 ? done / items.length : 0,
      containsToday,
      todayDate: containsToday ? today : null,
      label: subjects.slice(0, 3).join(' · ') || 'Revision',
    };
  });
}
