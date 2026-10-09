/**
 * The confidence sheet — product plan §7.5 and screen 5 of the preview.
 *
 * Five levels, each mapping to when the topic comes back for revision. The
 * mapping lives in the goal file's scheduler_hints, so the sheet tells the
 * learner the real consequence ("Comes back for revision in 4 days") rather
 * than a hardcoded guess.
 *
 * ONE card for the whole day, even when the day covered several topics. A
 * separate full-size card per topic is what the mockup does not do, and on a
 * three-topic day it pushed "Mark day complete" off the screen.
 */
import { View } from 'react-native';
import type { ConfidenceLevel, SchedulerHints } from '@freementor/shared';
import { Button, Card, Txt } from './ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

const LEVELS: { level: ConfidenceLevel; label: string }[] = [
  { level: 'need_revision', label: 'Need revision' },
  { level: 'little_afraid', label: 'A little afraid' },
  { level: 'confident', label: "I'm confident" },
  { level: 'all_cleared', label: 'All cleared' },
  { level: 'mastered', label: 'Mastered' },
];

export function ConfidenceSheet({
  hints,
  topics,
  ratings,
  onSelect,
}: {
  hints: SchedulerHints;
  topics: { id: string; title: string }[];
  ratings: Record<string, { level: ConfidenceLevel }>;
  onSelect: (topicId: string, level: ConfidenceLevel) => void;
}) {
  const theme = useTheme();
  if (topics.length === 0) return null;

  return (
    <Card>
      <Txt variant="heading">How well do you know this?</Txt>
      <Txt variant="caption" color="secondary" style={{ marginTop: 2 }}>
        This decides when it comes back for revision.
      </Txt>

      {topics.map((topic, i) => {
        const selected = ratings[topic.id]?.level ?? null;
        const days = selected ? hints.confidence_to_next_review_days[selected] : null;

        return (
          <View
            key={topic.id}
            style={{
              marginTop: theme.spacing.lg,
              paddingTop: i === 0 ? 0 : theme.spacing.lg,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
            }}
          >
            {topics.length > 1 ? (
              <Txt variant="bodyStrong" numberOfLines={2}>
                {topic.title}
              </Txt>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
                marginTop: theme.spacing.md,
              }}
            >
              {LEVELS.map(({ level, label }) => (
                <Button
                  key={level}
                  compact
                  label={label}
                  variant={selected === level ? 'primary' : 'secondary'}
                  onPress={() => onSelect(topic.id, level)}
                />
              ))}
            </View>

            {days != null ? (
              <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.md }}>
                Comes back for revision in {days} {days === 1 ? 'day' : 'days'}.
              </Txt>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
