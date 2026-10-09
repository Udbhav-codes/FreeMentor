/**
 * Home / Roadmap tab — product plan §8.2 and screen 3 of the preview.
 *
 * Greeting by name, goal, progress ring, streak, today's checklist, and
 * exactly ONE primary action. Everything comes from the scheduler, so it
 * works with no network once the goal file is cached.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Checkbox, Empty, Pill, Screen, Txt } from '../../components/ui.tsx';
import { ProgressRing } from '../../components/charts.tsx';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useStreak } from '../../state/useStreak.ts';
import { HABIT_TARGET_DAYS } from '../../progress/streak.ts';
import { loadProfile } from '../../db/profile.ts';
import { WelcomeCard } from '../../components/WelcomeCard.tsx';
import { currentEntitlement, showsWelcomeCard } from '../../billing/entitlement.ts';
import { catalog } from '../../api/library.ts';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';
import { isoWeekKey, weekAndDay, type PlannedItem } from '../../scheduler/index.ts';

export default function RoadmapHome() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, goal, plan, toggleTask } = useEnrollment();
  const streak = useStreak();
  const [name, setName] = useState<string | null>(null);
  // Shown on every open and reload until a plan is bought. The ✕ hides it for
  // this session only — nothing is persisted, so it comes back next time.
  const [hiddenThisSession, setHiddenThisSession] = useState(false);
  const showWelcome = showsWelcomeCard(currentEntitlement()) && !hiddenThisSession;

  useEffect(() => {
    loadProfile()
      .then((p) => setName(p?.name ?? null))
      .catch(() => setName(null));
  }, []);

  const dismissWelcome = useCallback(() => setHiddenThisSession(true), []);

  const today = todayIso();
  const day = useMemo(() => plan?.days.find((d) => d.date === today) ?? null, [plan, today]);
  // The welcome copy is built from catalog facts (phases, hours, outcomes).
  const catalogEntry = useMemo(
    () => catalog.goals.find((g) => g.id === goal?.goal.id) ?? null,
    [goal],
  );

  if (loading) return <Screen />;

  if (!goal || !plan) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl }}>
          <Empty
            title="No roadmap yet"
            body="Pick a goal and FreeMentor will build your day-by-day plan."
          />
          <Button label="Choose your goal" onPress={() => router.push('/choose')} />
        </View>
      </Screen>
    );
  }

  const doneMinutes = day?.items.filter((i) => i.done).reduce((s, i) => s + i.minutes, 0) ?? 0;
  const plannedMinutes = day?.plannedMinutes ?? 0;
  const toGo = Math.max(0, plannedMinutes - doneMinutes);
  const overMinutes = Math.max(0, doneMinutes - plannedMinutes);

  const overallFraction =
    plan.totals.contentMinutes > 0
      ? plan.totals.completedMinutes / plan.totals.contentMinutes
      : 0;

  // The mockup's goal card reads "Week 9 of 44", which is how a learner
  // thinks about a months-long plan — days would read in the hundreds.
  const here = weekAndDay(plan.days, today);
  const totalWeeks = new Set(plan.days.map((d) => isoWeekKey(d.date))).size;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="small" color="secondary">
              {greeting()},
            </Txt>
            <Txt variant="display">{name ?? 'there'}</Txt>
          </View>
          {streak.current > 0 ? (
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Pill tone="accent">{`🔥 ${streak.current}`}</Pill>
              <Txt variant="caption" color="secondary">
                {streak.habitDays}/{HABIT_TARGET_DAYS} days
              </Txt>
            </View>
          ) : null}
        </View>

        {showWelcome && catalogEntry ? (
          <WelcomeCard goal={catalogEntry} onDismiss={dismissWelcome} />
        ) : null}

        <Card>
          <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}>
            <ProgressRing fraction={overallFraction} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="caption" color="secondary">
                YOUR GOAL
              </Txt>
              <Txt variant="title">{goal.goal.name}</Txt>
              <Txt variant="caption" color="secondary">
                Week {here?.week ?? 1} of {totalWeeks} ·{' '}
                {plan.totals.topicsCompleted}/{plan.totals.topicsTotal} topics
              </Txt>
              <Txt variant="caption" color="secondary">
                Projected finish: {plan.projectedFinish ?? '—'}
              </Txt>
            </View>
          </View>
        </Card>

        {plan.warnings.map((w) => (
          <Card key={w.code} style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.accent }}>
            <Txt variant="bodyStrong">Heads up</Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
              {w.message}
            </Txt>
          </Card>
        ))}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Txt variant="heading">Today · {formatMinutes(plannedMinutes)}</Txt>
          <View style={{ flex: 1 }} />
          <Txt variant="caption" color="secondary">
            {overMinutes > 0
              ? `${formatMinutes(overMinutes)} extra 🎉`
              : toGo > 0
                ? `${formatMinutes(doneMinutes)} done · ${formatMinutes(toGo)} to go`
                : 'all done ✓'}
          </Txt>
        </View>

        {!day || day.items.length === 0 ? (
          <Card>
            <Txt variant="bodyStrong">
              {day?.isRestDay ? 'Rest day — enjoy it.' : 'Nothing scheduled today.'}
            </Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
              {day?.isRestDay
                ? 'Your streak is protected.'
                : 'Your next study day is coming up — check your route below.'}
            </Txt>
          </Card>
        ) : (
          <Card onPress={() => router.push(`/day/${today}`)}>
            {day.items.map((item) => (
              <Checkbox
                key={item.key}
                checked={item.done}
                onToggle={() => void toggleTask(item.key, today, item.minutes, !item.done)}
                label={item.title}
                sublabel={sourceLabel(item) + (item.part ? ` · part ${item.part.index}/${item.part.of}` : '')}
                minutes={item.minutes}
              />
            ))}
          </Card>
        )}

        <Button
          label={toGo > 0 ? "Continue today's task →" : 'Review today'}
          onPress={() => router.push(`/day/${today}`)}
          disabled={!day || day.items.length === 0}
        />

        <Button
          label="See your whole route →"
          variant="secondary"
          onPress={() => router.push('/route')}
        />
      </ScrollView>
    </Screen>
  );
}

function sourceLabel(item: PlannedItem): string {
  switch (item.source) {
    case 'warmup':
      return 'Warm-up recall';
    case 'spaced_review':
      return 'Spaced revision';
    case 'final_revision':
      return 'Final revision';
    case 'weekly_test':
      return 'Weekly test';
    case 'remediation':
      return 'Catch-up';
    case 'milestone':
      return 'Mock test';
    default:
      return item.subject || 'Task';
  }
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
