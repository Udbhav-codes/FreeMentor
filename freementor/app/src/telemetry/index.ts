/**
 * Analytics and crash reporting, behind one small door.
 *
 * ## Why this is a wrapper and not direct imports
 *
 * `@react-native-firebase/*` is a native module. It exists in a development or
 * release build and does NOT exist in Expo Go or under vitest. A top-level
 * import would take the whole bundle down there, so the SDK is loaded lazily
 * inside a try/catch and every function here quietly does nothing when it is
 * missing.
 *
 * ## The rule it enforces (product plan §15, DPDP Act §9)
 *
 * No behavioural tracking of minors. Analytics collection is ON only for a
 * learner we positively know is an adult; under 18, or age unknown, it is OFF.
 * Crash reports are technical diagnostics with no learner content and stay on,
 * which is what lets a crash on a 16-year-old's phone be fixed at all.
 *
 * Never put a name, email, birth year or free text in an event. Event names
 * and parameters are product facts only ("day_completed", { goal_id }).
 */
import { ADULT_AGE } from '../ads/rewarded.ts';

type AnyFn = (...args: never[]) => unknown;
interface Sdk {
  analytics: unknown;
  crashlytics: unknown;
  logEvent: AnyFn;
  setAnalyticsCollectionEnabled: AnyFn;
  recordError: AnyFn;
  setCrashlyticsCollectionEnabled: AnyFn;
}

let cached: Sdk | null | undefined;

function sdk(): Sdk | null {
  if (cached !== undefined) return cached;
  try {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const a = require('@react-native-firebase/analytics');
    const c = require('@react-native-firebase/crashlytics');
    /* eslint-enable @typescript-eslint/no-require-imports */
    cached = {
      analytics: a.getAnalytics(),
      crashlytics: c.getCrashlytics(),
      logEvent: a.logEvent,
      setAnalyticsCollectionEnabled: a.setAnalyticsCollectionEnabled,
      recordError: c.recordError,
      setCrashlyticsCollectionEnabled: c.setCrashlyticsCollectionEnabled,
    };
  } catch {
    cached = null;
  }
  return cached;
}

/** Whether analytics may collect for a learner of this age. Unknown = no. */
export function analyticsAllowed(age: number | null): boolean {
  return age !== null && age >= ADULT_AGE;
}

/** Call once the learner's age is known (app start, after onboarding). */
export function configureTelemetry(age: number | null): void {
  const s = sdk();
  if (!s) return;
  try {
    void (s.setAnalyticsCollectionEnabled as (a: unknown, e: boolean) => unknown)(
      s.analytics,
      analyticsAllowed(age),
    );
    void (s.setCrashlyticsCollectionEnabled as (c: unknown, e: boolean) => unknown)(
      s.crashlytics,
      !__DEV__,
    );
  } catch {
    // Telemetry must never be the reason the app misbehaves.
  }
}

/** Log a product event. No personal data in the name or the parameters. */
export function track(name: string, params?: Record<string, string | number | boolean>): void {
  const s = sdk();
  if (!s) return;
  try {
    void (s.logEvent as (a: unknown, n: string, p?: unknown) => unknown)(s.analytics, name, params);
  } catch {
    // ignore
  }
}

/** Report a handled error so it shows up in Crashlytics. */
export function reportError(error: unknown, context?: string): void {
  const s = sdk();
  if (!s) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    void (s.recordError as (c: unknown, e: Error, n?: string) => unknown)(s.crashlytics, err, context);
  } catch {
    // ignore
  }
}
