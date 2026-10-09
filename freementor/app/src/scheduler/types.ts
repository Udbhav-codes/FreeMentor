/**
 * Public contract of the scheduler.
 *
 * buildPlan(input) is PURE: same input, same output, always. It reads no
 * clock (today is injected), touches no network and no database. That is what
 * makes the 13 rules in APP_BUILD_SPEC §4 testable.
 */
import type { Lang, Milestone, Topic } from '@freementor/shared';
import type { IsoDate, Weekday } from './dates.ts';

export type MinutesByWeekday = Record<Weekday, number>;

export interface StudySettings {
  startDate: IsoDate;
  /** Exam date or self-set deadline. null for open-ended skill learning. */
  targetDate?: IsoDate | null;
  minutesByWeekday: MinutesByWeekday;
  language: Lang;
  /** CUET: the domain subjects the learner actually chose (rule 13). */
  selectedDomainSubjects?: string[];
  /** CUET: NTA subject codes, for object-form track gates. */
  selectedSubjectCodes?: string[];
}

export interface CompletedRecord {
  completedAt: IsoDate;
  minutesCredited: number;
}

export interface ConfidenceRecord {
  level: import('@freementor/shared').ConfidenceLevel;
  ratedAt: IsoDate;
}

export interface TestScoreRecord {
  score: number;
  maxScore: number;
  takenAt: IsoDate;
}

export interface ProgressState {
  /**
   * Keyed by PlannedItem.key, not by block id: a block that spans two days
   * produces two independently tickable items. Stored in
   * task_progress.block_id, which is a free-form string column.
   */
  completed: Record<string, CompletedRecord>;
  /** Latest confidence rating per topic. Overrides the default spacing. */
  confidence: Record<string, ConfidenceRecord>;
  /** Keyed by block or milestone id. Drives the mastery gate (rule 8). */
  testScores: Record<string, TestScoreRecord>;
  /** Days the learner marked as rest. Capped by hints.rest_day_limits. */
  restDays: IsoDate[];
}

export const EMPTY_PROGRESS: ProgressState = {
  completed: {},
  confidence: {},
  testScores: {},
  restDays: [],
};

/** Why an item is on the plan. Drives the Day view's grouping and icons. */
export type ItemSource =
  | 'warmup'
  | 'topic'
  | 'spaced_review'
  | 'weekly_test'
  | 'remediation'
  | 'milestone'
  /** Rule 9 — the reserved tail of the timeline. */
  | 'final_revision';

export interface PlannedItem {
  /** Stable identity used by task_progress. See ProgressState.completed. */
  key: string;
  source: ItemSource;
  blockId?: string;
  topicId?: string;
  milestoneId?: string;
  subject: string;
  title: string;
  minutes: number;
  blockType?: import('@freementor/shared').BlockType;
  /** Set when one block was split across days: part 2 of 3, etc. */
  part?: { index: number; of: number };
  /** true once this item appears in ProgressState.completed. */
  done: boolean;
  /** The learner enters a score after this one. */
  scoreEntry?: boolean;
}

export type DayKind =
  | 'new_content'
  | 'mixed_practice'
  /** The weekly light day (rule 5). */
  | 'light_revision'
  /** Inside the reserved mocks-and-revision tail (rule 9). */
  | 'final_revision'
  | 'rest';

export interface PlannedDay {
  date: IsoDate;
  kind: DayKind;
  items: PlannedItem[];
  /** Sum of item minutes. */
  plannedMinutes: number;
  /** What minutesByWeekday allows for this weekday. */
  availableMinutes: number;
  /** Set when the learner marked this a rest day. */
  isRestDay: boolean;
}

export type WarningCode =
  | 'not_enough_time'
  | 'no_study_time_set'
  | 'target_date_passed'
  | 'plan_exceeds_target';

export interface PlanWarning {
  code: WarningCode;
  message: string;
  /** For 'not_enough_time': what the learner would need vs what they set. */
  requiredMinutesPerWeek?: number;
  configuredMinutesPerWeek?: number;
}

export interface PlanTotals {
  totalMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  topicsTotal: number;
  topicsCompleted: number;
  /** Content only — excludes the reserved tail. Comparable across learners. */
  contentMinutes: number;
  /** Minutes actually scheduled into the reserved tail (rule 9). */
  reservedMinutes: number;
  /** Study days spent on new content, and on the reserved tail. */
  contentDays: number;
  reserveDays: number;
}

export interface Plan {
  goalId: string;
  days: PlannedDay[];
  /** The day the last NEW content is scheduled — "syllabus finished". */
  contentFinish: IsoDate | null;
  /** The end of the reserved mocks-and-revision tail — "exam ready". */
  projectedFinish: IsoDate | null;
  warnings: PlanWarning[];
  totals: PlanTotals;
}

export interface SchedulerInput {
  goal: import('@freementor/shared').GoalFile;
  settings: StudySettings;
  progress: ProgressState;
  today: IsoDate;
  /** Safety valve so a misconfigured plan can never loop forever. */
  maxDays?: number;
}

/** A topic or milestone, flattened into schedulable order. */
export interface OrderedUnit {
  kind: 'topic' | 'milestone';
  topic?: Topic;
  milestone?: Milestone;
  phaseOrder: number;
}
