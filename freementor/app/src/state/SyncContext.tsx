/**
 * Draining the sync queue — the trigger side of app/src/api/sync.ts.
 *
 * syncNow() knew how to drain the queue but nothing ever called it, so every
 * tick a learner made piled up locally forever. This is what calls it.
 *
 * When it runs:
 *   · when a session appears, i.e. straight after sign-in
 *   · when the app comes back to the foreground
 * Both are cheap because syncNow() returns `nothing_to_do` on an empty queue.
 *
 * What it deliberately does not do: run on every write. A tick is recorded
 * locally and is already safe there; firing a request per checkbox would
 * waste the learner's data for no gain. The queue drains on the next
 * foreground instead.
 *
 * The same foreground moment also checks whether the CDN has a newer version
 * of any cached roadmap (see api/libraryRefresh.ts). It is a separate concern
 * from the sync queue — one is the learner's progress going up, the other is
 * corrected library content coming down — but it wants exactly the same
 * trigger, and doing both here keeps the app to one wake-up rather than two.
 *
 * Nothing here surfaces an error to the learner. A failed sync is the normal
 * case on Indian mobile data — the queue stays put and is retried.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { apiBaseUrl, syncNow, type SyncOutcome } from '../api/sync.ts';
import { refreshLibrary } from '../api/libraryRefresh.ts';
import { useAuth } from '../auth/AuthContext.tsx';

export { describeSync } from './syncStatus.ts';

/** Don't re-sync more often than this on rapid foreground/background flips. */
const MIN_GAP_MS = 30_000;

/** How often to re-check the library manifest. Content changes rarely. */
const LIBRARY_CHECK_GAP_MS = 6 * 60 * 60 * 1000;

interface SyncState {
  /** True while a drain is in flight. */
  syncing: boolean;
  /** The last result, or null if sync has never run this session. */
  last: SyncOutcome | null;
  /** When `last` was recorded. */
  lastAt: Date | null;
  /** Force a drain, ignoring the throttle. For a pull-to-refresh or a button. */
  sync: () => Promise<SyncOutcome>;
  /** Goal ids whose roadmap was refreshed from the CDN this session. */
  refreshedGoals: string[];
}

const Ctx = createContext<SyncState | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<SyncOutcome | null>(null);
  const [lastAt, setLastAt] = useState<Date | null>(null);

  // Refs, not state: these guard against overlapping runs and must be read
  // at call time, not at render time.
  const inFlight = useRef(false);
  const lastRunAt = useRef(0);
  const libraryCheckedAt = useRef(0);
  const [refreshedGoals, setRefreshedGoals] = useState<string[]>([]);

  /**
   * Checks the CDN for newer roadmap content. Independent of the sync queue
   * and of being signed in: corrected library content is not the learner's
   * data, and someone using the app without an account still deserves a
   * roadmap whose links work.
   */
  const checkLibrary = useCallback(async (force: boolean) => {
    if (!force && Date.now() - libraryCheckedAt.current < LIBRARY_CHECK_GAP_MS) return;
    libraryCheckedAt.current = Date.now();
    const outcome = await refreshLibrary().catch(() => null);
    if (outcome?.status === 'updated' && outcome.updated.length > 0) {
      setRefreshedGoals(outcome.updated);
    }
  }, []);

  const run = useCallback(async (force: boolean): Promise<SyncOutcome> => {
    if (!apiBaseUrl) return { status: 'not_configured' };
    if (inFlight.current) return { status: 'nothing_to_do' };
    if (!force && Date.now() - lastRunAt.current < MIN_GAP_MS) {
      return { status: 'nothing_to_do' };
    }

    inFlight.current = true;
    setSyncing(true);
    try {
      const outcome = await syncNow();
      lastRunAt.current = Date.now();
      setLast(outcome);
      setLastAt(new Date());
      return outcome;
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, []);

  // On sign-in. Also covers a token refresh, which is harmless.
  useEffect(() => {
    if (session) void run(false);
  }, [session, run]);

  // On foreground, and once at startup — a learner who never backgrounds the
  // app would otherwise never get a library check.
  useEffect(() => {
    void checkLibrary(false);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void run(false);
      void checkLibrary(false);
    });
    return () => subscription.remove();
  }, [run, checkLibrary]);

  const value = useMemo<SyncState>(
    () => ({ syncing, last, lastAt, sync: () => run(true), refreshedGoals }),
    [syncing, last, lastAt, run, refreshedGoals],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}

