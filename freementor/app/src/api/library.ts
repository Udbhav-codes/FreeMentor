/**
 * Fetching a goal's roadmap file.
 *
 * The catalog ships inside the app bundle; a goal file is downloaded only
 * when the learner picks that goal (product plan decision #18) and is then
 * cached in SQLite forever.
 *
 * Goal files now come from Supabase Storage over a CDN. The dev file server
 * remains the fallback so the app still runs on a laptop with no network, and
 * so a contributor can work on the library without publishing it.
 *
 * The bucket is public by design: these files hold only links to material
 * that is already public, no learner data, and the app must be able to fetch
 * one before anybody has paid. What is paid for is the scheduling and the
 * tracking, not secrecy over a list of URLs.
 */
import type { Catalog, CatalogGoal, GoalFile } from '@freementor/shared';
import { parseHints } from '@freementor/shared';
import catalogJson from '../catalog/catalog.json';
import { loadGoalFile, saveGoalFile } from '../db/index.ts';

export const catalog = catalogJson as unknown as Catalog;

export function goalsByCategory(): { category: string; goals: CatalogGoal[] }[] {
  const out = new Map<string, CatalogGoal[]>();
  for (const goal of catalog.goals) {
    const list = out.get(goal.category);
    if (list) list.push(goal);
    else out.set(goal.category, [goal]);
  }
  return [...out].map(([category, goals]) => ({
    category,
    goals: goals.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Global search across goals — product plan §8.13. */
export function searchGoals(query: string): CatalogGoal[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return catalog.goals
    .filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.group?.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.phases?.some((p) => p.modules.some((m) => m.toLowerCase().includes(q))),
    )
    .sort((a, b) => {
      // Exact-ish name matches first, then goals that are actually playable.
      const an = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bn = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return an - bn || (a.status === 'full' ? 0 : 1) - (b.status === 'full' ? 0 : 1);
    });
}

/**
 * Where goal files come from. In dev this is the static server started by
 * `npm run library:serve`; set EXPO_PUBLIC_LIBRARY_URL to your machine's LAN
 * address so the phone can reach it (localhost means the phone itself).
 */
const SUPABASE_LIBRARY =
  'https://demkvsslqfkreicbjjmm.supabase.co/storage/v1/object/public/library';

export const libraryBaseUrl = process.env.EXPO_PUBLIC_LIBRARY_URL ?? SUPABASE_LIBRARY;

export class GoalDownloadError extends Error {
  constructor(
    message: string,
    readonly goalId: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GoalDownloadError';
  }
}

/**
 * Returns the cached copy if there is one, otherwise downloads and caches it.
 * Pass `force` to re-download when the catalog advertises a newer version.
 */
export async function getGoalFile(goalId: string, force = false): Promise<GoalFile> {
  if (!force) {
    const cached = await loadGoalFile(goalId);
    if (cached) return cached;
  }

  const url = `${libraryBaseUrl}/goals/${goalId}.json`;
  let raw: string;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new GoalDownloadError(
        `Server returned ${response.status} for ${goalId}`,
        goalId,
      );
    }
    raw = await response.text();
  } catch (error) {
    if (error instanceof GoalDownloadError) throw error;
    // Offline with no cache is the one case the learner must be told about.
    throw new GoalDownloadError(
      `Could not download the ${goalId} roadmap. Check your connection and try again.`,
      goalId,
      error,
    );
  }

  let parsed: GoalFile;
  try {
    parsed = JSON.parse(raw) as GoalFile;
  } catch (error) {
    throw new GoalDownloadError(`The ${goalId} roadmap file is corrupt.`, goalId, error);
  }

  if (parsed.schema_version !== '1.0' || !parsed.goal?.id || !Array.isArray(parsed.topics)) {
    throw new GoalDownloadError(`The ${goalId} roadmap file is not a valid library file.`, goalId);
  }

  const file: GoalFile = { ...parsed, scheduler_hints: parseHints(parsed.scheduler_hints) };
  await saveGoalFile(file, raw);
  return file;
}

/** Catalog entries that actually have a roadmap to download. */
export const isPlayable = (goal: CatalogGoal): boolean => goal.status === 'full';
