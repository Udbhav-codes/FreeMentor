/**
 * "Your route" — product plan §8.3 and screen 4 of the preview.
 *
 * Its own screen, not a section of Home. Two reasons: the mockup separates
 * them (screens 3 and 4), and a long roadmap has a lot of weeks — JEE
 * Advanced at 2 h/day is about 72 of them. A ScrollView mounts every child
 * eagerly, so rendering the whole route under the dashboard would put ~72
 * shadowed cards on screen at once on a 3-4 GB phone (§11.4).
 *
 * A FlatList virtualises them: only the weeks near the viewport exist.
 */
import { useMemo, useRef } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Empty, Pill, Screen, Txt } from '../components/ui.tsx';
import { groupIntoWeeks, WeekCard } from '../components/RouteList.tsx';
import { todayIso, useEnrollment } from '../state/EnrollmentContext.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

export default function Route() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal, plan } = useEnrollment();
  const today = todayIso();

  const weeks = useMemo(() => (plan ? groupIntoWeeks(plan.days, today) : []), [plan, today]);
  const currentIndex = Math.max(
    0,
    weeks.findIndex((w) => w.containsToday),
  );
  const listRef = useRef<FlatList>(null);

  /** The phase today's work belongs to — "Phase 1 · Class 11 Foundation". */
  const phaseLabel = useMemo(() => {
    if (!goal || !plan) return null;
    const topicIds = new Set(
      plan.days
        .find((d) => d.date === today)
        ?.items.map((i) => i.topicId)
        .filter(Boolean) ?? [],
    );
    const topic = goal.topics.find((t) => topicIds.has(t.id));
    if (!topic) return null;
    const phase = goal.phases.find((p) => p.order === topic.phase);
    return phase ? `Phase ${phase.order} · ${phase.name}` : null;
  }, [goal, plan, today]);

  if (!goal || !plan) {
    return (
      <Screen>
        <Empty title="No route yet" body="Pick a goal and your roadmap appears here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.screen,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Button
          label="←"
          variant="ghost"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 40 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Txt variant="display" style={{ flex: 1 }}>
            Your route
          </Txt>
          <Pill>{goal.goal.name}</Pill>
        </View>
        {phaseLabel ? (
          <Txt variant="small" color="secondary" style={{ marginTop: 2 }}>
            {phaseLabel}
          </Txt>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={weeks}
        keyExtractor={(w) => w.key}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        // Start the learner on the week they are actually in.
        initialScrollIndex={Math.max(0, currentIndex - 1)}
        onScrollToIndexFailed={() => {
          // Week heights vary once one is expanded; falling back to the top
          // is better than crashing the screen.
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.screen,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.md,
        }}
        renderItem={({ item, index }) => (
          <WeekCard
            week={item}
            isLast={index === weeks.length - 1}
            isFuture={!item.containsToday && item.doneFraction === 0 && index > currentIndex}
            defaultOpen={item.containsToday}
            onOpenDay={(date) => router.push(`/day/${date}`)}
          />
        )}
      />
    </Screen>
  );
}
