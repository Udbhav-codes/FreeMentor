import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, Txt } from '../../components/ui.tsx';
import { useAppearance, useTheme } from '../../theme/ThemeProvider.tsx';
import { useEnrollment } from '../../state/EnrollmentContext.tsx';
import { libraryBaseUrl } from '../../api/library.ts';

export default function Profile() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { appearance, setAppearance } = useAppearance();
  const { goal, plan } = useEnrollment();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingTop: insets.top + theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <Txt variant="display">Profile</Txt>

        <Card>
          <Txt variant="heading">Appearance</Txt>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
            {(['light', 'dark', 'system'] as const).map((option) => (
              <Button
                key={option}
                label={option[0]!.toUpperCase() + option.slice(1)}
                variant={appearance === option ? 'primary' : 'secondary'}
                onPress={() => setAppearance(option)}
                style={{ flex: 1, paddingHorizontal: theme.spacing.sm }}
              />
            ))}
          </View>
        </Card>

        <Card>
          <Txt variant="heading">Your goal</Txt>
          <Txt variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            {goal ? `${goal.goal.name} · version ${goal.goal.version}` : 'No goal selected yet.'}
          </Txt>
          {plan ? (
            <Txt variant="caption" color="secondary" style={{ marginTop: 4 }}>
              {plan.totals.contentDays} study days + {plan.totals.reserveDays} days of
              mocks and revision
            </Txt>
          ) : null}
          <Button
            label={goal ? 'Change goal' : 'Choose a goal'}
            variant="secondary"
            onPress={() => router.push('/choose')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>

        <Card>
          <Txt variant="heading">Your plan</Txt>
          <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
            You're on the 3-day free trial of Basic. YouTube lessons stay free to open on
            every plan.
          </Txt>
          <Button
            label="See plans"
            variant="secondary"
            onPress={() => router.push('/plans')}
            style={{ marginTop: theme.spacing.lg }}
          />
        </Card>

        <Card>
          <Txt variant="caption" color="secondary">
            Library source (dev)
          </Txt>
          <Txt variant="small" style={{ marginTop: 4 }}>
            {libraryBaseUrl}
          </Txt>
        </Card>
      </ScrollView>
    </Screen>
  );
}
