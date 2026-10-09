/**
 * Loads the real library files from the dev kit. The scheduler is tested
 * against production data, not toy fixtures — a toy roadmap would not catch
 * interleaving, phase gaps or blocks longer than a study day.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHints, type GoalFile } from '@freementor/shared';
import type { MinutesByWeekday, StudySettings } from '../types.ts';
import { EMPTY_PROGRESS, type ProgressState } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const LIBRARY = resolve(here, '../../../../../library/FreeMentor_Library');

export function loadGoal(id: string): GoalFile {
  const raw = JSON.parse(readFileSync(resolve(LIBRARY, 'goals', `${id}.json`), 'utf8'));
  return { ...raw, scheduler_hints: parseHints(raw.scheduler_hints) } as GoalFile;
}

export const everyDay = (minutes: number): MinutesByWeekday => ({
  mon: minutes,
  tue: minutes,
  wed: minutes,
  thu: minutes,
  fri: minutes,
  sat: minutes,
  sun: minutes,
});

export const weekdaysOnly = (weekday: number, weekend: number): MinutesByWeekday => ({
  mon: weekday,
  tue: weekday,
  wed: weekday,
  thu: weekday,
  fri: weekday,
  sat: weekend,
  sun: weekend,
});

export function settings(over: Partial<StudySettings> = {}): StudySettings {
  return {
    startDate: '2026-10-08', // a Thursday
    targetDate: null,
    minutesByWeekday: everyDay(120),
    language: 'en',
    ...over,
  };
}

export const progress = (over: Partial<ProgressState> = {}): ProgressState => ({
  ...EMPTY_PROGRESS,
  completed: {},
  confidence: {},
  testScores: {},
  restDays: [],
  ...over,
});
