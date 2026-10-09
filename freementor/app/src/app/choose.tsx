/**
 * Goal selection — product plan §5 step 5.
 *
 * All 73 goals are browsable; the 12 with a built roadmap are startable and
 * the rest are marked "Coming soon" rather than hidden, which is what the MVP
 * scope in §17 asks for.
 */
import { useMemo, useState } from 'react';
import { SectionList, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CatalogGoal } from '@freementor/shared';
import { catalog, isPlayable, searchGoals } from '../api/library.ts';
import { Card, Pill, Screen, Txt } from '../components/ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

const CATEGORY_ORDER = ['Entrance Exams', 'Skills', 'Programming Languages'];

export default function Choose() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    if (query.trim()) {
      const results = searchGoals(query);
      return [{ title: `${results.length} result${results.length === 1 ? '' : 's'}`, data: results }];
    }
    const byCategory = new Map<string, CatalogGoal[]>();
    for (const goal of catalog.goals) {
      const list = byCategory.get(goal.category);
      if (list) list.push(goal);
      else byCategory.set(goal.category, [goal]);
    }
    return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((title) => ({
      title,
      // Ready-to-start goals first, then alphabetical.
      data: byCategory
        .get(title)!
        .sort(
          (a, b) =>
            Number(isPlayable(b)) - Number(isPlayable(a)) || a.name.localeCompare(b.name),
        ),
    }));
  }, [query]);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + theme.spacing.lg, paddingHorizontal: theme.spacing.lg }}>
        <Txt variant="display">What do you want to learn?</Txt>
        <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          One goal at a time. You can change it later.
        </Txt>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search exams, skills and languages"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="search"
          style={[
            theme.typography.body,
            {
              marginTop: theme.spacing.lg,
              minHeight: 48,
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.card,
              color: theme.colors.text,
              borderWidth: 1,
              borderColor: theme.colors.border,
            },
          ]}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.md,
        }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.md }}>
            {section.title.toUpperCase()}
          </Txt>
        )}
        renderItem={({ item }) => <GoalRow goal={item} onPress={() => router.push(`/goal/${item.id}`)} />}
      />
    </Screen>
  );
}

function GoalRow({ goal, onPress }: { goal: CatalogGoal; onPress: () => void }) {
  const theme = useTheme();
  const ready = isPlayable(goal);

  return (
    <Card onPress={onPress} style={{ opacity: ready ? 1 : 0.6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt variant="bodyStrong">{goal.name}</Txt>
          <Txt variant="caption" color="secondary">
            {goal.group} · about {goal.estimated_hours} hours
          </Txt>
        </View>
        {ready ? <Pill tone="primary">Ready</Pill> : <Pill>Coming soon</Pill>}
      </View>
    </Card>
  );
}
