/**
 * The age gate is a legal control (DPDP Act 2023 + Rules 2025), so it is
 * tested as carefully as the scheduler. Getting this wrong means processing a
 * child's data without consent.
 */
import { describe, expect, it } from 'vitest';
import { adPolicyFor, ageFromBirthYear, decideAge, MINIMUM_AGE } from '../age.ts';

const ON = (iso: string) => new Date(`${iso}T12:00:00Z`);
const TODAY = ON('2026-10-08');

describe('age from birth year', () => {
  it('takes the younger reading, since we do not know the birthday', () => {
    // Born 2010: they turn 16 at some point in 2026, but may not have yet.
    expect(ageFromBirthYear(2010, TODAY)).toBe(15);
    expect(ageFromBirthYear(2009, TODAY)).toBe(16);
  });
});

describe('the 16+ gate', () => {
  it('blocks someone who may still be 15', () => {
    const d = decideAge(2010, TODAY);
    expect(d.outcome).toBe('blocked');
    if (d.outcome !== 'allowed') expect(d.reason).toContain(String(MINIMUM_AGE));
  });

  it('blocks a clearly under-age year outright', () => {
    expect(decideAge(2015, TODAY).outcome).toBe('blocked');
  });

  it('lets a 16-year-old through, with parent consent required', () => {
    expect(decideAge(2009, TODAY).outcome).toBe('needs_parent_consent');
  });

  it('still requires consent at 17', () => {
    expect(decideAge(2008, TODAY).outcome).toBe('needs_parent_consent');
  });

  it('allows an 18-year-old without consent', () => {
    const d = decideAge(2007, TODAY);
    expect(d.outcome).toBe('allowed');
    expect(d.age).toBe(18);
  });

  it('allows adults', () => {
    expect(decideAge(1990, TODAY).outcome).toBe('allowed');
  });
});

describe('rejecting nonsense input', () => {
  it.each([
    [0],
    [-1],
    [1800],
    [2099],
    [2026.5],
    [Number.NaN],
  ])('rejects %s', (year) => {
    expect(decideAge(year as number, TODAY).outcome).toBe('blocked');
  });

  it('rejects a year in the future', () => {
    expect(decideAge(2027, TODAY).outcome).toBe('blocked');
  });
});

describe('the boundary moves with the calendar', () => {
  it('admits the same birth year once the next year starts', () => {
    expect(decideAge(2010, ON('2026-12-31')).outcome).toBe('blocked');
    expect(decideAge(2010, ON('2027-01-01')).outcome).toBe('needs_parent_consent');
  });
});

describe('ad policy for minors (product plan §10.2)', () => {
  it('is non-personalised and G-rated under 18', () => {
    expect(adPolicyFor(16)).toEqual({
      personalised: false,
      maxAdContentRating: 'G',
      tagForUnderAgeOfConsent: true,
    });
    expect(adPolicyFor(17).personalised).toBe(false);
  });

  it('relaxes at 18', () => {
    const policy = adPolicyFor(18);
    expect(policy.personalised).toBe(true);
    expect(policy.tagForUnderAgeOfConsent).toBe(false);
  });

  it('never personalises for anyone the gate would call a minor', () => {
    for (let age = MINIMUM_AGE; age < 18; age++) {
      expect(adPolicyFor(age).personalised, `age ${age}`).toBe(false);
    }
  });
});
