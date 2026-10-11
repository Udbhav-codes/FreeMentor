/**
 * The GPS-style route — product plan §8.3, screen 4 of the preview.
 *
 * A vertical line of stops: done stops solid, today amber, future faded,
 * weeks that expand to their days. Tapping a day opens it.
 *
 * Exported as a single WeekCard rather than a whole list, so the route screen
 * can put it in a FlatList. A long roadmap has a lot of weeks (JEE Advanced
 * at 2 h/day is about 72) and a ScrollView would mount every one of them.
 *
 * Only the week HEADER is pressable. A card-wide Pressable wrapping the day
 * rows put two touch targets on top of each other, so a tap meant to open a
 * day could collapse the week instead.
 */
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Pill, Txt } from './ui.tsx';
import { describeUnlock } from '../progress/weekLock.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import type { PlannedDay } from '../scheduler/index.ts';
import type { RouteWeek } from '../progress/routeWeeks.ts';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

export { groupIntoWeeks, type RouteWeek } from '../progress/routeWeeks.ts';

/**
 * A padlock drawn from two Views.
 *
 * Not the 🔒 emoji: that renders in full colour and would be the only
 * coloured thing on a screen of navy-and-amber tokens. Not an icon font
 * either — @expo/vector-icons is ~1 MB of TTF and §11.4 caps the app at
 * 25 MB. Two rounded rectangles cost nothing, take the theme's colour, and
 * scale with the row.
 */
function LockGlyph({ size = 13, color }: { size?: number; color: string }) {
  const bodyH = Math.round(size * 0.62);
  const shackleW = Math.round(size * 0.6);
  const shackleH = Math.round(size * 0.46);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      {/* the shackle: a bordered box with its bottom edge removed */}
      <View
        style={{
          width: shackleW,
          height: shackleH,
          borderColor: color,
          borderTopWidth: 1.5,
          borderLeftWidth: 1.5,
          borderRightWidth: 1.5,
          borderBottomWidth: 0,
          borderTopLeftRadius: shackleW / 2,
          borderTopRightRadius: shackleW / 2,
          marginBottom: -1,
        }}
      />
      <View
        style={{
          width: size,
          height: bodyH,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function WeekCard({
  week,
  isLast,
  isFuture,
  defaultOpen,
  onOpenDay,
  locked = false,
  unlocksOn = null,
}: {
  week: RouteWeek;
  isLast: boolean;
  isFuture: boolean;
  defaultOpen: boolean;
  onOpenDay: (date: string) => void;
  /** A week further ahead than the learner has reached (see progress/weekLock). */
  locked?: boolean;
  /** The date it opens, shown on the lock row. */
  unlocksOn?: string | null;
}) {
  const theme = useTheme();
  // A locked week can never be open, whatever defaultOpen says.
  const [open, setOpen] = useState(defaultOpen && !locked);
  const [showWhy, setShowWhy] = useState(false);
  const isPast = week.doneFraction >= 1;

  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      {/* the route itself */}
      <View style={{ alignItems: 'center', width: 20 }}>
        <View
          style={{
            width: 14,
            height: 14,
            marginTop: 18,
            borderRadius: 7,
            backgroundColor: week.containsToday
              ? theme.colors.accent
              : isPast
                ? theme.colors.primary
                : 'transparent',
            borderWidth: isFuture || locked ? 2 : 0,
            borderColor: theme.colors.muted,
          }}
        />
        {!isLast ? (
          <View
            style={{
              flex: 1,
              width: 2,
              marginTop: 4,
              backgroundColor: isPast ? theme.colors.primary : theme.colors.border,
            }}
          />
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: week.containsToday ? theme.colors.accent : theme.colors.border,
          opacity: locked ? 0.55 : isFuture ? 0.6 : 1,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open, disabled: locked }}
          accessibilityLabel={
            locked
              ? `Week of ${week.startDate}, locked. ${
                  unlocksOn ? describeUnlock(unlocksOn) : 'Opens later'
                }.`
              : `Week of ${week.startDate}, ${Math.round(week.doneFraction * 100)} percent done`
          }
          // A locked week still responds to a tap so the learner is told WHEN
          // it opens, rather than pressing a dead card and learning nothing.
          onPress={() => (locked ? setShowWhy((v) => !v) : setOpen(!open))}
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH_TARGET,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.md,
            backgroundColor: pressed ? theme.colors.background : 'transparent',
          })}
        >
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Week of {week.startDate}</Txt>
            <Txt variant="caption" color="secondary" numberOfLines={1}>
              {week.label}
            </Txt>
          </View>
          {locked ? null : week.containsToday ? (
            <Pill tone="accent">Today</Pill>
          ) : (
            <Txt variant="caption" color={isPast ? 'success' : 'secondary'}>
              {Math.round(week.doneFraction * 100)}%
            </Txt>
          )}
          {locked ? (
            <LockGlyph color={theme.colors.muted} />
          ) : (
            <Txt variant="caption" color="secondary">
              {open ? '▴' : '▾'}
            </Txt>
          )}
        </Pressable>

        {locked && showWhy ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.md,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              One week at a time, so the plan stays something you can act on rather
              than a wall of dates. {unlocksOn ? describeUnlock(unlocksOn) : 'Opens later'}.
            </Txt>
          </View>
        ) : null}

        {open && !locked ? (
          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {week.days.map((day) => (
              <DayRow
                key={day.date}
                day={day}
                isToday={day.date === week.todayDate}
                onPress={() => onOpenDay(day.date)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DayRow({
  day,
  isToday,
  onPress,
}: {
  day: PlannedDay;
  isToday: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const done = day.items.length > 0 && day.items.every((i) => i.done);
  const title = day.isRestDay
    ? 'Rest day'
    : day.kind === 'mixed_practice'
      ? 'Mixed practice + weekly test'
      : day.kind === 'light_revision'
        ? 'Light revision'
        : day.kind === 'final_revision'
          ? 'Final revision'
          : (day.items.find((i) => i.source === 'topic')?.subject ?? 'Study');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${day.date}, ${title}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        marginTop: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        backgroundColor: pressed
          ? theme.colors.background
          : isToday
            ? theme.colors.accentSoft
            : 'transparent',
      })}
    >
      <Txt variant="caption" color={done ? 'success' : 'secondary'}>
        {done ? '✓' : isToday ? '→' : '○'}
      </Txt>
      <Txt
        variant="small"
        color={isToday ? 'text' : 'secondary'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {day.date.slice(5)} · {title}
      </Txt>
      <Txt variant="caption" color="secondary">
        {day.plannedMinutes} m
      </Txt>
      <Txt variant="caption" color="secondary">
        ›
      </Txt>
    </Pressable>
  );
}
