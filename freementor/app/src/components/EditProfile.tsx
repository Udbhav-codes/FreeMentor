/**
 * Editing your personal details — product plan §8.9.
 *
 * Photo, name, "currently" (qualification) and language. Nothing saves until
 * the learner says so: the photo is confirmed with Done, the rest with Save.
 * Silent auto-save left people unsure whether anything had happened, which is
 * the opposite of the trust this screen needs.
 *
 * The qualification options come from the learner's own goal in the catalog,
 * so a JEE aspirant sees "Class 11 / Class 12 / Dropper" while a CAT aspirant
 * sees "Final-year student / Graduate / Working professional".
 *
 * §15 keeps all of it on the device until the backend exists.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, TextInput, View } from 'react-native';
import type { CatalogGoal } from '@freementor/shared';
import { Avatar } from './Avatar.tsx';
import { Button, Card, Pill, Txt } from './ui.tsx';
import { deletePhotoFile, pickProfilePhoto } from '../profile/photo.ts';
import type { Profile } from '../db/profile.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

const LANGUAGES = [
  ['en', 'English'],
  ['hi', 'हिंदी'],
  ['hi-en', 'Hinglish (both)'],
] as const;

type Language = (typeof LANGUAGES)[number][0];

export function EditProfile({
  profile,
  goal,
  onChange,
}: {
  profile: Profile | null;
  /** The learner's current goal, for its qualification options. */
  goal: CatalogGoal | null;
  onChange: (patch: Partial<Profile>) => Promise<void>;
}) {
  const theme = useTheme();

  // --- the photo, confirmed separately with Done ------------------------
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kept in a ref so the unmount cleanup sees the latest value.
  const pendingRef = useRef<string | null>(null);
  pendingRef.current = pendingPhoto;

  // A photo picked but never confirmed is already a file on disk. Clean it up
  // rather than leaving an orphan behind when the learner walks away.
  useEffect(
    () => () => {
      if (pendingRef.current) deletePhotoFile(pendingRef.current);
    },
    [],
  );

  // --- the text and choice fields, confirmed with Save -------------------
  const [name, setName] = useState(profile?.name ?? '');
  const [qualification, setQualification] = useState<string | null>(
    profile?.qualification ?? null,
  );
  const [language, setLanguage] = useState<Language>((profile?.language as Language) ?? 'en');
  const [saved, setSaved] = useState(false);

  // Re-sync when the stored profile changes underneath us (first load, reset).
  useEffect(() => {
    setName(profile?.name ?? '');
    setQualification(profile?.qualification ?? null);
    setLanguage((profile?.language as Language) ?? 'en');
  }, [profile?.name, profile?.qualification, profile?.language]);

  const detailsDirty =
    (name.trim() || null) !== (profile?.name ?? null) ||
    qualification !== (profile?.qualification ?? null) ||
    language !== ((profile?.language as Language) ?? 'en');

  const pickPhoto = useCallback(async () => {
    setBusy(true);
    try {
      // Replace an earlier unconfirmed pick rather than stacking files up.
      const result = await pickProfilePhoto(pendingPhoto);
      if (result.ok) {
        setPendingPhoto(result.uri);
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
  }, [pendingPhoto]);

  const confirmPhoto = useCallback(async () => {
    if (!pendingPhoto) return;
    const previous = profile?.photoUri;
    await onChange({ photoUri: pendingPhoto });
    setPendingPhoto(null);
    // Only now is the old one safe to remove.
    deletePhotoFile(previous);
  }, [pendingPhoto, profile?.photoUri, onChange]);

  const cancelPhoto = useCallback(() => {
    deletePhotoFile(pendingPhoto);
    setPendingPhoto(null);
  }, [pendingPhoto]);

  const removePhoto = useCallback(() => {
    Alert.alert('Remove your photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const previous = profile?.photoUri;
          await onChange({ photoUri: null });
          deletePhotoFile(previous);
        },
      },
    ]);
  }, [profile?.photoUri, onChange]);

  const saveDetails = useCallback(async () => {
    await onChange({
      name: name.trim() || null,
      qualification,
      language,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [name, qualification, language, onChange]);

  const qualifications = goal?.qualification_options ?? [];
  const shownPhoto = pendingPhoto ?? profile?.photoUri;

  return (
    <Card>
      <Txt variant="heading">Your details</Txt>

      {/* --- photo --- */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.lg,
          marginTop: theme.spacing.lg,
        }}
      >
        <Avatar
          uri={shownPhoto}
          name={profile?.name}
          size={72}
          onPress={busy ? undefined : () => void pickPhoto()}
        />

        <View style={{ flex: 1, gap: theme.spacing.sm }}>
          {pendingPhoto ? (
            <>
              <Pill tone="accent">New photo — not saved yet</Pill>
              <Button compact label="Done" onPress={() => void confirmPhoto()} />
              <Button compact label="Cancel" variant="ghost" onPress={cancelPhoto} />
            </>
          ) : (
            <>
              <Button
                compact
                label={busy ? 'Opening…' : profile?.photoUri ? 'Change photo' : 'Add a photo'}
                variant="secondary"
                onPress={() => void pickPhoto()}
                disabled={busy}
              />
              {profile?.photoUri ? (
                <Button compact label="Remove photo" variant="ghost" onPress={removePhoto} />
              ) : (
                <Txt variant="caption" color="secondary">
                  Optional. Stays on your device.
                </Txt>
              )}
            </>
          )}
        </View>

        {busy ? <ActivityIndicator color={theme.colors.primary} /> : null}
      </View>

      {/* --- name --- */}
      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Txt variant="caption" color="secondary">
          NAME
        </Txt>
        <TextInput
          value={name}
          onChangeText={setName}
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

      {/* --- currently --- */}
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
                variant={qualification === option ? 'primary' : 'secondary'}
                onPress={() => setQualification(option)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* --- language --- */}
      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Txt variant="caption" color="secondary">
          LANGUAGE
        </Txt>
        <View style={{ gap: theme.spacing.sm }}>
          {LANGUAGES.map(([value, label]) => (
            <Button
              key={value}
              label={label}
              variant={language === value ? 'primary' : 'secondary'}
              onPress={() => setLanguage(value)}
            />
          ))}
        </View>
        <Txt variant="caption" color="secondary">
          Picks your videos and notes where both exist. The app's own text is English for
          now.
        </Txt>
      </View>

      {/* --- save --- */}
      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
        <Button
          label={saved && !detailsDirty ? 'Saved ✓' : 'Save changes'}
          onPress={() => void saveDetails()}
          disabled={!detailsDirty}
        />
        {detailsDirty ? (
          <Txt variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            You have unsaved changes.
          </Txt>
        ) : null}
      </View>
    </Card>
  );
}
