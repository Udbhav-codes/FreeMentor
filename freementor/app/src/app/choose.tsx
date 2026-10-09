/**
 * Goal selection — product plan §5 step 5 and §8.13 (global search).
 *
 * All 73 goals are browsable; the 12 with a built roadmap are startable and
 * the rest are marked "Coming soon" rather than hidden, which is what the MVP
 * scope in §17 asks for.
 *
 * Rows are hairline-separated lines, not cards. A neumorphic card per goal
 * means 73 stacked shadows in one scroll — heavy to look at, heavy to render
 * on the 3-4 GB phones §11.4 targets, and impossible to scan.
 */
import { useMemo, useState } from 'react';
import { Pressable, SectionList, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CatalogGoal } from '@freementor/shared';
import { catalog, isPlayable, searchGoals } from '../api/library.ts';
import { Pill, Screen, Txt } from '../components/ui.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';
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
      return [
        { title: `${results.length} result${results.length === 1 ? '' : 's'}`, data: results },
      ];
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
          (a, b) => Number(isPlayable(b)) - Number(isPlayable(a)) || a.name.localeCompare(b.name),
        ),
    }));
  }, [query]);

  const readyCount = catalog.goals.filter(isPlayable).length;

  return (
    <Screen>
      <View
        style={{
          paddingTop: insets.top + theme.spacing.lg,
          paddingHorizontal: theme.spacing.screen,
          paddingBottom: theme.spacing.md,
        }}
      >
        <Txt variant="display">What do you want to learn?</Txt>
        <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.xs }}>
          One goal at a time. {readyCount} of {catalog.goals.length} are ready to start today.
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
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: theme.spacing.lg,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
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
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xxl }}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ padding: theme.spacing.xl }}>
            <Txt variant="small" color="secondary">
              Nothing matched that. Try a shorter word.
            </Txt>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Txt
            variant="caption"
            color="secondary"
            style={{
              paddingHorizontal: theme.spacing.screen,
              paddingTop: theme.spacing.xl,
              paddingBottom: theme.spacing.sm,
            }}
          >
            {section.title.toUpperCase()}
          </Txt>
        )}
        renderItem={({ item }) => (
          <GoalRow goal={item} onPress={() => router.push(`/goal/${item.id}`)} />
        )}
      />
    </Screen>
  );
}

function GoalRow({ goal, onPress }: { goal: CatalogGoal; onPress: () => void }) {
  const theme = useTheme();
  const ready = isPlayable(goal);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.name}. ${ready ? 'Ready to start' : 'Coming soon'}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        minHeight: 64,
        paddingHorizontal: theme.spacing.screen,
        paddingVertical: theme.spacing.md,
        backgroundColor: pressed ? theme.colors.surface : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong" numberOfLines={1} style={ready ? undefined : { opacity: 0.7 }}>
          {goal.name}
        </Txt>
        <Txt variant="caption" color="secondary" numberOfLines={1}>
          {goal.group} · about {goal.estimated_hours} hours
        </Txt>
      </View>
      {ready ? <Pill tone="primary">Ready</Pill> : <Pill>Soon</Pill>}
      <Txt variant="caption" color="secondary">
        ›
      </Txt>
    </Pressable>
  );
}
