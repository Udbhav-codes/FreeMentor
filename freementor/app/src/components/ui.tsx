/**
 * Shared primitives. Every screen is built from these so the soft-minimal
 * look (product plan §11.1) stays consistent and the accessibility floors —
 * 48 dp targets, 14 sp minimum text — are enforced in one place.
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
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';
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
  color?: 'text' | 'secondary' | 'primary' | 'accent' | 'success' | 'onPrimary';
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

/** The soft card. Neumorphic shadow in light mode, flat elevation in dark. */
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
        },
        theme.elevation,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

/**
 * Primary action. Solid navy, never neumorphic — the product plan is explicit
 * that main buttons must always read as tappable (§11.1).
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const bg = isPrimary
    ? theme.colors.primary
    : variant === 'secondary'
      ? theme.colors.card
      : 'transparent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH_TARGET,
          paddingHorizontal: theme.spacing.xl,
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
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
        <Txt variant="bodyStrong" color={isPrimary ? 'onPrimary' : 'primary'}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

/** 48 dp tick target even though the box itself is 24 dp. */
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
          width: 24,
          height: 24,
          borderRadius: theme.radius.sm,
          borderWidth: checked ? 0 : 2,
          borderColor: theme.colors.muted,
          backgroundColor: checked ? theme.colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Text style={{ color: theme.colors.onPrimary, fontSize: 15, lineHeight: 18 }}>✓</Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Txt
          variant="body"
          style={checked ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
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
  const bg = {
    neutral: theme.colors.background,
    accent: theme.colors.accent,
    success: theme.colors.success,
    primary: theme.colors.primary,
  }[tone];
  const fg = {
    neutral: theme.colors.textSecondary,
    accent: theme.colors.onAccent,
    success: '#FFFFFF',
    primary: theme.colors.onPrimary,
  }[tone];

  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[theme.typography.caption, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** Plain horizontal progress bar — "████████░░ 72%" from product plan §8.6. */
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
        backgroundColor: theme.colors.background,
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

export function Screen({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
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

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
