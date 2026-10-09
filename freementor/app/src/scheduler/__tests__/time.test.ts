import { describe, expect, it } from 'vitest';
import { DEFAULT_HINTS, type Resource } from '@freementor/shared';
import { blockMinutes, focusSegments, roundUpTo, videoMinutes } from '../time.ts';

const H = DEFAULT_HINTS;

const video = (over: Partial<Resource> = {}): Resource => ({
  type: 'video',
  role: 'main',
  title: 'v',
  url: 'https://youtu.be/x',
  lang: 'en',
  provider: 'YouTube',
  access: 'all',
  ad_gate_allowed: false,
  status: 'active',
  ...over,
});

describe('rule 3 — video time = duration x 1.15 rounded up to 5 min', () => {
  it('matches the worked example from the product plan (1 h 40 m -> 1 h 55 m)', () => {
    // 100 min x 1.15 = 115 -> already a multiple of 5
    expect(videoMinutes(video({ duration_seconds: 100 * 60 }), H)).toBe(115);
  });

  it('matches the worked example from the mockup (52 min video -> 60 min)', () => {
    // 52 x 1.15 = 59.8 -> rounds up to 60
    expect(videoMinutes(video({ duration_seconds: 52 * 60 }), H)).toBe(60);
  });

  it('always rounds up, never to nearest', () => {
    // 10 x 1.15 = 11.5 -> 15, not 10
    expect(videoMinutes(video({ duration_seconds: 10 * 60 }), H)).toBe(15);
    // 4 x 1.15 = 4.6 -> 5
    expect(videoMinutes(video({ duration_seconds: 4 * 60 }), H)).toBe(5);
  });

  it('leaves an exact multiple alone', () => {
    // 1200s = 20 min; 20 x 1.15 = 23 -> 25
    expect(videoMinutes(video({ duration_seconds: 1200 }), H)).toBe(25);
  });

  it('falls back to est_minutes when the checker has not filled a duration', () => {
    // The whole library is in this state today — and est_minutes is already an
    // estimate, so it must NOT be multiplied again.
    expect(videoMinutes(video({ duration_seconds: null, est_minutes: 20 }), H)).toBe(20);
  });

  it('prefers the real duration once the checker fills it in', () => {
    expect(videoMinutes(video({ duration_seconds: 52 * 60, est_minutes: 20 }), H)).toBe(60);
  });
});

describe('roundUpTo', () => {
  it.each([
    [0, 5, 0],
    [1, 5, 5],
    [5, 5, 5],
    [5.1, 5, 10],
    [59.8, 5, 60],
  ])('roundUpTo(%s, %s) = %s', (m, step, want) => {
    expect(roundUpTo(m, step)).toBe(want);
  });
});

describe('blockMinutes', () => {
  it('uses the video rule for learn blocks', () => {
    const block = {
      id: 'b1',
      type: 'learn' as const,
      title: 'Watch',
      est_minutes: 20,
      resources: [video({ duration_seconds: 52 * 60 })],
    };
    expect(blockMinutes(block, H)).toBe(60);
  });

  it('never schedules less than the library asked for', () => {
    const block = {
      id: 'b1',
      type: 'learn' as const,
      title: 'Watch both parts',
      est_minutes: 90,
      resources: [video({ duration_seconds: 10 * 60 })], // 15 min from the rule
    };
    expect(blockMinutes(block, H)).toBe(90);
  });

  it('uses est_minutes verbatim for non-learn blocks', () => {
    const block = {
      id: 'b2',
      type: 'read' as const,
      title: 'Read NCERT',
      est_minutes: 30,
      resources: [],
    };
    expect(blockMinutes(block, H)).toBe(30);
  });

  it('picks the Hindi video for a Hindi learner', () => {
    const block = {
      id: 'b3',
      type: 'learn' as const,
      title: 'Watch',
      est_minutes: 10,
      resources: [
        video({ role: 'main', lang: 'en', duration_seconds: 60 * 60 }),
        video({ role: 'main_hi', lang: 'hi', duration_seconds: 20 * 60 }),
      ],
    };
    expect(blockMinutes(block, H, 'en')).toBe(70); // 60 x 1.15 = 69 -> 70
    expect(blockMinutes(block, H, 'hi')).toBe(25); // 20 x 1.15 = 23 -> 25
  });
});

describe('focus segments (25 min focus / 5 min break)', () => {
  it('leaves a short block whole', () => {
    expect(focusSegments(20, H)).toEqual([{ focus: 20, breakAfter: 0 }]);
  });

  it('splits 60 min into 25 + 25 + 10 with breaks between, not after the last', () => {
    expect(focusSegments(60, H)).toEqual([
      { focus: 25, breakAfter: 5 },
      { focus: 25, breakAfter: 5 },
      { focus: 10, breakAfter: 0 },
    ]);
  });

  it('never invents study time', () => {
    const total = focusSegments(137, H).reduce((s, x) => s + x.focus, 0);
    expect(total).toBe(137);
  });
});
