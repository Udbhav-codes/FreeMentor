/**
 * The 10-minute rewarded-ad window (§10.2).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AD_WINDOW_MS,
  isWithinAdWindow,
  msUntilNextAd,
  noteRewarded,
  resetAdWindow,
  windowOpen,
} from '../cap.ts';

const T = 1_000_000_000_000;

describe('the window', () => {
  it('is closed when no ad has been watched', () => {
    expect(isWithinAdWindow(null, T)).toBe(false);
  });

  it('is open for ten minutes after a completed ad', () => {
    expect(isWithinAdWindow(T, T)).toBe(true);
    expect(isWithinAdWindow(T, T + AD_WINDOW_MS - 1)).toBe(true);
  });

  it('closes at exactly ten minutes', () => {
    expect(isWithinAdWindow(T, T + AD_WINDOW_MS)).toBe(false);
  });

  it('does not treat a timestamp from the future as an open window', () => {
    // A moved clock must not buy a longer ad-free period than the cap.
    expect(isWithinAdWindow(T + 60_000, T)).toBe(false);
  });

  it('reports how long is left', () => {
    expect(msUntilNextAd(T, T + 4 * 60_000)).toBe(6 * 60_000);
    expect(msUntilNextAd(T, T + AD_WINDOW_MS)).toBe(0);
    expect(msUntilNextAd(null, T)).toBe(0);
  });
});

describe('the in-memory record', () => {
  beforeEach(() => resetAdWindow());

  it('starts closed, opens after noteRewarded, and closes again', () => {
    expect(windowOpen(T)).toBe(false);
    noteRewarded(T);
    expect(windowOpen(T + 1000)).toBe(true);
    expect(windowOpen(T + AD_WINDOW_MS + 1)).toBe(false);
  });
});
