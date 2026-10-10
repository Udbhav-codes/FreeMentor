/**
 * Resolving a PlannedItem back to the library content behind it.
 *
 * The scheduler deliberately carries only ids and minutes so it stays cheap
 * and serialisable; the Day view needs the actual block, its resources and
 * its topic, which is what these do.
 */
import type { Block, GoalFile, Milestone, Resource, Topic } from '@freementor/shared';
import { isoWeekKey } from './dates.ts';
import { primaryResource, videoMinutes } from './time.ts';
import type { PlannedItem } from './types.ts';

export interface GoalIndex {
  topics: Map<string, Topic>;
  blocks: Map<string, { block: Block; topic: Topic }>;
  milestones: Map<string, Milestone>;
  phases: Map<number, string>;
}

/** Built once per goal and reused; O(n) over a file that can hold 700 blocks. */
export function indexGoal(goal: GoalFile): GoalIndex {
  const topics = new Map<string, Topic>();
  const blocks = new Map<string, { block: Block; topic: Topic }>();
  for (const topic of goal.topics) {
    topics.set(topic.id, topic);
    for (const block of topic.blocks) blocks.set(block.id, { block, topic });
  }
  return {
    topics,
    blocks,
    milestones: new Map(goal.milestones.map((m) => [m.id, m])),
    phases: new Map(goal.phases.map((p) => [p.order, p.name])),
  };
}

export interface ResolvedItem {
  item: PlannedItem;
  topic?: Topic;
  block?: Block;
  milestone?: Milestone;
  resources: Resource[];
  /** "52 min video -> shown as 60 min", when we know the real duration. */
  videoNote?: string;
}

export function resolveItem(
  item: PlannedItem,
  goal: GoalFile,
  index: GoalIndex,
  lang: 'en' | 'hi' | 'hi-en' = 'en',
): ResolvedItem {
  // A weekly test draws on the topics the learner covered that week.
  if (item.source === 'weekly_test') {
    const resources = (item.coversTopicIds ?? [])
      .map((id) => index.topics.get(id))
      .filter((t): t is Topic => Boolean(t))
      .flatMap((t) => t.blocks.flatMap((b) => b.resources))
      .filter((r) => r.type === 'test' || r.type === 'practice');
    // De-duplicate: the same PYQ set often serves several topics.
    return { item, resources: [...new Map(resources.map((r) => [r.url, r])).values()].slice(0, 6) };
  }

  if (item.milestoneId) {
    const milestone = index.milestones.get(item.milestoneId);
    return { item, milestone, resources: milestone?.resources ?? [] };
  }

  // Reviews, warm-ups and the weekly test have no block of their own; they
  // point at a topic, whose own resources are the right thing to reopen.
  const found = item.blockId ? index.blocks.get(item.blockId) : undefined;
  const topic = found?.topic ?? (item.topicId ? index.topics.get(item.topicId) : undefined);

  if (!found) {
    return { item, topic, resources: revisionResources(topic, lang) };
  }

  const { block } = found;
  let videoNote: string | undefined;
  if (block.type === 'learn') {
    const video = primaryResource(block, lang);
    if (video?.type === 'video' && video.duration_seconds) {
      const real = Math.round(video.duration_seconds / 60);
      const shown = videoMinutes(video, goal.scheduler_hints);
      videoNote = `${real} min video · shown as ${shown} min`;
    }
  }

  return { item, topic, block, resources: block.resources, videoNote };
}

/**
 * For a revision visit, surface the topic's notes and practice rather than
 * the full lecture — the learner has already watched it once.
 */
function revisionResources(topic: Topic | undefined, lang: string): Resource[] {
  if (!topic) return [];
  const all = topic.blocks.flatMap((b) => b.resources);
  const preferred = all.filter((r) => r.type === 'notes' || r.type === 'practice');
  const list = preferred.length > 0 ? preferred : all;
  return list.filter((r) => r.lang === lang || r.lang === 'en').slice(0, 3);
}


/**
 * "Week 9 · Day 3" — the Day view's breadcrumb. Weeks are counted from the
 * first day of the plan, and the day number is its position inside that week,
 * which is how a learner talks about their own schedule.
 */
export function weekAndDay(
  days: { date: string }[],
  date: string,
): { week: number; day: number } | null {
  const sorted = [...days].map((d) => d.date).sort();
  if (!sorted.includes(date)) return null;

  const weeks: string[] = [];
  let week = 0;
  let day = 0;

  for (const d of sorted) {
    const key = isoWeekKeyOf(d);
    if (weeks[weeks.length - 1] !== key) {
      weeks.push(key);
      day = 0;
    }
    day += 1;
    if (d === date) {
      week = weeks.length;
      break;
    }
  }
  return { week, day };
}

function isoWeekKeyOf(date: string): string {
  // Re-exported from dates.ts; kept local so lookup.ts has no cycle.
  return isoWeekKey(date);
}
