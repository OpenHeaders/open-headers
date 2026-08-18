/**
 * Coverage for the per-connection reach slot (`OH.backendReach`,
 * the multi-backend plan Phase 4 — per-backend keying). Pinned:
 *   - Entries are keyed per connection; one wire's write/clear never
 *     touches another's (or the self entry).
 *   - Redundant writes and missing-key clears skip the storage write.
 *   - `widestBackendReach` ranks loopback < lan < wan, null on empty.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { resetBackendReach, setBackendReach, widestBackendReach } from '../../src/backends';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH, SELF_BACKEND_REACH_KEY } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from '../identity/_host-storage-fake';

const BACKEND_A = '01900000-0000-7000-8000-0000000000aa';
const BACKEND_B = '01900000-0000-7000-8000-0000000000bb';

describe('backend reach slot — per-connection entries', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
  });

  it('keys each connection separately, self entry included', async () => {
    await setBackendReach(BACKEND_A, 'loopback');
    await setBackendReach(BACKEND_B, 'lan');
    await setBackendReach(SELF_BACKEND_REACH_KEY, 'lan');
    expect(await hostStorage.get(OH.backendReach)).toEqual({
      [BACKEND_A]: 'loopback',
      [BACKEND_B]: 'lan',
      [SELF_BACKEND_REACH_KEY]: 'lan',
    });
  });

  it('a null write clears exactly that entry (wire disconnect)', async () => {
    await setBackendReach(BACKEND_A, 'loopback');
    await setBackendReach(BACKEND_B, 'wan');
    await setBackendReach(BACKEND_A, null);
    expect(await hostStorage.get(OH.backendReach)).toEqual({ [BACKEND_B]: 'wan' });
    // Clearing a missing entry is a no-op.
    await setBackendReach(BACKEND_A, null);
    expect(await hostStorage.get(OH.backendReach)).toEqual({ [BACKEND_B]: 'wan' });
  });

  it('resetBackendReach drops every entry (SW init)', async () => {
    await setBackendReach(BACKEND_A, 'loopback');
    await setBackendReach(SELF_BACKEND_REACH_KEY, 'lan');
    await resetBackendReach();
    expect(await hostStorage.get(OH.backendReach)).toEqual({});
  });

  it('widestBackendReach ranks loopback < lan < wan, null on empty', () => {
    expect(widestBackendReach({})).toBeNull();
    expect(widestBackendReach({ [BACKEND_A]: 'loopback' })).toBe('loopback');
    expect(widestBackendReach({ [BACKEND_A]: 'loopback', [BACKEND_B]: 'lan' })).toBe('lan');
    expect(
      widestBackendReach({ [BACKEND_A]: 'wan', [BACKEND_B]: 'lan', [SELF_BACKEND_REACH_KEY]: 'loopback' }),
    ).toBe('wan');
  });
});
