/**
 * Editing your personal details — product plan §8.9.
 *
 * Photo, name, "currently" (qualification) and language, all editable in
 * place. The qualification options come from the learner's own goal in the
 * catalog, so a JEE aspirant sees "Class 11 / Class 12 / Dropper" while a CAT
 * aspirant sees "Final-year student / Graduate / Working professional".
 *
 * Everything saves as you change it — no "Save" button to forget. §15 keeps
 * all of it on the device until the backend exists.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import type { CatalogGoal } from '@freementor/shared';
import { Avatar } from './Avatar.tsx';
import { Button, Card, Txt } from './ui.tsx';
import { deletePhotoFile, pickProfilePhoto } from '../profile/photo.ts';
import type { Profile } from '../db/profile.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['hi-en', 'Hinglish (both)'],
] as const;

export function EditProfile({
  profile,
  goal,
  onChange,
}: {
  profile: Profile | null;
  /** The learner's current goal, for its qualification options. */
  goal: CatalogGoal | null;
  onChange: (patch: Partial<Profile>) => Promise<void> | void;
}) {
  const theme = useTheme();
  const [name, setName] = useState(profile?.name ?? '');
  const [busy, setBusy] = useState(false);

  const changePhoto = useCallback(async () => {
    setBusy(true);
    try {
      const result = await pickProfilePhoto(profile?.photoUri);
      if (result.ok) {
        await onChange({ photoUri: result.uri });
        return;
      }
      if (result.reason === 'permission_denied') {
        Alert.alert(
          'Photo access is off',
          'FreeMentor needs permission to open your gallery. You can turn it on in Android settings — or skip the photo, it is optional.',
        );
      } else if (result.reason === 'failed') {
        Alert.alert('Could not set that photo', 'Try another image.');
      }
    } finally {
      setBusy(false);
    }
  }, [profile?.photoUri, onChange]);

  const removePhoto = useCallback(() => {
    Alert.alert('Remove your photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          deletePhotoFile(profile?.photoUri);
          await onChange({ photoUri: null });
        },
      },
    ]);
  }, [profile?.photoUri, onChange]);

  const qualifications = goal?.qualification_options ?? [];

  return (
    <Card>
      <Txt variant="heading">Your details</Txt>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          marginTop: theme.spacing.lg,
        }}
      >
        <Avatar uri={profile?.photoUri} name={profile?.name} size={72} onPress={changePhoto} />
        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          <Button
            compact
            label={busy ? 'Opening…' : profile?.photoUri ? 'Change photo' : 'Add a photo'}
            variant="secondary"
            onPress={() => void changePhoto()}
            disabled={busy}
          />
          {profile?.photoUri ? (
            <Button compact label="Remove photo" variant="ghost" onPress={removePhoto} />
          ) : (
            <Txt variant="caption" color="secondary">
              Optional. Stays on your device.
            </Txt>
          )}
        </View>
        {busy ? <ActivityIndicator color={theme.colors.primary} /> : null}
      </View>

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Txt variant="caption" color="secondary">
          NAME
        </Txt>
        <TextInput
          value={name}
          onChangeText={setName}
          // Saved when the field loses focus, so we are not writing to SQLite
          // on every keystroke.
          onEndEditing={() => void onChange({ name: name.trim() || null })}
          onBlur={() => void onChange({ name: name.trim() || null })}
          placeholder="What should we call you?"
          placeholderTextColor={theme.colors.muted}
          returnKeyType="done"
          style={[
            theme.typography.body,
            {
              minHeight: MIN_TOUCH_TARGET,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
            },
          ]}
        />
      </View>

      {qualifications.length > 0 ? (
        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          <Txt variant="caption" color="secondary">
            CURRENTLY
          </Txt>
          <View style={{ gap: theme.spacing.sm }}>
            {qualifications.map((option) => (
              <Button
                key={option}
                label={option}
                variant={profile?.qualification === option ? 'primary' : 'secondary'}
                onPress={() => void onChange({ qualification: option })}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Txt variant="caption" color="secondary">
          LANGUAGE
        </Txt>
        <View style={{ gap: theme.spacing.sm }}>
          {LANGUAGES.map(([value, label]) => (
            <Button
              key={value}
              label={label}
              variant={(profile?.language ?? 'en') === value ? 'primary' : 'secondary'}
              onPress={() => void onChange({ language: value })}
            />
          ))}
        </View>
        <Txt variant="caption" color="secondary">
          Picks your videos and notes where both exist. The app's own text is English for
          now.
        </Txt>
      </View>
    </Card>
  );
}
