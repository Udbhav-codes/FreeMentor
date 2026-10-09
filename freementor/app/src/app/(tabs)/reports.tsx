/**
 * Reports tab — product plan §8.7 and screen 6 of the preview.
 *
 * Detailed analytics are a Premium feature (§10.1); the weekly report itself
 * is free on every plan, because it is the thing that actually changes
 * behaviour. The Premium lock lands with billing at M5.
 */
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, ScoreBars } from '../../components/charts.tsx';
import { Card, Empty, Screen, Txt } from '../../components/ui.tsx';
import { formatMinutes } from '../../onboarding/deadline.ts';
import { weeklyReport } from '../../progress/weekly.ts';
import { consistency } from '../../progress/streak.ts';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';

export default function Reports() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { plan, progress } = useEnrollment();
  const today = todayIso();

  const report = useMemo(
    () => (plan && progress ? weeklyReport(plan, progress, today) : null),
    [plan, progress, today],
  );

  const week = useMemo(
    () =>
      consistency(
        Object.values(progress?.completed ?? {}).map((r) => r.completedAt),
        today,
      ),
    [progress, today],
  );

  if (!report) {
    return (
      <Screen>
        <Empty title="No reports yet" body="Pick a goal and your weekly report starts here." />
      </Screen>
    );
  }

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
        <View>
          <Txt variant="display">This week</Txt>
          <Txt variant="small" color="secondary">
            {report.weekStart} – {report.weekEnd}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Stat
            label="Study time"
            value={formatMinutes(report.studiedMinutes)}
            of={formatMinutes(report.plannedMinutes)}
          />
          <Stat
            label="Tasks done"
            value={String(report.tasksDone)}
            of={String(report.tasksPlanned)}
          />
        </View>

        <Card>
          <Txt variant="heading">Daily study hours</Txt>
          <View style={{ marginTop: theme.spacing.md }}>
            <BarChart
              bars={report.dailyMinutes.map((d) => ({
                label: d.label,
                value: d.studied,
                highlight: d.studied > d.planned && d.planned > 0,
              }))}
              target={report.targetMinutes > 0 ? report.targetMinutes : undefined}
            />
          </View>
        </Card>

        {report.highlight ? (
          <Card style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.success }}>
            <Txt variant="small" color="success">
              ✓ {report.highlight}
            </Txt>
          </Card>
        ) : null}

        {report.subjectScores.length > 0 ? (
          <Card>
            <Txt variant="heading">Test scores</Txt>
            <View style={{ marginTop: theme.spacing.md }}>
              <ScoreBars rows={report.subjectScores} />
            </View>
            <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.md }}>
              Anything under 60% triggers a catch-up block before new content.
            </Txt>
          </Card>
        ) : (
          <Card>
            <Txt variant="heading">Test scores</Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
              Enter your score after a test and it shows up here.
            </Txt>
          </Card>
        )}

        <Card>
          <Txt variant="heading">Consistency</Txt>
          <Txt variant="body" style={{ marginTop: theme.spacing.sm }}>
            You studied on {week.studied} of the last {week.of} days.
          </Txt>
        </Card>

        <Card style={{ borderLeftWidth: 4, borderLeftColor: theme.colors.primary }}>
          <Txt variant="caption" color="secondary">
            THIS WEEK'S ONE THING
          </Txt>
          <Txt variant="bodyStrong" style={{ marginTop: theme.spacing.xs }}>
            {report.recommendation}
          </Txt>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, of }: { label: string; value: string; of: string }) {
  const theme = useTheme();
  return (
    <Card style={{ flex: 1 }}>
      <Txt variant="caption" color="secondary">
        {label.toUpperCase()}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Txt variant="title">{value}</Txt>
        <Txt variant="caption" color="secondary">
          / {of}
        </Txt>
      </View>
    </Card>
  );
}
