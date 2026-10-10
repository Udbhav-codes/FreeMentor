/**
 * The bypass must be impossible to reach in a release build.
 *
 * This is the whole security argument for shipping a skip-sign-in button at
 * all, so it is tested as a policy rather than left to a code read.
 */
import { describe, expect, it } from 'vitest';
import { bypassAllowed } from '../devBypass.ts';

describe('who may skip sign-in', () => {
  it('allows it only in a dev build with the flag explicitly set', () => {
    expect(bypassAllowed(true, '1')).toBe(true);
  });

  it('refuses a release build even with the flag set', () => {
    // The case that matters: an env var left in a CI config or an EAS profile
    // must not open auth in a store build.
    expect(bypassAllowed(false, '1')).toBe(false);
  });

  it('refuses a dev build without the flag, so plain `npm start` is unaffected', () => {
    expect(bypassAllowed(true, undefined)).toBe(false);
    expect(bypassAllowed(true, '')).toBe(false);
    expect(bypassAllowed(true, '0')).toBe(false);
  });

  it('refuses anything other than exactly "1"', () => {
    // No truthiness games: 'true', 'yes' and 'false' are all refused, so the
    // flag cannot be enabled by accident with a plausible-looking value.
    for (const value of ['true', 'TRUE', 'yes', 'false', 'on', ' 1', '1 ']) {
      expect(bypassAllowed(true, value), value).toBe(false);
    }
  });

  it('refuses when neither condition holds', () => {
    expect(bypassAllowed(false, undefined)).toBe(false);
  });
});
