/**
 * Opening a resource.
 *
 * Product rules this enforces, from CLAUDE.md and the product plan §9.1:
 *   - Videos play in YouTube's own embedded player on the Day view
 *     (components/YouTubeEmbed.tsx); this link is the fallback, opening the
 *     YouTube app. Never re-hosted, never scraped.
 *   - Notes and practice open in a Chrome Custom Tab (expo-web-browser).
 *   - Gating is decided ONLY by billing/entitlement.ts, which guarantees
 *     YouTube content is never behind an ad or a paywall on any plan (YouTube
 *     API Services Developer Policies III.F.3.2).
 *   - On the Day view, a task's dropdown is unlocked as a whole by one ad
 *     (ads/dropdownUnlock.ts) and passes `unlocked`. Elsewhere (the Practice
 *     tab) an ad-gated link asks for its own ad.
 */
import { useCallback } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import type { Resource } from '@freementor/shared';
import { Pill, Txt } from './ui.tsx';
import { accessFor } from '../billing/entitlement.ts';
import { noteRewarded, windowOpen } from '../ads/cap.ts';
import { askForAd } from '../ads/askForAd.ts';
import { useEntitlement } from '../billing/useEntitlement.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';
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

export function ResourceLink({
  resource,
  unlocked = false,
}: {
  resource: Resource;
  /** The task dropdown holding this link was unlocked by a watched ad. */
  unlocked?: boolean;
}) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  // A library file could carry a resource type we do not know yet; a link
  // with an odd label is far better than a crashed screen.
  const label = LABELS[resource.type] ?? 'Open link';
  const { entitlement } = useEntitlement();
  const decided = accessFor(resource, entitlement);
  const access = unlocked && decided.kind === 'ad_gated' ? { kind: 'open' as const } : decided;
  const broken = resource.status === 'broken';

  // Both of these are "you cannot open this yet, here is where to fix that".
  const locked = access.kind === 'premium_only' || access.kind === 'needs_plan';

  const onPress = useCallback(() => {
    if (access.kind === 'premium_only' || access.kind === 'needs_plan') {
      router.push('/plans');
      return;
    }
    if (access.kind === 'ad_gated') {
      // §10.2: at most one rewarded unlock per ten minutes. Inside the window
      // a completed ad still covers this open, so a video and its notes cost
      // one ad, not two.
      if (windowOpen()) {
        openResource(resource).catch(() =>
          reportFailure(t('dialog.linkFailedTitle'), t('dialog.linkFailedBody')),
        );
        return;
      }
      // A user-initiated rewarded ad (ads/askForAd.ts), on the tap that
      // opens a resource — never auto-playing, never during study.
      void (async () => {
        const result = await askForAd({
          title: t('dialog.adGateTitle'),
          body: t('dialog.adGateBody'),
          notLiveBody: t('dialog.adGateNotLive'),
          watch: t('dialog.adGateWatch'),
          openWithoutAd: t('day.openLink'),
          cancel: t('common.cancel'),
        });
        if (result === 'declined') return;
        // Only a watched ad opens the window; an unavailable one showed
        // nothing, so it must not suppress the next real ad.
        if (result === 'rewarded') noteRewarded();
        await openResource(resource).catch(() =>
          reportFailure(t('dialog.linkFailedTitle'), t('dialog.linkFailedBody')),
        );
      })();
      return;
    }
    openResource(resource).catch(() =>
      reportFailure(t('dialog.linkFailedTitle'), t('dialog.linkFailedBody')),
    );
  }, [access.kind, resource, router]);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={
        access.kind === 'premium_only'
          ? `${resource.title}. Premium only.`
          : access.kind === 'needs_plan'
            ? `${resource.title}. Locked — needs a plan.`
            : `${label}: ${resource.title}`
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
          color={locked ? 'secondary' : 'primary'}
          numberOfLines={2}
        >
          {locked ? resource.title : label}
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
      ) : access.kind === 'needs_plan' ? (
        <Pill tone="accent">Locked</Pill>
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

function reportFailure(title: string, body: string) {
  Alert.alert(title, body);
}
