/**
 * The §10.1 tier table, checked against the real library.
 *
 * The rules are unit-tested next door; this runs them over every resource of
 * all 12 full goals, so a library file that drifts from the model shows up
 * here rather than on somebody's phone.
 *
 * The model changed in Oct 2026: the trial is Basic made free for three days,
 * and when it ends everything locks — videos included. This file previously
 * asserted the opposite for YouTube.
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
      if (typeof o.url === 'string' && typeof o.type === 'string')
        out.push(o as unknown as Resource);
      Object.values(o).forEach(walk);
    }
  };
  walk(doc);
  return out;
}

const ALL: Entitlement[] = ['trial', 'expired', 'basic', 'premium'];
const every = FULL.flatMap((id) => resourcesOf(id).map((r) => ({ id, r })));

const offendersFor = (
  entitlement: Entitlement,
  want: string,
  filter: (r: Resource) => boolean = () => true,
) =>
  every
    .filter(({ r }) => filter(r))
    .filter(({ r }) => accessFor(r, entitlement).kind !== want)
    .map(({ id, r }) => `${id}: ${r.type} ${r.url}`);

describe('the library has resources to gate at all', () => {
  it('found them', () => {
    // Guards everything below: an empty list would pass vacuously.
    expect(every.length).toBeGreaterThan(3000);
    expect(FULL.length).toBeGreaterThanOrEqual(12);
  });
});

describe('the trial opens the whole library', () => {
  it('every resource, including videos and Premium notes', () => {
    const offenders = offendersFor('trial', 'open');
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('an expired trial locks the whole library', () => {
  it('every resource, videos included', () => {
    // The change the owner asked for, asserted across all 12 goals rather
    // than on a synthetic resource.
    const offenders = offendersFor('expired', 'needs_plan');
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('Basic reaches everything through an ad', () => {
  it('ad-gates every non-Premium resource', () => {
    const offenders = offendersFor('basic', 'ad_gated', (r) => r.access !== 'premium');
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it('still meets the Premium lock on Premium resources', () => {
    const locked = every.filter(
      ({ r }) => r.access === 'premium' && accessFor(r, 'basic').kind === 'premium_only',
    );
    // The library has 429 of them; if that branch ever stops being reachable
    // Premium has nothing left to sell.
    expect(locked.length).toBeGreaterThan(100);
  });
});

describe('Premium opens everything', () => {
  it('never meets a lock or an ad gate', () => {
    const offenders = offendersFor('premium', 'open');
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('no resource falls through', () => {
  it('every plan resolves every resource to a known outcome', () => {
    const known = ['open', 'ad_gated', 'premium_only', 'needs_plan'];
    for (const entitlement of ALL) {
      const bad = every.filter(
        ({ r }) => !known.includes(accessFor(r, entitlement).kind),
      );
      expect(bad.length, `${entitlement} has unresolved resources`).toBe(0);
    }
  });
});
