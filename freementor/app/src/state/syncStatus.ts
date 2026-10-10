/**
 * Plain-English wording for a sync outcome.
 *
 * Separate from SyncContext.tsx so it can be unit-tested: the suite parses
 * plain TypeScript, not JSX.
 */
import type { SyncOutcome } from '../api/sync.ts';

export function describeSync(outcome: SyncOutcome | null): string {
  if (!outcome) return 'Not synced yet this session';
  switch (outcome.status) {
    case 'synced':
      return outcome.rejected.length
        ? `Synced ${outcome.applied}, ${outcome.rejected.length} rejected`
        : `Synced ${outcome.applied} change${outcome.applied === 1 ? '' : 's'}`;
    case 'nothing_to_do':
      return 'Everything is already synced';
    case 'not_configured':
      return 'No server configured for this build';
    case 'offline':
      return 'Offline — will retry';
    case 'failed':
      return `Could not sync: ${outcome.reason}`;
  }
}
