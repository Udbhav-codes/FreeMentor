import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Imported per weight, not from the package root: the root index re-exports
// all 18 weights, which dragged ~8 MB of unused TTFs into the bundle.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMSans_700Bold_Italic } from '@expo-google-fonts/dm-sans/700Bold_Italic';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider.tsx';
import { EnrollmentProvider } from '../state/EnrollmentContext.tsx';
import { AuthProvider } from '../auth/AuthContext.tsx';
import { SyncProvider } from '../state/SyncContext.tsx';
import { OpeningAnimation } from '../components/OpeningAnimation.tsx';
import { getDb } from '../db/index.ts';
import { hasOnboarded } from '../db/profile.ts';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    DMSans_500Medium,
    DMSans_700Bold,
    DMSans_700Bold_Italic,
  });
  const [dbReady, setDbReady] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);
  // Full-length intro only for someone who has never onboarded.
  const [firstLaunch, setFirstLaunch] = useState(true);

  useEffect(() => {
    getDb()
      .then(async () => {
        setFirstLaunch(!(await hasOnboarded().catch(() => false)));
        setDbReady(true);
      })
      .catch((e) => setFatal(String(e)));
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && dbReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (fatal) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <Fatal message={fatal} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  if (!ready) return null;

  if (!introDone) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar style="light" />
          <OpeningAnimation firstLaunch={firstLaunch} onDone={() => setIntroDone(true)} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
        <SyncProvider>
        <EnrollmentProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="choose" />
            <Stack.Screen name="day/[date]" />
            <Stack.Screen name="route" />
            <Stack.Screen name="plans" options={{ presentation: 'modal' }} />
            <Stack.Screen name="goal/[id]" />
          </Stack>
        </EnrollmentProvider>
        </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Only reachable if SQLite itself refused to open — the app is unusable
 *  offline without it, so say so plainly rather than showing an empty screen. */
function Fatal({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 8,
        backgroundColor: theme.colors.background,
      }}
    >
      <Text style={[theme.typography.heading, { color: theme.colors.text }]}>
        FreeMentor could not start
      </Text>
      <Text
        style={[
          theme.typography.small,
          { color: theme.colors.textSecondary, textAlign: 'center' },
        ]}
      >
        Local storage is unavailable. {message}
      </Text>
    </View>
  );
}
