/**
 * Rule 2 — a topic becomes an ordered list of tickable items:
 *   learn -> read -> practice -> recall -> test
 * A `project` topic is a `build` block (hours) plus its recall.
 *
 * Minutes come from time.ts, so the +15% video rule is applied exactly once,
 * here, and every downstream total inherits it.
 */
import type { Milestone, Topic } from '@freementor/shared';
import type { SchedulerHints } from '@freementor/shared';
import { blockMinutes } from './time.ts';
import type { PlannedItem, StudySettings } from './types.ts';

/** The order blocks are worked through, whatever order the file lists them in. */
const BLOCK_RANK: Record<string, number> = {
  learn: 0,
  read: 1,
  build: 2,
  practice: 3,
  recall: 4,
  test: 5,
};

/** An item before it has been placed on a day. */
export type PendingItem = Omit<PlannedItem, 'done' | 'part'>;

export function expandTopic(
  topic: Topic,
  hints: SchedulerHints,
  settings: StudySettings,
): PendingItem[] {
  return [...topic.blocks]
    .sort((a, b) => (BLOCK_RANK[a.type] ?? 9) - (BLOCK_RANK[b.type] ?? 9))
    .map((block) => ({
      key: block.id,
      source: 'topic' as const,
      blockId: block.id,
      topicId: topic.id,
      subject: topic.subject,
      title: block.title,
      minutes: blockMinutes(block, hints, settings.language),
      blockType: block.type,
      scoreEntry: block.score_entry === true,
    }))
    .filter((i) => i.minutes > 0);
}

export function expandMilestone(milestone: Milestone): PendingItem[] {
  return [
    {
      key: milestone.id,
      source: 'milestone',
      milestoneId: milestone.id,
      subject: 'Mock test',
      title: milestone.title,
      minutes: milestone.est_minutes,
      scoreEntry: milestone.score_entry === true,
    },
  ];
}

/**
 * The daily warm-up: yesterday's recall questions, answered from memory.
 * Only added once the learner has something to recall.
 */
export function warmupItem(
  hints: SchedulerHints,
  previousTopic: Topic | undefined,
  date: string,
): PendingItem | null {
  if (!previousTopic || previousTopic.recall.length === 0) return null;
  return {
    key: `warmup:${date}`,
    source: 'warmup',
    topicId: previousTopic.id,
    subject: previousTopic.subject,
    title: `Warm-up recall · ${previousTopic.title}`,
    minutes: hints.warmup_recall_minutes,
  };
}

/** A spaced-revision visit to a topic the learner already finished (rule 6). */
export function reviewItem(topic: Topic, dueOn: string, minutes: number): PendingItem {
  return {
    key: `review:${topic.id}:${dueOn}`,
    source: 'spaced_review',
    topicId: topic.id,
    subject: topic.subject,
    title: `Spaced revision · ${topic.title}`,
    minutes,
  };
}

/**
 * Rule 9 — items for the reserved tail of the timeline.
 *
 * The exam libraries end with an empty "Final Revision" phase (zero topics,
 * zero mocks): the library deliberately leaves that stretch for the scheduler
 * to fill. Topics come back highest-weightage first, because the product rule
 * for a learner who is short on time is "prioritise high-weightage topics".
 */
const WEIGHTAGE_RANK: Record<string, number> = { H: 0, core: 1, M: 2, L: 3 };

export function* finalRevisionItems(topics: Topic[]): Generator<PendingItem> {
  const sorted = [...topics].sort(
    (a, b) =>
      (WEIGHTAGE_RANK[a.weightage] ?? 9) - (WEIGHTAGE_RANK[b.weightage] ?? 9) ||
      a.phase - b.phase ||
      a.order - b.order,
  );
  if (sorted.length === 0) return;

  // Revised in passes; a long reserve simply goes round again.
  for (let pass = 1; ; pass += 1) {
    for (const topic of sorted) {
      yield {
        key: `final-revision:${topic.id}:${pass}`,
        source: 'final_revision',
        topicId: topic.id,
        subject: topic.subject,
        title: `Final revision · ${topic.title}`,
        // A fifth of the original time, kept to a sitting a learner will do.
        minutes: Math.min(60, Math.max(15, Math.round(topic.est_minutes_total * 0.2))),
      };
    }
  }
}

/** The catch-up block forced by a failed weekly test (rule 8). */
export function remediationItem(topic: Topic, dueOn: string, minutes: number): PendingItem {
  return {
    key: `remediation:${topic.id}:${dueOn}`,
    source: 'remediation',
    topicId: topic.id,
    subject: topic.subject,
    title: `Catch-up · ${topic.title}`,
    minutes,
  };
}
