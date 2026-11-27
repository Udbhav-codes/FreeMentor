/**
 * Day view — product plan §8.4 and screen 5 of the preview.
 *
 * The mockup's shape, which this follows exactly:
 *   breadcrumb → title → pills → ONE checklist card
 *   → ONE confidence section → "Mark day complete"
 *
 * There is no separate video card above the list (owner, Nov 2026): it showed
 * the same videos as the list's first task, and the duplicate confused people.
 * Only the box ticks a task; tapping the title opens its links and details.
 *
 * Videos play inside the dropdown in YouTube's embedded player
 * (components/YouTubeEmbed.tsx), never behind an ad. After the trial, with
 * nothing bought, a task's notes need one rewarded ad per dropdown, which
 * keeps that dropdown unlocked for 30 minutes (ads/dropdownUnlock.ts).
 *
 * The checklist is a single card, not a card per task. Stacking a raised card
 * around every row buries the list in shadows and makes a five-task day look
 * like a five-screen form — the opposite of "exactly what to do, in order".
 * Each row expands in place for its links and details.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConfidenceLevel } from '@freementor/shared';
import { Button, Card, Checkbox, Empty, Pill, Screen, Txt } from '../../components/ui.tsx';
import { ConfidenceSheet } from '../../components/ConfidenceSheet.tsx';
import { ResourceLink } from '../../components/ResourceLink.tsx';
import { YouTubeEmbed } from '../../components/YouTubeEmbed.tsx';
import { accessFor, type Entitlement } from '../../billing/entitlement.ts';
import { useEntitlement } from '../../billing/useEntitlement.ts';
import { askForAd } from '../../ads/askForAd.ts';
import { isDropdownUnlocked, unlockDropdown } from '../../ads/dropdownUnlock.ts';
import {
  focusSegments,
  indexGoal,
  resolveItem,
  shortDate,
  weekAndDay,
} from '../../scheduler/index.ts';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { restDayBlockedReason } from '../../progress/streak.ts';
import { useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';
import { useT } from '../../i18n/LanguageProvider.tsx';

type Resolved = ReturnType<typeof resolveItem>;

export default function DayView() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal, plan, settings, progress, toggleTask, rate, score, markRestDay } =
    useEnrollment();

  const [expanded, setExpanded] = useState<string | null>(null);
  const { entitlement } = useEntitlement();

  const day = plan?.days.find((d) => d.date === date) ?? null;
  const index = useMemo(() => (goal ? indexGoal(goal) : null), [goal]);

  const resolved = useMemo(() => {
    if (!goal || !index || !day) return [];
    return day.items.map((item) => resolveItem(item, goal, index, settings?.language ?? 'en'));
  }, [goal, index, day, settings?.language]);

  const breadcrumb = useMemo(
    () => (plan && date ? weekAndDay(plan.days, date) : null),
    [plan, date],
  );

  /** Topics touched today — each gets one confidence rating, not one sheet. */
  const topicsToday = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of resolved) {
      if (r.item.source === 'topic' && r.topic) seen.set(r.topic.id, r.topic.title);
    }
    return [...seen].map(([id, title]) => ({ id, title }));
  }, [resolved]);

  const mainSubject = resolved.find((r) => r.item.source === 'topic')?.topic?.subject;
  const hasHighWeightage = resolved.some((r) => r.topic?.weightage === 'H');
  const allDone = day != null && day.items.length > 0 && day.items.every((i) => i.done);
  const doneCount = day?.items.filter((i) => i.done).length ?? 0;

  const onRest = useCallback(() => {
    if (!day || !plan) return;
    const restDays = plan.days.filter((d) => d.isRestDay).map((d) => d.date);
    const blocked = restDayBlockedReason(day.date, restDays);
    if (blocked) {
      Alert.alert(t('dialog.restUnavailable'), blocked);
      return;
    }
    Alert.alert(t('dialog.takeRestTitle'), t('dialog.takeRestBody'), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rest today', onPress: () => void markRestDay(day.date, true) },
    ]);
  }, [day, plan, markRestDay]);

  if (!goal || !day || !index) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.xl }}>
          <Empty title={t('day.nothingScheduled')} body={t('day.notInPlan')} />
          <Button
            label="Back"
            variant="secondary"
            onPress={() => router.back()}
            style={{ margin: theme.spacing.screen }}
          />
        </View>
      </Screen>
    );
  }

  if (day.isRestDay) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingTop: insets.top + theme.spacing.xl }}>
          <Empty title={t('day.restDayTitle')} body={t('day.restDayBody')} />
          <View style={{ padding: theme.spacing.screen, gap: theme.spacing.sm }}>
            <Button
              label={t('day.cancelRestDay')}
              variant="secondary"
              onPress={() => void markRestDay(day.date, false)}
            />
            <Button label="Back" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Button
            label="←"
            variant="ghost"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 40 }}
          />
          <Txt variant="caption" color="secondary">
            {breadcrumb
              ? `${shortDate(day.date)} · Week ${breadcrumb.week} · Day ${breadcrumb.day}`
              : shortDate(day.date)}
            {' · '}
            {dayKindLabel(day.kind)}
          </Txt>
          <Txt variant="display">{headline(resolved, day.kind)}</Txt>
          <View
            style={{
              flexDirection: 'row',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
              flexWrap: 'wrap',
            }}
          >
            {resolved.some((r) => r.item.source === 'milestone') ? (
              <Pill tone="accent">⚑ Mock test</Pill>
            ) : null}
            {mainSubject ? <Pill>{mainSubject}</Pill> : null}
            {hasHighWeightage ? <Pill tone="accent">High weightage</Pill> : null}
            <Pill>{formatMinutes(day.plannedMinutes)}</Pill>
          </View>
        </View>

        {/* One card, one list. Tap a task's title for its links and details. */}
        <Card variant="surface" style={{ paddingVertical: theme.spacing.sm }}>
          {resolved.map((r, i) => (
            <TaskRow
              key={r.item.key}
              resolved={r}
              hints={goal.scheduler_hints}
              last={i === resolved.length - 1}
              entitlement={entitlement}
              unlockKey={`${day.date}:${r.item.key}`}
              expanded={expanded === r.item.key}
              onExpand={() => setExpanded(expanded === r.item.key ? null : r.item.key)}
              onToggle={() =>
                void toggleTask(r.item.key, day.date, r.item.minutes, !r.item.done)
              }
              onScore={(value, max) => void score(r.item.key, value, max)}
            />
          ))}
        </Card>

        {topicsToday.length > 0 ? (
          <ConfidenceSheet
            hints={goal.scheduler_hints}
            topics={topicsToday}
            ratings={progress?.confidence ?? {}}
            onSelect={(topicId, level: ConfidenceLevel) => void rate(topicId, level)}
          />
        ) : null}

        <Button
          label={allDone ? 'Day complete ✓' : `Mark day complete (${doneCount}/${day.items.length})`}
          onPress={() => router.back()}
          disabled={!allDone}
        />
        <Button label={t('day.needRestDay')} variant="ghost" onPress={onRest} />
      </ScrollView>
    </Screen>
  );
}

function TaskRow({
  resolved: r,
  hints,
  last,
  entitlement,
  unlockKey,
  expanded,
  onExpand,
  onToggle,
  onScore,
}: {
  resolved: Resolved;
  hints: import('@freementor/shared').SchedulerHints;
  last: boolean;
  entitlement: Entitlement;
  /** One task on one day: each dropdown is unlocked on its own. */
  unlockKey: string;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onScore: (score: number, max: number) => void;
}) {
  const theme = useTheme();
  const t = useT();
  /** This dropdown's ad-gated links are open for as long as it stays open. */
  const [openUnlocked, setOpenUnlocked] = useState(false);
  const gated = r.resources.some(
    (resource) => accessFor(resource, entitlement).kind === 'ad_gated',
  );
  const hasVideo = r.resources.some((resource) => resource.type === 'video');

  // The time is checked only here, on opening. An open dropdown is never
  // interrupted, however long it stays open.
  const toggleOpen = async () => {
    if (expanded) {
      setOpenUnlocked(false);
      onExpand();
      return;
    }
    if (!gated || isDropdownUnlocked(unlockKey)) {
      setOpenUnlocked(gated);
      onExpand();
      return;
    }
    // A video must never wait behind an ad (YouTube policy III.F.3.2), so a
    // dropdown with one opens freely and asks for the ad at its notes.
    if (hasVideo) {
      setOpenUnlocked(false);
      onExpand();
      return;
    }
    if (await watchForDropdown()) onExpand();
  };

  const watchForDropdown = async (): Promise<boolean> => {
    const result = await askForAd({
      title: t('dialog.adGateTitle'),
      body: t('dialog.adGateBody'),
      notLiveBody: t('dialog.adGateNotLive'),
      watch: t('dialog.adGateWatch'),
      openWithoutAd: t('day.openLink'),
      cancel: t('common.cancel'),
    });
    if (result === 'declined') return false;
    // An unavailable ad opens it this time but is not remembered: it showed
    // nothing, so it must not stand in for 30 minutes of a real one.
    if (result === 'rewarded') unlockDropdown(unlockKey);
    setOpenUnlocked(true);
    return true;
  };
  const focus = focusSegments(r.item.minutes, hints);
  const hasDetail =
    r.resources.length > 0 ||
    Boolean(r.block?.note) ||
    Boolean(r.topic?.safety_note) ||
    Boolean(r.block?.done_when?.length) ||
    r.block?.type === 'recall' ||
    Boolean(r.item.scoreEntry);

  return (
    <View
      style={{
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <Checkbox
        checked={r.item.done}
        onToggle={onToggle}
        label={r.item.title}
        sublabel={
          gated && !hasVideo && !expanded && !isDropdownUnlocked(unlockKey)
            ? [subtitle(r), t('day.adToOpen')].filter(Boolean).join(' · ')
            : subtitle(r)
        }
        minutes={r.item.minutes}
        onPressLabel={hasDetail ? () => void toggleOpen() : () => undefined}
        trailing={
          hasDetail ? (
            <Txt variant="body" color="secondary" style={{ width: 20, textAlign: 'center' }}>
              {expanded ? '▴' : '▾'}
            </Txt>
          ) : null
        }
      />

      {expanded && hasDetail ? (
        <View style={{ paddingBottom: theme.spacing.md, gap: theme.spacing.sm }}>
          {r.block?.note ? (
            <Txt variant="small" color="secondary">
              {r.block.note}
            </Txt>
          ) : null}

          {/* §7.3 — long blocks are worked in 25-minute focus blocks with
              5-minute breaks, which beat self-chosen breaks for fatigue. */}
          {focus.length > 1 ? (
            <View style={{ gap: 2 }}>
              <Txt variant="caption" color="secondary">
                WORK IT IN FOCUS BLOCKS
              </Txt>
              <Txt variant="small">
                {focus
                  .map((seg) =>
                    seg.breakAfter > 0
                      ? `${seg.focus} min, ${seg.breakAfter} min break`
                      : `${seg.focus} min`,
                  )
                  .join(' → ')}
              </Txt>
            </View>
          ) : null}

          {r.topic?.safety_note ? (
            <Txt variant="small" color="accent">
              ⚠ {r.topic.safety_note}
            </Txt>
          ) : null}

          {r.block?.done_when?.length ? (
            <View style={{ gap: 2 }}>
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

          {r.resources
            .filter((resource) => resource.type === 'video')
            .map((resource) => (
              <YouTubeEmbed key={`${r.item.key}-${resource.url}`} resource={resource} />
            ))}

          {r.resources
            .filter(
              (resource) =>
                resource.type !== 'video' &&
                (openUnlocked || accessFor(resource, entitlement).kind !== 'ad_gated'),
            )
            .map((resource) => (
              <ResourceLink
                key={`${r.item.key}-${resource.url}`}
                resource={resource}
                unlocked={openUnlocked}
              />
            ))}

          {gated && !openUnlocked ? (
            <Button
              label={t('day.unlockNotes')}
              variant="secondary"
              onPress={() => void watchForDropdown()}
            />
          ) : null}

          {r.block?.type === 'recall' ? <RecallBlock questions={r.topic?.recall ?? []} /> : null}

          {r.item.scoreEntry ? <ScoreEntry onSubmit={onScore} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function RecallBlock({ questions }: { questions: { q: string; a: string }[] }) {
  const theme = useTheme();
  const t = useT();
  const [revealed, setRevealed] = useState(false);
  if (questions.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm }}>
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
          label={t('day.answerFromMemory')}
          variant="secondary"
          onPress={() => setRevealed(true)}
        />
      ) : null}
    </View>
  );
}

function ScoreEntry({ onSubmit }: { onSubmit: (score: number, max: number) => void }) {
  const theme = useTheme();
  const t = useT();
  const [value, setValue] = useState('');
  const [max, setMax] = useState('');

  const submit = () => {
    const s = Number(value);
    const m = Number(max);
    if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0 || s < 0 || s > m) {
      Alert.alert(t('dialog.checkScoreTitle'), t('dialog.checkScoreBody'));
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
    <View style={{ gap: theme.spacing.sm }}>
      <Txt variant="caption" color="secondary">
        ENTER YOUR SCORE
      </Txt>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
          placeholder={t('day.score')}
          placeholderTextColor={theme.colors.muted}
          style={[theme.typography.body, field]}
        />
        <Txt color="secondary">/</Txt>
        <TextInput
          value={max}
          onChangeText={setMax}
          keyboardType="number-pad"
          placeholder={t('day.outOf')}
          placeholderTextColor={theme.colors.muted}
          style={[theme.typography.body, field]}
        />
        <Button label="Save" compact onPress={submit} />
      </View>
    </View>
  );
}

function subtitle(r: Resolved): string {
  return [
    sourceLabel(r),
    r.videoNote,
    r.item.part ? `part ${r.item.part.index} of ${r.item.part.of}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function sourceLabel(r: Resolved): string {
  switch (r.item.source) {
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
      return r.topic?.subject ?? 'Task';
  }
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

function headline(resolved: Resolved[], kind: string): string {
  if (kind === 'mixed_practice') return 'Mixed practice & weekly test';
  if (kind === 'light_revision') return 'Light revision';
  if (kind === 'final_revision') return 'Final revision';
  const topic = resolved.find((r) => r.item.source === 'topic')?.topic;
  return topic?.title ?? "Today's plan";
}
