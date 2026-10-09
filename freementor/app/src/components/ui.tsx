/**
 * Shared primitives. Every screen is built from these, so the soft-minimal
 * look (§11.1) stays consistent and the accessibility floors — 48 dp targets,
 * 14 sp minimum text — are enforced in one place.
 *
 * Two card variants, because the mockup uses both and the difference IS the
 * house style:
 *   raised  — background-coloured with a two-sided neumorphic shadow, so it
 *             looks pressed out of the screen. The default.
 *   surface — a plain white panel for content sitting inside a raised card.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { BUTTON_HEIGHT, CHECKBOX_SIZE, MIN_TOUCH_TARGET } from '../theme/tokens.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

type TextVariant = keyof ReturnType<typeof useTheme>['typography'];

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: TextVariant;
  color?: 'text' | 'secondary' | 'primary' | 'accent' | 'success' | 'onPrimary' | 'danger';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const theme = useTheme();
  const colors = {
    text: theme.colors.text,
    secondary: theme.colors.textSecondary,
    primary: theme.colors.primary,
    accent: theme.colors.accent,
    success: theme.colors.success,
    onPrimary: theme.colors.onPrimary,
    danger: '#B3261E',
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[theme.typography[variant], { color: colors[color ?? 'text'] }, style]}
    >
      {children}
    </Text>
  );
}

export function Card({
  children,
  style,
  onPress,
  variant = 'raised',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: 'raised' | 'surface';
}) {
  const theme = useTheme();
  const raised = variant === 'raised';

  const body = (
    <View
      style={[
        {
          backgroundColor: raised ? theme.colors.background : theme.colors.surface,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          boxShadow: raised ? theme.shadows.raised : theme.shadows.soft,
          // Dark mode has no neumorphism, so a hairline keeps cards readable.
          borderWidth: theme.dark ? 1 : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {body}
    </Pressable>
  );
}

/**
 * Primary action: solid navy, 52 dp tall, never neumorphic. §11.1 is explicit
 * that main buttons must always read as tappable.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Chip-sized, for option grids. Still 44 dp tall. */
  compact?: boolean;
}) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 44 : BUTTON_HEIGHT,
          paddingVertical: compact ? 0 : theme.spacing.sm,
          paddingHorizontal: compact ? theme.spacing.lg : theme.spacing.lg,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isPrimary
            ? theme.colors.primary
            : variant === 'secondary'
              ? theme.colors.surface
              : 'transparent',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.colors.onPrimary : theme.colors.primary} />
      ) : (
        <Txt
          variant="bodyStrong"
          color={isPrimary ? 'onPrimary' : 'primary'}
          // A full-width button wraps; only chips are held to one line. The
          // longest qualification option is 43 characters and 68 of the 73
          // goals use it, so one line silently ellipsised it.
          numberOfLines={compact ? 1 : 2}
          style={{ textAlign: 'center' }}
        >
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

/** 22 dp box, carved in when unchecked, solid navy when done — inside a 48 dp row. */
export function Checkbox({
  checked,
  onToggle,
  label,
  sublabel,
  minutes,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  sublabel?: string;
  minutes?: number;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: MIN_TOUCH_TARGET,
        paddingVertical: theme.spacing.sm,
        gap: theme.spacing.md,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: CHECKBOX_SIZE,
          height: CHECKBOX_SIZE,
          borderRadius: theme.radius.xs,
          backgroundColor: checked ? theme.colors.primary : theme.colors.background,
          boxShadow: checked ? 'none' : theme.shadows.inset,
          borderWidth: theme.dark && !checked ? 1 : 0,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text style={{ color: theme.colors.onPrimary, fontSize: 13, lineHeight: 16 }}>✓</Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Txt
          variant="body"
          style={checked ? { textDecorationLine: 'line-through', opacity: 0.55 } : undefined}
        >
          {label}
        </Txt>
        {sublabel ? (
          <Txt variant="caption" color="secondary">
            {sublabel}
          </Txt>
        ) : null}
      </View>

      {minutes != null ? (
        <Txt variant="caption" color="secondary">
          {minutes} m
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** Small status chip. Amber is reserved for streak and "today". */
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'primary';
}) {
  const theme = useTheme();
  const styles: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.chip, fg: theme.colors.onChip },
    accent: { bg: theme.colors.accentSoft, fg: theme.colors.onAccent },
    success: { bg: theme.dark ? '#13351F' : '#DCF3E6', fg: theme.colors.success },
    primary: { bg: theme.colors.primary, fg: theme.colors.onPrimary },
  };
  const { bg, fg } = styles[tone]!;

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 9,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[theme.typography.caption, { color: fg, fontSize: 11 }]}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ fraction }: { fraction: number }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}
      style={{
        height: 8,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.pill,
        }}
      />
    </View>
  );
}

export function Screen({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}>{children}</View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { padding: theme.spacing.xl, gap: theme.spacing.sm }]}>
      <Txt variant="heading">{title}</Txt>
      {body ? (
        <Txt variant="small" color="secondary" style={{ textAlign: 'center' }}>
          {body}
        </Txt>
      ) : null}
    </View>
  );
}

/** A labelled value row — used on every summary card. */
export function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.spacing.sm,
        gap: theme.spacing.md,
      }}
    >
      <Txt variant="small" color="secondary">
        {label}
      </Txt>
      <Txt variant="bodyStrong" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
