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
import { accessFor } from '../billing/entitlement.ts';
import { useEntitlement } from '../billing/useEntitlement.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';
import { useT } from '../i18n/LanguageProvider.tsx';
import { MIN_TOUCH_TARGET } from '../theme/tokens.ts';
import {
  ageFromBirthYear,
  getRewardedAds,
  grantsAccess,
  requestOptionsFor,
  type Outcome,
} from '../ads/rewarded.ts';
import { loadProfile } from '../db/profile.ts';

// One instance for the module. The stub is stateless; the real one will hold
// a loaded ad, which is exactly the thing worth reusing across taps.
const ads = getRewardedAds();

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
  const t = useT();
  const router = useRouter();
  // A library file could carry a resource type we do not know yet; a link
  // with an odd label is far better than a crashed screen.
  const label = LABELS[resource.type] ?? 'Open link';
  const { entitlement } = useEntitlement();
  const access = accessFor(resource, entitlement);
  const broken = resource.status === 'broken';

  // Both of these are "you cannot open this yet, here is where to fix that".
  const locked = access.kind === 'premium_only' || access.kind === 'needs_plan';

  const onPress = useCallback(() => {
    if (access.kind === 'premium_only' || access.kind === 'needs_plan') {
      router.push('/plans');
      return;
    }
    if (access.kind === 'ad_gated') {
      // A user-initiated rewarded ad. Never auto-playing, never during a
      // video, a test or the checklist itself (§10.2) — this runs before
      // study starts, on the tap that opens a resource.
      //
      // `ads.available` is false until there is an AdMob account and a
      // development build, and the dialog says so rather than implying an ad
      // was shown. The ad path itself is live either way: the stub resolves
      // `unavailable`, which is the same branch a real no-fill takes.
      Alert.alert(
        t('dialog.adGateTitle'),
        ads.available ? t('dialog.adGateBody') : t('dialog.adGateNotLive'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: ads.available ? t('dialog.adGateWatch') : t('day.openLink'),
            onPress: () => {
              void (async () => {
                // Loaded here rather than per render: ResourceLink appears
                // once per resource, and the age is only needed on the tap
                // that actually asks for an ad.
                const age = ageFromBirthYear((await loadProfile())?.birthYear ?? null);
                let outcome: Outcome;
                try {
                  outcome = await ads.show(requestOptionsFor(age));
                } catch (error) {
                  // A build that names an ad unit but cannot show one. The
                  // learner is not held responsible for our misconfiguration.
                  outcome = {
                    kind: 'unavailable',
                    reason: error instanceof Error ? error.message : 'ad failed',
                  };
                }
                // A dismissed ad opens nothing; everything else does. See
                // ads/rewarded.ts for why a failure still grants access.
                if (!grantsAccess(outcome)) return;
                await openResource(resource).catch(() =>
                  reportFailure(t('dialog.linkFailedTitle'), t('dialog.linkFailedBody')),
                );
              })();
            },
          },
        ],
      );
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
            ? `${resource.title}. Locked — your free trial has ended.`
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
