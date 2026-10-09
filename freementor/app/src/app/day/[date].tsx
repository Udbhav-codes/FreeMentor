/**
 * Day view — product plan §8.4 and screen 5 of the preview.
 *
 * "Exactly what to do, in order." Each block carries its own resource
 * buttons and its own checkbox; the confidence sheet decides when the topic
 * comes back; "Mark day complete" only lights up when everything is ticked.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConfidenceLevel } from '@freementor/shared';
import { Button, Card, Checkbox, Empty, Pill, Screen, Txt } from '../../components/ui.tsx';
import { VideoCard } from '../../components/VideoCard.tsx';
import { ConfidenceSheet } from '../../components/ConfidenceSheet.tsx';
import { ResourceLink } from '../../components/ResourceLink.tsx';
import { indexGoal, resolveItem } from '../../scheduler/index.ts';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { useEnrollment } from '../../state/EnrollmentContext.tsx';
import { restDayBlockedReason } from '../../progress/streak.ts';
import { useTheme } from '../../theme/ThemeProvider.tsx';

export default function DayView() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal, plan, settings, progress, toggleTask, rate, score, markRestDay } =
    useEnrollment();

  const day = plan?.days.find((d) => d.date === date) ?? null;
  const index = useMemo(() => (goal ? indexGoal(goal) : null), [goal]);

  const resolved = useMemo(() => {
    if (!goal || !index || !day) return [];
    return day.items.map((item) => resolveItem(item, goal, index, settings?.language ?? 'en'));
  }, [goal, index, day, settings?.language]);

  /** Topics touched today — each gets a confidence sheet once it is ticked. */
  const topicsToday = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of resolved) {
      if (r.item.source === 'topic' && r.topic) seen.set(r.topic.id, r.topic.title);
    }
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [resolved]);

  const allDone = day != null && day.items.length > 0 && day.items.every((i) => i.done);

  /** The lesson this day is built around — shown as a hero card up top. */
  const heroVideo = resolved.find(
    (r) => r.block?.type === 'learn' && r.resources.some((x) => x.type === 'video'),
  );
  const mainSubject = resolved.find((r) => r.item.source === 'topic')?.topic?.subject;
  const hasHighWeightage = resolved.some((r) => r.topic?.weightage === 'H');

  const onRest = useCallback(() => {
    if (!day || !plan) return;
    const restDays = plan.days.filter((d) => d.isRestDay).map((d) => d.date);
    const blocked = restDayBlockedReason(day.date, restDays);
    if (blocked) {
      Alert.alert('Rest day not available', blocked);
      return;
    }
    Alert.alert('Take a rest day?', 'Your plan shifts forward and your streak is protected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rest today', onPress: () => void markRestDay(day.date, true) },
    ]);
  }, [day, plan, markRestDay]);

  if (!goal || !day || !index) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + theme.spacing.xl }}>
          <Empty title="Nothing scheduled" body="This day is not part of your plan." />
          <Button
            label="Back"
            variant="secondary"
            onPress={() => router.back()}
            style={{ margin: theme.spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  if (day.isRestDay) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.xl }}>
          <Empty title="Rest day" body="Your streak is protected. See you tomorrow." />
          <Button
            label="Cancel rest day"
            variant="secondary"
            onPress={() => void markRestDay(day.date, false)}
            style={{ margin: theme.spacing.lg }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Button
            label="← Back"
            variant="ghost"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
          />
          <Txt variant="caption" color="secondary">
            {day.date} · {dayKindLabel(day.kind)}
          </Txt>
          <Txt variant="display">{headline(resolved, day.kind)}</Txt>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              marginTop: 4,
              flexWrap: 'wrap',
            }}
          >
            {mainSubject ? <Pill>{mainSubject}</Pill> : null}
            {hasHighWeightage ? <Pill tone="accent">High weightage</Pill> : null}
            <Pill>{formatMinutes(day.plannedMinutes)}</Pill>
          </View>
        </View>

        {heroVideo ? <VideoCard resolved={heroVideo} /> : null}

        {resolved.map((r) => (
          <Card key={r.item.key}>
            <Checkbox
              checked={r.item.done}
              onToggle={() => void toggleTask(r.item.key, day.date, r.item.minutes, !r.item.done)}
              label={r.item.title}
              sublabel={subtitle(r)}
              minutes={r.item.minutes}
            />

            {r.block?.note ? (
              <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                {r.block.note}
              </Txt>
            ) : null}

            {r.topic?.safety_note ? (
              <Txt
                variant="small"
                style={{ marginTop: theme.spacing.sm, color: theme.colors.accent }}
              >
                ⚠ {r.topic.safety_note}
              </Txt>
            ) : null}

            {r.block?.done_when?.length ? (
              <View style={{ marginTop: theme.spacing.sm, gap: 2 }}>
                <Txt variant="caption" color="secondary">
                  DONE WHEN
                </Txt>
                {r.block.done_when.map((criterion) => (
                  <Txt key={criterion} variant="small">
                    · {criterion}
                  </Txt>
                ))}
              </View>
            ) : null}

            {r.resources.length > 0 ? (
              <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                {r.resources.map((resource) => (
                  <ResourceLink key={`${r.item.key}-${resource.url}`} resource={resource} />
                ))}
              </View>
            ) : null}

            {r.block?.type === 'recall' ? (
              <RecallBlock questions={r.topic?.recall ?? []} />
            ) : null}

            {r.item.scoreEntry ? (
              <ScoreEntry
                onSubmit={(value, max) => void score(r.item.key, value, max)}
              />
            ) : null}
          </Card>
        ))}

        {topicsToday.map((topic) => (
          <ConfidenceSheet
            key={topic.id}
            hints={goal.scheduler_hints}
            topicTitle={topic.title}
            selected={progress?.confidence[topic.id]?.level ?? null}
            onSelect={(level: ConfidenceLevel) => void rate(topic.id, level)}
          />
        ))}

        <Button
          label={allDone ? 'Day complete ✓' : 'Mark day complete'}
          onPress={() => router.back()}
          disabled={!allDone}
        />
        <Button label="I need a rest day" variant="ghost" onPress={onRest} />
      </ScrollView>
    </Screen>
  );
}

function RecallBlock({ questions }: { questions: { q: string; a: string }[] }) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  if (questions.length === 0) return null;

  return (
    <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
      {questions.map((item, i) => (
        <View key={item.q} style={{ gap: 2 }}>
          <Txt variant="bodyStrong">
            {i + 1}. {item.q}
          </Txt>
          {revealed ? (
            <Txt variant="small" color="secondary">
              {item.a}
            </Txt>
          ) : null}
        </View>
      ))}
      {!revealed ? (
        <Button
          label="Answer from memory first, then reveal"
          variant="secondary"
          onPress={() => setRevealed(true)}
        />
      ) : null}
    </View>
  );
}

function ScoreEntry({ onSubmit }: { onSubmit: (score: number, max: number) => void }) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [max, setMax] = useState('');

  const submit = () => {
    const s = Number(value);
    const m = Number(max);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0 || s < 0 || s > m) {
      Alert.alert('Check your score', 'Enter your score and the total it was out of.');
      return;
    }
    onSubmit(s, m);
    setValue('');
    setMax('');
  };

  const field = {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
  };

  return (
    <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
      <Txt variant="caption" color="secondary">
        ENTER YOUR SCORE
      </Txt>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder="Score"
          placeholderTextColor={theme.colors.muted}
          style={[theme.typography.body, field]}
        />
        <Txt color="secondary">/</Txt>
        <TextInput
          value={max}
          onChangeText={setMax}
          keyboardType="number-pad"
          placeholder="Out of"
          placeholderTextColor={theme.colors.muted}
          style={[theme.typography.body, field]}
        />
        <Button label="Save" onPress={submit} style={{ paddingHorizontal: theme.spacing.screen }} />
      </View>
    </View>
  );
}

function subtitle(r: ReturnType<typeof resolveItem>): string {
  const bits: string[] = [];
  if (r.topic?.subject) bits.push(r.topic.subject);
  if (r.videoNote) bits.push(r.videoNote);
  if (r.item.part) bits.push(`part ${r.item.part.index} of ${r.item.part.of}`);
  return bits.join(' · ');
}

function dayKindLabel(kind: string): string {
  switch (kind) {
    case 'mixed_practice':
      return 'Mixed practice + weekly test';
    case 'light_revision':
      return 'Light revision';
    case 'final_revision':
      return 'Final revision';
    case 'rest':
      return 'Rest day';
    default:
      return 'New content';
  }
}

function headline(resolved: ReturnType<typeof resolveItem>[], kind: string): string {
  if (kind === 'mixed_practice') return 'Mixed practice & weekly test';
  if (kind === 'light_revision') return 'Light revision';
  if (kind === 'final_revision') return 'Final revision';
  const topic = resolved.find((r) => r.item.source === 'topic')?.topic;
  return topic?.title ?? "Today's plan";
}
