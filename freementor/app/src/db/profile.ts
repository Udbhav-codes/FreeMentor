/**
 * The single profile row: onboarding answers and app settings.
 */
import { getDb } from './index.ts';

export interface Profile {
  name: string | null;
  birthYear: number | null;
  qualification: string | null;
  language: 'en' | 'hi' | 'hi-en';
  appearance: 'light' | 'dark' | 'system';
  onboardedAt: string | null;
  /** Hour of day (0-23) the learner said they would study. */
  studyHour: number | null;
  studyPlace: string | null;
  welcomeDismissedAt: string | null;
}

export async function loadProfile(): Promise<Profile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    name: string | null;
    birth_year: number | null;
    qualification: string | null;
    language: string;
    appearance: string;
    onboarded_at: string | null;
    study_hour: number | null;
    study_place: string | null;
    welcome_dismissed_at: string | null;
  }>('SELECT * FROM profile WHERE id = 1');
  if (!row) return null;
  return {
    name: row.name,
    birthYear: row.birth_year,
    qualification: row.qualification,
    language: row.language as Profile['language'],
    appearance: row.appearance as Profile['appearance'],
    onboardedAt: row.onboarded_at,
    studyHour: row.study_hour,
    studyPlace: row.study_place,
    welcomeDismissedAt: row.welcome_dismissed_at,
  };
}

export async function saveProfile(patch: Partial<Profile>): Promise<void> {
  const db = await getDb();
  const current = await loadProfile();
  const next: Profile = {
    name: null,
    birthYear: null,
    qualification: null,
    language: 'en',
    appearance: 'system',
    onboardedAt: null,
    studyHour: null,
    studyPlace: null,
    welcomeDismissedAt: null,
    ...current,
    ...patch,
  };
  await db.runAsync(
    `INSERT INTO profile
       (id, name, birth_year, qualification, language, appearance, onboarded_at,
        study_hour, study_place, welcome_dismissed_at)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       birth_year = excluded.birth_year,
       qualification = excluded.qualification,
       language = excluded.language,
       appearance = excluded.appearance,
       onboarded_at = excluded.onboarded_at,
       study_hour = excluded.study_hour,
       study_place = excluded.study_place,
       welcome_dismissed_at = excluded.welcome_dismissed_at`,
    [
      next.name,
      next.birthYear,
      next.qualification,
      next.language,
      next.appearance,
      next.onboardedAt,
      next.studyHour,
      next.studyPlace,
      next.welcomeDismissedAt,
    ],
  );
}

/** Onboarding is done once the profile row has a timestamp. */
export async function hasOnboarded(): Promise<boolean> {
  return Boolean((await loadProfile())?.onboardedAt);
}
