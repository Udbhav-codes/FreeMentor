import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog } from '@freementor/shared';
import { welcomeCopy } from '../welcome.ts';
import { FREE_DISCLOSURE, PRICES, rupees } from '../../billing/pricing.ts';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(resolve(here, '../../../../../library/FreeMentor_Library/catalog.json'), 'utf8'),
) as Catalog;

const forGoal = (id: string) => {
  const g = catalog.goals.find((x) => x.id === id)!;
  return welcomeCopy({ goalId: g.id, goalName: g.name, goalType: g.type });
};

describe('the brand lead splits so "Mentor" can be amber', () => {
  it('reads "Welcome to FreeMentor" when joined', () => {
    const copy = forGoal('python');
    expect(copy.brandLead + copy.brandAccent).toBe('Welcome to FreeMentor');
  });
});

describe('the goal is named in the promise', () => {
  it('uses the real aspiration for the exams we know', () => {
    expect(forGoal('jee-advanced').promise).toContain('a seat at IIT');
    expect(forGoal('neet-ug').promise).toContain('an MBBS seat');
  });

  it('falls back to the goal name for anything else', () => {
    expect(forGoal('sql').promise).toContain('SQL');
    expect(forGoal('cybersecurity').promise).toContain('Cybersecurity');
  });

  it('produces sane copy for every one of the 73 goals', () => {
    for (const goal of catalog.goals) {
      const copy = welcomeCopy({
        goalId: goal.id,
        goalName: goal.name,
        goalType: goal.type,
      });
      // No unreplaced placeholders, and nothing empty.
      for (const [field, text] of Object.entries(copy)) {
        expect(text.length, `${goal.id}.${field} is empty`).toBeGreaterThan(0);
        expect(text, `${goal.id}.${field} has a placeholder`).not.toMatch(/____|undefined|NaN/);
      }
      expect(copy.promise, goal.id).toMatch(/\S/);
    }
  });
});

describe('the price comparison', () => {
  it('quotes the Basic price as the one-time lifetime cost', () => {
    const copy = forGoal('jee-main');
    expect(copy.value).toContain(rupees(PRICES.basic));
    expect(copy.value).toMatch(/one time, lifetime/);
  });

  it('compares against coaching for exams and bootcamps for skills', () => {
    expect(forGoal('jee-main').value).toContain('coaching courses');
    expect(forGoal('full-stack').value).toContain('bootcamps');
    expect(forGoal('python').value).toContain('paid courses');
  });

  it('never claims the comparison price is what FreeMentor costs', () => {
    const copy = forGoal('jee-main');
    // The cheaper figure must be ours, not the comparison's.
    expect(copy.value.indexOf(rupees(PRICES.basic))).toBeGreaterThan(
      copy.value.indexOf('Instead of paying'),
    );
  });
});

describe('the required "free" disclosure', () => {
  it('is always present', () => {
    for (const goal of catalog.goals.slice(0, 10)) {
      const copy = welcomeCopy({ goalId: goal.id, goalName: goal.name, goalType: goal.type });
      expect(copy.disclosure).toBe(FREE_DISCLOSURE);
    }
  });

  it('states the trial length and both prices, so "free" is never misleading', () => {
    expect(FREE_DISCLOSURE).toContain('free for 3 days');
    expect(FREE_DISCLOSURE).toContain(rupees(PRICES.basic));
    expect(FREE_DISCLOSURE).toContain(rupees(PRICES.premium));
    expect(FREE_DISCLOSURE).toContain('one-time');
  });
});

describe('the nudge line', () => {
  it('is goal-aware', () => {
    expect(forGoal('jee-advanced').nudge).toContain('JEE Advanced');
    expect(forGoal('full-stack').nudge).toContain('Full Stack');
  });

  it('never promises the content is paid-for', () => {
    for (const id of ['jee-main', 'python', 'full-stack']) {
      expect(forGoal(id).nudge.toLowerCase()).not.toContain('premium content');
    }
  });
});
