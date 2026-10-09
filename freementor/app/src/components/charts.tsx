/**
 * The three data shapes the mockup uses: the progress ring on Home, the
 * weekday bars in onboarding, and the daily-hours / test-score bars in
 * Reports.
 *
 * The ring is SVG because it needs a real arc. The bars are plain Views —
 * cheaper than SVG on the 3-4 GB phones this app targets (product plan §11.4).
 */
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Txt } from './ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

/** The 42% ring from screen 3 of the preview. */
export function ProgressRing({
  fraction,
  size = 76,
  strokeWidth = 8,
  label,
}: {
  fraction: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.background}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          // Start the arc at 12 o'clock rather than 3.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Txt variant="bodyStrong">{label ?? `${Math.round(pct * 100)}%`}</Txt>
    </View>
  );
}

export interface Bar {
  label: string;
  value: number;
  /** Shown under the label, e.g. "2h". */
  caption?: string;
  highlight?: boolean;
}

/**
 * Vertical bars with an optional dashed target line — the "Daily study hours"
 * chart on the weekly report, and the weekday picker in onboarding.
 */
export function BarChart({
  bars,
  height = 110,
  target,
  targetLabel = 'target',
}: {
  bars: Bar[];
  height?: number;
  target?: number;
  targetLabel?: string;
}) {
  const theme = useTheme();
  const max = Math.max(...bars.map((b) => b.value), target ?? 0, 1);
  const scale = (value: number) => Math.max(2, Math.round((value / max) * height));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {target != null ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <Txt variant="caption" color="secondary">
            — {targetLabel}
          </Txt>
        </View>
      ) : null}

      <View style={{ height, position: 'relative' }}>
        {target != null ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: scale(target),
              borderBottomWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.colors.muted,
            }}
          />
        ) : null}

        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
          }}
        >
          {bars.map((bar, i) => (
            <View key={`${bar.label}-${i}`} style={{ alignItems: 'center', flex: 1 }}>
              <View
                style={{
                  width: 16,
                  height: scale(bar.value),
                  borderRadius: 4,
                  backgroundColor: bar.highlight ? theme.colors.accent : theme.colors.primary,
                }}
              />
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {bars.map((bar, i) => (
          <View key={`${bar.label}-label-${i}`} style={{ alignItems: 'center', flex: 1, gap: 2 }}>
            <Txt variant="caption" color="secondary">
              {bar.label}
            </Txt>
            {bar.caption ? (
              <Txt variant="caption" color="secondary">
                {bar.caption}
              </Txt>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Horizontal score bars — "Biology 84%" on the weekly report. */
export function ScoreBars({
  rows,
}: {
  rows: { label: string; percent: number }[];
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {rows.map((row) => (
        <View
          key={row.label}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <Txt variant="small" color="secondary" style={{ width: 84 }} numberOfLines={1}>
            {row.label}
          </Txt>
          <View
            style={{
              flex: 1,
              height: 8,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.background,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(0, Math.min(100, row.percent))}%`,
                height: '100%',
                borderRadius: theme.radius.pill,
                // Below the 60% mastery gate is worth seeing at a glance.
                backgroundColor: row.percent < 60 ? theme.colors.accent : theme.colors.primary,
              }}
            />
          </View>
          <Txt variant="caption" style={{ width: 36, textAlign: 'right' }}>
            {Math.round(row.percent)}%
          </Txt>
        </View>
      ))}
    </View>
  );
}
