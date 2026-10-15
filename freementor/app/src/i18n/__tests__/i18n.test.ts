/**
 * The string catalogues, and the one failure mode that matters: a learner
 * reading a raw key, an unfilled placeholder, or English on a Hindi phone.
 *
 * TypeScript already makes a *missing* key impossible — `hi` and `hinglish`
 * are typed `Record<StringKey, string>`. What it cannot catch is a key that
 * was copied across and left in English, or a placeholder that was dropped in
 * translation, and those are what these tests are for.
 */
import { describe, expect, it } from 'vitest';
import { catalogues, en, hi, hinglish, type StringKey } from '../strings.ts';
import { LANGUAGES, fill, isLanguage, translate } from '../translate.ts';
import { checkCopy } from '../../marketing/compliance.ts';

const keys = Object.keys(en) as StringKey[];
const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();

describe('the catalogues line up', () => {
  it('covers a real number of strings', () => {
    // Guards everything below: an empty catalogue would pass vacuously.
    expect(keys.length).toBeGreaterThan(80);
  });

  it('has every key in all three languages', () => {
    for (const [name, catalogue] of Object.entries(catalogues)) {
      const missing = keys.filter((k) => !(k in catalogue));
      expect(missing, `${name} is missing: ${missing.join(', ')}`).toEqual([]);
    }
  });

  it('has no empty strings', () => {
    for (const [name, catalogue] of Object.entries(catalogues)) {
      const blank = keys.filter((k) => !(catalogue as Record<string, string>)[k]?.trim());
      expect(blank, `${name} has blanks: ${blank.join(', ')}`).toEqual([]);
    }
  });

  it('keeps the same placeholders in every language', () => {
    // Word order differs — Hindi is subject-object-verb, so {name} may sit
    // elsewhere in the sentence — but a placeholder that was DROPPED is a
    // number the learner never sees.
    const wrong: string[] = [];
    for (const key of keys) {
      const expected = placeholders(en[key]);
      for (const [name, catalogue] of Object.entries(catalogues)) {
        const actual = placeholders((catalogue as Record<string, string>)[key]!);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          wrong.push(`${name}.${key}: expected ${expected.join(',')} got ${actual.join(',')}`);
        }
      }
    }
    expect(wrong, wrong.slice(0, 5).join('\n')).toEqual([]);
  });
});

describe('the translations are actually translations', () => {
  it('leaves almost nothing in English in the Devanagari catalogue', () => {
    // A key copied across and left untranslated is the failure TypeScript
    // cannot see. A handful of strings are legitimately identical — brand
    // names and labels nobody translates — so this allows a small number
    // rather than demanding zero.
    const identical = keys.filter((k) => hi[k] === en[k]);
    expect(identical.length, `still English: ${identical.join(', ')}`).toBeLessThan(5);
  });

  it('writes Hindi in Devanagari, not Latin', () => {
    const devanagari = /[ऀ-ॿ]/;
    const latinOnly = keys.filter((k) => !devanagari.test(hi[k]));
    // Some strings are mostly a placeholder or a brand name, so a few will
    // have no Devanagari at all. Most must.
    expect(latinOnly.length / keys.length).toBeLessThan(0.15);
  });

  it('writes Hinglish in Latin, not Devanagari', () => {
    // The whole point of the third catalogue: it needs no Devanagari font,
    // which the app does not ship.
    const devanagari = /[ऀ-ॿ]/;
    const wrong = keys.filter((k) => devanagari.test(hinglish[k]));
    expect(wrong, `Devanagari in Hinglish: ${wrong.join(', ')}`).toEqual([]);
  });

  it('keeps technical words a learner would say out loud', () => {
    // Hinglish exists to read naturally, not to be a dictionary. "streak"
    // and "roadmap" stay English because that is what people say.
    expect(hinglish['home.streak']).toMatch(/streak/i);
    expect(hinglish['home.yourRoute']).toMatch(/route/i);
  });
});

describe('translate', () => {
  it('returns the string for the chosen language', () => {
    expect(translate('common.done', 'en')).toBe('Done');
    expect(translate('common.done', 'hi')).toBe('हो गया');
    expect(translate('common.done', 'hi-en')).toBe('Ho gaya');
  });

  it('fills placeholders', () => {
    expect(translate('home.streak', 'en', { count: 7 })).toBe('7-day streak');
    expect(translate('plans.trialLeft', 'en', { days: 2 })).toBe(
      '2 days left of your free trial',
    );
  });

  it('fills them wherever the sentence puts them', () => {
    // Hindi reorders: "{total} में से हफ़्ता {week}".
    expect(translate('home.weekOf', 'hi', { week: 3, total: 40 })).toBe('40 में से हफ़्ता 3');
    expect(translate('home.weekOf', 'en', { week: 3, total: 40 })).toBe('Week 3 of 40');
  });

  it('falls back to English for a language we do not ship', () => {
    // A stale profile row must never show a raw key.
    expect(translate('common.done', 'ta')).toBe('Done');
    expect(translate('common.done', '')).toBe('Done');
  });

  it('never returns the key itself', () => {
    for (const key of keys) {
      for (const language of ['en', 'hi', 'hi-en', 'nonsense']) {
        expect(translate(key, language)).not.toBe(key);
      }
    }
  });
});

describe('fill', () => {
  it('leaves an unmatched placeholder visible rather than blank', () => {
    // Ugly, but obviously broken — where a silently dropped number reads as a
    // sentence somebody meant to write.
    expect(fill('Last {days} of your trial', {})).toBe('Last {days} of your trial');
    expect(fill('Last {days} of your trial')).toBe('Last {days} of your trial');
  });

  it('handles numbers and repeats', () => {
    expect(fill('{a} and {a} and {b}', { a: 1, b: 'two' })).toBe('1 and 1 and two');
  });
});

describe('the language list', () => {
  it('offers exactly the three the catalogues have', () => {
    expect(LANGUAGES.map((l) => l.value).sort()).toEqual(['en', 'hi', 'hi-en']);
  });

  it('labels each in its own script, so a learner can find theirs', () => {
    expect(LANGUAGES.find((l) => l.value === 'hi')?.label).toBe('हिंदी');
  });

  it('recognises only the languages we ship', () => {
    expect(isLanguage('hi')).toBe(true);
    expect(isLanguage('hi-en')).toBe(true);
    expect(isLanguage('ta')).toBe(false);
    expect(isLanguage(null)).toBe(false);
  });
});

describe('the brand inside a translated sentence', () => {
  it('moves position between languages, which is why BrandText splits on it', () => {
    // English puts it last, Hindi first. Rendering "sentence minus brand"
    // then appending an amber "Mentor" worked in English and produced
    // "Free में आपका स्वागत हैMentor" in Hindi.
    expect(en['signIn.title'].endsWith('FreeMentor')).toBe(true);
    expect(hi['signIn.title'].startsWith('FreeMentor')).toBe(true);
  });

  it('keeps the brand spelled exactly the same in every language', () => {
    // BrandText splits on the literal string; a transliterated brand would
    // simply not be found and would render unstyled.
    for (const catalogue of [en, hi, hinglish]) {
      expect(catalogue['signIn.title']).toContain('FreeMentor');
    }
  });
});

describe('the catalogues obey the advertising rules', () => {
  // Added Oct 2026. The locking change was applied to the gate, the library,
  // the validator and the marketing module — and missed two strings in here,
  // which went on telling learners that "YouTube lessons stay free to open on
  // every plan" after they had stopped doing so. src/marketing/ had tests
  // over every goal's copy; the UI catalogue had none, so the claims that
  // reach the most screens were the least checked.
  //
  // Only `en` can be matched by English-language regexes, which is a real
  // limit worth stating rather than papering over: a false claim introduced
  // only in the Hindi catalogue would not be caught here. `en` is the source
  // of truth that the other two are translated from, so this is where such a
  // claim would enter.
  it('breaks no advertising rule in any English string', () => {
    const failures: string[] = [];
    for (const key of keys) {
      for (const violation of checkCopy(en[key])) {
        failures.push(`${key}: [${violation.rule}] "${violation.match}" — ${en[key]}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('describes Basic as reaching every resource through an ad', () => {
    // The paywall's own feature list, which must agree with
    // billing/entitlement.ts: Basic opens everything, videos included, after
    // a rewarded ad. It advertised the opposite until this was fixed.
    const basic = [
      en['plans.basicFeature2'],
      en['plans.basicFeature3'],
    ].join(' ');
    expect(basic).toMatch(/videos/i);
    expect(basic).toMatch(/rewarded ad/i);
    expect(basic).not.toMatch(/free to open|always/i);
  });
});
