import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useEnrollment } from '../state/EnrollmentContext.tsx';
import { useAuth } from '../auth/AuthContext.tsx';
import { hasOnboarded } from '../db/profile.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

/**
 * The gate every launch passes through, in the order of product plan §5:
 *
 *   animation (_layout) -> sign-in -> onboarding -> choose -> goal/[id] -> roadmap
 *
 * This file owns the route "/" and nothing else may: the tab group's home is
 * `(tabs)/roadmap.tsx`, deliberately not `(tabs)/index.tsx`. A group adds no
 * path segment, so an index inside it would also be "/" and the two would
 * compete — which is exactly what happened: the tab group won, the gate never
 * ran, and a brand-new user went from the animation straight to an empty
 * roadmap with no sign-in, no name and no goal.
 */
export default function Index() {
  const { loading, enrollment } = useEnrollment();
  const { loading: authLoading, signedIn } = useAuth();
  const theme = useTheme();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasOnboarded()
      .then(setOnboarded)
      .catch(() => setOnboarded(false));
  }, []);

  if (loading || authLoading || onboarded === null) {
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

  // §5: sign-in comes before anything personal is asked, so the age gate and
  // everything after it happen on a known account.
  if (!signedIn) return <Redirect href="/sign-in" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href={enrollment ? '/roadmap' : '/choose'} />;
}
