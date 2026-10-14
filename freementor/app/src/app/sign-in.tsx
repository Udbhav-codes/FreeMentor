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
import { BrandText } from '../components/BrandText.tsx';
import { useAuth } from '../auth/AuthContext.tsx';
import { devBypassAllowed } from '../auth/devBypass.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';

const PRIVACY_URL = 'https://freementor.app/privacy';
const TERMS_URL = 'https://freementor.app/terms';

export default function SignIn() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, skipSignInForDev } = useAuth();

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
          <BrandText>{t('signIn.title')}</BrandText>
          <Txt variant="body" color="secondary">
            {t('signIn.body')}
          </Txt>

          <Card style={{ marginTop: theme.spacing.lg }}>
            <Txt variant="caption" color="secondary">
              {t('signIn.whatWeTake')}
            </Txt>
            <View style={{ marginTop: theme.spacing.sm, gap: 4 }}>
              <Txt variant="small">{t('signIn.takeName')}</Txt>
              <Txt variant="small">{t('signIn.takeNothingElse')}</Txt>
            </View>
          </Card>
        </View>

        {error ? (
          <Card>
            <Txt variant="bodyStrong" color="danger">
              {t('signIn.failed')}
            </Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: 4 }}>
              {error}
            </Txt>
            {devBypassAllowed ? (
              <Txt variant="caption" color="secondary" style={{ marginTop: theme.spacing.sm }}>
                "This site can't be reached" usually means `exp://**` is missing from
                Supabase → Authentication → URL Configuration → Redirect URLs.
              </Txt>
            ) : null}
          </Card>
        ) : null}

        {/* Development only. devBypassAllowed is __DEV__ AND an explicit
            EXPO_PUBLIC_DEV_SKIP_AUTH=1, so this cannot render in a release
            build even if the env var is left set somewhere. */}
        {devBypassAllowed ? (
          <Card>
            <Txt variant="caption" color="danger">
              DEV ONLY — NOT IN A RELEASE BUILD
            </Txt>
            <Txt variant="small" color="secondary" style={{ marginTop: theme.spacing.sm }}>
              Skips Google and continues with no account. Nothing syncs — progress
              stays on this phone — and this button does not exist in a release
              build.
            </Txt>
            <Button
              label="Skip sign-in and continue"
              variant="secondary"
              onPress={() => {
                void skipSignInForDev().then(() => router.replace('/onboarding'));
              }}
              style={{ marginTop: theme.spacing.md }}
            />
          </Card>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={busy ? t('signIn.opening') : t('signIn.button')}
            onPress={() => void onSignIn()}
            loading={busy}
          />
          <Txt variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            {t('signIn.terms')}
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
