/**
 * The circular profile picture — shown beside the greeting on Home and at the
 * top of Profile.
 *
 * Falls back to the learner's initials, then to a neutral glyph. A photo is
 * optional (§8.9) and plenty of people will never set one, so the fallback
 * has to look deliberate rather than broken.
 */
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Txt } from './ui.tsx';
import { initialsFrom } from '../profile/initials.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

export function Avatar({
  uri,
  name,
  size = 44,
  onPress,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  // A stored file can go missing (restore, manual delete) — fall back rather
  // than leaving a blank circle.
  const [failed, setFailed] = useState(false);
  const initials = initialsFrom(name);
  const showPhoto = Boolean(uri) && !failed;

  const body = (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {showPhoto ? (
        <Image
          source={{ uri: uri! }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Txt
          variant="bodyStrong"
          color="onPrimary"
          style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.46) }}
        >
          {initials || '☻'}
        </Txt>
      )}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}
