/**
 * Devanagari typography — the Hindi half of the UI.
 *
 * ## The problem this fixes
 *
 * Inter and DM Sans carry no Devanagari glyphs. Every Hindi string therefore
 * fell back to whatever Android had — usually Noto — so a Hindi learner read
 * the app in a different typeface from the one it was designed in, with
 * different metrics and a different colour on the page. Legible, but visibly
 * not the same product.
 *
 * ## Why a mapping rather than a second theme
 *
 * The typography tokens encode size, line height and letter spacing as well
 * as family, and those are right for Hindi too. Only the family is wrong. So
 * this swaps the family and leaves everything else, which means a change to
 * `typography` keeps applying to both scripts without anybody remembering to
 * mirror it.
 *
 * ## Hinglish deliberately does NOT use this
 *
 * Hinglish is Hindi written in Latin script ("Aapka roadmap taiyaar hai"), so
 * it renders correctly in Inter and DM Sans and should keep them. Switching
 * it to a Devanagari font would be both pointless and slightly worse, since
 * these fonts' Latin glyphs are not what the UI was drawn with. It is also
 * part of why Hinglish exists.
 *
 * ## The weight cost
 *
 * Four static weights at ~216 KB each, about 864 KB in the APK. Noto Sans
 * Devanagari ships no variable font through @expo-google-fonts, so there is
 * no single-file option; and loading from a CDN was rejected because the app
 * has to work offline. Weights are imported per file for the same reason the
 * Latin ones are (CLAUDE.md): importing the package root pulls all nine.
 */

/** A font family the UI uses, mapped to its Devanagari equivalent. */
export const DEVANAGARI_FOR: Readonly<Record<string, string>> = {
  Inter_400Regular: 'NotoSansDevanagari_400Regular',
  Inter_500Medium: 'NotoSansDevanagari_500Medium',
  Inter_600SemiBold: 'NotoSansDevanagari_600SemiBold',
  DMSans_500Medium: 'NotoSansDevanagari_500Medium',
  DMSans_700Bold: 'NotoSansDevanagari_700Bold',
  // Devanagari has no italic tradition, and a synthetic oblique applied to
  // it reads as a rendering fault rather than emphasis. The warm "your
  // roadmap is ready" moment keeps its weight and loses only the slant.
  DMSans_700Bold_Italic: 'NotoSansDevanagari_700Bold',
};

/** The families to hand `useFonts`. Derived, so the two cannot drift. */
export const DEVANAGARI_FAMILIES: readonly string[] = Array.from(
  new Set(Object.values(DEVANAGARI_FOR)),
).sort();

/**
 * Whether a language needs Devanagari glyphs.
 *
 * Only `hi`. `en` and `hi-en` (Hinglish) are Latin script.
 */
export function needsDevanagari(language: string): boolean {
  return language === 'hi';
}

/**
 * Swaps a font family for its Devanagari equivalent.
 *
 * Returns the input untouched when the language is Latin-script, or when the
 * family has no mapping — a caller passing something unexpected should get
 * the Latin font rather than no font at all.
 */
export function devanagariFamily(family: string | undefined, language: string): string | undefined {
  if (!family || !needsDevanagari(language)) return family;
  return DEVANAGARI_FOR[family] ?? family;
}

/**
 * The same, for a whole typography token.
 *
 * Size, line height and letter spacing are carried through unchanged.
 */
export function devanagariType<T extends { fontFamily?: string }>(token: T, language: string): T {
  const swapped = devanagariFamily(token.fontFamily, language);
  return swapped === token.fontFamily ? token : { ...token, fontFamily: swapped };
}
