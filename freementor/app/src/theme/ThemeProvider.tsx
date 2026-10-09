/**
 * Theme context. Appearance is Light / Dark / System (product plan §8.9),
 * stored in the profile table so it survives a restart.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from './tokens.ts';

export type Appearance = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialAppearance = 'system',
  onAppearanceChange,
}: {
  children: ReactNode;
  initialAppearance?: Appearance;
  onAppearanceChange?: (next: Appearance) => void;
}) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>(initialAppearance);

  useEffect(() => setAppearanceState(initialAppearance), [initialAppearance]);

  const value = useMemo<ThemeContextValue>(() => {
    const resolved = appearance === 'system' ? (system ?? 'light') : appearance;
    return {
      theme: resolved === 'dark' ? darkTheme : lightTheme,
      appearance,
      setAppearance: (next) => {
        setAppearanceState(next);
        onAppearanceChange?.(next);
      },
    };
  }, [appearance, system, onAppearanceChange]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx.theme;
}

export function useAppearance(): Pick<ThemeContextValue, 'appearance' | 'setAppearance'> {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppearance must be used inside <ThemeProvider>');
  return { appearance: ctx.appearance, setAppearance: ctx.setAppearance };
}
