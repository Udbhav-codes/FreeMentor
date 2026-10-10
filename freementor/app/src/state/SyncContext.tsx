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
import { useAuth } from '../auth/AuthContext.tsx';

export { describeSync } from './syncStatus.ts';

/** Don't re-sync more often than this on rapid foreground/background flips. */
const MIN_GAP_MS = 30_000;

interface SyncState {
  /** True while a drain is in flight. */
  syncing: boolean;
  /** The last result, or null if sync has never run this session. */
  last: SyncOutcome | null;
  /** When `last` was recorded. */
  lastAt: Date | null;
  /** Force a drain, ignoring the throttle. For a pull-to-refresh or a button. */
  sync: () => Promise<SyncOutcome>;
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

  // On foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run(false);
    });
    return () => subscription.remove();
  }, [run]);

  const value = useMemo<SyncState>(
    () => ({ syncing, last, lastAt, sync: () => run(true) }),
    [syncing, last, lastAt, run],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}

