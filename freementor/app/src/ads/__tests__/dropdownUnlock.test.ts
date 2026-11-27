import { beforeEach, describe, expect, it } from 'vitest';
import {
  isDropdownUnlocked,
  isUnlockFresh,
  resetDropdownUnlocks,
  UNLOCK_MS,
  unlockDropdown,
} from '../dropdownUnlock.ts';

const MIN = 60 * 1000;

beforeEach(() => resetDropdownUnlocks());

describe('per-dropdown rewarded unlocks', () => {
  it('lasts 30 minutes from the watched ad', () => {
    expect(UNLOCK_MS).toBe(30 * MIN);
    expect(isUnlockFresh(0, 29 * MIN)).toBe(true);
    expect(isUnlockFresh(0, 30 * MIN)).toBe(false);
  });

  it('is locked until an ad is watched', () => {
    expect(isDropdownUnlocked('a', 1000)).toBe(false);
  });

  it('unlocks only the dropdown whose ad was watched', () => {
    unlockDropdown('2026-11-26:task-1', 0);
    expect(isDropdownUnlocked('2026-11-26:task-1', 10 * MIN)).toBe(true);
    expect(isDropdownUnlocked('2026-11-26:task-2', 10 * MIN)).toBe(false);
    expect(isDropdownUnlocked('2026-11-27:task-1', 10 * MIN)).toBe(false);
  });

  it('asks again when reopened after 30 minutes', () => {
    unlockDropdown('a', 0);
    expect(isDropdownUnlocked('a', 31 * MIN)).toBe(false);
  });

  it('never grants time from a clock that moved backwards', () => {
    expect(isUnlockFresh(10 * MIN, 5 * MIN)).toBe(false);
  });
});
