/**
 * The trial-ending reminder: when it fires, when it must not, what it says.
 */
import { describe, expect, it } from 'vitest';
import { planTrialReminder, trialReminderCopy, trialReminderTime } from '../trialReminder.ts';

const ENDS = '2026-10-14T09:00:00.000Z';
const at = (iso: string) => new Date(iso);

describe('when the reminder fires', () => {
  it('is exactly 24 hours before the trial ends', () => {
    const when = trialReminderTime(ENDS, at('2026-10-12T09:00:00.000Z'));
    expect(when?.toISOString()).toBe('2026-10-13T09:00:00.000Z');
  });

  it('is skipped when that moment has already passed', () => {
    // Firing at once would be a surprise, not a reminder.
    expect(trialReminderTime(ENDS, at('2026-10-13T10:00:00.000Z'))).toBeNull();
    expect(trialReminderTime(ENDS, at('2026-10-13T09:00:00.000Z'))).toBeNull();
  });

  it('is skipped for an unparseable end rather than guessing', () => {
    expect(trialReminderTime('garbage', at('2026-10-12T09:00:00.000Z'))).toBeNull();
  });
});

describe('whether to schedule or cancel', () => {
  const now = at('2026-10-12T09:00:00.000Z');

  it('schedules while the trial runs and nothing is bought', () => {
    const plan = planTrialReminder({ endsAt: ENDS, now, purchased: null });
    expect(plan.kind).toBe('schedule');
  });

  it('cancels the moment a plan is bought, so nobody is told it is ending after paying', () => {
    expect(planTrialReminder({ endsAt: ENDS, now, purchased: 'basic' }).kind).toBe('cancel');
    expect(planTrialReminder({ endsAt: ENDS, now, purchased: 'premium' }).kind).toBe('cancel');
  });

  it('cancels when there is no trial to remind about', () => {
    expect(planTrialReminder({ endsAt: null, now, purchased: null }).kind).toBe('cancel');
  });

  it('cancels once the reminder moment has passed', () => {
    const late = at('2026-10-13T12:00:00.000Z');
    expect(planTrialReminder({ endsAt: ENDS, now: late, purchased: null }).kind).toBe('cancel');
  });
});

describe('what it says (§10.4: the end, the price and what locks)', () => {
  it('names the end, what locks and the price in English', () => {
    const { title, body } = trialReminderCopy('en');
    expect(title).toMatch(/ends tomorrow/i);
    expect(body).toMatch(/practice and tests lock/i);
    expect(body).toContain('₹599');
    expect(body).toMatch(/one-time/i);
  });

  it('is translated, and still carries the price', () => {
    for (const lang of ['hi', 'hi-en'] as const) {
      const { title, body } = trialReminderCopy(lang);
      expect(title.length).toBeGreaterThan(5);
      expect(body).toContain('₹599');
      expect(trialReminderCopy('en').title).not.toBe(title);
    }
  });
});
