/**
 * Produces the learner's data export and hands it to the share sheet.
 *
 * The impure half: SQLite, the network, the filesystem and the share sheet.
 * Everything that decides what the document *contains* is in buildExport.ts,
 * which is pure and tested.
 *
 * ## Why the share sheet rather than a download
 *
 * Android gives an app no writable "Downloads" it can hand a learner directly
 * — anything written to `Paths.document` lives inside the app's sandbox and
 * vanishes with it. The share sheet is the one route that reaches Drive,
 * Gmail, Files or a messaging app, which is what "export" means on a phone.
 *
 * The file is written to the **cache** directory, deliberately: once it is
 * shared, the copy the learner keeps is theirs, and leaving a second copy of
 * their complete personal data inside the app forever would be a worse
 * outcome than the OS reclaiming it.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/index.ts';
import { loadProfile } from '../db/profile.ts';
import { api, apiConfigured, authToken } from '../api/client.ts';
import {
  buildExport,
  exportFileName,
  isComplete,
  type LocalData,
  type LocalEnrollment,
  type ServerPart,
} from './buildExport.ts';

/** Where the temporary file goes. Cache, so the OS can reclaim it. */
const EXPORT_DIR_NAME = 'export';

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Everything on this device, read straight out of SQLite. */
export async function readLocalData(): Promise<LocalData> {
  const db = await getDb();
  const profile = await loadProfile();

  const enrollmentRows = await db.getAllAsync<{
    id: string;
    goal_id: string;
    version: string;
    start_date: string;
    target_date: string | null;
    status: string;
    created_at: string;
  }>(`SELECT id, goal_id, version, start_date, target_date, status, created_at
        FROM enrollment ORDER BY created_at`);

  const enrollments: LocalEnrollment[] = [];
  for (const row of enrollmentRows) {
    // The goal's display name comes out of the cached roadmap file. Worth the
    // parse: an export listing only "jee-main" is far less use to a person.
    const cached = await db.getFirstAsync<{ json: string }>(
      'SELECT json FROM cached_goal WHERE goal_id = ?',
      [row.goal_id],
    );
    const goalFile = parseJson(cached?.json ?? null);
    const goal = goalFile?.goal as { name?: string } | undefined;

    const schedule = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT mode, minutes_by_weekday, study_time, study_place, language,
              selected_subjects, effective_from
         FROM schedule WHERE enrollment_id = ?`,
      [row.id],
    );

    enrollments.push({
      id: row.id,
      goalId: row.goal_id,
      goalName: goal?.name ?? null,
      version: row.version,
      startDate: row.start_date,
      targetDate: row.target_date,
      status: row.status,
      createdAt: row.created_at,
      schedule: schedule
        ? {
            ...schedule,
            // Stored as JSON text to mirror the server's jsonb columns;
            // re-parsed so the export is a real object, not a string of one.
            minutes_by_weekday: parseJson(schedule.minutes_by_weekday as string),
            selected_subjects: parseJson(schedule.selected_subjects as string),
          }
        : null,
      completedTasks: await db.getAllAsync(
        `SELECT block_id, scheduled_date, completed_at, minutes_credited
           FROM task_progress WHERE enrollment_id = ? ORDER BY completed_at, block_id`,
        [row.id],
      ),
      confidenceRatings: await db.getAllAsync(
        `SELECT topic_id, level, rated_at, next_review_on
           FROM confidence WHERE enrollment_id = ? ORDER BY topic_id`,
        [row.id],
      ),
      testScores: await db.getAllAsync(
        `SELECT block_or_milestone_id, score, max_score, taken_at
           FROM test_score WHERE enrollment_id = ? ORDER BY taken_at`,
        [row.id],
      ),
      restDays: (
        await db.getAllAsync<{ date: string }>(
          'SELECT date FROM rest_day WHERE enrollment_id = ? ORDER BY date',
          [row.id],
        )
      ).map((r) => r.date),
    });
  }

  const streakRow = await db.getFirstAsync<{
    current: number;
    best: number;
    last_study_date: string | null;
    grace_used_on: string | null;
  }>('SELECT current, best, last_study_date, grace_used_on FROM streak WHERE id = 1');

  const pending = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_queue',
  );

  return {
    profile,
    enrollments,
    streak: streakRow
      ? {
          current: streakRow.current,
          best: streakRow.best,
          lastStudyDate: streakRow.last_study_date,
          graceUsedOn: streakRow.grace_used_on,
        }
      : null,
    pendingSyncWrites: pending?.n ?? 0,
  };
}

/**
 * The server's half, or why there isn't one.
 *
 * Never throws. A failure here downgrades the export to device-only and the
 * document says so — it does not deny the learner the data we do have.
 */
export async function fetchServerPart(): Promise<ServerPart> {
  if (!apiConfigured) return { kind: 'no_server' };
  if (!(await authToken())) return { kind: 'not_signed_in' };

  try {
    const response = await api('/account/export');
    if (!response.ok) {
      return { kind: 'failed', reason: `HTTP ${response.status}` };
    }
    return { kind: 'included', document: (await response.json()) as Record<string, unknown> };
  } catch (error) {
    return {
      kind: 'failed',
      reason: error instanceof Error ? error.message : 'network error',
    };
  }
}

export interface ExportResult {
  /** True when the share sheet was opened. */
  shared: boolean;
  /** Whether account-level records (purchases, consent) made it in. */
  complete: boolean;
  /** Set when the export could not be produced at all. */
  error?: string;
}

/**
 * Build the export, write it, and open the share sheet.
 *
 * Returns rather than throws, because the caller is a button and every
 * outcome here has something specific worth telling the learner.
 */
export async function exportProgress(now: Date = new Date()): Promise<ExportResult> {
  let document: unknown;
  let complete = false;

  try {
    const [local, server] = await Promise.all([readLocalData(), fetchServerPart()]);
    document = buildExport(local, server, now);
    complete = isComplete(server);
  } catch (error) {
    return {
      shared: false,
      complete: false,
      error: error instanceof Error ? error.message : 'Could not read your data.',
    };
  }

  try {
    const dir = new File(Paths.cache, EXPORT_DIR_NAME, exportFileName(now));
    dir.parentDirectory.create({ intermediates: true, idempotent: true });
    // Indented: this is a document a person opens and reads, not a payload.
    dir.write(JSON.stringify(document, null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      return {
        shared: false,
        complete,
        error: 'Sharing is not available on this device.',
      };
    }

    await Sharing.shareAsync(dir.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Your FreeMentor data',
      UTI: 'public.json',
    });
    return { shared: true, complete };
  } catch (error) {
    return {
      shared: false,
      complete,
      error: error instanceof Error ? error.message : 'Could not save the file.',
    };
  }
}
