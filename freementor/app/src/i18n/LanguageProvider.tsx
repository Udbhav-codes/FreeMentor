/**
 * The learner's language, available to every screen.
 *
 * It lives in the profile row, but screens must not each read it for
 * themselves: changing the language in Profile has to re-render the tab bar,
 * the roadmap and everything else at once, and a per-screen read would leave
 * half the app in the old language until each screen happened to reload.
 *
 * `t` is recreated when the language changes, which is what makes components
 * using it re-render.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadProfile, saveProfile } from '../db/profile.ts';
import { isLanguage, translate, type Params } from './translate.ts';
import type { Language, StringKey } from './strings.ts';

interface LanguageState {
  language: Language;
  /** Translate a key, filling any `{placeholders}`. */
  t: (key: StringKey, params?: Params) => string;
  /** Persists to the profile and re-renders everything. */
  setLanguage: (next: Language) => Promise<void>;
}

const Ctx = createContext<LanguageState | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadProfile()
      .then((profile) => {
        if (isLanguage(profile?.language)) setLanguageState(profile.language);
      })
      .catch(() => {
        // A profile that will not load is not worth blocking the app over;
        // English is a working default.
      });
  }, []);

  const setLanguage = useCallback(async (next: Language) => {
    // State first so the change is instant; the write follows. A failed write
    // means the choice does not survive a restart, which is better than a UI
    // that appears not to have responded.
    setLanguageState(next);
    await saveProfile({ language: next }).catch(() => undefined);
  }, []);

  const value = useMemo<LanguageState>(
    () => ({
      language,
      t: (key, params) => translate(key, language, params),
      setLanguage,
    }),
    [language, setLanguage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLanguage(): LanguageState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>');
  return ctx;
}

/** The common case: `const t = useT()`. */
export function useT(): (key: StringKey, params?: Params) => string {
  return useLanguage().t;
}
