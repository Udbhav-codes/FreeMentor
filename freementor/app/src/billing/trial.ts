/**
 * The 3-day free trial clock — product plan §10.1 and §10.4.
 *
 * Pure and deterministic, like the scheduler: (started, now, high-water mark)
 * in, status out. No clock reads, no storage, no network, so every edge can
 * be tested rather than waited for.
 *
 * The trial is anchored to `enrollment.created_at` — the moment the learner
 * actually started a goal — not to the roadmap's `start_date`, which the
 * learner may set in the future and which would hand them a longer trial.
 *
 * ## Why the high-water mark
 *
 * Entitlement cannot be device-authoritative the way progress is. Progress is
 * offline-first because the device is the only honest witness to what the
 * learner did; a trial deadline is the opposite — the device has every
 * incentive to lie. Winding the clock back a week would otherwise renew the
 * trial indefinitely.
 *
 * So callers persist the highest `now` ever seen and pass it back in. Time
 * only ever moves forward from the app's point of view. This is a deterrent,
 * not proof: the real answer is a server-verified entitlement, which arrives
 * with Play Billing at M5. Winding the clock FORWARD still expires the trial
 * early, which is left alone — it only harms the person doing it.
 */

/** §10.1: three days. */
export const TRIAL_DAYS = 3;

/** §10.4: tell them a day before it ends. */
export const REMIND_BEFORE_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export type TrialPhase =
  /** Running, more than 24h left. */
  | 'active'
  /** Running, inside the final 24h — §10.4's reminder window. */
  | 'last_day'
  /** Over. Everything but YouTube locks until a plan is bought. */
  | 'expired';

export interface TrialStatus {
  phase: TrialPhase;
  /** When it ends, ISO. */
  endsAt: string;
  msRemaining: number;
  /** Whole days left, rounded up. 0 once expired. */
  daysRemaining: number;
  /** True exactly in the final 24h, so a reminder fires once. */
  inReminderWindow: boolean;
}

export interface TrialInput {
  /** enrollment.created_at, ISO. */
  startedAt: string;
  now: Date;
  /** The latest `now` this device has ever reported, ISO. */
  highWaterMark?: string | null;
}

/**
 * The effective current time: never earlier than the newest moment already
 * observed, so a rewound device clock cannot extend the trial.
 */
export function effectiveNow(now: Date, highWaterMark?: string | null): Date {
  if (!highWaterMark) return now;
  const seen = new Date(highWaterMark);
  if (Number.isNaN(seen.getTime())) return now;
  return seen.getTime() > now.getTime() ? seen : now;
}

export function trialStatus({ startedAt, now, highWaterMark }: TrialInput): TrialStatus {
  const started = new Date(startedAt);
  const current = effectiveNow(now, highWaterMark);

  // An unparseable or missing start cannot be allowed to read as "plenty of
  // time left" — that would be a free unlimited trial for anyone who could
  // corrupt one row. Treat it as expired and let a server check correct it.
  if (Number.isNaN(started.getTime())) {
    return {
      phase: 'expired',
      endsAt: new Date(0).toISOString(),
      msRemaining: 0,
      daysRemaining: 0,
      inReminderWindow: false,
    };
  }

  const endsAtMs = started.getTime() + TRIAL_DAYS * DAY_MS;
  const msRemaining = Math.max(0, endsAtMs - current.getTime());

  const phase: TrialPhase =
    msRemaining <= 0 ? 'expired' : msRemaining <= REMIND_BEFORE_MS ? 'last_day' : 'active';

  return {
    phase,
    endsAt: new Date(endsAtMs).toISOString(),
    msRemaining,
    daysRemaining: Math.ceil(msRemaining / DAY_MS),
    inReminderWindow: phase === 'last_day',
  };
}

/** For the paywall and the welcome card: "2 days left", "Last day". */
export function describeTrial(status: TrialStatus): string {
  switch (status.phase) {
    case 'expired':
      return 'Your free trial has ended';
    case 'last_day':
      return 'Last day of your free trial';
    case 'active':
      return `${status.daysRemaining} day${status.daysRemaining === 1 ? '' : 's'} left of your free trial`;
  }
}
