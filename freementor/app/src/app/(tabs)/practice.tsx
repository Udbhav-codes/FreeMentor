/**
 * Practice tab — product plan §8.5.
 *
 * Today's practice, chapter-wise PYQs, mock tests and coding practice. All of
 * it is links out to free sources — nothing is copied or re-hosted (§9.1).
 */
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Resource } from '@freementor/shared';
import { Button, Card, Empty, Pill, Screen, Txt } from '../../components/ui.tsx';
import { ResourceLink } from '../../components/ResourceLink.tsx';
import { todayIso, useEnrollment } from '../../state/EnrollmentContext.tsx';
import { useTheme } from '../../theme/ThemeProvider.tsx';

export default function Practice() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal, plan } = useEnrollment();
  const today = todayIso();

  const todaysPractice = useMemo(() => {
    if (!goal || !plan) return [];
    const day = plan.days.find((d) => d.date === today);
    if (!day) return [];
    const blocks = new Map(
      goal.topics.flatMap((t) => t.blocks.map((b) => [b.id, b] as const)),
    );
    return day.items
      .filter((i) => i.blockId && blocks.get(i.blockId)?.type === 'practice')
      .flatMap((i) => blocks.get(i.blockId!)?.resources ?? []);
  }, [goal, plan, today]);

  /** De-duplicated practice and test links across the whole roadmap. */
  const { practice, mocks } = useMemo(() => {
    if (!goal) return { practice: [], mocks: [] };
    const seen = new Set<string>();
    const practiceLinks: Resource[] = [];
    const mockLinks: Resource[] = [];

    for (const resource of goal.topics.flatMap((t) => t.blocks.flatMap((b) => b.resources))) {
      if (seen.has(resource.url)) continue;
      seen.add(resource.url);
      if (resource.type === 'practice') practiceLinks.push(resource);
      else if (resource.type === 'test') mockLinks.push(resource);
    }
    for (const resource of goal.milestones.flatMap((m) => m.resources)) {
      if (seen.has(resource.url)) continue;
      seen.add(resource.url);
      mockLinks.push(resource);
    }
    return { practice: practiceLinks, mocks: mockLinks };
  }, [goal]);

  if (!goal || !plan) {
    return (
      <Screen>
        <Empty title="No practice yet" body="Pick a goal to get practice and past papers." />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <Txt variant="display">Practice</Txt>

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Txt variant="heading" style={{ flex: 1 }}>
              Today's practice
            </Txt>
            <Pill tone="accent">Today</Pill>
          </View>

          {todaysPractice.length === 0 ? (
            <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              No practice scheduled today. Anything below is yours to dip into.
            </Txt>
          ) : (
            <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
              {todaysPractice.map((resource) => (
                <ResourceLink key={resource.url} resource={resource} />
              ))}
            </View>
          )}

          <Button
            label="Open today's plan →"
            variant="secondary"
            onPress={() => router.push(`/day/${today}`)}
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        <LinkSection
          title={goal.goal.type === 'exam' ? 'Chapter-wise past papers' : 'Coding practice'}
          subtitle={`${practice.length} free links from this roadmap`}
          resources={practice}
        />

        <LinkSection
          title={goal.goal.type === 'exam' ? 'Mock tests' : 'Tests & certification'}
          subtitle={`${mocks.length} links`}
          resources={mocks}
        />

        <Txt variant="caption" color="secondary">
          Every link opens the original free source. FreeMentor never copies or re-hosts
          anyone's content.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

/** Long lists are capped: 700-link goals exist, and nobody scrolls 700 rows. */
function LinkSection({
  title,
  subtitle,
  resources,
  limit = 12,
}: {
  title: string;
  subtitle: string;
  resources: Resource[];
  limit?: number;
}) {
  const theme = useTheme();
  if (resources.length === 0) return null;

  return (
    <Card>
      <Txt variant="heading">{title}</Txt>
      <Txt variant="caption" color="secondary" style={{ marginTop: 2 }}>
        {subtitle}
      </Txt>
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
        {resources.slice(0, limit).map((resource) => (
          <ResourceLink key={resource.url} resource={resource} />
        ))}
      </View>
      {resources.length > limit ? (
        <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          + {resources.length - limit} more, scheduled into your plan on the right days.
        </Txt>
      ) : null}
    </Card>
  );
}
