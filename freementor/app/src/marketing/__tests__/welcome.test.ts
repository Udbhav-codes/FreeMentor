/**
 * Every line FreeMentor says to a learner, for every one of the 73 goals,
 * checked against India's advertising rules.
 *
 * This is the point of the whole module. Marketing copy is written under
 * pressure to convert, by whoever is editing at the time, and "guaranteed
 * selection" is always the easiest sentence to type. Here it fails the build.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Catalog, CatalogGoal } from '@freementor/shared';
import { allCopyStrings, welcomeCopy } from '../welcome.ts';
import { checkCopy, statesPriceHonestly } from '../compliance.ts';
import { FREE_DISCLOSURE, PRICES, rupees } from '../../billing/pricing.ts';

const here = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(resolve(here, '../../../../../library/FreeMentor_Library/catalog.json'), 'utf8'),
) as Catalog;

const goal = (id: string): CatalogGoal => catalog.goals.find((g) => g.id === id)!;
const copyFor = (id: string) => welcomeCopy(goal(id));

describe('compliance, across every goal', () => {
  it('breaks no advertising rule, in any line, for any of the 73 goals', () => {
    const failures: string[] = [];

    for (const entry of catalog.goals) {
      const copy = welcomeCopy(entry);
      for (const [field, text] of Object.entries(copy)) {
        for (const violation of checkCopy(text)) {
          failures.push(`${entry.id}.${field}: [${violation.rule}] "${violation.match}"`);
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('never promises a result, however the goal is phrased', () => {
    // Preparation language only: "your attempt at", "your shot at", never
    // "you will get".
    for (const entry of catalog.goals) {
      const copy = welcomeCopy(entry);
      const joined = allCopyStrings(copy).join(' ');
      expect(joined, entry.id).not.toMatch(/\byou will (get|clear|crack|pass|qualify)\b/i);
      expect(joined, entry.id).not.toMatch(/\bguarantee/i);
    }
  });

  it('states the price as one-time and lifetime wherever it appears', () => {
    for (const entry of catalog.goals) {
      const copy = welcomeCopy(entry);
      expect(statesPriceHonestly(copy.value), entry.id).toBe(true);
    }
  });

  it('says taxes are included, so the price shown is the price paid', () => {
    expect(copyFor('jee-main').value).toMatch(/inclusive of taxes/i);
    expect(FREE_DISCLOSURE).toMatch(/inclusive of taxes/i);
  });

  it('rules out a subscription, which the plan is not', () => {
    expect(FREE_DISCLOSURE).toMatch(/no subscription/i);
  });
});

describe('the compliance checker itself catches what it should', () => {
  it.each([
    ['Guaranteed selection in JEE Main!', 'outcome-guarantee'],
    ['You will clear NEET with this plan.', 'outcome-guarantee'],
    ['Get AIR 1 with FreeMentor', 'rank-promise'],
    ['Hurry, only 3 seats left!', 'false-urgency'],
    ['Offer ends tonight', 'false-urgency'],
    ['No, I do not want to succeed', 'confirm-shaming'],
    ['Cheaper than Unacademy', 'disparagement'],
    ['FreeMentor is completely free', 'free-without-qualification'],
    ['Special price for you today', 'fake-scarcity-price'],
  ])('flags %s', (text, rule) => {
    expect(checkCopy(text).map((v) => v.rule)).toContain(rule);
  });

  it('passes copy that is merely confident', () => {
    expect(checkCopy('A day-by-day plan built from free resources, yours for life.')).toEqual([]);
  });
});

describe('every goal gets its own message', () => {
  it('produces a distinct promise for all 73', () => {
    const promises = catalog.goals.map((g) => welcomeCopy(g).promise);
    expect(new Set(promises).size).toBe(catalog.goals.length);
  });

  it('names the real aspiration for each exam, not the exam code', () => {
    expect(copyFor('jee-advanced').promise).toContain('IIT');
    expect(copyFor('jee-main').promise).toContain('NIT');
    expect(copyFor('neet-ug').promise).toContain('MBBS');
    expect(copyFor('cat').promise).toContain('IIM');
    expect(copyFor('clat').promise).toContain('National Law University');
    expect(copyFor('upsc-cse').promise).toContain('Civil Services');
    expect(copyFor('sbi-po').promise).toContain('Probationary Officer');
    expect(copyFor('nda').promise).toContain('NDA');
    expect(copyFor('ugc-net').promise).toContain('Assistant Professor');
  });

  it('frames skills by their group', () => {
    expect(copyFor('full-stack').promise).toContain('ship');
    expect(copyFor('data-science').promise).toMatch(/data/i);
  });

  it('gives languages their own framing', () => {
    expect(copyFor('python').nudge).toContain('Python');
    expect(copyFor('python').nudge).toMatch(/already free/i);
  });

  it('has no placeholder or broken interpolation anywhere', () => {
    // brandLead/brandAccent are deliberately short fragments of the wordmark.
    const sentences = ['promise', 'facts', 'value', 'nudge', 'trust', 'disclosure'];
    for (const entry of catalog.goals) {
      const copy = welcomeCopy(entry);
      for (const [field, text] of Object.entries(copy)) {
        expect(text, `${entry.id}.${field}`).not.toMatch(/____|undefined|NaN|\[object/);
        if (sentences.includes(field)) {
          expect(text.length, `${entry.id}.${field}`).toBeGreaterThan(30);
          expect(text.trim(), `${entry.id}.${field}`).toMatch(/[.!?]$/);
        }
      }
    }
    expect(copyFor('jee-main').brandLead + copyFor('jee-main').brandAccent).toBe(
      'Welcome to FreeMentor',
    );
  });
});

describe('the card stays scannable', () => {
  it('keeps every line short enough to read at a glance', () => {
    // Regression: exam eligibility notes run to a paragraph, and pulling one
    // in turned the welcome card into a wall of text.
    const limits: Record<string, number> = {
      promise: 160,
      facts: 180,
      value: 220,
      nudge: 200,
      trust: 240,
      disclosure: 260,
    };
    for (const entry of catalog.goals) {
      const copy = welcomeCopy(entry);
      for (const [field, max] of Object.entries(limits)) {
        const text = copy[field as keyof typeof copy];
        expect(text.length, `${entry.id}.${field} is ${text.length} chars`).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('the facts are real, not adjectives', () => {
  it('quotes the goal\'s own hours and phases', () => {
    const jee = goal('jee-main');
    const facts = welcomeCopy(jee).facts;
    expect(facts).toContain(String(jee.estimated_hours));
    expect(facts).toContain(`${jee.phases!.length} phases`);
  });

  it('uses the goal\'s first career outcome where there is one', () => {
    const python = goal('python');
    expect(welcomeCopy(python).facts.toLowerCase()).toContain(
      python.career_outcomes![0]!.slice(1, 20).toLowerCase(),
    );
  });
});

describe('trust and the free/paid boundary', () => {
  it('says we link rather than re-host', () => {
    expect(copyFor('neet-ug').trust).toMatch(/never copy or re-host/i);
  });

  it('repeats that videos stay free on every plan', () => {
    for (const id of ['jee-main', 'python', 'full-stack']) {
      expect(copyFor(id).trust).toMatch(/free to open on every plan/i);
    }
  });

  it('carries the required disclosure on every goal', () => {
    for (const entry of catalog.goals) {
      expect(welcomeCopy(entry).disclosure).toBe(FREE_DISCLOSURE);
    }
    expect(FREE_DISCLOSURE).toContain('free for 3 days');
    expect(FREE_DISCLOSURE).toContain(rupees(PRICES.basic));
    expect(FREE_DISCLOSURE).toContain(rupees(PRICES.premium));
  });
});
