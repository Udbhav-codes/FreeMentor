/**
 * Draining the sync queue.
 *
 * Every write the learner makes is recorded locally first and queued here —
 * the app has to work on a train with no signal, so the device is the source
 * of truth and the server catches up later.
 *
 * The id problem: the device mints its own enrollment id when a goal starts
 * (it has to — there may be no network for days), while the server mints a
 * UUID. Those are different identities for the same enrollment. The first
 * successful sync registers the enrollment and stores the server's id
 * alongside the local one; every queued row is translated on the way out.
 * Without that, every sync would be rejected as "unknown enrollment".
 *
 * Nothing here ever throws at the caller. A failed sync is normal — the queue
 * simply stays put and is retried.
 */
import { accessToken } from '../auth/supabase.ts';
import {
  activeEnrollment,
  clearWrites,
  getDb,
  loadSettings,
  pendingWrites,
  type EnrollmentRow,
} from '../db/index.ts';

/** Where the API lives. Set per build; empty means "not configured yet". */
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

export type SyncOutcome =
  | { status: 'synced'; applied: number; rejected: string[] }
  | { status: 'nothing_to_do' }
  | { status: 'not_configured' }
  | { status: 'offline' }
  | { status: 'failed'; reason: string };

/**
 * The signed-in learner's access token.
 *
 * Falls back to EXPO_PUBLIC_DEV_TOKEN so the sync path can still be exercised
 * against a server running in local mode, but a real session always wins.
 */
async function authToken(): Promise<string | null> {
  const token = await accessToken().catch(() => null);
  return token ?? process.env.EXPO_PUBLIC_DEV_TOKEN ?? null;
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await authToken();
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Makes sure the server knows about this enrollment, and returns its id
 * there. Stored locally so this happens once, not on every sync.
 */
async function serverEnrollmentId(local: EnrollmentRow): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ server_id: string | null }>(
    'SELECT server_id FROM enrollment WHERE id = ?',
    [local.id],
  );
  if (row?.server_id) return row.server_id;

  const settings = await loadSettings(local.id);
  if (!settings) return null;

  const response = await api('/enrollments', {
    method: 'POST',
    body: JSON.stringify({
      goal_id: local.goal_id,
      start_date: local.start_date,
      target_date: local.target_date,
      minutes_by_weekday: settings.minutesByWeekday,
      language: settings.language,
      selected_subjects: settings.selectedDomainSubjects ?? [],
    }),
  });
  if (!response.ok) return null;

  const created = (await response.json()) as { id: string };
  await db.runAsync('UPDATE enrollment SET server_id = ? WHERE id = ?', [created.id, local.id]);
  return created.id;
}

/**
 * Sends everything queued. Rows are deleted only once the server has
 * confirmed them, so a dropped connection costs a retry and never a tick.
 */
export async function syncNow(): Promise<SyncOutcome> {
  if (!apiBaseUrl) return { status: 'not_configured' };

  const queued = await pendingWrites();
  if (queued.length === 0) return { status: 'nothing_to_do' };

  const enrollment = await activeEnrollment();
  if (!enrollment) return { status: 'nothing_to_do' };

  try {
    const remoteId = await serverEnrollmentId(enrollment);
    if (!remoteId) return { status: 'failed', reason: 'could not register the enrollment' };

    const operations = queued.map((write) => {
      const payload = JSON.parse(write.payload_json) as Record<string, unknown>;
      return toOperation(write.kind, payload, remoteId);
    });

    const response = await api('/progress', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    });

    if (!response.ok) {
      return { status: 'failed', reason: `server returned ${response.status}` };
    }

    const result = (await response.json()) as { applied: number; rejected: string[] };
    // Clear even rows the server rejected: a malformed row will never become
    // valid, and leaving it would block the queue behind it forever.
    await clearWrites(queued.map((w) => w.id));
    return { status: 'synced', applied: result.applied, rejected: result.rejected };
  } catch {
    // No connection, DNS failure, airplane mode — all normal, all retried.
    return { status: 'offline' };
  }
}

/** Local queue payloads use camelCase; the API speaks snake_case. */
function toOperation(
  kind: string,
  payload: Record<string, unknown>,
  enrollmentId: string,
): Record<string, unknown> {
  switch (kind) {
    case 'task_progress':
      return {
        kind,
        enrollment_id: enrollmentId,
        block_id: payload.blockId,
        scheduled_date: payload.scheduledDate ?? null,
        completed_at: payload.completedAt,
        minutes_credited: payload.minutesCredited ?? 0,
      };
    case 'task_progress_delete':
      return { kind, enrollment_id: enrollmentId, block_id: payload.blockId };
    case 'confidence':
      return {
        kind,
        enrollment_id: enrollmentId,
        topic_id: payload.topicId,
        level: payload.level,
        rated_at: payload.ratedAt,
      };
    case 'test_score':
      return {
        kind,
        enrollment_id: enrollmentId,
        block_or_milestone_id: payload.id,
        score: payload.score,
        max_score: payload.maxScore,
        taken_at: payload.takenAt,
      };
    case 'rest_day':
      return {
        kind,
        enrollment_id: enrollmentId,
        date: payload.date,
        is_rest: payload.isRest,
      };
    default:
      return { kind, enrollment_id: enrollmentId, ...payload };
  }
}
