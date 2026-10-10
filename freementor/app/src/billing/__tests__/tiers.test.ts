/**
 * The §10.1 tier table, checked against the real library.
 *
 * Two regressions this pins:
 *
 *  1. `accessFor()`'s `ad_gated` branch was unreachable. Nothing in the
 *     library set ad_gate_allowed=true, so Basic's "main notes and tests
 *     after a rewarded ad" tier could never fire — a code path with no data
 *     able to trigger it.
 *
 *  2. 21 YouTube links were typed as `notes` with access="premium", i.e.
 *     paywalled YouTube videos. The validator missed them because its
 *     YouTube rule keyed on type==='video', so typing a YouTube URL as notes
 *     bypassed the one rule meant to prevent exactly that.
 *
 * The validator enforces both on the library files; this enforces them where
 * the decision is actually made, on every resource of every full goal.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GoalFile, Resource } from '@freementor/shared';
import { accessFor, type Entitlement } from '../entitlement.ts';

const LIB = resolve(__dirname, '../../../../../library/FreeMentor_Library');
const CATALOG = JSON.parse(readFileSync(resolve(LIB, 'catalog.json'), 'utf8')) as {
  goals: { id: string; status: string }[];
};
const FULL = CATALOG.goals.filter((g) => g.status === 'full').map((g) => g.id);

function resourcesOf(goalId: string): Resource[] {
  const doc = JSON.parse(
    readFileSync(resolve(LIB, 'goals', `${goalId}.json`), 'utf8'),
  ) as GoalFile;
  const out: Resource[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      const o = node as Record<string, unknown>;
      if (typeof o.url === 'string' && typeof o.type === 'string') out.push(o as Resource);
      Object.values(o).forEach(walk);
    }
  };
  walk(doc);
  return out;
}

const isYouTube = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
};

const ALL: Entitlement[] = ['trial', 'basic', 'premium'];
const every = FULL.flatMap((id) => resourcesOf(id).map((r) => ({ id, r })));

describe('the library actually has resources to gate', () => {
  it('found resources at all', () => {
    // Guards everything below: an empty list would pass vacuously.
    expect(every.length).toBeGreaterThan(3000);
    expect(FULL.length).toBeGreaterThanOrEqual(12);
  });

  it('Basic really does meet an ad gate — the branch is reachable', () => {
    const gated = every.filter(({ r }) => accessFor(r, 'basic').kind === 'ad_gated');
    expect(gated.length).toBeGreaterThan(1000);
  });

  it('Premium really does meet a lock — that branch is reachable too', () => {
    const locked = every.filter(({ r }) => accessFor(r, 'trial').kind === 'premium_only');
    expect(locked.length).toBeGreaterThan(100);
  });
});

describe('YouTube is never gated, on any plan', () => {
  it.each(ALL)('%s opens every YouTube link freely', (entitlement) => {
    const offenders = every
      .filter(({ r }) => isYouTube(r.url))
      .filter(({ r }) => accessFor(r, entitlement).kind !== 'open')
      .map(({ id, r }) => `${id}: ${r.type} ${r.url}`);

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it('no YouTube link is marked premium or ad-gated in the data', () => {
    // accessFor() would open them regardless, but wrong data is still wrong:
    // it is what the paywall bug looked like before it was fixed.
    const offenders = every
      .filter(({ r }) => isYouTube(r.url))
      .filter(({ r }) => r.access !== 'all' || r.ad_gate_allowed !== false)
      .map(({ id, r }) => `${id}: ${r.type} access=${r.access} gate=${r.ad_gate_allowed}`);

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('practice stays free on every plan (§10.1)', () => {
  it.each(ALL)('%s opens all practice links', (entitlement) => {
    const offenders = every
      .filter(({ r }) => r.type === 'practice')
      .filter(({ r }) => accessFor(r, entitlement).kind !== 'open')
      .map(({ id, r }) => `${id}: ${r.url}`);

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('Premium opens everything', () => {
  it('never sees a lock or an ad gate', () => {
    const offenders = every
      .filter(({ r }) => accessFor(r, 'premium').kind !== 'open')
      .map(({ id, r }) => `${id}: ${r.type} ${r.url}`);

    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});
