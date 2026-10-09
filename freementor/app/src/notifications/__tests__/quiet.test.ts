import { describe, expect, it } from 'vitest';
import { isQuiet } from '../quiet.ts';

describe('quiet hours', () => {
  it('is never quiet when none are set', () => {
    expect(isQuiet(3)).toBe(false);
  });

  it('handles a window that wraps midnight (22:00 - 07:00)', () => {
    const quiet = { from: 22, to: 7 };
    expect(isQuiet(23, quiet)).toBe(true);
    expect(isQuiet(2, quiet)).toBe(true);
    expect(isQuiet(6, quiet)).toBe(true);
    expect(isQuiet(7, quiet)).toBe(false);
    expect(isQuiet(12, quiet)).toBe(false);
    expect(isQuiet(21, quiet)).toBe(false);
    expect(isQuiet(22, quiet)).toBe(true);
  });

  it('handles a window inside one day (13:00 - 15:00)', () => {
    const quiet = { from: 13, to: 15 };
    expect(isQuiet(12, quiet)).toBe(false);
    expect(isQuiet(13, quiet)).toBe(true);
    expect(isQuiet(14, quiet)).toBe(true);
    expect(isQuiet(15, quiet)).toBe(false);
  });
});
