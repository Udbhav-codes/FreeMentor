/**
 * SQLite access. Everything the app reads while offline comes through here.
 *
 * One connection for the whole app, opened lazily. Migrations run once on
 * first access and are tracked with SQLite's own `user_version`.
 */
import * as SQLite from 'expo-sqlite';
import type { ConfidenceLevel, GoalFile } from '@freementor/shared';
import { parseHints } from '@freementor/shared';
import type { ProgressState, StudySettings } from '../scheduler/index.ts';
import { LATEST_VERSION, MIGRATIONS } from './schema.ts';

const DB_NAME = 'freementor.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // WAL keeps reads fast while the sync queue writes in the background.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.sql);
    });
  }
  // PRAGMA will not take a bound parameter.
  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}

/** Drops everything. Used by "reset roadmap" in settings, and by tests. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM task_progress;
    DELETE FROM confidence;
    DELETE FROM test_score;
    DELETE FROM rest_day;
    DELETE FROM sync_queue;
    DELETE FROM schedule;
    DELETE FROM enrollment;
    DELETE FROM cached_goal;
  `);
}

// --- the cached roadmap ---------------------------------------------------

export async function saveGoalFile(file: GoalFile, raw: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO cached_goal (goal_id, version, json, bytes, downloaded_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(goal_id) DO UPDATE SET
       version = excluded.version,
       json = excluded.json,
       bytes = excluded.bytes,
       downloaded_at = excluded.downloaded_at`,
    [file.goal.id, file.goal.version, raw, raw.length, new Date().toISOString()],
  );
}

export async function loadGoalFile(goalId: string): Promise<GoalFile | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>(
    'SELECT json FROM cached_goal WHERE goal_id = ?',
    [goalId],
  );
  if (!row) return null;
  const parsed = JSON.parse(row.json);
  // parseHints fills anything a slightly older file is missing, so a cached
  // roadmap from a previous app version can never crash the scheduler.
  return { ...parsed, scheduler_hints: parseHints(parsed.scheduler_hints) } as GoalFile;
}

/** goal id -> the version currently cached on this device. */
export async function cachedGoalVersions(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ goal_id: string; version: string }>(
    'SELECT goal_id, version FROM cached_goal',
  );
  return Object.fromEntries(rows.map((r) => [r.goal_id, r.version]));
}

/**
 * Point an enrollment at a newer version of its goal file.
 *
 * The enrollment records which version its plan was built from, so a
 * refreshed roadmap has to be recorded here too or the row keeps claiming a
 * version the device no longer holds.
 */
export async function setEnrollmentVersion(
  enrollmentId: string,
  version: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE enrollment SET version = ? WHERE id = ?', [version, enrollmentId]);
}

export async function cachedGoalIds(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ goal_id: string }>('SELECT goal_id FROM cached_goal');
  return rows.map((r) => r.goal_id);
}

// --- enrollment and schedule ---------------------------------------------

export interface EnrollmentRow {
  id: string;
  goal_id: string;
  version: string;
  start_date: string;
  target_date: string | null;
  status: 'trial' | 'active' | 'archived';
  /**
   * When the learner started this goal, ISO. The trial clock is anchored to
   * this and NOT to start_date, which the learner may set in the future and
   * which would hand them a longer trial. `SELECT *` already returned it;
   * only the type was missing.
   */
  created_at: string;
}

export async function activeEnrollment(): Promise<EnrollmentRow | null> {
  const db = await getDb();
  return (
    (await db.getFirstAsync<EnrollmentRow>(
      `SELECT * FROM enrollment WHERE status != 'archived' ORDER BY created_at DESC LIMIT 1`,
    )) ?? null
  );
}

export async function createEnrollment(
  goal: GoalFile,
  settings: StudySettings,
): Promise<EnrollmentRow> {
  const db = await getDb();
  const id = `${goal.goal.id}-${Date.now()}`;
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // One goal at a time (product plan §2); the old one is archived, never
    // deleted, so its progress can still be viewed.
    await db.runAsync(`UPDATE enrollment SET status = 'archived' WHERE status != 'archived'`);
    await db.runAsync(
      `INSERT INTO enrollment (id, goal_id, version, start_date, target_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'trial', ?)`,
      [id, goal.goal.id, goal.goal.version, settings.startDate, settings.targetDate ?? null, now],
    );
    await db.runAsync(
      `INSERT INTO schedule
         (enrollment_id, mode, minutes_by_weekday, language, selected_subjects, effective_from)
       VALUES (?, 'each_day', ?, ?, ?, ?)`,
      [
        id,
        JSON.stringify(settings.minutesByWeekday),
        settings.language,
        JSON.stringify(settings.selectedDomainSubjects ?? []),
        settings.startDate,
      ],
    );
  });

  return {
    id,
    goal_id: goal.goal.id,
    version: goal.goal.version,
    start_date: settings.startDate,
    target_date: settings.targetDate ?? null,
    status: 'trial',
    created_at: now,
  };
}

export async function loadSettings(enrollmentId: string): Promise<StudySettings | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    minutes_by_weekday: string;
    language: string;
    selected_subjects: string | null;
    effective_from: string;
  }>('SELECT * FROM schedule WHERE enrollment_id = ?', [enrollmentId]);
  const enrollment = await db.getFirstAsync<EnrollmentRow>(
    'SELECT * FROM enrollment WHERE id = ?',
    [enrollmentId],
  );
  if (!row || !enrollment) return null;

  return {
    startDate: enrollment.start_date,
    targetDate: enrollment.target_date,
    minutesByWeekday: JSON.parse(row.minutes_by_weekday),
    language: row.language as StudySettings['language'],
    selectedDomainSubjects: JSON.parse(row.selected_subjects ?? '[]'),
  };
}

export async function updateSchedule(
  enrollmentId: string,
  minutesByWeekday: StudySettings['minutesByWeekday'],
  effectiveFrom: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE schedule SET minutes_by_weekday = ?, effective_from = ? WHERE enrollment_id = ?`,
    [JSON.stringify(minutesByWeekday), effectiveFrom, enrollmentId],
  );
}

// --- progress -------------------------------------------------------------

/** Everything the scheduler needs about what the learner has already done. */
export async function loadProgress(enrollmentId: string): Promise<ProgressState> {
  const db = await getDb();

  const [tasks, ratings, scores, rests] = await Promise.all([
    db.getAllAsync<{ block_id: string; completed_at: string; minutes_credited: number }>(
      'SELECT block_id, completed_at, minutes_credited FROM task_progress WHERE enrollment_id = ?',
      [enrollmentId],
    ),
    db.getAllAsync<{ topic_id: string; level: string; rated_at: string }>(
      'SELECT topic_id, level, rated_at FROM confidence WHERE enrollment_id = ?',
      [enrollmentId],
    ),
    db.getAllAsync<{
      block_or_milestone_id: string;
      score: number;
      max_score: number;
      taken_at: string;
    }>('SELECT * FROM test_score WHERE enrollment_id = ?', [enrollmentId]),
    db.getAllAsync<{ date: string }>('SELECT date FROM rest_day WHERE enrollment_id = ?', [
      enrollmentId,
    ]),
  ]);

  return {
    completed: Object.fromEntries(
      tasks.map((t) => [
        t.block_id,
        { completedAt: t.completed_at.slice(0, 10), minutesCredited: t.minutes_credited },
      ]),
    ),
    confidence: Object.fromEntries(
      ratings.map((r) => [
        r.topic_id,
        { level: r.level as ConfidenceLevel, ratedAt: r.rated_at.slice(0, 10) },
      ]),
    ),
    testScores: Object.fromEntries(
      scores.map((s) => [
        s.block_or_milestone_id,
        { score: s.score, maxScore: s.max_score, takenAt: s.taken_at.slice(0, 10) },
      ]),
    ),
    restDays: rests.map((r) => r.date),
  };
}

/** Ticking a task. Writes the row and queues it for the server in one go. */
export async function completeTask(
  enrollmentId: string,
  itemKey: string,
  scheduledDate: string,
  minutes: number,
  completedAt = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO task_progress
         (enrollment_id, block_id, scheduled_date, completed_at, minutes_credited)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(enrollment_id, block_id) DO UPDATE SET
         completed_at = excluded.completed_at,
         minutes_credited = excluded.minutes_credited`,
      [enrollmentId, itemKey, scheduledDate, completedAt, minutes],
    );
    await queue(db, 'task_progress', {
      enrollmentId,
      blockId: itemKey,
      scheduledDate,
      completedAt,
      minutesCredited: minutes,
    });
  });
}

export async function uncompleteTask(enrollmentId: string, itemKey: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM task_progress WHERE enrollment_id = ? AND block_id = ?', [
      enrollmentId,
      itemKey,
    ]);
    await queue(db, 'task_progress_delete', { enrollmentId, blockId: itemKey });
  });
}

export async function rateConfidence(
  enrollmentId: string,
  topicId: string,
  level: ConfidenceLevel,
  ratedAt = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO confidence (enrollment_id, topic_id, level, rated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(enrollment_id, topic_id) DO UPDATE SET
         level = excluded.level, rated_at = excluded.rated_at`,
      [enrollmentId, topicId, level, ratedAt],
    );
    await queue(db, 'confidence', { enrollmentId, topicId, level, ratedAt });
  });
}

export async function recordScore(
  enrollmentId: string,
  id: string,
  score: number,
  maxScore: number,
  takenAt = new Date().toISOString().slice(0, 10),
): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO test_score (enrollment_id, block_or_milestone_id, score, max_score, taken_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(enrollment_id, block_or_milestone_id) DO UPDATE SET
         score = excluded.score, max_score = excluded.max_score, taken_at = excluded.taken_at`,
      [enrollmentId, id, score, maxScore, takenAt],
    );
    await queue(db, 'test_score', { enrollmentId, id, score, maxScore, takenAt });
  });
}

export async function setRestDay(
  enrollmentId: string,
  date: string,
  isRest: boolean,
): Promise<void> {
  const db = await getDb();
  if (isRest) {
    await db.runAsync(
      'INSERT OR IGNORE INTO rest_day (enrollment_id, date) VALUES (?, ?)',
      [enrollmentId, date],
    );
  } else {
    await db.runAsync('DELETE FROM rest_day WHERE enrollment_id = ? AND date = ?', [
      enrollmentId,
      date,
    ]);
  }
  await queue(await getDb(), 'rest_day', { enrollmentId, date, isRest });
}

// --- sync queue -----------------------------------------------------------

async function queue(db: SQLite.SQLiteDatabase, kind: string, payload: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_queue (kind, payload_json, created_at) VALUES (?, ?, ?)',
    [kind, JSON.stringify(payload), new Date().toISOString()],
  );
}

export interface QueuedWrite {
  id: number;
  kind: string;
  payload_json: string;
}

export async function pendingWrites(limit = 200): Promise<QueuedWrite[]> {
  const db = await getDb();
  return db.getAllAsync<QueuedWrite>(
    'SELECT id, kind, payload_json FROM sync_queue ORDER BY id LIMIT ?',
    [limit],
  );
}

export async function clearWrites(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM sync_queue WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
}
