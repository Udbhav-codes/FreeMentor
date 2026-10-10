/**
 * Which cached roadmaps count as stale.
 *
 * The bug this closes: nothing ever compared versions, so a device that had
 * downloaded a roadmap kept it forever and no library correction — a fixed
 * link, a backfilled duration, a changed access tier — could reach it.
 *
 * The comparison is deliberately conservative. Re-downloading is cheap and
 * safe; throwing away a roadmap a learner depends on because a manifest was
 * incomplete is not.
 */
import { describe, expect, it } from 'vitest';
import { staleGoals } from '../libraryVersions.ts';

describe('staleGoals', () => {
  it('finds a goal the CDN has a newer version of', () => {
    expect(staleGoals({ c: '2026.1' }, { c: '2026.2' })).toEqual(['c']);
  });

  it('ignores a goal already at the published version', () => {
    expect(staleGoals({ c: '2026.2' }, { c: '2026.2' })).toEqual([]);
  });

  it('leaves alone a cached goal the manifest does not mention', () => {
    // An incomplete or half-written manifest must not be read as "this
    // roadmap no longer exists".
    expect(staleGoals({ c: '2026.1', java: '2026.1' }, { java: '2026.1' })).toEqual([]);
  });

  it('never pre-fetches goals the device has not downloaded', () => {
    // The manifest lists every published goal; only the ones in hand matter.
    expect(staleGoals({}, { c: '2026.2', java: '2026.2' })).toEqual([]);
    expect(staleGoals({ c: '2026.2' }, { c: '2026.2', java: '2026.3' })).toEqual([]);
  });

  it('re-downloads when the version differs at all, not only when it rises', () => {
    // A rolled-back publish is still a mismatch, and the CDN is the authority
    // on what the current library is. Comparing strings rather than ordering
    // also avoids inventing a version-sort for "2026.10" vs "2026.9".
    expect(staleGoals({ c: '2026.2' }, { c: '2026.1' })).toEqual(['c']);
  });

  it('reports several stale goals in a stable order', () => {
    const stale = staleGoals(
      { sql: '2026.1', c: '2026.1', java: '2026.2' },
      { sql: '2026.2', c: '2026.2', java: '2026.2' },
    );
    expect(stale).toEqual(['c', 'sql']);
  });

  it('ignores a manifest entry that is not a version string', () => {
    // Malformed JSON should not trigger a pointless re-download loop.
    const manifest = { c: null, java: 42, sql: undefined } as unknown as Record<string, string>;
    expect(staleGoals({ c: '2026.1', java: '2026.1', sql: '2026.1' }, manifest)).toEqual([]);
  });
});
