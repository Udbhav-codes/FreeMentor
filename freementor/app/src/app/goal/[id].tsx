/**
 * Goal detail -> download -> set weekly time -> start.
 *
 * This is the first screen that exercises the real pipeline end to end:
 * fetch goals/<id>.json, cache it in SQLite, run the scheduler on it, and
 * show the projected finish date before the learner commits.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GoalFile } from '@freementor/shared';
import { catalog, getGoalFile, GoalDownloadError, isPlayable } from '../../api/library.ts';
import { Button, Card, Pill, Screen, Txt } from '../../components/ui.tsx';
import { WeeklyTime } from '../../components/WeeklyTime.tsx';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { buildPlan, type MinutesByWeekday } from '../../scheduler/index.ts';
import { todayIso, useEnrollment, EMPTY_PROGRESS } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { start } = useEnrollment();

  const entry = catalog.goals.find((g) => g.id === id);
  const [file, setFile] = useState<GoalFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minutesByWeekday, setMinutesByWeekday] = useState<MinutesByWeekday>({
    mon: 120,
    tue: 120,
    wed: 120,
    thu: 120,
    fri: 120,
    sat: 240,
    sun: 240,
  });

  // Preview the plan before committing, so the finish date is honest.
  const preview = useMemo(() => {
    if (!file) return null;
    return buildPlan({
      goal: file,
      settings: {
        startDate: todayIso(),
        targetDate: null,
        minutesByWeekday,
        language: 'en',
      },
      progress: EMPTY_PROGRESS,
      today: todayIso(),
    });
  }, [file, minutesByWeekday]);

  const download = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      setFile(await getGoalFile(id));
    } catch (e) {
      setError(
        e instanceof GoalDownloadError
          ? e.message
          : 'Something went wrong downloading this roadmap.',
      );
    } finally {
      setBusy(false);
    }
  }, [id]);

  const begin = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    try {
      await start(file, {
        startDate: todayIso(),
        targetDate: null,
        minutesByWeekday,
        language: 'en',
      });
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }, [file, minutesByWeekday, router, start]);

  if (!entry) {
    return (
      <Screen>
        <View style={{ padding: theme.spacing.xl, paddingTop: insets.top + theme.spacing.xl }}>
          <Txt variant="heading">Goal not found</Txt>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Txt variant="caption" color="secondary">
            {entry.category.toUpperCase()} · {entry.group}
          </Txt>
          <Txt variant="display">{entry.name}</Txt>
          {entry.eligibility_note ? (
            <Txt variant="small" color="secondary">
              {entry.eligibility_note}
            </Txt>
          ) : null}
        </View>

        {!isPlayable(entry) ? (
          <Card>
            <Pill>Coming soon</Pill>
            <Txt variant="body" style={{ marginTop: theme.spacing.sm }}>
              This roadmap is still being built. The outline below shows what it will cover.
            </Txt>
            {entry.phases?.map((phase) => (
              <View key={phase.order} style={{ marginTop: theme.spacing.md }}>
                <Txt variant="bodyStrong">
                  {phase.order}. {phase.name}
                </Txt>
                <Txt variant="caption" color="secondary">
                  {phase.modules.slice(0, 6).join(' · ')}
                </Txt>
              </View>
            ))}
          </Card>
        ) : !file ? (
          <Card>
            <Txt variant="heading">About this roadmap</Txt>
            <Txt variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              Roughly {entry.estimated_hours} hours of free, trusted resources — videos,
              official notes and practice — organised into a day-by-day plan.
            </Txt>
            {error ? (
              <Txt variant="small" style={{ marginTop: theme.spacing.md, color: '#B3261E' }}>
                {error}
              </Txt>
            ) : null}
            <Button
              label={error ? 'Try again' : 'Download roadmap'}
              onPress={download}
              loading={busy}
              style={{ marginTop: theme.spacing.lg }}
            />
          </Card>
        ) : (
          <>
            <WeeklyTime
              value={minutesByWeekday}
              onChange={setMinutesByWeekday}
              goalName={entry.name}
              estimatedHours={entry.estimated_hours}
              today={todayIso()}
            />

            {preview ? (
              <Card>
                <Txt variant="heading">Your roadmap</Txt>
                <Row label="Phases" value={String(file.phases.length)} />
                <Row label="Topics" value={String(preview.totals.topicsTotal)} />
                <Row
                  label="Study time"
                  value={`${Math.round(preview.totals.contentMinutes / 60)} h`}
                />
                <Row
                  label="A typical day"
                  value={formatMinutes(
                    Math.round(
                      preview.days
                        .filter((d) => d.items.length > 0)
                        .reduce((s2, d) => s2 + d.plannedMinutes, 0) /
                        Math.max(1, preview.days.filter((d) => d.items.length > 0).length),
                    ),
                  )}
                />
                <Row label="Syllabus finished" value={preview.contentFinish ?? '—'} />
                <Row label="Ready by" value={preview.projectedFinish ?? '—'} />
                <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.md }}>
                  The last {Math.round(
                    file.scheduler_hints.reserve_final_fraction_for_mocks_and_revision * 100,
                  )}
                  % of your plan is kept free for mocks and revision.
                </Txt>
              </Card>
            ) : null}

            <Button label="Start Day 1" onPress={begin} loading={busy} />
          </>
        )}
      </ScrollView>
    </Screen>
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
