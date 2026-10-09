/**
 * Calendar-date helpers. The scheduler deals in local calendar days only, so
 * every date is an ISO `YYYY-MM-DD` string and all arithmetic goes through UTC
 * noon — that way a device in IST (+05:30) or any other zone can never land on
 * the previous or next day, which would silently corrupt streaks and plans.
 */

export type IsoDate = string; // 'YYYY-MM-DD'

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(d: string): asserts d is IsoDate {
  if (!ISO_RE.test(d)) throw new RangeError(`Not an ISO date: "${d}"`);
}

/** UTC-noon Date for an ISO day. Noon keeps DST shifts from changing the day. */
function toUtcNoon(d: IsoDate): Date {
  assertIsoDate(d);
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0, 0));
}

function fromUtc(dt: Date): IsoDate {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  const dt = toUtcNoon(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** Whole calendar days from `a` to `b`; negative when `b` is earlier. */
export function daysBetween(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcNoon(b).getTime() - toUtcNoon(a).getTime()) / 86_400_000);
}

export function weekdayOf(d: IsoDate): Weekday {
  return WEEKDAYS[toUtcNoon(d).getUTCDay()]!;
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);
export const maxDate = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b);

/** Monday-start ISO week key, e.g. '2026-W41'. Used to cap rest days per week. */
export function isoWeekKey(d: IsoDate): string {
  const dt = toUtcNoon(d);
  const day = (dt.getUTCDay() + 6) % 7; // Mon = 0
  dt.setUTCDate(dt.getUTCDate() - day + 3); // nearest Thursday
  const year = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const week = 1 + Math.round(((dt.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** 'YYYY-MM' — used to cap rest days per month. */
export const monthKey = (d: IsoDate): string => d.slice(0, 7);

/** Monday of the week containing `d`. */
export function startOfWeek(d: IsoDate): IsoDate {
  return addDays(d, -((toUtcNoon(d).getUTCDay() + 6) % 7));
}

/** Inclusive date range. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
