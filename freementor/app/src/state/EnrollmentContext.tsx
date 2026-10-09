/**
 * The one piece of global state: which goal the learner is on, and the plan
 * the scheduler built from it.
 *
 * The plan is recomputed (not mutated) after every tick, which is cheap
 * because buildPlan is pure — and it is the only way rule 10's "recalculate
 * from the next incomplete task" can stay correct.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ConfidenceLevel, GoalFile } from '@freementor/shared';
import {
  activeEnrollment,
  completeTask,
  createEnrollment,
  loadGoalFile,
  loadProgress,
  loadSettings,
  rateConfidence,
  recordScore,
  setRestDay,
  uncompleteTask,
  type EnrollmentRow,
} from '../db/index.ts';
import {
  buildPlan,
  EMPTY_PROGRESS,
  type Plan,
  type ProgressState,
  type StudySettings,
} from '../scheduler/index.ts';

/** Today as a local calendar date — the scheduler never reads a clock itself. */
export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

interface EnrollmentState {
  loading: boolean;
  enrollment: EnrollmentRow | null;
  goal: GoalFile | null;
  settings: StudySettings | null;
  plan: Plan | null;
  /** The raw ticks behind the plan — the Day view needs the ratings. */
  progress: ProgressState | null;
  /** Rebuilds the plan from SQLite. Called after every write. */
  refresh: () => Promise<void>;
  start: (goal: GoalFile, settings: StudySettings) => Promise<void>;
  toggleTask: (itemKey: string, date: string, minutes: number, done: boolean) => Promise<void>;
  rate: (topicId: string, level: ConfidenceLevel) => Promise<void>;
  score: (id: string, score: number, maxScore: number) => Promise<void>;
  markRestDay: (date: string, isRest: boolean) => Promise<void>;
}

const Ctx = createContext<EnrollmentState | null>(null);

export function EnrollmentProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [goal, setGoal] = useState<GoalFile | null>(null);
  const [settings, setSettings] = useState<StudySettings | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const refresh = useCallback(async () => {
    const row = await activeEnrollment();
    if (!row) {
      setEnrollment(null);
      setGoal(null);
      setSettings(null);
      setPlan(null);
      setProgress(null);
      setLoading(false);
      return;
    }

    const [file, cfg] = await Promise.all([loadGoalFile(row.goal_id), loadSettings(row.id)]);
    if (!file || !cfg) {
      // The enrollment outlived its cached file (cleared storage). Treat it as
      // no enrollment rather than crashing the Roadmap tab.
      setEnrollment(null);
      setGoal(null);
      setPlan(null);
      setLoading(false);
      return;
    }

    const state = await loadProgress(row.id);
    setEnrollment(row);
    setGoal(file);
    setSettings(cfg);
    setProgress(state);
    setPlan(buildPlan({ goal: file, settings: cfg, progress: state, today: todayIso() }));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const start = useCallback(
    async (file: GoalFile, cfg: StudySettings) => {
      await createEnrollment(file, cfg);
      await refresh();
    },
    [refresh],
  );

  const toggleTask = useCallback(
    async (itemKey: string, date: string, minutes: number, done: boolean) => {
      if (!enrollment) return;
      if (done) await completeTask(enrollment.id, itemKey, date, minutes);
      else await uncompleteTask(enrollment.id, itemKey);
      await refresh();
    },
    [enrollment, refresh],
  );

  const rate = useCallback(
    async (topicId: string, level: ConfidenceLevel) => {
      if (!enrollment) return;
      await rateConfidence(enrollment.id, topicId, level);
      await refresh();
    },
    [enrollment, refresh],
  );

  const score = useCallback(
    async (id: string, value: number, maxScore: number) => {
      if (!enrollment) return;
      await recordScore(enrollment.id, id, value, maxScore);
      await refresh();
    },
    [enrollment, refresh],
  );

  const markRestDay = useCallback(
    async (date: string, isRest: boolean) => {
      if (!enrollment) return;
      await setRestDay(enrollment.id, date, isRest);
      await refresh();
    },
    [enrollment, refresh],
  );

  const value = useMemo<EnrollmentState>(
    () => ({
      loading,
      enrollment,
      goal,
      settings,
      plan,
      progress,
      refresh,
      start,
      toggleTask,
      rate,
      score,
      markRestDay,
    }),
    [
      loading,
      enrollment,
      goal,
      settings,
      plan,
      progress,
      refresh,
      start,
      toggleTask,
      rate,
      score,
      markRestDay,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEnrollment(): EnrollmentState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useEnrollment must be used inside <EnrollmentProvider>');
  return ctx;
}

/** The plan's entry for a given date, if there is one. */
export function useDay(date: string) {
  const { plan } = useEnrollment();
  return plan?.days.find((d) => d.date === date) ?? null;
}

export { EMPTY_PROGRESS };
