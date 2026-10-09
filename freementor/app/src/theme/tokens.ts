/**
 * Design tokens — product plan §11.2 and design/FreeMentor_App_Preview.png.
 *
 * Contrast ratios in the comments are the ones the product plan verified; do
 * not change a value without re-checking, since the 14 sp body text and the
 * amber "today" chip are both close to the WCAG AA floor.
 */

export const palette = {
  navy: '#0A2463',
  sky: '#8FB3FF',
  base: '#EEF1F7',
  card: '#FFFFFF',
  ink: '#0B1220',
  secondary: '#5B6475',
  amber: '#F2A900',
  green: '#127A45',
  darkBase: '#0B1020',
  darkCard: '#141B2D',
  darkInk: '#E8ECF4',
  darkSecondary: '#9AA4B8',
  darkGreen: '#4ADE80',
} as const;

export interface Colors {
  /** Brand. Solid primary buttons, the progress ring, the current tab. */
  primary: string;
  onPrimary: string;
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Streak and "today" ONLY — never decorative (product plan §11.2). */
  accent: string;
  onAccent: string;
  success: string;
  /** Faded future stops on the roadmap route. */
  muted: string;
  overlay: string;
}

export const lightColors: Colors = {
  primary: palette.navy, // 14.5:1 on white
  onPrimary: '#FFFFFF',
  background: palette.base,
  card: palette.card,
  text: palette.ink,
  textSecondary: palette.secondary, // 5.3:1
  border: '#DCE2EC',
  accent: palette.amber,
  onAccent: palette.navy, // 7.2:1 navy on amber
  success: palette.green,
  muted: '#A8B0C0',
  overlay: 'rgba(11, 18, 32, 0.45)',
};

export const darkColors: Colors = {
  primary: palette.sky,
  onPrimary: palette.darkBase,
  background: palette.darkBase,
  card: palette.darkCard,
  text: palette.darkInk,
  textSecondary: palette.darkSecondary,
  border: '#243049',
  accent: palette.amber,
  onAccent: palette.navy,
  success: palette.darkGreen,
  muted: '#4A566F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 4 pt scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/**
 * Minimum 14 sp body, per product plan §11.3 — and every size here scales
 * with the system font setting, so nothing is locked to a pixel size.
 */
export const typography = {
  display: { fontFamily: 'DMSans_700Bold', fontSize: 28, lineHeight: 34 },
  /** Italic DM Sans is reserved for warm moments: "Your *roadmap* is ready". */
  displayItalic: { fontFamily: 'DMSans_700Bold_Italic', fontSize: 28, lineHeight: 34 },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: 'DMSans_500Medium', fontSize: 18, lineHeight: 24 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },
} as const;

/**
 * Soft minimal + LIGHT neumorphism (product plan §11.1): soft shadows only on
 * large cards, the progress ring and checkboxes. Dark mode drops neumorphism
 * for flat elevation — raised shadows read as dirt on a dark surface.
 */
export const elevation = {
  card: {
    shadowColor: '#9AA7BF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  cardDark: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  none: { shadowOpacity: 0, elevation: 0 },
} as const;

/** 48 dp minimum touch target (product plan §11.4). */
export const MIN_TOUCH_TARGET = 48;

export interface Theme {
  dark: boolean;
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation.card | typeof elevation.cardDark;
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  elevation: elevation.card,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
  elevation: elevation.cardDark,
};
