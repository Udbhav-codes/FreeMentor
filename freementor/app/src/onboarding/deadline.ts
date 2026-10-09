/**
 * The deadline calculator — product plan §5 step 7a.
 *
 *   "NEET UG in 10 months needs about 2 h 25 m per day"
 *
 * It ADVISES ONLY. The learner then sets their own hours, and the scheduler
 * works from those, not from this. That is deliberate: a calculator that
 * silently overrode a learner's stated availability would produce a plan they
 * cannot keep, and the whole product rests on the plan being honest.
 */
import { daysBetween, type IsoDate } from '../scheduler/dates.ts';

export interface DeadlineAdvice {
  daysLeft: number;
  /** Minutes per day needed to finish the whole roadmap by the deadline. */
  requiredMinutesPerDay: number;
  /** What the learner has actually set, averaged across the week. */
  plannedMinutesPerDay: number;
  onTrack: boolean;
  /** How far short they are per day; 0 when on track. */
  shortfallMinutesPerDay: number;
}

export function deadlineAdvice({
  estimatedHours,
  today,
  deadline,
  weeklyMinutes,
}: {
  estimatedHours: number;
  today: IsoDate;
  deadline: IsoDate;
  weeklyMinutes: number;
}): DeadlineAdvice | null {
  const daysLeft = daysBetween(today, deadline);
  if (daysLeft <= 0) return null;

  const requiredMinutesPerDay = Math.ceil((estimatedHours * 60) / daysLeft);
  const plannedMinutesPerDay = Math.round(weeklyMinutes / 7);
  const shortfall = requiredMinutesPerDay - plannedMinutesPerDay;

  return {
    daysLeft,
    requiredMinutesPerDay,
    plannedMinutesPerDay,
    onTrack: shortfall <= 0,
    shortfallMinutesPerDay: Math.max(0, shortfall),
  };
}

/** "2 h 25 m", "45 m", "3 h" — the format used throughout the mockup. */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} m`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} m`;
}

/** The preset deadlines offered on the calculator card. */
export function presetDeadlines(today: IsoDate): { label: string; date: IsoDate }[] {
  const add = (months: number): IsoDate => {
    const [y, m, d] = today.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(y, m - 1 + months, d, 12));
    return date.toISOString().slice(0, 10);
  };
  return [
    { label: '1 month', date: add(1) },
    { label: '3 months', date: add(3) },
    { label: '6 months', date: add(6) },
    { label: '12 months', date: add(12) },
  ];
}
