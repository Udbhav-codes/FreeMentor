import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useEnrollment } from '../state/EnrollmentContext.tsx';
import { hasOnboarded } from '../db/profile.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

/**
 * Entry point: straight to the roadmap if a goal is already running,
 * otherwise to goal selection. (Full onboarding — age gate, consent, name,
 * weekly time, if-then plan — arrives at M3.)
 */
export default function Index() {
  const { loading, enrollment } = useEnrollment();
  const theme = useTheme();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasOnboarded()
      .then(setOnboarded)
      .catch(() => setOnboarded(false));
  }, []);

  if (loading || onboarded === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={enrollment ? '/(tabs)' : '/choose'} />;
}
