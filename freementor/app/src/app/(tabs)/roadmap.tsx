/**
 * Home / Roadmap tab — product plan §8.2 and screen 3 of the preview.
 *
 * Greeting by name, the goal card with its progress ring and streak, and then
 * the whole route inline. Everything comes from the scheduler, so it works
 * with no network once the goal file is cached.
 *
 * The today-only checklist that used to sit between them is gone on the
 * product owner's instruction: the route carries today's week expanded with
 * today's row highlighted, so the day is one tap away without a second copy
 * of it on the same screen.
 *
 * A FlatList, not a ScrollView. A ScrollView mounts every child eagerly and a
 * long roadmap has a lot of weeks — JEE Advanced at 2 h/day is about 72 — so
 * the dashboard is the list header and the weeks are its data. That was the
 * original reason the route lived on its own screen; virtualising it here is
 * what lets it come home.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Pill, Screen, SectionTitle, Txt } from '../../components/ui.tsx';
import { ProgressRing } from '../../components/charts.tsx';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useStreak } from '../../state/useStreak.ts';
import { HABIT_TARGET_DAYS } from '../../progress/streak.ts';
import { loadProfile } from '../../db/profile.ts';
import { WelcomeCard } from '../../components/WelcomeCard.tsx';
import { Avatar } from '../../components/Avatar.tsx';
import { showsWelcomeCard } from '../../billing/entitlement.ts';
import { useEntitlement } from '../../billing/useEntitlement.ts';
import { catalog } from '../../api/library.ts';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { groupIntoWeeks, WeekCard } from '../../components/RouteList.tsx';
import { weekLock } from '../../progress/weekLock.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';
import { useT } from '../../i18n/LanguageProvider.tsx';
import { isoWeekKey, weekAndDay } from '../../scheduler/index.ts';

export default function RoadmapHome() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, goal, plan } = useEnrollment();
  const streak = useStreak();
  const [name, setName] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Shown on every open and reload until a plan is bought. The ✕ hides it for
  // this session only — nothing is persisted, so it comes back next time.
  const [hiddenThisSession, setHiddenThisSession] = useState(false);
  const { entitlement } = useEntitlement();
  const showWelcome = showsWelcomeCard(entitlement) && !hiddenThisSession;

  // Reloaded on focus, not just on mount: the tab stays mounted while the
  // learner edits their name or photo in Profile, so a one-off read would
  // leave a stale avatar beside the greeting.
  useFocusEffect(
    useCallback(() => {
      loadProfile()
        .then((p) => {
          setName(p?.name ?? null);
          setPhotoUri(p?.photoUri ?? null);
        })
        .catch(() => setName(null));
    }, []),
  );

  const dismissWelcome = useCallback(() => setHiddenThisSession(true), []);

  const today = todayIso();
  const weeks = useMemo(() => (plan ? groupIntoWeeks(plan.days, today) : []), [plan, today]);
  const day = useMemo(() => plan?.days.find((d) => d.date === today) ?? null, [plan, today]);
  const listRef = useRef<FlatList>(null);
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
            title={t('home.noRoadmap')}
            body={t('home.noRoadmapBody')}
          />
          <Button label={t('home.chooseGoal')} onPress={() => router.push('/choose')} />
        </View>
      </Screen>
    );
  }

  const overallFraction =
    plan.totals.contentMinutes > 0
      ? plan.totals.completedMinutes / plan.totals.contentMinutes
      : 0;

  // The mockup's goal card reads "Week 9 of 44", which is how a learner
  // thinks about a months-long plan — days would read in the hundreds.
  const here = weekAndDay(plan.days, today);
  const totalWeeks = new Set(plan.days.map((d) => isoWeekKey(d.date))).size;
  const currentIndex = Math.max(0, weeks.findIndex((w) => w.containsToday));

  // Today's figures drive the one primary action (§8.2). The checklist they
  // used to sit above is gone, so the button has to say enough on its own:
  // a disabled button with no explanation is worse than no button.
  const doneMinutes = day?.items.filter((i) => i.done).reduce((sum, i) => sum + i.minutes, 0) ?? 0;
  const plannedMinutes = day?.plannedMinutes ?? 0;
  const toGo = Math.max(0, plannedMinutes - doneMinutes);
  const nothingToday = !day || day.items.length === 0;
  const todayLabel = nothingToday
    ? day?.isRestDay
      ? t('home.restDay')
      : t('home.nothingToday')
    : toGo > 0
      ? t('home.continueToday')
      : t('home.reviewToday');

  return (
    <Screen>
      <FlatList
        ref={listRef}
        data={weeks}
        keyExtractor={(w) => w.key}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.md,
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Avatar uri={photoUri} name={name} size={44} />
              <View style={{ flex: 1 }}>
                <Txt variant="caption" color="secondary">
                  {greeting(t)}
                </Txt>
                <Txt variant="title">{name ?? t('home.there')}</Txt>
              </View>
              {streak.current > 0 ? (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Pill tone="accent">{t('home.streak', { count: streak.current })}</Pill>
                  <Txt variant="caption" color="secondary">
                    {t('home.habit', { days: streak.habitDays, target: HABIT_TARGET_DAYS })}
                  </Txt>
                </View>
              ) : null}
            </View>

            {showWelcome && catalogEntry ? (
              <WelcomeCard goal={catalogEntry} onDismiss={dismissWelcome} />
            ) : null}

            <Card>
              <View
                style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}
              >
                <ProgressRing fraction={overallFraction} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="caption" color="secondary">
                    {t('home.yourGoal')}
                  </Txt>
                  <Txt variant="title">{goal.goal.name}</Txt>
                  <Txt variant="caption" color="secondary">
                    {t('home.weekOf', { week: here?.week ?? 1, total: totalWeeks })} ·{' '}
                    {t('home.topicsDone', {
                      done: plan.totals.topicsCompleted,
                      total: plan.totals.topicsTotal,
                    })}
                  </Txt>
                  <Txt variant="caption" color="secondary">
                    {t('home.projectedFinish', { date: plan.projectedFinish ?? '—' })}
                  </Txt>
                </View>
              </View>
            </Card>

            {plan.warnings.map((w) => (
              <Card
                key={w.code}
                style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.accent }}
              >
                <Txt variant="bodyStrong">Heads up</Txt>
                <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
                  {w.message}
                </Txt>
              </Card>
            ))}

            <View style={{ gap: 6 }}>
              <Button
                label={todayLabel}
                onPress={() => router.push(`/day/${today}`)}
                disabled={nothingToday}
              />
              {nothingToday ? null : (
                <Txt variant="caption" color="secondary" style={{ textAlign: 'center' }}>
                  {toGo > 0
                    ? t('home.doneToGo', {
                        done: formatMinutes(doneMinutes),
                        toGo: formatMinutes(toGo),
                      })
                    : t('home.allDone', { done: formatMinutes(plannedMinutes) })}
                </Txt>
              )}
            </View>

            <SectionTitle
              right={
                /* Only worth offering once there is a real distance to cover —
                   on week 1 the current week is already the first card. */
                currentIndex > 2 ? (
                  <Button
                    compact
                    variant="ghost"
                    label={t('home.jumpToWeek')}
                    onPress={() =>
                      listRef.current?.scrollToIndex({
                        index: currentIndex,
                        animated: true,
                        viewPosition: 0,
                      })
                    }
                  />
                ) : undefined
              }
            >
              {t('home.yourRoute')}
            </SectionTitle>
          </View>
        }
        onScrollToIndexFailed={() => {
          // Week heights vary once one is expanded; falling back to the top is
          // better than crashing the tab.
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        renderItem={({ item, index }) => {
          const lock = weekLock({ weekStart: item.startDate, isFirst: index === 0, today });
          return (
            <WeekCard
              week={item}
              isLast={index === weeks.length - 1}
              isFuture={!item.containsToday && item.doneFraction === 0 && index > currentIndex}
              defaultOpen={item.containsToday}
              locked={lock.locked}
              unlocksOn={lock.unlocksOn}
              onOpenDay={(date) => router.push(`/day/${date}`)}
            />
          );
        }}
      />
    </Screen>
  );
}


function greeting(t: (key: 'home.goodMorning' | 'home.goodAfternoon' | 'home.goodEvening') => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('home.goodMorning');
  if (hour < 17) return t('home.goodAfternoon');
  return t('home.goodEvening');
}
