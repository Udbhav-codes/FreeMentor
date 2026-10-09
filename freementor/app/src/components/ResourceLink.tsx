/**
 * Opening a resource.
 *
 * Product rules this enforces, from CLAUDE.md and the product plan §9.1:
 *   - Videos open in the YouTube app (web as a fallback). We link, never
 *     embed, never re-host, never scrape.
 *   - Notes and practice open in a Chrome Custom Tab (expo-web-browser).
 *   - Gating is decided ONLY by billing/entitlement.ts, which guarantees a
 *     video is never behind an ad or a paywall on any plan. That is a YouTube
 *     API Services policy requirement.
 */
import { useCallback } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import type { Resource } from '@freementor/shared';
import { Pill, Txt } from './ui.tsx';
import { accessFor, currentEntitlement } from '../billing/entitlement.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';

export async function openResource(resource: Resource): Promise<void> {
  if (resource.type === 'video') {
    // Prefer the installed YouTube app; fall back to the browser.
    const appUrl = resource.youtube_id ? `vnd.youtube://${resource.youtube_id}` : resource.url;
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
  const router = useRouter();
  // A library file could carry a resource type we do not know yet; a link
  // with an odd label is far better than a crashed screen.
  const label = LABELS[resource.type] ?? 'Open link';
  const access = accessFor(resource, currentEntitlement());
  const broken = resource.status === 'broken';

  const onPress = useCallback(() => {
    if (access.kind === 'premium_only') {
      router.push('/plans');
      return;
    }
    if (access.kind === 'ad_gated') {
      // M6 shows a user-initiated rewarded ad here. Never auto-playing, never
      // during a video, a test or the checklist itself (§10.2).
      Alert.alert(
        'Watch a short ad to open this?',
        'Ads arrive with the next milestone. For now this opens directly.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open', onPress: () => void openResource(resource).catch(reportFailure) },
        ],
      );
      return;
    }
    openResource(resource).catch(reportFailure);
  }, [access.kind, resource, router]);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={
        access.kind === 'premium_only' ? `${resource.title}. Premium only.` : `${label}: ${resource.title}`
      }
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
      <View style={{ flex: 1, gap: 2 }}>
        <Txt
          variant="bodyStrong"
          color={access.kind === 'premium_only' ? 'secondary' : 'primary'}
          numberOfLines={2}
        >
          {access.kind === 'premium_only' ? resource.title : label}
        </Txt>
        <Txt variant="caption" color="secondary" numberOfLines={2}>
          {[
            resource.channel ?? resource.provider,
            resource.lang === 'hi' ? 'हिंदी' : null,
            resource.role === 'alternative' ? 'alternative' : null,
            broken ? 'link reported broken' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Txt>
      </View>

      {access.kind === 'premium_only' ? (
        <Pill tone="accent">Premium</Pill>
      ) : access.kind === 'ad_gated' ? (
        <Pill>Watch an ad</Pill>
      ) : (
        <Txt variant="caption" color="secondary">
          ↗
        </Txt>
      )}
    </Pressable>
  );
}

function reportFailure() {
  Alert.alert('Could not open this link', 'Check your connection and try again.');
}
