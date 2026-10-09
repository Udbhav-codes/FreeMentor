/**
 * The age gate — product plan decision #9 and §15.
 *
 *   16+ only. 16-17 need verifiable parental consent before any personal data
 *   beyond sign-in is processed, and only ever get non-personalised, G-rated
 *   ads. Under 16 cannot continue.
 *
 * This is a legal requirement (DPDP Act 2023 + Rules 2025, full compliance by
 * 13 May 2027), not a product preference — so it is a pure, tested function
 * rather than a condition buried in a screen.
 *
 * Birth YEAR only: collecting a full date of birth would be more personal
 * data than the decision needs.
 */

export const MINIMUM_AGE = 16;
export const ADULT_AGE = 18;

export type AgeDecision =
  | { outcome: 'blocked'; age: number; reason: string }
  | { outcome: 'needs_parent_consent'; age: number; reason: string }
  | { outcome: 'allowed'; age: number };

/**
 * Age from birth year alone. Without a birthday we cannot know whether they
 * have had it yet this year, so we take the YOUNGER reading — someone born in
 * 2010 is treated as 15 for all of 2026. Erring young is the safe direction
 * for a child-protection gate.
 */
export function ageFromBirthYear(birthYear: number, today: Date): number {
  return today.getFullYear() - birthYear - 1;
}

export function decideAge(birthYear: number, today: Date = new Date()): AgeDecision {
  const currentYear = today.getFullYear();

  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
    return { outcome: 'blocked', age: 0, reason: 'Please enter the year you were born.' };
  }

  const age = ageFromBirthYear(birthYear, today);

  if (age < MINIMUM_AGE) {
    return {
      outcome: 'blocked',
      age,
      reason: `FreeMentor is for ages ${MINIMUM_AGE} and over.`,
    };
  }

  if (age < ADULT_AGE) {
    return {
      outcome: 'needs_parent_consent',
      age,
      reason:
        'Because you are under 18, we need a parent or guardian to agree before we store ' +
        'anything beyond your sign-in.',
    };
  }

  return { outcome: 'allowed', age };
}

/** Under-18s get non-personalised, G-rated ads (product plan §10.2). */
export interface AdPolicy {
  personalised: boolean;
  maxAdContentRating: 'G' | 'PG' | 'T' | 'MA';
  tagForUnderAgeOfConsent: boolean;
}

export function adPolicyFor(age: number): AdPolicy {
  const minor = age < ADULT_AGE;
  return {
    personalised: !minor,
    maxAdContentRating: minor ? 'G' : 'T',
    tagForUnderAgeOfConsent: minor,
  };
}

/** A plausible range for the birth-year picker. */
export function birthYearRange(today: Date = new Date()): number[] {
  const current = today.getFullYear();
  const years: number[] = [];
  // Oldest first is wrong for a picker; most users are students.
  for (let y = current - MINIMUM_AGE; y >= current - 70; y--) years.push(y);
  return years;
}
