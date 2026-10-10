/**
 * Goal setup — product plan §5 steps 5 to 12.
 *
 *   about → download → qualification → weekly time (+ deadline calculator)
 *   → "Building your roadmap…" → "Roadmap ready" → Start Day 1
 *
 * One question per screen with a progress bar and a back button, which is
 * what §5 asks for: the flow should feel like a short chat, not a form.
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GoalFile } from '@freementor/shared';
import { catalog, getGoalFile, GoalDownloadError, isPlayable } from '../../api/library.ts';
import { Button, Card, Pill, ProgressBar, Row, Screen, Txt } from '../../components/ui.tsx';
import { WeeklyTime } from '../../components/WeeklyTime.tsx';
import { Building } from '../../components/Building.tsx';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { saveProfile } from '../../db/profile.ts';
import { buildPlan, type MinutesByWeekday, type PlannedDay } from '../../scheduler/index.ts';
import { todayIso, useEnrollment, EMPTY_PROGRESS } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';

type Step = 'about' | 'qualification' | 'time' | 'building' | 'ready';
const ORDER: Step[] = ['about', 'qualification', 'time', 'building', 'ready'];

export default function GoalSetup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { start } = useEnrollment();

  const entry = catalog.goals.find((g) => g.id === id);

  const [step, setStep] = useState<Step>('about');
  const [file, setFile] = useState<GoalFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualification, setQualification] = useState<string | null>(null);
  const [minutesByWeekday, setMinutesByWeekday] = useState<MinutesByWeekday>({
    mon: 120,
    tue: 120,
    wed: 120,
    thu: 120,
    fri: 120,
    sat: 240,
    sun: 240,
  });

  const settings = useMemo(
    () => ({
      startDate: todayIso(),
      targetDate: null,
      minutesByWeekday,
      language: 'en' as const,
    }),
    [minutesByWeekday],
  );

  const preview = useMemo(
    () =>
      file ? buildPlan({ goal: file, settings, progress: EMPTY_PROGRESS, today: todayIso() }) : null,
    [file, settings],
  );

  const download = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      setFile(await getGoalFile(id));
      setStep('qualification');
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
      if (qualification) await saveProfile({ qualification });
      await start(file, settings);
      router.replace('/roadmap');
    } finally {
      setBusy(false);
    }
  }, [file, qualification, settings, router, start]);

  const back = useCallback(() => {
    const i = ORDER.indexOf(step);
    if (i <= 0) router.back();
    else setStep(ORDER[i - 1]!);
  }, [step, router]);

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

  // Step 11 — "Building your personalised roadmap…"
  if (step === 'building') {
    return <Building goalName={entry.name} onDone={() => setStep('ready')} />;
  }

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.screen,
        }}
      >
        <ProgressBar fraction={(ORDER.indexOf(step) + 1) / ORDER.length} />
        <Button
          label="← Back"
          variant="ghost"
          onPress={back}
          style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        {step === 'about' ? (
          <>
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
                  This roadmap is still being built. Here's what it will cover.
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
            ) : (
              <>
                <Card>
                  <Txt variant="heading">What you'll get</Txt>
                  <Txt variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                    About {entry.estimated_hours} hours of free, trusted resources — videos,
                    official notes and practice — turned into a day-by-day plan built around
                    your time.
                  </Txt>
                  {entry.career_outcomes?.length ? (
                    <View style={{ marginTop: theme.spacing.md, gap: 2 }}>
                      <Txt variant="caption" color="secondary">
                        WHAT YOU CAN DO AFTER THIS
                      </Txt>
                      {entry.career_outcomes.slice(0, 4).map((outcome) => (
                        <Txt key={outcome} variant="small">
                          · {outcome}
                        </Txt>
                      ))}
                    </View>
                  ) : null}
                </Card>

                {error ? (
                  <Card>
                    <Txt variant="bodyStrong" color="danger">
                      Could not download
                    </Txt>
                    <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
                      {error}
                    </Txt>
                  </Card>
                ) : null}

                <Button
                  label={error ? 'Try again' : 'Download roadmap'}
                  onPress={download}
                  loading={busy}
                />
              </>
            )}
          </>
        ) : null}

        {step === 'qualification' ? (
          <>
            <Txt variant="display">Where are you right now?</Txt>
            <Txt variant="small" color="secondary">
              This only changes the wording and the pacing advice — every roadmap starts from
              scratch.
            </Txt>
            <View style={{ gap: theme.spacing.sm }}>
              {(entry.qualification_options ?? ['Other']).map((option) => (
                <Button
                  key={option}
                  label={option}
                  variant={qualification === option ? 'primary' : 'secondary'}
                  onPress={() => setQualification(option)}
                />
              ))}
            </View>
            <Button label={qualification ? 'Continue' : 'Skip'} onPress={() => setStep('time')} />
          </>
        ) : null}

        {step === 'time' && file ? (
          <>
            <Txt variant="display">How much time can you give?</Txt>
            <WeeklyTime
              value={minutesByWeekday}
              onChange={setMinutesByWeekday}
              goalName={entry.name}
              estimatedHours={entry.estimated_hours}
              today={todayIso()}
            />
            <Button label="Build my roadmap" onPress={() => setStep('building')} />
          </>
        ) : null}

        {step === 'ready' && preview ? (
          <>
            <Txt variant="displayItalic">Your roadmap is ready.</Txt>

            <Card>
              <Txt variant="heading">{entry.name}</Txt>
              <Row label="Phases" value={String(file?.phases.length ?? 0)} />
              <Row label="Topics" value={String(preview.totals.topicsTotal)} />
              <Row
                label="Study time"
                value={`${Math.round(preview.totals.contentMinutes / 60)} h`}
              />
              <Row label="A typical day" value={formatMinutes(typicalDay(preview.days))} />
              <Row label="Syllabus finished" value={preview.contentFinish ?? '—'} />
              <Row label="Ready by" value={preview.projectedFinish ?? '—'} />
            </Card>

            <Card>
              <Txt variant="caption" color="secondary">
                HOW IT WORKS
              </Txt>
              <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
                <Txt variant="small">
                  · Each day is a short checklist — watch, read, practise, recall.
                </Txt>
                <Txt variant="small">
                  · Miss a day and the whole plan shifts forward. Nothing is lost.
                </Txt>
                <Txt variant="small">
                  · Topics come back for revision based on how well you say you know them.
                </Txt>
                <Txt variant="small">
                  · The last{' '}
                  {Math.round(
                    (file?.scheduler_hints.reserve_final_fraction_for_mocks_and_revision ?? 0.15) *
                      100,
                  )}
                  % of your plan is kept free for mocks and revision.
                </Txt>
              </View>
            </Card>

            {preview.warnings.map((w) => (
              <Card
                key={w.code}
                style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.accent }}
              >
                <Txt variant="bodyStrong">Worth knowing</Txt>
                <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
                  {w.message}
                </Txt>
              </Card>
            ))}

            <Button label="Start Day 1" onPress={() => void begin()} loading={busy} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function typicalDay(days: PlannedDay[]): number {
  const active = days.filter((d) => d.items.length > 0);
  if (active.length === 0) return 0;
  return Math.round(active.reduce((s, d) => s + d.plannedMinutes, 0) / active.length);
}
