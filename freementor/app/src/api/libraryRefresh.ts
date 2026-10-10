/**
 * Picking up a newer library without an app update.
 *
 * The problem this fixes: getGoalFile() returned the cached copy whenever one
 * existed, nothing ever passed `force`, and the bundled catalog.json carries
 * no version — so a device that had downloaded a roadmap kept it forever. A
 * corrected link, a backfilled video duration or a changed access tier could
 * never reach an existing install.
 *
 * How it works: publish_library writes a small `versions.json` manifest to the
 * same CDN bucket as the goal files, listing each goal's current version. The
 * app fetches that (a couple of KB), compares it with what SQLite holds, and
 * re-downloads only what has actually changed. catalog.json is 112 KB and
 * ships inside the bundle, so it could be used for neither job.
 *
 * Failure is always a no-op. No network, a 404, malformed JSON, a goal file
 * that will not parse — the cached roadmap stays exactly as it is and the
 * learner notices nothing. A stale roadmap is a far better outcome than a
 * missing one, and the whole app works offline by design.
 */
export { staleGoals, type VersionManifest } from './libraryVersions.ts';

import { getGoalFile, libraryBaseUrl } from './library.ts';
import { staleGoals, type VersionManifest } from './libraryVersions.ts';
import { activeEnrollment, cachedGoalVersions, setEnrollmentVersion } from '../db/index.ts';

export type RefreshOutcome =
  | { status: 'up_to_date'; checked: number }
  | { status: 'updated'; updated: string[]; failed: string[] }
  /** Nothing cached yet, so there is nothing to refresh. */
  | { status: 'nothing_cached' }
  | { status: 'unavailable'; reason: string };

/** Fetches the manifest. Returns null rather than throwing. */
export async function fetchManifest(): Promise<VersionManifest | null> {
  try {
    // Cache-busted on purpose. Supabase Storage serves these through a CDN,
    // and a cached manifest would hide the very update being looked for.
    // A query param rather than `cache: 'no-store'`, which React Native's
    // fetch does not implement, or a no-cache header, which an edge cache is
    // free to ignore. The file is under a kilobyte, so re-fetching it costs
    // nothing worth saving.
    const response = await fetch(`${libraryBaseUrl}/versions.json?t=${Date.now()}`);
    if (!response.ok) return null;
    const parsed = (await response.json()) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as VersionManifest).goals !== 'object'
    ) {
      return null;
    }
    return parsed as VersionManifest;
  } catch {
    return null;
  }
}

/**
 * Re-downloads any cached goal the CDN has a different version of.
 *
 * Only goals already on the device are touched — this never pre-fetches the
 * other 72 roadmaps behind the learner's back.
 */
export async function refreshLibrary(): Promise<RefreshOutcome> {
  const cached = await cachedGoalVersions().catch(() => ({}) as Record<string, string>);
  if (Object.keys(cached).length === 0) return { status: 'nothing_cached' };

  const manifest = await fetchManifest();
  if (!manifest) return { status: 'unavailable', reason: 'could not read the version manifest' };

  const stale = staleGoals(cached, manifest.goals);
  if (stale.length === 0) return { status: 'up_to_date', checked: Object.keys(cached).length };

  const updated: string[] = [];
  const failed: string[] = [];
  const enrollment = await activeEnrollment().catch(() => null);

  for (const goalId of stale) {
    try {
      const file = await getGoalFile(goalId, true);
      updated.push(goalId);
      // Keep the enrollment's recorded version in step with what it now has.
      if (enrollment && enrollment.goal_id === goalId) {
        await setEnrollmentVersion(enrollment.id, file.goal.version);
      }
    } catch {
      // saveGoalFile only runs on a successful parse, so the previous copy is
      // still intact and still usable.
      failed.push(goalId);
    }
  }

  return { status: 'updated', updated, failed };
}
