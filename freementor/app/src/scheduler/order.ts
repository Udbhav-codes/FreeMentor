/**
 * Rules 1, 7 and 13 — what gets scheduled, and in what order.
 *
 *  1. Topics run in phase order, then `order` within the phase. For exams the
 *     subjects are interleaved so a learner touches Physics, Chemistry and
 *     Biology in the same week instead of finishing one before starting another.
 *  7. Milestones (mocks) are inserted after the phase named in `after_phase`.
 * 13. CUET-style `track_gate` topics are skipped unless the learner chose that
 *     domain subject.
 */
import type { GoalFile, Topic } from '@freementor/shared';
import type { OrderedUnit, StudySettings } from './types.ts';

/** Normalises 'Business Studies' / 'business-studies' / 'domain:business-studies'. */
const slug = (s: string): string =>
  s.trim().toLowerCase().replace(/^domain:/, '').replace(/[\s_]+/g, '-');

/**
 * Rule 13. A topic with no `track_gate` is always scheduled (CUET's language,
 * GK and reasoning sections). A gated topic needs an explicit match.
 */
export function isTopicSelected(topic: Topic, settings: StudySettings): boolean {
  const gate = topic.track_gate;
  if (gate == null) return true;

  if (typeof gate === 'string') {
    const chosen = new Set((settings.selectedDomainSubjects ?? []).map(slug));
    // Nothing chosen yet => show the whole roadmap rather than an empty plan.
    if (chosen.size === 0) return true;
    return chosen.has(slug(gate));
  }

  const codes = gate['schedule_if_any_selected_subject_code'];
  if (Array.isArray(codes)) {
    const chosen = new Set(settings.selectedSubjectCodes ?? []);
    if (chosen.size === 0) return gate['skip_otherwise'] !== true;
    return codes.some((c) => chosen.has(String(c)));
  }

  return true;
}

/**
 * Rule 1's interleave. Round-robin weighted by how much of each subject is
 * left, so subjects with more topics are drawn more often and all of them
 * finish together at the end of the phase — rather than plain alternation,
 * which would exhaust the smallest subject first.
 */
export function interleaveBySubject(topics: Topic[]): Topic[] {
  const bySubject = new Map<string, Topic[]>();
  for (const t of topics) {
    const list = bySubject.get(t.subject);
    if (list) list.push(t);
    else bySubject.set(t.subject, [t]);
  }
  if (bySubject.size <= 1) return [...topics];

  type Lane = { queue: Topic[]; taken: number; total: number; seq: number };
  const lanes: Lane[] = [...bySubject.values()].map((queue, seq) => ({
    queue: [...queue].sort((a, b) => a.order - b.order),
    taken: 0,
    total: queue.length,
    seq,
  }));

  const out: Topic[] = [];
  while (out.length < topics.length) {
    let pick: Lane | undefined;
    for (const lane of lanes) {
      if (lane.queue.length === 0) continue;
      if (
        !pick ||
        lane.taken / lane.total < pick.taken / pick.total ||
        (lane.taken / lane.total === pick.taken / pick.total && lane.seq < pick.seq)
      ) {
        pick = lane;
      }
    }
    if (!pick) break;
    out.push(pick.queue.shift()!);
    pick.taken += 1;
  }
  return out;
}

/**
 * The full schedulable sequence: phase by phase, topics (interleaved for
 * exams) then that phase's milestones.
 */
export function orderUnits(goal: GoalFile, settings: StudySettings): OrderedUnit[] {
  const selected = goal.topics.filter(
    (t) => !t.deprecated && isTopicSelected(t, settings),
  );
  const byId = new Map(selected.map((t) => [t.id, t]));
  const phases = [...goal.phases].sort((a, b) => a.order - b.order);
  const interleave = goal.scheduler_hints.interleave_by === 'subject';

  const units: OrderedUnit[] = [];

  for (const phase of phases) {
    // Follow the phase's own topic_ids order, then sort defensively — a goal
    // file could list them out of order.
    const inPhase = phase.topic_ids
      .map((id) => byId.get(id))
      .filter((t): t is Topic => Boolean(t))
      .sort((a, b) => a.order - b.order);

    const ordered = interleave ? interleaveBySubject(inPhase) : inPhase;
    for (const topic of ordered) {
      units.push({ kind: 'topic', topic, phaseOrder: phase.order });
    }

    for (const milestone of goal.milestones.filter((m) => m.after_phase === phase.order)) {
      units.push({ kind: 'milestone', milestone, phaseOrder: phase.order });
    }
  }

  // Milestones pinned to a phase that produced no topics still belong on the
  // plan; append any the loop above missed.
  const placed = new Set(units.filter((u) => u.milestone).map((u) => u.milestone!.id));
  for (const m of goal.milestones) {
    if (!placed.has(m.id)) units.push({ kind: 'milestone', milestone: m, phaseOrder: m.after_phase });
  }

  return units;
}
