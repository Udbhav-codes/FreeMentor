/**
 * The wording the Profile screen shows for each sync outcome.
 *
 * The provider itself is a React component and is not unit-tested here (the
 * suite is pure-logic by convention), but the strings a learner actually
 * reads are worth pinning: "offline" must not look like data loss, and
 * "not_configured" must not look like a failure, because on a build with no
 * EXPO_PUBLIC_API_URL that is the normal state.
 */
import { describe, expect, it } from 'vitest';
import { describeSync } from '../syncStatus.ts';

describe('describeSync', () => {
  it('says nothing has run yet before the first sync', () => {
    expect(describeSync(null)).toMatch(/not synced yet/i);
  });

  it('counts what went up, singular and plural', () => {
    expect(describeSync({ status: 'synced', applied: 1, rejected: [] })).toBe(
      'Synced 1 change',
    );
    expect(describeSync({ status: 'synced', applied: 4, rejected: [] })).toBe(
      'Synced 4 changes',
    );
  });

  it('reports rejections rather than hiding them', () => {
    expect(
      describeSync({ status: 'synced', applied: 2, rejected: ['bad row'] }),
    ).toBe('Synced 2, 1 rejected');
  });

  it('treats an empty queue as success, not as an error', () => {
    expect(describeSync({ status: 'nothing_to_do' })).toMatch(/already synced/i);
  });

  it('does not make being offline sound like lost work', () => {
    const text = describeSync({ status: 'offline' });
    expect(text).toMatch(/retry/i);
    expect(text).not.toMatch(/fail|error|lost/i);
  });

  it('does not make an unconfigured build sound broken', () => {
    const text = describeSync({ status: 'not_configured' });
    expect(text).toMatch(/no server configured/i);
    expect(text).not.toMatch(/fail|error/i);
  });

  it('passes a real failure through with its reason', () => {
    expect(describeSync({ status: 'failed', reason: 'server returned 500' })).toBe(
      'Could not sync: server returned 500',
    );
  });
});
