/**
 * The shape the app actually consumes. It narrows the auto-generated schema
 * types (which leave several objects as bare `{}`) without contradicting them.
 */
import type { FreeMentorGoalLibraryFile } from './generated/goal.ts';
import type { SchedulerHints } from './hints.ts';

export type GoalType = 'exam' | 'skill' | 'language';
export type Lang = 'en' | 'hi' | 'hi-en';
export type Weightage = 'H' | 'M' | 'L' | 'core';
export type BlockType = 'learn' | 'read' | 'practice' | 'recall' | 'test' | 'build';
export type ResourceType = 'video' | 'notes' | 'practice' | 'test';
export type ResourceStatus = 'unverified' | 'active' | 'broken' | 'replaced';
export type ResourceAccess = 'all' | 'premium';

export interface Resource {
  type: ResourceType;
  /** 'main' | 'main_hi' | 'alternative' | 'extra' | ... */
  role?: string;
  title: string;
  url: string;
  lang: Lang;
  provider: string;
  channel?: string;
  access: ResourceAccess;
  /** Must be false for every video — YouTube API Services policy. */
  ad_gate_allowed?: boolean;
  status: ResourceStatus;
  last_checked?: string | null;
  verified_via?: string;
  youtube_id?: string;
  /** null until tools/check_links.py fills it from the YouTube Data API. */
  duration_seconds?: number | null;
  est_minutes?: number;
  duration_source?: 'estimate' | 'youtube_api';
}

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  est_minutes: number;
  note?: string;
  /** Completion criteria for a `build` (project) block. */
  done_when?: string[];
  /** true => the learner enters a score after finishing. */
  score_entry?: boolean;
  resources: Resource[];
}

export interface RecallQuestion {
  q: string;
  a: string;
}

export interface Topic {
  id: string;
  subject: string;
  title: string;
  phase: number;
  order: number;
  kind?: 'learn' | 'project';
  weightage: Weightage;
  est_minutes_total: number;
  blocks: Block[];
  recall: RecallQuestion[];
  /** CUET and other multi-track goals. */
  domain_subject?: string;
  track_gate?: string | Record<string, unknown>;
  source_topic_id?: string;
  safety_note?: string;
  prerequisite_note?: string;
  instructions?: string;
  deprecated?: boolean;
}

export interface Phase {
  id: string;
  order: number;
  name: string;
  topic_ids: string[];
}

export interface Milestone {
  id: string;
  /** Inserted after the phase with this `order`. */
  after_phase: number;
  type: 'mock' | 'certification';
  title: string;
  est_minutes: number;
  score_entry?: boolean;
  instructions?: string;
  /** jee-advanced only. */
  paper_count?: number;
  paper_minutes?: number;
  analysis_minutes?: number;
  resources: Resource[];
}

export interface EstimatedHours {
  content: number;
  mocks_and_milestones: number;
  spaced_revision_allowance: number;
  total: number;
  note?: string;
}

export interface GoalMeta {
  id: string;
  name: string;
  category: string;
  group?: string;
  type: GoalType;
  version: string;
  valid_for: string;
  last_updated: string;
  languages: Lang[];
  estimated_hours: EstimatedHours;
  official_url?: string | null;
  career_outcomes?: string[] | null;
  eligibility_note?: string;
  qualification_options?: string[];
  safety_policy?: string;
  domain_subjects_full_roadmap?: string[];
  [key: string]: unknown;
}

/** A downloaded `goals/<id>.json`. */
export interface GoalFile extends Omit<
  FreeMentorGoalLibraryFile,
  'goal' | 'scheduler_hints' | 'topics' | 'milestones' | 'phases'
> {
  schema_version: '1.0';
  goal: GoalMeta;
  scheduler_hints: SchedulerHints;
  phases: Phase[];
  topics: Topic[];
  milestones: Milestone[];
}

/** An entry in the bundled catalog.json. */
export interface CatalogGoal {
  id: string;
  name: string;
  category: string;
  group: string;
  type: GoalType;
  status: 'full' | 'outline';
  estimated_hours: number;
  estimate_basis?: string;
  official_url?: string | null;
  eligibility_note?: string;
  qualification_options?: string[];
  phases?: { order: number; name: string; modules: string[] }[];
  career_outcomes?: string[];
}

export interface Catalog {
  schema_version: string;
  app: string;
  generated: string;
  goal_count: number;
  categories: { name: string; groups: string[] }[];
  goals: CatalogGoal[];
}
