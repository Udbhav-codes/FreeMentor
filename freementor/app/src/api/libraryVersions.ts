/**
 * Comparing cached roadmap versions against the published manifest.
 *
 * Its own module with no imports so the suite can load it: vitest parses
 * plain TypeScript, and libraryRefresh.ts reaches the database and, through
 * it, JSX.
 */

export interface VersionManifest {
  generated: string;
  goals: Record<string, string>;
}

/**
 * Which cached goals the manifest says are out of date.
 *
 * Deliberately conservative. A goal the manifest does not mention is left
 * alone: a missing entry means an incomplete manifest, not that the learner's
 * roadmap should be discarded. Goals the device has never downloaded are
 * ignored entirely, so this never pre-fetches the other 72 roadmaps.
 */
export function staleGoals(
  cached: Record<string, string>,
  manifest: Record<string, string>,
): string[] {
  return Object.keys(cached)
    .filter((id) => {
      const latest = manifest[id];
      return typeof latest === 'string' && latest !== cached[id];
    })
    .sort();
}
