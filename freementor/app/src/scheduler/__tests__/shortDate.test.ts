import { describe, expect, it } from 'vitest';
import { shortDate } from '../dates.ts';

describe('shortDate (DD MMM)', () => {
  it('formats an ISO date for the learner', () => {
    expect(shortDate('2026-11-25')).toBe('25 Nov');
    expect(shortDate('2027-01-05')).toBe('05 Jan');
    expect(shortDate('2026-12-31')).toBe('31 Dec');
  });

  it('leaves anything it cannot read unchanged', () => {
    expect(shortDate('not a date')).toBe('not a date');
  });
});
