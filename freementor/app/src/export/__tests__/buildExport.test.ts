/**
 * The export document.
 *
 * The privacy policy promises this at an exact menu path, so the plain
 * requirement is that the file contains the learner's data. The tests worth
 * writing are about the two things that are easy to get wrong:
 *
 *  - a device-only export must SAY it is device-only, rather than look
 *    complete while silently missing purchases;
 *  - a device path or a photo URI must not travel inside it.
 */
import { describe, expect, it } from 'vitest';
import {
  buildExport,
  exportFileName,
  FORMAT_VERSION,
  isComplete,
  type LocalData,
  type ServerPart,
} from '../buildExport.ts';

const NOW = new Date('2026-10-15T09:30:00.000Z');

const local = (over: Partial<LocalData> = {}): LocalData => ({
  profile: {
    name: 'Asha',
    birthYear: 2004,
    qualification: 'Class 12',
    language: 'hi',
    appearance: 'dark',
    onboardedAt: '2026-10-01T00:00:00.000Z',
    studyHour: 20,
    studyPlace: 'desk',
    photoUri: 'file:///data/user/0/com.freementor/files/profile/avatar-1.jpg',
  },
  enrollments: [
    {
      id: 'e-1',
      goalId: 'jee-main',
      goalName: 'JEE Main',
      version: '1.0.0',
      startDate: '2026-10-01',
      targetDate: '2027-04-01',
      status: 'trial',
      createdAt: '2026-10-01T00:00:00.000Z',
      schedule: { mode: 'each_day', minutes_by_weekday: { mon: 90 } },
      completedTasks: [{ block_id: 'b-1', completed_at: '2026-10-02', minutes_credited: 45 }],
      confidenceRatings: [{ topic_id: 't-1', level: 'shaky' }],
      testScores: [{ block_or_milestone_id: 'm-1', score: 62.5, max_score: 100 }],
      restDays: ['2026-10-05'],
    },
  ],
  streak: { current: 4, best: 9, lastStudyDate: '2026-10-03', graceUsedOn: null },
  pendingSyncWrites: 0,
  ...over,
});

const serverDoc: ServerPart = {
  kind: 'included',
  document: {
    account: { id: 'u-1', email: 'asha@example.com', name: 'Asha' },
    purchases: [{ play_order_id: 'GPA.1', plan: 'basic', price_paid: '599' }],
    parent_consent: [{ parent_contact: 'parent@example.com' }],
    notification_preferences: { daily: true },
  },
};

describe('the learner gets their data', () => {
  it('carries the roadmap and the work done in it', () => {
    const doc = buildExport(local(), { kind: 'no_server' }, NOW);
    expect(doc.roadmaps).toHaveLength(1);
    expect(doc.roadmaps[0]!.goalId).toBe('jee-main');
    // The name as well as the slug: an export reading "jee-main" is much less
    // use to a person than one reading "JEE Main".
    expect(doc.roadmaps[0]!.goalName).toBe('JEE Main');
    expect(doc.roadmaps[0]!.completedTasks).toHaveLength(1);
    expect(doc.roadmaps[0]!.restDays).toEqual(['2026-10-05']);
  });

  it('carries the streak and the profile', () => {
    const doc = buildExport(local(), { kind: 'no_server' }, NOW);
    expect(doc.streak).toEqual({
      current: 4,
      best: 9,
      lastStudyDate: '2026-10-03',
      graceUsedOn: null,
    });
    expect(doc.account).toMatchObject({ name: 'Asha', birth_year: 2004, language: 'hi' });
  });

  it('separates device settings from account data', () => {
    // The server has no business knowing the learner prefers dark mode, and
    // does not; mixing the two would misrepresent what we hold.
    const doc = buildExport(local(), { kind: 'no_server' }, NOW);
    expect(doc.app_settings).toMatchObject({ appearance: 'dark', study_hour: 20 });
    expect(doc.account).not.toHaveProperty('appearance');
  });

  it('works for somebody who has done nothing at all', () => {
    const doc = buildExport(
      { profile: null, enrollments: [], streak: null, pendingSyncWrites: 0 },
      { kind: 'no_server' },
      NOW,
    );
    expect(doc.account).toBeNull();
    expect(doc.app_settings).toBeNull();
    expect(doc.roadmaps).toEqual([]);
    expect(doc._meta.format_version).toBe(FORMAT_VERSION);
  });
});

describe('the file never carries a device path', () => {
  it('reports that a photo exists without naming where', () => {
    // The URI is a path inside the app sandbox. It would be meaningless in a
    // file somebody opens, and slightly alarming.
    const doc = buildExport(local(), { kind: 'no_server' }, NOW);
    expect(doc.app_settings).toMatchObject({ has_profile_photo: true });
    expect(JSON.stringify(doc)).not.toContain('/data/user/0/');
    expect(JSON.stringify(doc)).not.toContain('avatar-1.jpg');
  });

  it('says so when there is no photo', () => {
    const data = local();
    data.profile!.photoUri = null;
    expect(buildExport(data, { kind: 'no_server' }, NOW).app_settings).toMatchObject({
      has_profile_photo: false,
    });
  });
});

describe('the document is honest about how complete it is', () => {
  it('is complete only when the server answered', () => {
    expect(isComplete(serverDoc)).toBe(true);
    expect(isComplete({ kind: 'no_server' })).toBe(false);
    expect(isComplete({ kind: 'not_signed_in' })).toBe(false);
    expect(isComplete({ kind: 'failed', reason: 'HTTP 500' })).toBe(false);
  });

  it('merges the account records in when the server answered', () => {
    const doc = buildExport(local(), serverDoc, NOW);
    expect(doc.purchases).toEqual([
      { play_order_id: 'GPA.1', plan: 'basic', price_paid: '599' },
    ]);
    expect(doc.parent_consent).toEqual([{ parent_contact: 'parent@example.com' }]);
    expect(doc._meta.complete).toBe(true);
  });

  it('prefers the server account row, which is authoritative for email', () => {
    const doc = buildExport(local(), serverDoc, NOW);
    expect(doc.account).toMatchObject({ email: 'asha@example.com' });
  });

  it('marks purchases null rather than empty when the server was absent', () => {
    // An empty array would read as "you have never bought anything", which
    // is a different claim from "we did not look".
    const doc = buildExport(local(), { kind: 'no_server' }, NOW);
    expect(doc.purchases).toBeNull();
    expect(doc.parent_consent).toBeNull();
    expect(doc._meta.complete).toBe(false);
  });

  it.each([
    ['no_server', /does not connect to a server/i],
    ['not_signed_in', /not signed in/i],
  ])('explains in the file itself why %s left records out', (kind, expected) => {
    const doc = buildExport(local(), { kind } as ServerPart, NOW);
    expect(String(doc._meta.sources)).toMatch(expected);
  });

  it('names the reason a reachable server still failed', () => {
    const doc = buildExport(local(), { kind: 'failed', reason: 'HTTP 503' }, NOW);
    expect(String(doc._meta.sources)).toContain('HTTP 503');
  });

  it('reports work this device has not yet synced', () => {
    // Somebody comparing this file against a support answer should be able to
    // tell which of the two is stale.
    const doc = buildExport(local({ pendingSyncWrites: 7 }), serverDoc, NOW);
    expect(doc._meta.pending_sync_writes).toBe(7);
  });

  it('says what the document is and that the library is not personal data', () => {
    const doc = buildExport(local(), serverDoc, NOW);
    expect(String(doc._meta.what_this_is)).toMatch(/roadmap files are not included/i);
    expect(doc._meta.generated_at).toBe('2026-10-15T09:30:00.000Z');
  });
});

describe('the file name', () => {
  it('is dated, so two exports do not look like the same file', () => {
    expect(exportFileName(NOW)).toBe('freementor-export-2026-10-15.json');
  });

  it('has no characters a file system or share sheet would object to', () => {
    expect(exportFileName(NOW)).toMatch(/^[a-z0-9.-]+$/);
  });
});
