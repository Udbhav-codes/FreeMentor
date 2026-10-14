/**
 * Looking a string up and filling its placeholders.
 *
 * Pure, and its own file so the suite can load it: the hook next door touches
 * React and the database.
 */
import { catalogues, en, type Language, type StringKey } from './strings.ts';

export type Params = Record<string, string | number>;

/**
 * The translated string, with `{placeholders}` filled.
 *
 * Falls back to English for an unknown language rather than showing a raw
 * key: a learner should never see `home.yourGoal`. The types make a missing
 * key impossible at compile time, so the fallback is for a value that arrived
 * from the database — an older row, or a language we stopped shipping.
 */
export function translate(key: StringKey, language: string, params?: Params): string {
  const catalogue = (catalogues as Record<string, Record<string, string>>)[language] ?? en;
  const template = catalogue[key] ?? en[key];
  return fill(template, params);
}

/**
 * `{name}` -> value.
 *
 * A placeholder with no matching parameter is left exactly as written. Showing
 * `{days}` is ugly, but it is a visible bug rather than a sentence that reads
 * as though a number were deliberately omitted — "Last {days} of your trial"
 * is at least obviously broken, where "Last of your trial" is not.
 */
export function fill(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** The languages the app actually ships. */
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'hi-en', label: 'Hinglish' },
];

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'hi' || value === 'hi-en';
}
