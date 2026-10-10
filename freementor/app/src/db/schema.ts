/**
 * On-device SQLite schema — APP_BUILD_SPEC §3.
 *
 * Everything the app needs to work offline lives here: the downloaded goal
 * file, the enrollment, the schedule, and every tick the learner makes. Table
 * and column names deliberately mirror the server's Postgres tables (product
 * plan §13) so the sync queue can ship rows across with no translation.
 *
 * Migrations are forward-only and numbered; `user_version` tracks where a
 * device is. Never edit an existing migration — add the next one.
 */

export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      -- The downloaded roadmap. One row per goal the learner has fetched.
      -- The json column holds the whole goals/<id>.json file.
      CREATE TABLE IF NOT EXISTS cached_goal (
        goal_id        TEXT PRIMARY KEY NOT NULL,
        version        TEXT NOT NULL,
        json           TEXT NOT NULL,
        bytes          INTEGER NOT NULL DEFAULT 0,
        downloaded_at  TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS enrollment (
        id            TEXT PRIMARY KEY NOT NULL,
        goal_id       TEXT NOT NULL REFERENCES cached_goal(goal_id),
        version       TEXT NOT NULL,
        start_date    TEXT NOT NULL,
        target_date   TEXT,
        -- trial | active | archived. A goal switch archives, never deletes.
        status        TEXT NOT NULL DEFAULT 'trial',
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_enrollment_status ON enrollment(status);

      CREATE TABLE IF NOT EXISTS schedule (
        enrollment_id        TEXT PRIMARY KEY NOT NULL REFERENCES enrollment(id),
        mode                 TEXT NOT NULL DEFAULT 'each_day',
        minutes_by_weekday   TEXT NOT NULL,
        study_time           TEXT,
        study_place          TEXT,
        language             TEXT NOT NULL DEFAULT 'en',
        -- CUET and other multi-track goals (scheduler rule 13).
        selected_subjects    TEXT,
        effective_from       TEXT NOT NULL
      );

      -- block_id holds PlannedItem.key, which is the block id for a normal
      -- task but a synthetic key for reviews, warm-ups and weekly tests.
      CREATE TABLE IF NOT EXISTS task_progress (
        enrollment_id    TEXT NOT NULL REFERENCES enrollment(id),
        block_id         TEXT NOT NULL,
        scheduled_date   TEXT,
        completed_at     TEXT NOT NULL,
        minutes_credited INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (enrollment_id, block_id)
      );
      CREATE INDEX IF NOT EXISTS idx_progress_date
        ON task_progress(enrollment_id, completed_at);

      CREATE TABLE IF NOT EXISTS confidence (
        enrollment_id   TEXT NOT NULL REFERENCES enrollment(id),
        topic_id        TEXT NOT NULL,
        level           TEXT NOT NULL,
        rated_at        TEXT NOT NULL,
        next_review_on  TEXT,
        PRIMARY KEY (enrollment_id, topic_id)
      );

      CREATE TABLE IF NOT EXISTS test_score (
        enrollment_id        TEXT NOT NULL REFERENCES enrollment(id),
        block_or_milestone_id TEXT NOT NULL,
        score                REAL NOT NULL,
        max_score            REAL NOT NULL,
        taken_at             TEXT NOT NULL,
        PRIMARY KEY (enrollment_id, block_or_milestone_id)
      );

      CREATE TABLE IF NOT EXISTS rest_day (
        enrollment_id  TEXT NOT NULL REFERENCES enrollment(id),
        date           TEXT NOT NULL,
        PRIMARY KEY (enrollment_id, date)
      );

      CREATE TABLE IF NOT EXISTS streak (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        current        INTEGER NOT NULL DEFAULT 0,
        best           INTEGER NOT NULL DEFAULT 0,
        last_study_date TEXT,
        grace_used_on  TEXT
      );

      -- Writes waiting to be replayed to the server when the device is online.
      CREATE TABLE IF NOT EXISTS sync_queue (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        kind         TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        attempts     INTEGER NOT NULL DEFAULT 0
      );

      -- Onboarding answers and settings. Single row.
      CREATE TABLE IF NOT EXISTS profile (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        name           TEXT,
        birth_year     INTEGER,
        qualification  TEXT,
        language       TEXT NOT NULL DEFAULT 'en',
        appearance     TEXT NOT NULL DEFAULT 'system',
        onboarded_at   TEXT
      );
    `,
  },
  {
    version: 2,
    sql: `
      -- The "if-then plan" from onboarding step 8 (product plan §5):
      -- "If it's 8 pm, I study at my desk." Sets the daily reminder time.
      ALTER TABLE profile ADD COLUMN study_hour INTEGER;
      ALTER TABLE profile ADD COLUMN study_place TEXT;
      ALTER TABLE profile ADD COLUMN quiet_from INTEGER;
      ALTER TABLE profile ADD COLUMN quiet_to INTEGER;
    `,
  },
  {
    version: 3,
    sql: `
      -- DEPRECATED, kept only because SQLite cannot drop a column cleanly.
      -- The welcome card now shows on every open until a plan is bought, and
      -- its ✕ hides it for the session only, so no dismissal is stored.
      ALTER TABLE profile ADD COLUMN welcome_dismissed_at TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      -- Optional profile photo (§8.9). Stored as a local file URI; §15 keeps
      -- it on the device until the backend exists.
      ALTER TABLE profile ADD COLUMN photo_uri TEXT;
    `,
  },
  {
    version: 5,
    sql: `
      -- The device mints its own enrollment id when a goal starts, because
      -- there may be no network for days. The server mints a UUID. This holds
      -- the server's id once the two have been introduced, so queued rows can
      -- be translated on the way out (see api/sync.ts).
      ALTER TABLE enrollment ADD COLUMN server_id TEXT;
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;
