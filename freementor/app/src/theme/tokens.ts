/**
 * Design tokens — product plan §11 and the exact values from
 * design/freementor_mockup.html.
 *
 * Contrast ratios in the comments are the ones the product plan verified; do
 * not change a value without re-checking, since the 14 sp body text and the
 * amber "today" chip both sit near the WCAG AA floor.
 */

export const palette = {
  navy: '#0A2463',
  navySoft: '#3E5C9A',
  sky: '#8FB3FF',
  base: '#EEF1F7',
  card: '#FFFFFF',
  ink: '#0B1220',
  secondary: '#5B6475',
  line: '#DCE1EC',
  amber: '#F2A900',
  /** Light amber chip background — the mockup's .amberpill. */
  amberSoft: '#FFF1C7',
  amberInk: '#6B4A00',
  /** Neutral chip background — the mockup's .pill. */
  chip: '#E2E8F5',
  green: '#127A45',
  navInactive: '#8A93A6',
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
  /** White panels sitting on top of a raised card. */
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Streak and "today" ONLY — never decorative (product plan §11.2). */
  accent: string;
  accentSoft: string;
  onAccent: string;
  chip: string;
  onChip: string;
  success: string;
  muted: string;
  navInactive: string;
  overlay: string;
}

export const lightColors: Colors = {
  primary: palette.navy, // 14.5:1 on white
  onPrimary: '#FFFFFF',
  background: palette.base,
  surface: palette.card,
  text: palette.ink,
  textSecondary: palette.secondary, // 5.3:1
  border: palette.line,
  accent: palette.amber,
  accentSoft: palette.amberSoft,
  onAccent: palette.amberInk, // dark brown on soft amber, not navy on solid
  chip: palette.chip,
  onChip: palette.navy,
  success: palette.green,
  muted: '#A8B0C0',
  navInactive: palette.navInactive,
  overlay: 'rgba(11, 18, 32, 0.45)',
};

export const darkColors: Colors = {
  primary: palette.sky,
  onPrimary: palette.darkBase,
  background: palette.darkBase,
  surface: palette.darkCard,
  text: palette.darkInk,
  textSecondary: palette.darkSecondary,
  border: '#243049',
  accent: palette.amber,
  accentSoft: '#3A2E12',
  onAccent: '#FFD98A',
  chip: '#1E2940',
  onChip: palette.sky,
  success: palette.darkGreen,
  muted: '#4A566F',
  navInactive: '#6B778F',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 4 pt scale. Screen gutter is 20, matching the mockup's .content padding. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  screen: 20,
  xl: 24,
  xxl: 32,
} as const;

/** Radii straight from the mockup: cards 22, buttons 16, checkboxes 7. */
export const radius = {
  xs: 7,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/**
 * Minimum 14 sp body (§11.3). DM Sans for headings — italic reserved for warm
 * moments like "Your *roadmap* is ready". Everything scales with the system
 * font setting; nothing is locked to a pixel size.
 */
export const typography = {
  display: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  displayItalic: {
    fontFamily: 'DMSans_700Bold_Italic',
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  heading: { fontFamily: 'DMSans_500Medium', fontSize: 16, lineHeight: 22 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22 },
  small: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 },
  /** The bottom nav's labels — 10.5 in the mockup, floored at 11 for legibility. */
  navLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 14 },
} as const;

/**
 * Light neumorphism (§11.1): a dark shadow bottom-right and a light one
 * top-left, so a card looks pressed out of the background rather than
 * floating above it. That needs TWO shadows, which React Native can only do
 * through `boxShadow` (New Architecture, RN 0.81+).
 *
 * Dark mode deliberately drops it: a raised highlight on a dark surface reads
 * as dirt, so §11.1 calls for soft elevation instead.
 */
export const shadows = {
  /** Large cards, the progress ring — the signature look. */
  neu: '6px 6px 14px rgba(10, 36, 99, 0.10), -6px -6px 14px rgba(255, 255, 255, 0.95)',
  /** Unchecked checkboxes: carved IN rather than raised. */
  neuInset:
    'inset 3px 3px 7px rgba(10, 36, 99, 0.10), inset -3px -3px 7px rgba(255, 255, 255, 0.95)',
  /** White panels sitting on a raised card. */
  soft: '0px 1px 2px rgba(10, 36, 99, 0.06), 0px 6px 18px rgba(10, 36, 99, 0.06)',
  darkRaised: '0px 2px 8px rgba(0, 0, 0, 0.40)',
  none: 'none',
} as const;

/** 48 dp minimum touch target (§11.4); primary buttons are 52 in the mockup. */
export const MIN_TOUCH_TARGET = 48;
export const BUTTON_HEIGHT = 52;
export const CHECKBOX_SIZE = 22;
export const TAB_BAR_HEIGHT = 74;

export interface Theme {
  dark: boolean;
  colors: Colors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: {
    /** The raised, background-coloured card. */
    raised: string;
    /** The white panel. */
    soft: string;
    /** The carved-in checkbox. */
    inset: string;
  };
}

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  spacing,
  radius,
  typography,
  shadows: { raised: shadows.neu, soft: shadows.soft, inset: shadows.neuInset },
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  spacing,
  radius,
  typography,
  shadows: { raised: shadows.darkRaised, soft: shadows.darkRaised, inset: shadows.none },
};
