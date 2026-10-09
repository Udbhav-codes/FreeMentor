/**
 * Quiet hours — pure, so it can be tested without pulling in
 * expo-notifications (which cannot load outside a React Native runtime).
 */
export interface QuietHours {
  /** 0-23. Nothing fires at or after `from`, or before `to`. */
  from: number;
  to: number;
}

export function isQuiet(hour: number, quiet?: QuietHours): boolean {
  if (!quiet) return false;
  // Quiet hours usually wrap midnight (e.g. 22 -> 7).
  return quiet.from > quiet.to
    ? hour >= quiet.from || hour < quiet.to
    : hour >= quiet.from && hour < quiet.to;
}
