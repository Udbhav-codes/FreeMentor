/**
 * Builds the learner's data export document — pure, so it can be tested.
 *
 * The privacy policy promises this at an exact menu path ("Profile → Account →
 * Export my progress"), so it is a published commitment, not a feature idea.
 *
 * ## Why the phone builds it, and not just the server
 *
 * The obvious design is to call `GET /account/export` and save the response.
 * It is also the wrong one here, for a reason specific to this app: **the
 * shipped build has no server**. `EXPO_PUBLIC_API_URL` is unset in
 * production, sync is inert, and a learner can use FreeMentor for weeks
 * entirely offline. A server-only export would have been a second button that
 * does nothing — which is the exact problem this is fixing.
 *
 * So the device's own SQLite is the primary source. It holds the roadmap, the
 * schedule and every tick, which is what a learner means by "my progress".
 * When a server IS reachable and the learner is signed in, its document is
 * merged in for the account-level records the phone never sees — purchases,
 * parental consent, the server's view of the account.
 *
 * This mirrors the decision already made for profile photos: the local copy
 * is the source and the server is the backup, not the reverse.
 *
 * ## The file says what it is
 *
 * An export that silently omits purchases because the device was offline is
 * worse than one that says so. `sources` records exactly where each part came
 * from, and `pending_sync_writes` tells the learner whether the device still
 * holds changes the server has not seen. Somebody comparing this file against
 * a support answer should be able to tell which is stale.
 */

/** Bumped when the shape changes. Matches the server's FORMAT_VERSION. */
export const FORMAT_VERSION = 1;

export interface LocalProfile {
  name: string | null;
  birthYear: number | null;
  qualification: string | null;
  language: string;
  appearance: string;
  onboardedAt: string | null;
  studyHour: number | null;
  studyPlace: string | null;
  /** Whether a photo exists — never the file URI, which is a device path. */
  photoUri: string | null;
}

export interface LocalEnrollment {
  id: string;
  goalId: string;
  goalName: string | null;
  version: string;
  startDate: string;
  targetDate: string | null;
  status: string;
  createdAt: string;
  schedule: Record<string, unknown> | null;
  completedTasks: Record<string, unknown>[];
  confidenceRatings: Record<string, unknown>[];
  testScores: Record<string, unknown>[];
  restDays: string[];
}

export interface LocalStreak {
  current: number;
  best: number;
  lastStudyDate: string | null;
  graceUsedOn: string | null;
}

export interface LocalData {
  profile: LocalProfile | null;
  enrollments: LocalEnrollment[];
  streak: LocalStreak | null;
  /** Rows still in the sync queue. A count, not the payloads. */
  pendingSyncWrites: number;
}

/** Whatever `GET /account/export` returned, or a reason it did not. */
export type ServerPart =
  | { kind: 'included'; document: Record<string, unknown> }
  | { kind: 'no_server' }
  | { kind: 'not_signed_in' }
  | { kind: 'failed'; reason: string };

export interface ExportDocument {
  _meta: Record<string, unknown>;
  account: Record<string, unknown> | null;
  app_settings: Record<string, unknown> | null;
  streak: LocalStreak | null;
  roadmaps: LocalEnrollment[];
  /** Only the server knows these. Null when it was not reachable. */
  purchases: unknown;
  parent_consent: unknown;
  server_record: unknown;
}

function sourceNote(server: ServerPart): string {
  switch (server.kind) {
    case 'included':
      return 'This device and the FreeMentor server.';
    case 'no_server':
      // The honest description of the shipped build today.
      return 'This device only. This build of the app does not connect to a server, so nothing was fetched.';
    case 'not_signed_in':
      return 'This device only. You were not signed in, so your account records were not fetched.';
    case 'failed':
      return `This device only. The server could not be reached (${server.reason}), so your account records were not fetched.`;
  }
}

/**
 * Whether the document is complete, i.e. covers the account-level records too.
 *
 * Exposed because the UI tells the learner before they share the file. An
 * export missing their purchase history is still useful, but they should not
 * find that out from a support reply.
 */
export function isComplete(server: ServerPart): boolean {
  return server.kind === 'included';
}

export function buildExport(
  local: LocalData,
  server: ServerPart,
  generatedAt: Date,
): ExportDocument {
  const doc = server.kind === 'included' ? server.document : null;

  return {
    _meta: {
      format_version: FORMAT_VERSION,
      generated_at: generatedAt.toISOString(),
      service: 'FreeMentor',
      sources: sourceNote(server),
      complete: isComplete(server),
      // A learner whose device holds unsynced work should be able to see
      // that, rather than wonder why the server's copy differs.
      pending_sync_writes: local.pendingSyncWrites,
      what_this_is:
        'Everything FreeMentor holds about you, as JSON. Your roadmap files are not included — they are our published library, the same for every learner, not data about you.',
    },

    // The server's account row when we have it, because it is authoritative
    // for email and the deletion flag; the device's otherwise.
    account:
      (doc?.account as Record<string, unknown> | undefined) ??
      (local.profile
        ? {
            name: local.profile.name,
            birth_year: local.profile.birthYear,
            qualification: local.profile.qualification,
            language: local.profile.language,
            onboarded_at: local.profile.onboardedAt,
          }
        : null),

    // Device-only settings. The server has no business knowing the learner
    // prefers dark mode, and does not.
    app_settings: local.profile
      ? {
          appearance: local.profile.appearance,
          study_hour: local.profile.studyHour,
          study_place: local.profile.studyPlace,
          // The URI is a path inside this app's sandbox and would be
          // meaningless, and slightly alarming, in a file somebody opens.
          has_profile_photo: local.profile.photoUri !== null,
        }
      : null,

    // The device wins for progress: it is where the ticks are made, and it
    // may hold work the server has not received yet.
    streak: local.streak,
    roadmaps: local.enrollments,

    purchases: doc?.purchases ?? null,
    parent_consent: doc?.parent_consent ?? null,
    server_record: doc
      ? { notification_preferences: doc.notification_preferences ?? null }
      : null,
  };
}

/** `freementor-export-2026-10-15.json` */
export function exportFileName(generatedAt: Date): string {
  const iso = generatedAt.toISOString().slice(0, 10);
  return `freementor-export-${iso}.json`;
}
