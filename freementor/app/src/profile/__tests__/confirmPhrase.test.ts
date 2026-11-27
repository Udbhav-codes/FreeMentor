import { describe, expect, it } from 'vitest';
import { matchesPhrase } from '../confirmPhrase.ts';

describe('the typed delete confirmation', () => {
  it('accepts the phrase whatever the case or spacing', () => {
    expect(matchesPhrase('delete my account', 'delete my account')).toBe(true);
    expect(matchesPhrase('  Delete   My Account ', 'delete my account')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(matchesPhrase('', 'delete my account')).toBe(false);
    expect(matchesPhrase('delete account', 'delete my account')).toBe(false);
    expect(matchesPhrase('delete my accoun', 'delete my account')).toBe(false);
  });
});
