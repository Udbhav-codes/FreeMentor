/**
 * Sign in — product plan §5 step 2.
 *
 * Comes straight after Welcome and before anything personal is asked. That
 * order is deliberate: §15 allows only the sign-in itself to be processed
 * before consent, so the age gate and everything after it happen on a known
 * account.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Screen, Txt } from '../components/ui.tsx';
import { useAuth } from '../auth/AuthContext.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';

const PRIVACY_URL = 'https://freementor.app/privacy';
const TERMS_URL = 'https://freementor.app/terms';

export default function SignIn() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await signInWithGoogle();
    setBusy(false);

    if (result.ok) {
      router.replace('/onboarding');
      return;
    }
    // A cancelled sign-in is a choice, not a failure — say nothing.
    if (result.reason === 'cancelled') return;
    setError(result.detail ?? 'Could not sign in. Please try again.');
  }, [signInWithGoogle, router]);

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.xxl,
          paddingBottom: insets.bottom + theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
          <Txt variant="display">
            Welcome to Free
            <Txt variant="display" color="accent">
              Mentor
            </Txt>
          </Txt>
          <Txt variant="body" color="secondary">
            Sign in so your roadmap, your ticks and your streak are safe — and come back
            if you change phone.
          </Txt>

          <Card style={{ marginTop: theme.spacing.lg }}>
            <Txt variant="caption" color="secondary">
              WHAT WE TAKE FROM GOOGLE
            </Txt>
            <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
              <Txt variant="small">· Your name and email</Txt>
              <Txt variant="small">· Nothing else — no contacts, no files, no calendar</Txt>
            </View>
          </Card>
        </View>

        {error ? (
          <Card>
            <Txt variant="bodyStrong" color="danger">
              Sign-in failed
            </Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
              {error}
            </Txt>
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={busy ? 'Opening Google…' : 'Continue with Google'}
            onPress={() => void onSignIn()}
            loading={busy}
          />
          <Txt variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            By continuing you agree to our Terms and Privacy Policy.
          </Txt>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: theme.spacing.lg,
            }}
          >
            <Button
              label="Privacy Policy"
              variant="ghost"
              compact
              onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_URL)}
            />
            <Button
              label="Terms"
              variant="ghost"
              compact
              onPress={() => void WebBrowser.openBrowserAsync(TERMS_URL)}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
