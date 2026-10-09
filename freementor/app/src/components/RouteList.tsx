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
import { useTheme } from '../theme/ThemeProvider.tsx';
import { isoWeekKey, startOfWeek, type PlannedDay } from '../scheduler/index.ts';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

export interface RouteWeek {
  key: string;
  startDate: string;
  days: PlannedDay[];
  doneFraction: number;
  containsToday: boolean;
  /** Set when today falls inside this week, so the row can highlight it. */
  todayDate: string | null;
  label: string;
}

export function groupIntoWeeks(days: PlannedDay[], today: string): RouteWeek[] {
  const byWeek = new Map<string, PlannedDay[]>();
  for (const day of days) {
    const key = isoWeekKey(day.date);
    const list = byWeek.get(key);
    if (list) list.push(day);
    else byWeek.set(key, [day]);
  }

  return [...byWeek.entries()].map(([key, weekDays]) => {
    const items = weekDays.flatMap((d) => d.items);
    const done = items.filter((i) => i.done).length;
    const subjects = [...new Set(items.map((i) => i.subject).filter(Boolean))];
    const containsToday = weekDays.some((d) => d.date === today);
    return {
      key,
      startDate: startOfWeek(weekDays[0]!.date),
      days: weekDays,
      doneFraction: items.length > 0 ? done / items.length : 0,
      containsToday,
      todayDate: containsToday ? today : null,
      label: subjects.slice(0, 3).join(' · ') || 'Revision',
    };
  });
}

export function WeekCard({
  week,
  isLast,
  isFuture,
  defaultOpen,
  onOpenDay,
}: {
  week: RouteWeek;
  isLast: boolean;
  isFuture: boolean;
  defaultOpen: boolean;
  onOpenDay: (date: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
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
            borderWidth: isFuture ? 2 : 0,
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
          opacity: isFuture ? 0.6 : 1,
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Week of ${week.startDate}, ${Math.round(
            week.doneFraction * 100,
          )} percent done`}
          onPress={() => setOpen(!open)}
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
          {week.containsToday ? (
            <Pill tone="accent">Today</Pill>
          ) : (
            <Txt variant="caption" color={isPast ? 'success' : 'secondary'}>
              {Math.round(week.doneFraction * 100)}%
            </Txt>
          )}
          <Txt variant="caption" color="secondary">
            {open ? '▴' : '▾'}
          </Txt>
        </Pressable>

        {open ? (
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
