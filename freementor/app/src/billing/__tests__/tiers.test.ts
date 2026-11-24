/**
 * The §10.1 tier table, checked against the real library.
 *
 * The rules are unit-tested next door; this runs them over every resource of
 * all 12 full goals, so a library file that drifts from the model shows up
 * here rather than on somebody's phone.
 *
 * Model per the owner's Nov 2026 plan table; see billing/entitlement.ts.
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

const isVideoOrNote = (r: Resource) => r.type === 'video' || r.type === 'notes';
const isPlanGated = (r: Resource) => r.type === 'practice' || r.type === 'test';
const isExtra = (r: Resource) => r.access === 'premium';

describe('the trial', () => {
  it('opens every video and main note', () => {
    const o = offendersFor('trial', 'open', (r) => isVideoOrNote(r) && !isExtra(r));
    expect(o, o.slice(0, 5).join('\n')).toEqual([]);
  });

  it('locks every practice and test link', () => {
    const o = offendersFor('trial', 'needs_plan', (r) => isPlanGated(r) && !isExtra(r));
    expect(o, o.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('an expired trial', () => {
  it('ad-gates every video and main note', () => {
    const o = offendersFor('expired', 'ad_gated', (r) => isVideoOrNote(r) && !isExtra(r));
    expect(o, o.slice(0, 5).join('\n')).toEqual([]);
  });

  it('locks every practice and test link', () => {
    const o = offendersFor('expired', 'needs_plan', (r) => isPlanGated(r) && !isExtra(r));
    expect(o, o.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('Basic opens everything but extra notes, with no ad', () => {
  it('opens every non-Premium resource', () => {
    const offenders = offendersFor('basic', 'open', (r) => !isExtra(r));
    expect(offenders, offenders.slice(0, 5).join('\n')).toEqual([]);
  });

  it('still meets the Premium lock on Premium resources', () => {
    const locked = every.filter(
      ({ r }) => isExtra(r) && accessFor(r, 'basic').kind === 'premium_only',
    );
    // The library has 429 of them.
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
