/**
 * Edit your details — opened from the "Your details" card on Profile.
 *
 * Name, photo, year of birth, "currently" and language. The form itself is
 * components/EditProfile.tsx; this screen gives it room of its own instead of
 * sitting open at the top of Profile.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Screen, Txt } from '../components/ui.tsx';
import { EditProfile } from '../components/EditProfile.tsx';
import { catalog } from '../api/library.ts';
import { loadProfile, saveProfile, type Profile } from '../db/profile.ts';
import { useEnrollment } from '../state/EnrollmentContext.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';

export default function EditProfileScreen() {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { goal } = useEnrollment();
  const [profile, setProfile] = useState<Profile | null>(null);
  const catalogEntry = goal ? (catalog.goals.find((g) => g.id === goal.goal.id) ?? null) : null;

  useEffect(() => {
    loadProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  const update = useCallback(async (patch: Partial<Profile>) => {
    await saveProfile(patch);
    setProfile(await loadProfile());
  }, []);

  return (
    <Screen>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: theme.spacing.screen,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: insets.bottom + theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ gap: theme.spacing.xs }}>
          <Button
            label="←"
            variant="ghost"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 40 }}
          />
          <Txt variant="display">{t('editProfile.title')}</Txt>
        </View>
        <EditProfile profile={profile} goal={catalogEntry} onChange={update} />
      </ScrollView>
    </Screen>
  );
}
