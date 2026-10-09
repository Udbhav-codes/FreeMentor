/* eslint-disable */
/**
 * AUTO-GENERATED from library/FreeMentor_Library/schema/goal.schema.json.
 * Run `npm run types -w shared` to regenerate. Do not edit by hand.
 *
 * The schema leaves `scheduler_hints` and a few other objects untyped;
 * narrower, hand-written types live in ../hints.ts and ../library.ts.
 */

/**
 * Schema 1.0. One file per goal, downloaded only when the user selects that goal. Files contain no fixed days: the on-device scheduler packs blocks into days using scheduler_hints. Required keys are enforced; optional keys below are documented so any AI or tool building the library knows what they mean.
 */
export interface FreeMentorGoalLibraryFile {
  schema_version: '1.0';
  goal: {
    id: string;
    name: string;
    category: string;
    group?: string;
    type: 'exam' | 'skill' | 'language';
    version: string;
    valid_for: string;
    last_updated: string;
    languages: ('en' | 'hi' | 'hi-en')[];
    estimated_hours: {};
    official_url?: string | null;
    syllabus_url?: string | null;
    subject?: string;
    subjects?: unknown[];
    video_language_note?: string;
    career_outcomes?: unknown[] | null;
    resource_policy?: string;
    reviewed_by?: string | null;
    prerequisite_note?: string;
    safety_policy?: string;
    eligibility_note?: string;
    qualification_options?: unknown[];
    weightage_note?: string;
    exam_note?: string;
    track_policy?: string;
    estimate_basis?: string;
    build_status?: string;
    verification_note?: string;
    domain_subjects_full_roadmap?: unknown[];
    domain_note?: string;
    language_papers?: unknown[] | {};
    domain_papers?: unknown[] | {};
    general_aptitude_paper?: unknown[] | {};
  };
  scheduler_hints: {};
  phases: {
    id: string;
    order: number;
    name: string;
    topic_ids: string[];
  }[];
  topics: Topic[];
  milestones: {}[];
}
export interface Topic {
  id: string;
  subject: string;
  title: string;
  phase: number;
  order: number;
  kind?: 'learn' | 'project';
  weightage: 'H' | 'M' | 'L' | 'core';
  est_minutes_total: number;
  blocks: Block[];
  recall: {}[];
  /**
   * For CUET/multi-subject goals: which domain subject this topic belongs to.
   */
  domain_subject?: string;
  /**
   * Either a track key string (e.g. 'domain:physics') or a rule object describing when to schedule this topic. The app downloads a topic only when its track/rule matches the user's chosen subjects.
   */
  track_gate?: string | {};
  /**
   * Id of the topic this one was reused/derived from in another goal.
   */
  source_topic_id?: string;
  coverage_note?: string;
  source_note?: string;
  /**
   * Legal/ethical caution shown with the topic (used in Cybersecurity).
   */
  safety_note?: string;
  prerequisite_note?: string;
  instructions?: string;
  deprecated?: boolean;
}
export interface Block {
  type: 'learn' | 'read' | 'practice' | 'recall' | 'test' | 'build';
  score_entry?: boolean;
  /**
   * Guidance shown with the block, e.g. 'Watch both videos' or which section of a one-shot to watch.
   */
  note?: string;
  /**
   * Checkable completion criteria for a 'build' (project) block.
   */
  done_when?: string[];
  resources: Resource[];
}
export interface Resource {
  type: 'video' | 'notes' | 'practice' | 'test';
  /**
   * e.g. main, alternative, extra.
   */
  role?: string;
  url: string;
  lang: 'en' | 'hi' | 'hi-en';
  provider: string;
  /**
   * YouTube channel name for video resources.
   */
  channel?: string;
  access: 'all' | 'premium';
  ad_gate_allowed?: boolean;
  status: 'unverified' | 'active' | 'broken' | 'replaced';
  last_checked?: string | null;
  /**
   * How a resource reached 'active', e.g. 'youtube_oembed'.
   */
  verified_via?: string;
  youtube_id?: string;
  duration_seconds?: number | null;
  est_minutes?: number;
  duration_source?: 'estimate' | 'youtube_api';
  /**
   * Optional per-video segments/timestamps.
   */
  segments?: unknown[];
}
