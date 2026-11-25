/**
 * Telemetry: the minors rule, and "never throws without the native SDK".
 */
import { describe, expect, it } from 'vitest';
import { analyticsAllowed, configureTelemetry, reportError, track } from '../index.ts';

describe('analytics collection by age', () => {
  it('is off when the age is unknown', () => {
    // Guessing wrong the other way means tracking a child.
    expect(analyticsAllowed(null)).toBe(false);
  });

  it('is off for under-18s, including the 17/18 boundary', () => {
    expect(analyticsAllowed(16)).toBe(false);
    expect(analyticsAllowed(17)).toBe(false);
  });

  it('is on for adults', () => {
    expect(analyticsAllowed(18)).toBe(true);
    expect(analyticsAllowed(30)).toBe(true);
  });
});

describe('without the native SDK (Expo Go, tests)', () => {
  it('every call is a silent no-op', () => {
    expect(() => configureTelemetry(25)).not.toThrow();
    expect(() => track('day_completed', { goal_id: 'python' })).not.toThrow();
    expect(() => reportError(new Error('boom'), 'test')).not.toThrow();
    expect(() => reportError('a string, not an Error')).not.toThrow();
  });
});
