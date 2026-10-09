/**
 * The weekly-time picker — screen 2 of the preview, product plan §5 step 7.
 *
 * "Each day" / "Same every day", seven bars, a running weekly total, and the
 * optional deadline calculator. The calculator only advises: the learner sets
 * their own hours and the scheduler uses those.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart } from './charts.tsx';
import { Button, Card, Pill, Txt } from './ui.tsx';
import { WEEKDAYS, type MinutesByWeekday, type Weekday } from '../scheduler/index.ts';
import { deadlineAdvice, formatMinutes, presetDeadlines } from '../onboarding/deadline.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

const PRESETS = [30, 60, 90, 120, 180, 240, 360];
const SHORT: Record<Weekday, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};
/** Monday-first, the way the mockup and every Indian calendar shows a week. */
const WEEK_ORDER: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function WeeklyTime({
  value,
  onChange,
  goalName,
  estimatedHours,
  today,
}: {
  value: MinutesByWeekday;
  onChange: (next: MinutesByWeekday) => void;
  goalName: string;
  estimatedHours: number;
  today: string;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<'each_day' | 'same'>('each_day');
  const [editing, setEditing] = useState<Weekday>('mon');
  const [deadline, setDeadline] = useState<string | null>(null);

  const weeklyMinutes = WEEKDAYS.reduce((sum, day) => sum + (value[day] ?? 0), 0);

  const advice = useMemo(
    () =>
      deadline
        ? deadlineAdvice({ estimatedHours, today, deadline, weeklyMinutes })
        : null,
    [deadline, estimatedHours, today, weeklyMinutes],
  );

  const setDay = (minutes: number) => {
    if (mode === 'same') {
      onChange(
        WEEKDAYS.reduce((acc, day) => ({ ...acc, [day]: minutes }), {} as MinutesByWeekday),
      );
    } else {
      onChange({ ...value, [editing]: minutes });
    }
  };

  const current = mode === 'same' ? (value.mon ?? 0) : (value[editing] ?? 0);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="Each day"
            variant={mode === 'each_day' ? 'primary' : 'secondary'}
            onPress={() => setMode('each_day')}
            style={{ flex: 1, paddingHorizontal: theme.spacing.sm, minHeight: 44 }}
          />
          <Button
            label="Same every day"
            variant={mode === 'same' ? 'primary' : 'secondary'}
            onPress={() => {
              setMode('same');
              onChange(
                WEEKDAYS.reduce(
                  (acc, day) => ({ ...acc, [day]: value.mon ?? 120 }),
                  {} as MinutesByWeekday,
                ),
              );
            }}
            style={{ flex: 1, paddingHorizontal: theme.spacing.sm, minHeight: 44 }}
          />
        </View>

        <View style={{ marginTop: theme.spacing.lg }}>
          <BarChart
            height={64}
            bars={WEEK_ORDER.map((day) => ({
              label: SHORT[day],
              value: value[day] ?? 0,
              caption:
                (value[day] ?? 0) >= 60
                  ? `${Math.round(((value[day] ?? 0) / 60) * 10) / 10}h`
                  : `${value[day] ?? 0}m`,
              highlight: mode === 'each_day' && day === editing,
            }))}
          />
        </View>

        {mode === 'each_day' ? (
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.xs,
              marginTop: theme.spacing.md,
            }}
          >
            {WEEK_ORDER.map((day) => (
              <Button
                key={day}
                label={SHORT[day]}
                variant={editing === day ? 'primary' : 'secondary'}
                onPress={() => setEditing(day)}
                style={{ flex: 1, paddingHorizontal: 0, minHeight: 40 }}
              />
            ))}
          </View>
        ) : null}

        <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.md }}>
          {mode === 'same' ? 'EVERY DAY' : `${SHORT[editing]} · ${dayName(editing)}`.toUpperCase()}
        </Txt>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.sm,
          }}
        >
          {PRESETS.map((minutes) => (
            <Button
              key={minutes}
              label={formatMinutes(minutes)}
              variant={current === minutes ? 'primary' : 'secondary'}
              onPress={() => setDay(minutes)}
              style={{ paddingHorizontal: theme.spacing.md, minHeight: 40 }}
            />
          ))}
          <Button
            label="Rest"
            variant={current === 0 ? 'primary' : 'secondary'}
            onPress={() => setDay(0)}
            style={{ paddingHorizontal: theme.spacing.md, minHeight: 40 }}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            borderTopWidth: 1,
            borderTopColor: theme.colors.border,
          }}
        >
          <Txt variant="small" color="secondary">
            Total this week
          </Txt>
          <Txt variant="bodyStrong">{Math.round((weeklyMinutes / 60) * 10) / 10} h / week</Txt>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt variant="heading" style={{ flex: 1 }}>
            Deadline calculator
          </Txt>
          <Pill>Optional</Pill>
        </View>
        <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          Tell us when you need to be ready and we'll tell you the daily time it takes.
          You still choose your own hours.
        </Txt>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
          }}
        >
          {presetDeadlines(today).map((preset) => (
            <Button
              key={preset.label}
              label={preset.label}
              variant={deadline === preset.date ? 'primary' : 'secondary'}
              onPress={() => setDeadline(deadline === preset.date ? null : preset.date)}
              style={{ paddingHorizontal: theme.spacing.md, minHeight: 40 }}
            />
          ))}
        </View>

        {advice ? (
          <View style={{ marginTop: theme.spacing.lg, gap: 4 }}>
            <Txt variant="small" color="secondary">
              {goalName} in {advice.daysLeft} days needs about
            </Txt>
            <Txt variant="display">{formatMinutes(advice.requiredMinutesPerDay)}</Txt>
            <Txt variant="caption" color="secondary">
              per day
            </Txt>
            <Txt
              variant="small"
              color={advice.onTrack ? 'success' : 'accent'}
              style={{ marginTop: theme.spacing.sm }}
            >
              {advice.onTrack
                ? `Your plan: ${formatMinutes(advice.plannedMinutesPerDay)}/day avg — you're on track ✓`
                : `Your plan: ${formatMinutes(advice.plannedMinutesPerDay)}/day avg — about ${formatMinutes(
                    advice.shortfallMinutesPerDay,
                  )} a day short.`}
            </Txt>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function dayName(day: Weekday): string {
  return {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  }[day];
}
