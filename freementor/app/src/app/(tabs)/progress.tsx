/**
 * Progress tab — product plan §8.6.
 * Everything here is derived from the ticks in SQLite, so it is correct
 * offline and can never disagree with the roadmap.
 */
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Empty, Pill, ProgressBar, Row, Screen, Txt } from '../../components/ui.tsx';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useStreak } from '../../state/useStreak.ts';
import { consistency, HABIT_TARGET_DAYS, nextMilestone } from '../../progress/streak.ts';
import { badgesFor } from '../../progress/badges.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';
import { useT } from '../../i18n/LanguageProvider.tsx';

export default function Progress() {
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { goal, plan, progress } = useEnrollment();
  const streak = useStreak();

  const studyDates = useMemo(
    () => Object.values(progress?.completed ?? {}).map((r) => r.completedAt),
    [progress],
  );
  const week = consistency(studyDates, todayIso());
  const badges = useMemo(
    () => (plan && progress ? badgesFor(plan, progress, todayIso()) : []),
    [plan, progress],
  );

  if (!goal || !plan) {
    return (
      <Screen>
        <Empty title={t('progress.none')} body={t('progress.noneBody')} />
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
          padding: theme.spacing.screen,
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
          <Stat label={t('profile.currentStreak')} value={`${streak.current}`} suffix="days" />
          <Stat label={t('profile.bestStreak')} value={`${streak.best}`} suffix="days" />
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
          <Txt variant="heading">Achievements</Txt>
          <Txt variant="caption" color="secondary" style={{ marginTop: 2 }}>
            {t('progress.badgesNote')}
          </Txt>
          <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
            {badges.map((badge) => (
              <View key={badge.id} style={{ gap: 4, opacity: badge.earned ? 1 : 0.6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Txt
                    variant="bodyStrong"
                    color={badge.earned ? 'accent' : 'secondary'}
                    style={{ width: 18 }}
                  >
                    {badge.earned ? '★' : '☆'}
                  </Txt>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>
                    {badge.name}
                  </Txt>
                  {badge.earned ? <Pill tone="accent">Earned</Pill> : null}
                </View>
                <Txt variant="caption" color="secondary">
                  {badge.description}
                </Txt>
                {!badge.earned ? <ProgressBar fraction={badge.progress} /> : null}
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Txt variant="heading">Finishing</Txt>
          <Row label={t('progress.syllabusFinished')} value={plan.contentFinish ?? '—'} />
          <Row label={t('progress.readyBy')} value={plan.projectedFinish ?? '—'} />
          <Row
            label={t('progress.reserved')}
            value={`${Math.round(plan.totals.reservedMinutes / 60)} h`}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
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

