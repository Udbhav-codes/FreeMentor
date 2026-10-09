/**
 * The GPS-style route — product plan §8.3, screen 4 of the preview.
 *
 * A vertical line of stops: done stops solid, today amber, future faded,
 * a milestone flag at each phase boundary. Weeks collapse and expand.
 *
 * The plan is a flat list of days, so weeks are derived here rather than
 * stored — the scheduler must not care about presentation.
 */
import { useMemo, useState } from 'react';
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
    // The subjects this week covers, for the one-line summary.
    const subjects = [...new Set(items.map((i) => i.subject).filter(Boolean))];
    return {
      key,
      startDate: startOfWeek(weekDays[0]!.date),
      days: weekDays,
      doneFraction: items.length > 0 ? done / items.length : 0,
      containsToday: weekDays.some((d) => d.date === today),
      label: subjects.slice(0, 3).join(' · ') || 'Revision',
    };
  });
}

export function RouteList({
  days,
  today,
  onOpenDay,
}: {
  days: PlannedDay[];
  today: string;
  onOpenDay: (date: string) => void;
}) {
  const theme = useTheme();
  const weeks = useMemo(() => groupIntoWeeks(days, today), [days, today]);
  const currentIndex = Math.max(
    0,
    weeks.findIndex((w) => w.containsToday),
  );
  const [expanded, setExpanded] = useState<string | null>(weeks[currentIndex]?.key ?? null);

  return (
    <View style={{ gap: theme.spacing.md }}>
      {weeks.map((week, i) => {
        const isPast = week.doneFraction >= 1;
        const isFuture = !week.containsToday && week.doneFraction === 0 && i > currentIndex;
        const open = expanded === week.key;

        return (
          <View key={week.key} style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            {/* the route itself */}
            <View style={{ alignItems: 'center', width: 20 }}>
              <View
                style={{
                  width: 14,
                  height: 14,
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
              {i < weeks.length - 1 ? (
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

            <Pressable
              onPress={() => setExpanded(open ? null : week.key)}
              style={{
                flex: 1,
                minHeight: MIN_TOUCH_TARGET,
                backgroundColor: theme.colors.surface,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                opacity: isFuture ? 0.55 : 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
              </View>

              {open ? (
                <View style={{ marginTop: theme.spacing.md, gap: 2 }}>
                  {week.days.map((day) => (
                    <DayRow
                      key={day.date}
                      day={day}
                      isToday={day.date === today}
                      onPress={() => onOpenDay(day.date)}
                    />
                  ))}
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
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
  const title =
    day.isRestDay
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
      onPress={onPress}
      style={{
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.radius.sm,
        backgroundColor: isToday ? `${theme.colors.accent}22` : 'transparent',
        paddingHorizontal: isToday ? theme.spacing.sm : 0,
      }}
    >
      <Txt variant="caption" color={done ? 'success' : 'secondary'}>
        {done ? '✓' : isToday ? '→' : '○'}
      </Txt>
      <Txt
        variant="small"
        color={isToday ? 'text' : done ? 'secondary' : 'secondary'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {day.date.slice(5)} · {title}
      </Txt>
      <Txt variant="caption" color="secondary">
        {day.plannedMinutes} m
      </Txt>
    </Pressable>
  );
}
