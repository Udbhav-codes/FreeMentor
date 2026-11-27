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
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { entitlementFor, type Entitlement } from './entitlement.ts';
import {
  TRIAL_ENABLED,
  reconcileWithServer,
  trialStatus,
  type ServerTrialView,
  type TrialStatus,
} from './trial.ts';
import { trialStartFor } from './trialStart.ts';
import { fetchEntitlement } from '../api/billing.ts';
import { loadProfile } from '../db/profile.ts';
import {
  cancelTrialEndReminder,
  scheduleTrialEndReminder,
} from '../notifications/daily.ts';
import { planTrialReminder, trialReminderCopy } from '../notifications/trialReminder.ts';
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

// The reminder is rescheduled only when its plan actually changes, because
// this hook runs on every screen that gates and each would otherwise
// cancel and re-create it.
let lastReminderKey: string | null = null;

async function syncTrialReminder(
  endsAt: string | null,
  purchased: 'basic' | 'premium' | null,
): Promise<void> {
  const plan = planTrialReminder({ endsAt, now: new Date(), purchased });
  const key = plan.kind === 'schedule' ? plan.at.toISOString() : 'cancel';
  if (key === lastReminderKey) return;
  lastReminderKey = key;
  try {
    if (plan.kind === 'cancel') {
      await cancelTrialEndReminder();
      return;
    }
    const language = (await loadProfile())?.language ?? 'en';
    await scheduleTrialEndReminder(plan.at, trialReminderCopy(language));
  } catch {
    // A reminder is a convenience; it must never break the screen.
  }
}

export interface EntitlementState {
  entitlement: Entitlement;
  /** null when no goal is enrolled yet, so there is no trial running. */
  trial: TrialStatus | null;
  /** The verified plan, or null if nothing is bought / nothing known yet. */
  purchased: 'basic' | 'premium' | null;
  /** Re-reads the server, for right after a purchase completes. */
  refresh: () => Promise<void>;
}

export function useEntitlement(): EntitlementState {
  const { enrollment } = useEnrollment();
  const [highWater, setHighWater] = useState<string | null>(cachedHighWater);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [purchased, setPurchased] = useState<'basic' | 'premium' | null>(null);
  // What the server last said about this trial. Null offline or signed out, in
  // which case the device clock and its high-water mark decide, as before.
  const [serverTrial, setServerTrial] = useState<ServerTrialView | null>(null);

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

  // The server is authoritative about what was bought: a purchase lives on
  // the account, not on the device, so it has to survive a reinstall and a
  // new phone. A null answer means "not known", not "nothing bought", so an
  // unreachable server never revokes a plan somebody paid for.
  const loadPurchase = useCallback(async () => {
    const result = await fetchEntitlement(enrollment?.id ?? null).catch(() => null);
    if (!result) return;
    setPurchased(result.plan);
    if (result.trial) {
      setServerTrial({
        startedAt: result.trial.startedAt,
        serverTime: result.trial.serverTime,
        receivedAt: new Date(),
      });
      // The server's time becomes the floor, so winding the device clock back
      // later cannot go below what we were just told.
      const serverNow = new Date(result.trial.serverTime);
      if (!Number.isNaN(serverNow.getTime())) {
        await noteNow(serverNow);
        setHighWater(cachedHighWater);
      }
    }
  }, [enrollment?.id]);

  useEffect(() => {
    void loadPurchase();
  }, [loadPurchase]);

  const state = useMemo<EntitlementState>(() => {
    if (!enrollment) {
      // No goal yet: nothing to gate, and no trial has started. A purchase
      // made before picking a goal still counts.
      return {
        entitlement: purchased ?? (TRIAL_ENABLED ? 'trial' : 'expired'),
        trial: null,
        purchased,
        refresh: loadPurchase,
      };
    }
    if (!TRIAL_ENABLED) {
      // No trial in this build (see trial.ts): straight to "nothing bought".
      return {
        entitlement: entitlementFor({ trialPhase: 'expired', purchase: purchased }),
        trial: null,
        purchased,
        refresh: loadPurchase,
      };
    }
    const trial = trialStatus(
      reconcileWithServer(
        {
          // Until the remembered start has loaded, use the enrollment's own
          // date: it is never LATER than the remembered one, so the worst case
          // is a brief over-estimate of time left rather than a wrongly locked
          // app.
          startedAt: startedAt ?? enrollment.created_at,
          now: new Date(),
          highWaterMark: highWater,
        },
        serverTrial,
      ),
    );
    return {
      entitlement: entitlementFor({ trialPhase: trial.phase, purchase: purchased }),
      trial,
      purchased,
      refresh: loadPurchase,
    };
  }, [enrollment, highWater, startedAt, purchased, serverTrial, loadPurchase]);

  const endsAt = state.trial?.endsAt ?? null;
  useEffect(() => {
    void syncTrialReminder(endsAt, state.purchased);
  }, [endsAt, state.purchased]);

  return state;
}
