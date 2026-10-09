/**
 * The lesson card at the top of the Day view — screen 5 of the preview.
 *
 * Shows the honest video arithmetic ("52 min video → shown as 60 min") so the
 * learner understands why the plan reserves more time than the video's own
 * length. That extra 15% is for pausing, rewinding and taking notes.
 *
 * The thumbnail is a plain navy tile with a play glyph, NOT a YouTube
 * thumbnail image: embedding or re-hosting YouTube imagery pulls us into
 * territory the product plan explicitly avoids (§9.1 — we link, we don't
 * host). Tapping opens the YouTube app.
 */
import { Pressable, View } from 'react-native';
import { Txt } from './ui.tsx';
import { openResource, ResourceLink } from './ResourceLink.tsx';
import type { resolveItem } from '../scheduler/lookup.ts';
import { useTheme } from '../theme/ThemeProvider.tsx';

export function VideoCard({ resolved }: { resolved: ReturnType<typeof resolveItem> }) {
  const theme = useTheme();
  const video = resolved.resources.find((r) => r.type === 'video');
  if (!video) return null;

  const others = resolved.resources.filter((r) => r !== video && r.type === 'video');

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        theme.elevation,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${video.title} in YouTube`}
          onPress={() => void openResource(video).catch(() => undefined)}
          style={({ pressed }) => ({
            width: 64,
            height: 56,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Txt variant="title" color="onPrimary">
            ▶
          </Txt>
        </Pressable>

        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong" numberOfLines={2}>
            {video.title}
          </Txt>
          <Txt variant="caption" color="secondary">
            {video.channel ?? video.provider}
            {video.lang === 'hi' ? ' · हिंदी' : ''}
          </Txt>
        </View>
      </View>

      {resolved.videoNote ? (
        <Txt variant="caption" color="secondary">
          {resolved.videoNote} — the extra time is for pausing and notes.
        </Txt>
      ) : (
        <Txt variant="caption" color="secondary">
          About {resolved.item.minutes} min, including time to pause and take notes.
        </Txt>
      )}

      <ResourceLink resource={video} />

      {others.length > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Txt variant="caption" color="secondary">
            PREFER A DIFFERENT TEACHER?
          </Txt>
          {others.map((alt) => (
            <ResourceLink key={alt.url} resource={alt} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
