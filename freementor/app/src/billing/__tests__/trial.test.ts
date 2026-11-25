/**
 * The trial clock. Edges matter here: an off-by-one costs a learner a day of
 * access, or hands out a fourth day for free.
 */
import { describe, expect, it } from 'vitest';
import {
  TRIAL_DAYS,
  describeTrial,
  effectiveNow,
  reconcileWithServer,
  trialStatus,
} from '../trial.ts';

const START = '2026-10-11T09:00:00.000Z';
const at = (iso: string) => new Date(iso);

describe('the three-day window', () => {
  it('is active the moment it starts', () => {
    const s = trialStatus({ startedAt: START, now: at(START) });
    expect(s.phase).toBe('active');
    expect(s.daysRemaining).toBe(TRIAL_DAYS);
  });

  it('ends exactly three days later, to the second', () => {
    const s = trialStatus({ startedAt: START, now: at(START) });
    expect(s.endsAt).toBe('2026-10-14T09:00:00.000Z');
  });

  it('is still running one second before the end', () => {
    const s = trialStatus({ startedAt: START, now: at('2026-10-14T08:59:59.000Z') });
    expect(s.phase).toBe('last_day');
    expect(s.msRemaining).toBe(1000);
  });

  it('is expired exactly at the end, not a second later', () => {
    const s = trialStatus({ startedAt: START, now: at('2026-10-14T09:00:00.000Z') });
    expect(s.phase).toBe('expired');
    expect(s.msRemaining).toBe(0);
    expect(s.daysRemaining).toBe(0);
  });

  it('stays expired long afterwards', () => {
    expect(trialStatus({ startedAt: START, now: at('2027-01-01T00:00:00.000Z') }).phase).toBe(
      'expired',
    );
  });
});

describe('the 24-hour reminder window (§10.4)', () => {
  it('opens exactly 24h before the end', () => {
    const s = trialStatus({ startedAt: START, now: at('2026-10-13T09:00:00.000Z') });
    expect(s.phase).toBe('last_day');
    expect(s.inReminderWindow).toBe(true);
  });

  it('is not open a minute earlier', () => {
    const s = trialStatus({ startedAt: START, now: at('2026-10-13T08:59:00.000Z') });
    expect(s.phase).toBe('active');
    expect(s.inReminderWindow).toBe(false);
  });

  it('closes once expired — an ended trial is not "ending soon"', () => {
    const s = trialStatus({ startedAt: START, now: at('2026-10-15T00:00:00.000Z') });
    expect(s.inReminderWindow).toBe(false);
  });
});

describe('a device clock that cannot be trusted', () => {
  it('ignores a clock wound backwards, so the trial is not renewed', () => {
    // Day 3, then the learner sets the date back a week.
    const honest = trialStatus({ startedAt: START, now: at('2026-10-14T10:00:00.000Z') });
    expect(honest.phase).toBe('expired');

    const rewound = trialStatus({
      startedAt: START,
      now: at('2026-10-07T10:00:00.000Z'),
      highWaterMark: '2026-10-14T10:00:00.000Z',
    });
    expect(rewound.phase).toBe('expired');
  });

  it('still lets honest time move forward', () => {
    const s = trialStatus({
      startedAt: START,
      now: at('2026-10-12T09:00:00.000Z'),
      highWaterMark: '2026-10-11T12:00:00.000Z',
    });
    expect(s.phase).toBe('active');
    expect(s.daysRemaining).toBe(2);
  });

  it('expires early if the clock is wound forward — their loss, not ours', () => {
    const s = trialStatus({ startedAt: START, now: at('2030-01-01T00:00:00.000Z') });
    expect(s.phase).toBe('expired');
  });

  it('effectiveNow takes the later of the two, and survives junk', () => {
    expect(effectiveNow(at(START), null).toISOString()).toBe(START);
    expect(effectiveNow(at(START), 'not-a-date').toISOString()).toBe(START);
    expect(effectiveNow(at('2026-10-01T00:00:00.000Z'), START).toISOString()).toBe(START);
  });
});

describe('a start date that makes no sense', () => {
  it('reads as expired rather than as an unlimited trial', () => {
    // The failure must be in our favour: a corrupt row cannot mint free
    // access. A server check can always correct it upwards later.
    for (const bad of ['', 'yesterday', 'null', '0000-00-00']) {
      expect(trialStatus({ startedAt: bad, now: at(START) }).phase, bad).toBe('expired');
    }
  });
});

describe('what the learner is told', () => {
  it('counts days while there is time, singular on the last full day', () => {
    expect(describeTrial(trialStatus({ startedAt: START, now: at(START) }))).toBe(
      '3 days left of your free trial',
    );
    expect(
      describeTrial(trialStatus({ startedAt: START, now: at('2026-10-12T10:00:00.000Z') })),
    ).toBe('2 days left of your free trial');
  });

  it('says "last day" rather than "0 days left"', () => {
    expect(
      describeTrial(trialStatus({ startedAt: START, now: at('2026-10-13T20:00:00.000Z') })),
    ).toBe('Last day of your free trial');
  });

  it('states plainly that it has ended, with no countdown', () => {
    const text = describeTrial(trialStatus({ startedAt: START, now: at('2026-11-01T00:00:00.000Z') }));
    expect(text).toBe('Your free trial has ended');
    expect(text).not.toMatch(/\d/);
  });
});

describe('reconciling with the server', () => {
  const T0 = '2026-10-11T09:00:00.000Z';
  const received = new Date('2026-10-20T12:00:00.000Z');

  it('does nothing when there is no server answer', () => {
    const input = { startedAt: T0, now: at('2026-10-12T09:00:00.000Z') };
    expect(reconcileWithServer(input, null)).toBe(input);
  });

  it('takes the EARLIER start, so a reinstall cannot restart the clock', () => {
    const input = { startedAt: '2026-10-19T09:00:00.000Z', now: received };
    const out = reconcileWithServer(input, {
      startedAt: T0,
      serverTime: received.toISOString(),
      receivedAt: received,
    });
    expect(out.startedAt).toBe(T0);
    expect(trialStatus(out).phase).toBe('expired');
  });

  it('never moves the start later than the device already has it', () => {
    const input = { startedAt: T0, now: at('2026-10-12T09:00:00.000Z') };
    const out = reconcileWithServer(input, {
      startedAt: '2026-10-15T09:00:00.000Z',
      serverTime: '2026-10-12T09:00:00.000Z',
      receivedAt: at('2026-10-12T09:00:00.000Z'),
    });
    expect(out.startedAt).toBe(T0);
  });

  it('reads a clock wound back a week as the real time', () => {
    // The device says 12 Oct; the server, at the same instant, says 19 Oct.
    // Without the correction the trial would look nearly new.
    const deviceNow = at('2026-10-12T09:00:00.000Z');
    const out = reconcileWithServer(
      { startedAt: T0, now: deviceNow },
      {
        startedAt: T0,
        serverTime: '2026-10-19T09:00:00.000Z',
        receivedAt: deviceNow,
      },
    );
    expect(trialStatus(out).phase).toBe('expired');
  });

  it('keeps the correction as time passes after the answer arrived', () => {
    const arrival = at('2026-10-12T09:00:00.000Z');
    const later = at('2026-10-12T21:00:00.000Z'); // 12 h on the device
    const out = reconcileWithServer(
      { startedAt: T0, now: later },
      { startedAt: T0, serverTime: '2026-10-13T09:00:00.000Z', receivedAt: arrival },
    );
    // Server said 13 Oct 09:00 at arrival; 12 h later it is 13 Oct 21:00.
    expect(out.now.toISOString()).toBe('2026-10-13T21:00:00.000Z');
  });

  it('ignores an unparseable server answer rather than trusting it', () => {
    const input = { startedAt: T0, now: at('2026-10-12T09:00:00.000Z') };
    const out = reconcileWithServer(input, {
      startedAt: 'garbage',
      serverTime: 'nonsense',
      receivedAt: received,
    });
    expect(out).toBe(input);
  });
});
