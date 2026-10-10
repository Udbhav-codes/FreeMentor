/**
 * The trial start must survive a roadmap reset.
 *
 * The loophole this closes: the trial was anchored to enrollment.created_at,
 * and "Reset this roadmap" deletes the enrollment row — so re-enrolling the
 * same goal minted a new created_at and a fresh 3-day trial, repeatable as
 * often as the learner liked.
 *
 * AsyncStorage is mocked here: the point under test is the choice of date,
 * not the storage driver.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));

const { clearTrialStarts, trialStartFor } = await import('../trialStart.ts');

const FIRST = '2026-10-11T09:00:00.000Z';
const LATER = '2026-10-20T09:00:00.000Z';

beforeEach(async () => {
  store.clear();
  await clearTrialStarts();
});

describe('trialStartFor', () => {
  it('records the first start it is given', async () => {
    expect(await trialStartFor('c', FIRST)).toBe(FIRST);
  });

  it('keeps the original start when the same goal is re-enrolled', async () => {
    await trialStartFor('c', FIRST);
    // The learner resets the roadmap and starts the same goal again a week on.
    expect(await trialStartFor('c', LATER)).toBe(FIRST);
  });

  it('survives repeated resets — the loophole stays closed', async () => {
    await trialStartFor('c', FIRST);
    for (const attempt of ['2026-10-15T00:00:00.000Z', LATER, '2027-01-01T00:00:00.000Z']) {
      expect(await trialStartFor('c', attempt), attempt).toBe(FIRST);
    }
  });

  it('gives a genuinely different goal its own three days', async () => {
    // Pricing is per roadmap and switching goal is a separate purchase, so a
    // new goal legitimately gets its own trial.
    await trialStartFor('c', FIRST);
    expect(await trialStartFor('java', LATER)).toBe(LATER);
    expect(await trialStartFor('c', LATER)).toBe(FIRST);
  });

  it('prefers an earlier enrollment date over what was stored', async () => {
    // A restored backup can carry an older enrollment; the earliest start
    // wins so a re-enrollment can never move the start later.
    await trialStartFor('c', LATER);
    expect(await trialStartFor('c', FIRST)).toBe(FIRST);
    expect(await trialStartFor('c', LATER)).toBe(FIRST);
  });

  it('forgets everything only when explicitly cleared (development)', async () => {
    await trialStartFor('c', FIRST);
    await clearTrialStarts();
    expect(await trialStartFor('c', LATER)).toBe(LATER);
  });
});
