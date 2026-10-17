/**
 * The Devanagari font mapping.
 *
 * Two properties matter and neither is obvious from reading the component:
 * every family the UI actually uses must have a mapping (a missing one means
 * that one text style silently keeps falling back to the system font), and
 * Hinglish must NOT be switched, because it is Latin script.
 */
import { describe, expect, it } from 'vitest';
import { typography } from '../tokens.ts';
import {
  DEVANAGARI_FAMILIES,
  DEVANAGARI_FOR,
  devanagariFamily,
  devanagariType,
  needsDevanagari,
} from '../devanagari.ts';

describe('which languages need it', () => {
  it('is Hindi only', () => {
    expect(needsDevanagari('hi')).toBe(true);
    expect(needsDevanagari('en')).toBe(false);
    // Hinglish is Hindi in Latin script — it renders correctly in Inter and
    // must keep it. Switching it would be pointless and slightly worse.
    expect(needsDevanagari('hi-en')).toBe(false);
  });

  it('leaves an unknown language on the Latin fonts', () => {
    expect(needsDevanagari('ta')).toBe(false);
    expect(devanagariFamily('Inter_400Regular', 'ta')).toBe('Inter_400Regular');
  });
});

describe('every family the UI uses is covered', () => {
  it('maps all of them, derived from the real tokens', () => {
    // The test that actually protects this: adding a font to typography
    // without adding a mapping fails here rather than showing up as one
    // stray system-font line on a Hindi phone.
    const used = new Set(Object.values(typography).map((t) => t.fontFamily));
    const unmapped = [...used].filter((family) => !(family in DEVANAGARI_FOR));
    expect(unmapped, `no Devanagari mapping for: ${unmapped.join(', ')}`).toEqual([]);
  });

  it('maps every family to a Devanagari one', () => {
    for (const [latin, deva] of Object.entries(DEVANAGARI_FOR)) {
      expect(deva, latin).toMatch(/^NotoSansDevanagari_/);
    }
  });

  it('lists exactly the families that must be loaded, with no duplicates', () => {
    // DEVANAGARI_FAMILIES is what _layout hands useFonts. Derived from the
    // mapping so the two cannot drift apart.
    expect(DEVANAGARI_FAMILIES).toEqual([...new Set(DEVANAGARI_FAMILIES)]);
    expect(new Set(DEVANAGARI_FAMILIES)).toEqual(new Set(Object.values(DEVANAGARI_FOR)));
    // Four weights, which is the ~864 KB the APK pays. A fifth should be a
    // deliberate decision, not a slip.
    expect(DEVANAGARI_FAMILIES).toHaveLength(4);
  });

  it('folds italic onto the upright bold', () => {
    // Devanagari has no italic tradition; a synthetic oblique reads as a
    // rendering fault rather than emphasis.
    expect(DEVANAGARI_FOR.DMSans_700Bold_Italic).toBe('NotoSansDevanagari_700Bold');
  });
});

describe('swapping a typography token', () => {
  it('changes only the family', () => {
    const swapped = devanagariType(typography.body, 'hi');
    expect(swapped.fontFamily).toBe('NotoSansDevanagari_400Regular');
    expect(swapped.fontSize).toBe(typography.body.fontSize);
    expect(swapped.lineHeight).toBe(typography.body.lineHeight);
  });

  it('keeps letter spacing, which the display tokens rely on', () => {
    const swapped = devanagariType(typography.display, 'hi');
    expect(swapped.letterSpacing).toBe(typography.display.letterSpacing);
    expect(swapped.fontFamily).toBe('NotoSansDevanagari_700Bold');
  });

  it('returns the very same object for a Latin language', () => {
    // Identity, not just equality: a new object every render would defeat
    // any memoisation downstream.
    expect(devanagariType(typography.body, 'en')).toBe(typography.body);
    expect(devanagariType(typography.body, 'hi-en')).toBe(typography.body);
  });

  it('never mutates the token it was given', () => {
    const before = { ...typography.title };
    devanagariType(typography.title, 'hi');
    expect(typography.title).toEqual(before);
  });

  it('survives a token with no family', () => {
    const token: { fontFamily?: string; fontSize: number } = { fontSize: 12 };
    expect(devanagariType(token, 'hi')).toEqual({ fontSize: 12 });
  });

  it('leaves an unmapped family alone rather than blanking it', () => {
    // A caller passing something unexpected should get the Latin font, not
    // no font at all.
    expect(devanagariFamily('SomeOtherFont', 'hi')).toBe('SomeOtherFont');
  });
});
