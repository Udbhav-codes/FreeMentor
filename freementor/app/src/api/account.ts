/**
 * Account deletion against the server — DPDP Act 2023 §12, the right to
 * erasure, and a Google Play requirement.
 *
 * ## Why this file exists
 *
 * The Profile screen's "Delete my account" wiped the device and stopped
 * there. `DELETE /account/me` had been built, tested and verified against
 * Postgres, and the 30-day purge was scheduled in pg_cron — but nothing in
 * the app ever called it. A learner tapping delete got a clean phone and a
 * server row that stayed exactly where it was, while the privacy policy
 * promised deletion at that precise menu path.
 *
 * ## A local wipe is not an erasure
 *
 * The important consequence, and the reason the UI asks rather than assumes:
 * if the server call fails, erasing the device makes things *worse*. The
 * learner believes they are done, and the only copy of the evidence that they
 * asked — the app, signed in — is the thing that was just destroyed. So a
 * failure is reported, and the choice to wipe the device anyway is theirs.
 *
 * The web page at `/delete-account` is the fallback and needs no app at all,
 * which is also why Play accepts it.
 */
import { api, apiConfigured, authToken, errorDetail } from './client.ts';

export type DeletionOutcome =
  /** The server has the account marked; the purge follows within 30 days. */
  | { kind: 'scheduled'; purgeWithinDays: string }
  /** No server in this build. A device wipe is all there is to do. */
  | { kind: 'no_server' }
  /** Not signed in — including under the development sign-in bypass. */
  | { kind: 'not_signed_in' }
  /** Already marked for deletion by an earlier attempt or the web page. */
  | { kind: 'already_scheduled' }
  | { kind: 'failed'; reason: string };

/**
 * Ask the server to delete the caller's account.
 *
 * There is no account identifier in the request: the endpoint deletes
 * whoever the token belongs to, which is what makes it impossible to point at
 * somebody else.
 *
 * Never throws.
 */
export async function requestAccountDeletion(): Promise<DeletionOutcome> {
  if (!apiConfigured) return { kind: 'no_server' };
  if (!(await authToken())) return { kind: 'not_signed_in' };

  try {
    const response = await api('/account/me', { method: 'DELETE' });

    if (response.status === 202) {
      const body = (await response.json().catch(() => ({}))) as {
        purge_within_days?: string;
      };
      return { kind: 'scheduled', purgeWithinDays: body.purge_within_days ?? '30' };
    }

    // current_user refuses an account already marked for deletion, so a
    // second tap — or a tap after using the web page — lands here. That is
    // success as far as the learner is concerned, not an error.
    if (response.status === 403) return { kind: 'already_scheduled' };

    return {
      kind: 'failed',
      reason: await errorDetail(response, `The server returned ${response.status}.`),
    };
  } catch (error) {
    return {
      kind: 'failed',
      reason: error instanceof Error ? error.message : 'The server could not be reached.',
    };
  }
}

/** Whether the server now holds a deletion request. */
export function isErased(outcome: DeletionOutcome): boolean {
  return outcome.kind === 'scheduled' || outcome.kind === 'already_scheduled';
}

/**
 * Whether the device should be wiped without asking again.
 *
 * True when the server is done with it, and also when there is no server to
 * involve — a build with no API has nothing but the device, and refusing to
 * wipe it would leave the learner with no way to delete anything at all.
 */
export function mayWipeDevice(outcome: DeletionOutcome): boolean {
  return isErased(outcome) || outcome.kind === 'no_server' || outcome.kind === 'not_signed_in';
}
