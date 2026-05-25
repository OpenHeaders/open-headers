import { describe, expect, it } from 'vitest';

import { snapshotToUpdates } from '../../src/request-lifecycle-hub/replay';
import { makeLifecycle } from '../request-lifecycle-store/factories';

describe('snapshotToUpdates', () => {
  it('returns empty for empty snapshot', () => {
    expect(snapshotToUpdates([])).toEqual([]);
  });

  it('emits one `started` update per lifecycle in input order', () => {
    const a = makeLifecycle({ requestId: 'a' });
    const b = makeLifecycle({ requestId: 'b' });
    const c = makeLifecycle({ requestId: 'c' });
    const updates = snapshotToUpdates([a, b, c]);
    expect(updates).toHaveLength(3);
    expect(updates.every((u) => u.kind === 'started')).toBe(true);
    expect(updates.map((u) => (u.kind === 'started' ? u.lifecycle.requestId : ''))).toEqual(['a', 'b', 'c']);
  });

  it('preserves lifecycle identity (no clone)', () => {
    const lc = makeLifecycle({ requestId: 'r' });
    const [update] = snapshotToUpdates([lc]);
    if (update.kind !== 'started') throw new Error('expected started');
    expect(update.lifecycle).toBe(lc);
  });
});
