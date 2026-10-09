/**
 * Rule 3 (APP_BUILD_SPEC §4, product plan decision #16):
 *   shown video time = real duration x 1.15, rounded UP to the nearest 5 min.
 *
 * Until tools/check_links.py fills `duration_seconds` from the YouTube Data
 * API, every video in the library has `duration_seconds: null` — so we fall
 * back to the library's own `est_minutes`, which is ALREADY a planning
 * estimate and must not be inflated a second time.
 */
import type { Block, Resource, SchedulerHints } from '@freementor/shared';

export function roundUpTo(minutes: number, step: number): number {
  if (step <= 0) return Math.ceil(minutes);
  return Math.ceil(minutes / step) * step;
}

/**
 * Minutes to show for one video. `duration_seconds` is the real length; the
 * +15% covers pausing, rewinding and note-taking.
 */
export function videoMinutes(resource: Resource, hints: SchedulerHints): number {
  if (typeof resource.duration_seconds === 'number' && resource.duration_seconds > 0) {
    const real = resource.duration_seconds / 60;
    return roundUpTo(real * hints.video_time_multiplier, hints.round_up_to_minutes);
  }
  // No verified duration yet: trust the library's estimate as-is.
  return resource.est_minutes ?? 0;
}

/** The resource a learner is steered to, honouring their language choice. */
export function primaryResource(block: Block, lang: 'en' | 'hi' | 'hi-en'): Resource | undefined {
  const wanted = lang === 'hi' ? 'hi' : 'en';
  return (
    block.resources.find((r) => r.role?.startsWith('main') && r.lang === wanted) ??
    block.resources.find((r) => r.role?.startsWith('main')) ??
    block.resources.find((r) => r.lang === wanted) ??
    block.resources[0]
  );
}

/**
 * Scheduled minutes for a block. For `learn` blocks this is driven by the
 * video; every other type uses the library's `est_minutes` directly.
 */
export function blockMinutes(
  block: Block,
  hints: SchedulerHints,
  lang: 'en' | 'hi' | 'hi-en' = 'en',
): number {
  if (block.type !== 'learn') return block.est_minutes;

  const video = primaryResource(block, lang);
  if (!video || video.type !== 'video') return block.est_minutes;

  const fromVideo = videoMinutes(video, hints);
  // A block can carry more than the video (e.g. "watch both parts"); never
  // schedule less than the library asked for.
  return Math.max(fromVideo, block.est_minutes);
}

/**
 * Splits a long block into focus blocks (25 min) separated by 5-min breaks,
 * for display in the Day view. Breaks are not counted as study time.
 */
export function focusSegments(
  minutes: number,
  hints: SchedulerHints,
): { focus: number; breakAfter: number }[] {
  const { focus_block_minutes: focus, break_minutes: brk } = hints;
  if (minutes <= focus) return [{ focus: minutes, breakAfter: 0 }];

  const out: { focus: number; breakAfter: number }[] = [];
  let left = minutes;
  while (left > 0) {
    const chunk = Math.min(focus, left);
    left -= chunk;
    out.push({ focus: chunk, breakAfter: left > 0 ? brk : 0 });
  }
  return out;
}
