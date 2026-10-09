/**
 * Opening a resource.
 *
 * Product rules this enforces, from CLAUDE.md and the product plan §9.1:
 *   - Videos open in the YouTube app (web as a fallback). We link, never
 *     embed, never re-host, never scrape.
 *   - Notes and practice open in a Chrome Custom Tab (expo-web-browser).
 *   - A video is NEVER behind an ad gate or a paywall, on any plan. That is a
 *     YouTube API Services policy requirement, not a product preference, so it
 *     is asserted here rather than left to the caller.
 */
import { useCallback } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Resource } from '@freementor/shared';
import { Txt } from './ui.tsx';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

/** True when a resource may be put behind a rewarded ad for Basic users. */
export function canAdGate(resource: Resource): boolean {
  // Videos are never gateable, whatever the library file says.
  if (resource.type === 'video') return false;
  return resource.ad_gate_allowed === true;
}

/** True when a resource is Premium-only. Never true for a video. */
export function isPremiumOnly(resource: Resource): boolean {
  if (resource.type === 'video') return false;
  return resource.access === 'premium';
}

export async function openResource(resource: Resource): Promise<void> {
  if (resource.type === 'video') {
    // Prefer the installed YouTube app; fall back to the browser.
    const appUrl = resource.youtube_id
      ? `vnd.youtube://${resource.youtube_id}`
      : resource.url;
    try {
      if (resource.youtube_id && (await Linking.canOpenURL(appUrl))) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      // canOpenURL can throw on some Android configurations; fall through.
    }
    await Linking.openURL(resource.url);
    return;
  }

  // Notes, practice and tests: Chrome Custom Tab, so the learner stays in
  // context and comes straight back to their checklist.
  await WebBrowser.openBrowserAsync(resource.url, { enableBarCollapsing: true });
}

const LABELS: Record<Resource['type'], string> = {
  video: 'Open in YouTube',
  notes: 'Open notes',
  practice: 'Open practice',
  test: 'Open test',
};

export function ResourceLink({ resource }: { resource: Resource }) {
  const theme = useTheme();

  const onPress = useCallback(() => {
    openResource(resource).catch(() =>
      Alert.alert('Could not open this link', 'Check your connection and try again.'),
    );
  }, [resource]);

  const broken = resource.status === 'broken';

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${LABELS[resource.type]}: ${resource.title}`}
      disabled={broken}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH_TARGET,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.background : 'transparent',
        opacity: broken ? 0.45 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color="primary" numberOfLines={2}>
          {LABELS[resource.type]}
        </Txt>
        <Txt variant="caption" color="secondary" numberOfLines={2}>
          {resource.channel ?? resource.provider}
          {resource.lang === 'hi' ? ' · हिंदी' : ''}
          {resource.role === 'alternative' ? ' · alternative' : ''}
        </Txt>
      </View>
      <Txt variant="caption" color="secondary">
        ↗
      </Txt>
    </Pressable>
  );
}
