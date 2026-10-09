/**
 * Derives the streak from the ticks already in SQLite, so it can never drift
 * out of sync with progress the way a stored counter would.
 */
import { useMemo } from 'react';
import { computeStreak, type StreakState } from '../progress/streak.ts';
import { todayIso, useEnrollment } from './EnrollmentContext.tsx';

export function useStreak(): StreakState {
  const { progress } = useEnrollment();

  return useMemo(() => {
    const studyDates = new Set<string>();
    for (const record of Object.values(progress?.completed ?? {})) {
      studyDates.add(record.completedAt);
    }
    return computeStreak({
      studyDates,
      restDays: progress?.restDays ?? [],
      today: todayIso(),
    });
  }, [progress]);
}
