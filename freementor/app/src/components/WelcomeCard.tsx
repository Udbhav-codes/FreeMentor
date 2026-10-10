/**
 * The welcome / value card on Home.
 *
 * Shown while the learner is still on the trial — that is when it is useful,
 * because it explains what they would be paying for and why it is small. Once
 * they have bought, it is just noise in front of today's tasks, so it goes.
 *
 * It is also dismissible, and stays dismissed. §11.4 asks for one main action
 * per screen, and a permanent marketing block above the checklist works
 * against the thing the app is for.
 */
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CatalogGoal } from '@freementor/shared';
import { Button, Txt } from './ui.tsx';
import { welcomeCopy } from '../marketing/welcome.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

export function WelcomeCard({
  goal,
  onDismiss,
}: {
  goal: CatalogGoal;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const copy = welcomeCopy(goal);

  return (
    <View
      style={{
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.raised,
        borderWidth: theme.dark ? 1 : 0,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Txt variant="title" style={{ flex: 1 }}>
          {copy.brandLead}
          <Txt variant="title" color="accent">
            {copy.brandAccent}
          </Txt>
        </Txt>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome message"
          onPress={onDismiss}
          hitSlop={12}
          style={{
            minWidth: MIN_TOUCH_TARGET / 2,
            minHeight: MIN_TOUCH_TARGET / 2,
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <Txt variant="body" color="secondary">
            ✕
          </Txt>
        </Pressable>
      </View>

      <Txt variant="body">{copy.promise}</Txt>
      <Txt variant="small" color="secondary">
        {copy.facts}
      </Txt>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <Txt variant="small">{copy.value}</Txt>
        <Txt variant="small" color="secondary">
          {copy.nudge}
        </Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Txt variant="caption" color="accent">
          ✓
        </Txt>
        <Txt variant="caption" color="secondary" style={{ flex: 1 }}>
          {copy.trust}
        </Txt>
      </View>
      <Txt variant="caption" color="secondary">
        {copy.disclosure}
      </Txt>

      <Button label="See what you get" variant="secondary" onPress={() => router.push('/plans')} />
    </View>
  );
}
