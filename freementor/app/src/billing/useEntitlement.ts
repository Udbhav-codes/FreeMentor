/**
 * The current entitlement, for screens that gate on it.
 *
 * entitlement.ts stays pure; this is the impure half — it reads the
 * enrollment's created_at, the trial high-water mark, and (from M5) the
 * verified purchase, then calls entitlementFor().
 *
 * The high-water mark is the newest moment this device has ever reported. It
 * is persisted and fed back in so winding the clock backwards cannot renew an
 * expired trial. It is kept in AsyncStorage rather than SQLite deliberately:
 * resetDatabase() clears the learner's progress on a goal reset, and an
 * expired trial must not come back to life because somebody reset their
 * roadmap.
 */
import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { entitlementFor, type Entitlement } from './entitlement.ts';
import { trialStatus, type TrialStatus } from './trial.ts';
import { trialStartFor } from './trialStart.ts';
import { useEnrollment } from '../state/EnrollmentContext.tsx';

const HWM_KEY = 'freementor.trialHighWater';

/** Cached per process so three screens do not each hit storage on mount. */
let cachedHighWater: string | null = null;

async function readHighWater(): Promise<string | null> {
  if (cachedHighWater) return cachedHighWater;
  try {
    cachedHighWater = await AsyncStorage.getItem(HWM_KEY);
  } catch {
    cachedHighWater = null;
  }
  return cachedHighWater;
}

/** Only ever moves forward. */
async function noteNow(now: Date): Promise<void> {
  const iso = now.toISOString();
  if (cachedHighWater && cachedHighWater >= iso) return;
  cachedHighWater = iso;
  try {
    await AsyncStorage.setItem(HWM_KEY, iso);
  } catch {
    // A device with no writable storage simply loses the deterrent.
  }
}

export interface EntitlementState {
  entitlement: Entitlement;
  /** null when no goal is enrolled yet, so there is no trial running. */
  trial: TrialStatus | null;
}

export function useEntitlement(): EntitlementState {
  const { enrollment } = useEnrollment();
  const [highWater, setHighWater] = useState<string | null>(cachedHighWater);
  const [startedAt, setStartedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const seen = await readHighWater();
      if (alive) setHighWater(seen);
      await noteNow(new Date());
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The remembered start for this goal, which survives a roadmap reset.
  useEffect(() => {
    let alive = true;
    if (!enrollment) {
      setStartedAt(null);
      return;
    }
    void trialStartFor(enrollment.goal_id, enrollment.created_at)
      .then((iso) => {
        if (alive) setStartedAt(iso);
      })
      .catch(() => {
        if (alive) setStartedAt(enrollment.created_at);
      });
    return () => {
      alive = false;
    };
  }, [enrollment]);

  return useMemo<EntitlementState>(() => {
    if (!enrollment) {
      // No goal yet: nothing to gate, and no trial has started.
      return { entitlement: 'trial', trial: null };
    }
    const trial = trialStatus({
      // Until the remembered start has loaded, use the enrollment's own date:
      // it is never LATER than the remembered one, so the worst case is a
      // brief over-estimate of time left rather than a wrongly locked app.
      startedAt: startedAt ?? enrollment.created_at,
      now: new Date(),
      highWaterMark: highWater,
    });
    return {
      // M5 passes the verified Play purchase here. Until then nothing is
      // bought, so the clock alone decides.
      entitlement: entitlementFor({ trialPhase: trial.phase, purchase: null }),
      trial,
    };
  }, [enrollment, highWater, startedAt]);
}
