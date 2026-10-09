import { describe, expect, it } from 'vitest';
import { initialsFrom } from '../initials.ts';

describe('initials fallback', () => {
  it.each([
    ['Anubhav Singh', 'AS'],
    ['anubhav singh', 'AS'],
    ['Anubhav', 'A'],
    ['Anubhav Kumar Singh', 'AS'],
    ['  spaced   out  ', 'SO'],
  ])('%s -> %s', (name, expected) => {
    expect(initialsFrom(name)).toBe(expected);
  });

  it('is empty when there is no name, so the avatar can show an icon', () => {
    expect(initialsFrom(null)).toBe('');
    expect(initialsFrom(undefined)).toBe('');
    expect(initialsFrom('   ')).toBe('');
  });

  it('ignores punctuation-only tokens', () => {
    expect(initialsFrom('Anubhav - Singh')).toBe('AS');
  });

  it('handles non-Latin names', () => {
    // Devanagari is a first-class case: the app ships Hindi (§11.3).
    expect(initialsFrom('अनुभव सिंह')).toBe('अस');
  });

  it('takes one character per name, not a whole grapheme run', () => {
    expect(initialsFrom('Aa Bb')).toHaveLength(2);
  });
});
