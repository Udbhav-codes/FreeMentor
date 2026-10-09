/**
 * The confidence sheet — product plan §7.5.
 *
 * Five levels, each mapping to when the topic comes back for revision. The
 * mapping lives in the goal file's scheduler_hints, so the sheet shows the
 * learner the real consequence ("Comes back for revision in 4 days") rather
 * than a hardcoded guess.
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
  selected,
  onSelect,
  topicTitle,
}: {
  hints: SchedulerHints;
  selected: ConfidenceLevel | null;
  onSelect: (level: ConfidenceLevel) => void;
  topicTitle?: string;
}) {
  const theme = useTheme();
  const days = selected ? hints.confidence_to_next_review_days[selected] : null;

  return (
    <Card>
      <Txt variant="heading">How well do you know this?</Txt>
      {topicTitle ? (
        <Txt variant="caption" color="secondary" style={{ marginTop: 2 }}>
          {topicTitle}
        </Txt>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        }}
      >
        {LEVELS.map(({ level, label }) => (
          <Button
            key={level}
            label={label}
            variant={selected === level ? 'primary' : 'secondary'}
            onPress={() => onSelect(level)}
            style={{ paddingHorizontal: theme.spacing.lg, minHeight: 44 }}
          />
        ))}
      </View>

      {days != null ? (
        <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.md }}>
          Comes back for revision in {days} {days === 1 ? 'day' : 'days'}.
        </Txt>
      ) : null}
    </Card>
  );
}
