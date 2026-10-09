/**
 * Progress tab — product plan §8.6.
 * Everything here is derived from the ticks in SQLite, so it is correct
 * offline and can never disagree with the roadmap.
 */
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Pill, ProgressBar, Screen, Txt } from '../../components/ui.tsx';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useStreak } from '../../state/useStreak.ts';
import { consistency, HABIT_TARGET_DAYS, nextMilestone } from '../../progress/streak.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';

export default function Progress() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { goal, plan, progress } = useEnrollment();
  const streak = useStreak();

  const studyDates = useMemo(
    () => Object.values(progress?.completed ?? {}).map((r) => r.completedAt),
    [progress],
  );
  const week = consistency(studyDates, todayIso());

  if (!goal || !plan) {
    return (
      <Screen>
        <Empty title="No progress yet" body="Pick a goal to start tracking." />
      </Screen>
    );
  }

  const fraction =
    plan.totals.contentMinutes > 0
      ? plan.totals.completedMinutes / plan.totals.contentMinutes
      : 0;
  const hoursDone = Math.round((plan.totals.completedMinutes / 60) * 10) / 10;
  const hoursTotal = Math.round(plan.totals.contentMinutes / 60);
  const next = nextMilestone(streak.current);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <Txt variant="display">Progress</Txt>

        <Card>
          <Txt variant="heading">{goal.goal.name}</Txt>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <ProgressBar fraction={fraction} />
            <Txt variant="small" color="secondary">
              {Math.round(fraction * 100)}% · {plan.totals.topicsCompleted} of{' '}
              {plan.totals.topicsTotal} topics · {hoursDone} of {hoursTotal} hours
            </Txt>
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Stat label="Current streak" value={`${streak.current}`} suffix="days" />
          <Stat label="Best streak" value={`${streak.best}`} suffix="days" />
        </View>

        <Card>
          <Txt variant="heading">Your study habit</Txt>
          <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
            Habits take a median of {HABIT_TARGET_DAYS} days to form. One missed day
            doesn't undo it.
          </Txt>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
            <ProgressBar fraction={streak.habitDays / HABIT_TARGET_DAYS} />
            <Txt variant="bodyStrong">
              {streak.habitDays} / {HABIT_TARGET_DAYS} days
            </Txt>
          </View>
        </Card>

        <Card>
          <Txt variant="heading">This week</Txt>
          <Txt variant="body" style={{ marginTop: theme.spacing.sm }}>
            You studied on {week.studied} of the last {week.of} days.
          </Txt>
          {next ? (
            <View style={{ marginTop: theme.spacing.md }}>
              <Pill tone="accent">{`${next - streak.current} days to your ${next}-day badge`}</Pill>
            </View>
          ) : null}
        </Card>

        <Card>
          <Txt variant="heading">Finishing</Txt>
          <Row label="Syllabus finished" value={plan.contentFinish ?? '—'} />
          <Row label="Ready by" value={plan.projectedFinish ?? '—'} />
          <Row
            label="Mocks & revision reserved"
            value={`${Math.round(plan.totals.reservedMinutes / 60)} h`}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <Txt variant="caption" color="secondary">
        {label.toUpperCase()}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Txt variant="title">{value}</Txt>
        <Txt variant="caption" color="secondary">
          {suffix}
        </Txt>
      </View>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: theme.spacing.sm,
      }}
    >
      <Txt variant="small" color="secondary">
        {label}
      </Txt>
      <Txt variant="bodyStrong">{value}</Txt>
    </View>
  );
}
