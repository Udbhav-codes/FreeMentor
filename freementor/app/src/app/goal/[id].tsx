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
import { buildPlan, WEEKDAYS, type MinutesByWeekday } from '../../scheduler/index.ts';
import { todayIso, useEnrollment, EMPTY_PROGRESS } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';

const PRESETS = [60, 90, 120, 180, 240, 360];
const WEEKDAY_LABEL: Record<string, string> = {
  mon: 'M',
  tue: 'T',
  wed: 'W',
  thu: 'T',
  fri: 'F',
  sat: 'S',
  sun: 'S',
};

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
  const [weekdayMinutes, setWeekdayMinutes] = useState(120);
  const [weekendMinutes, setWeekendMinutes] = useState(240);

  const minutesByWeekday = useMemo<MinutesByWeekday>(
    () => ({
      mon: weekdayMinutes,
      tue: weekdayMinutes,
      wed: weekdayMinutes,
      thu: weekdayMinutes,
      fri: weekdayMinutes,
      sat: weekendMinutes,
      sun: weekendMinutes,
    }),
    [weekdayMinutes, weekendMinutes],
  );

  const weeklyMinutes = Object.values(minutesByWeekday).reduce((a, b) => a + b, 0);

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
            <Card>
              <Txt variant="heading">How much time can you give?</Txt>
              <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                Set it per day. You can change this anytime.
              </Txt>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: theme.spacing.lg,
                }}
              >
                {WEEKDAYS.map((day, i) => {
                  const minutes = minutesByWeekday[day];
                  const height = Math.max(8, Math.round((minutes / 360) * 56));
                  return (
                    <View key={`${day}-${i}`} style={{ alignItems: 'center', gap: 6 }}>
                      <View style={{ height: 56, justifyContent: 'flex-end' }}>
                        <View
                          style={{
                            width: 18,
                            height,
                            borderRadius: 4,
                            backgroundColor: theme.colors.primary,
                          }}
                        />
                      </View>
                      <Txt variant="caption" color="secondary">
                        {WEEKDAY_LABEL[day]}
                      </Txt>
                      <Txt variant="caption" color="secondary">
                        {Math.round(minutes / 60)}h
                      </Txt>
                    </View>
                  );
                })}
              </View>

              <MinutePicker
                label="Weekdays"
                value={weekdayMinutes}
                onChange={setWeekdayMinutes}
              />
              <MinutePicker
                label="Weekends"
                value={weekendMinutes}
                onChange={setWeekendMinutes}
              />

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: theme.spacing.lg,
                }}
              >
                <Txt variant="small" color="secondary">
                  Total this week
                </Txt>
                <Txt variant="bodyStrong">{Math.round(weeklyMinutes / 60)} h / week</Txt>
              </View>
            </Card>

            {preview ? (
              <Card>
                <Txt variant="heading">Your roadmap</Txt>
                <Row label="Phases" value={String(file.phases.length)} />
                <Row label="Topics" value={String(preview.totals.topicsTotal)} />
                <Row
                  label="Study time"
                  value={`${Math.round(preview.totals.contentMinutes / 60)} h`}
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

function MinutePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
      <Txt variant="small" color="secondary">
        {label}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {PRESETS.map((minutes) => {
          const selected = minutes === value;
          return (
            <Button
              key={minutes}
              label={minutes >= 60 ? `${minutes / 60} h` : `${minutes} m`}
              variant={selected ? 'primary' : 'secondary'}
              onPress={() => onChange(minutes)}
              style={{ paddingHorizontal: theme.spacing.lg, minHeight: 44 }}
            />
          );
        })}
      </View>
    </View>
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
