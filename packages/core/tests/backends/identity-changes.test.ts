/**
 * Coverage for the durable identity-change registry
 * (`OH.backendIdentityChanges` — one record, one Org, persisted).
 * Pinned invariants:
 *   - One row per backendId: a later change upserts in place.
 *   - A successful join clears a PENDING row and leaves a REPLACED one
 *     (the same Org re-announces itself on every reconnect; only the
 *     person's dismissal clears it).
 *   - Dismissal drops whatever the record holds.
 *   - `removeBackend` prunes the removed record's row.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __clearBackendsForTests,
  dismissBackendIdentityChange,
  recordBackendIdentityChange,
  removeBackend,
  resolvePendingBackendIdentityChange,
} from '../../src/backends';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { BackendConnection } from '../../src/types';
import { createHostStorageFake, type HostStorageFake } from '../identity/_host-storage-fake';

const BACKEND_A = '01900000-0000-7000-8000-0000000000aa';
const BACKEND_B = '01900000-0000-7000-8000-0000000000bb';

function makeRecord(id: string, label: string): BackendConnection {
  return {
    id,
    label,
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: '2026-10-01T00:00:00.000Z',
    lastConnectedAt: null,
  };
}

const pendingOnA = {
  backendId: BACKEND_A,
  previousOrgId: 'org-old',
  previousOrgName: 'Old Install',
  nextOrgId: 'org-new',
  nextOrgName: 'New Install',
  resolution: 'pending',
} as const;

describe('backend identity-change registry (durable rows)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    __clearBackendsForTests();
  });

  it('records a change and upserts on repeat — one row per backendId', async () => {
    await recordBackendIdentityChange(pendingOnA);
    await recordBackendIdentityChange({ ...pendingOnA, nextOrgName: 'Newer Install', resolution: 'replaced' });
    const rows = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].nextOrgName).toBe('Newer Install');
    expect(rows[0].resolution).toBe('replaced');
    expect(rows[0].at.length).toBeGreaterThan(0);
  });

  it('keeps rows of distinct records apart', async () => {
    await recordBackendIdentityChange(pendingOnA);
    await recordBackendIdentityChange({ ...pendingOnA, backendId: BACKEND_B });
    expect(await hostStorage.get(OH.backendIdentityChanges)).toHaveLength(2);
  });

  it('resolvePendingBackendIdentityChange drops a pending row and leaves a replaced one', async () => {
    await recordBackendIdentityChange(pendingOnA);
    await recordBackendIdentityChange({ ...pendingOnA, backendId: BACKEND_B, resolution: 'replaced' });
    await resolvePendingBackendIdentityChange(BACKEND_A);
    await resolvePendingBackendIdentityChange(BACKEND_B);
    const rows = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].backendId).toBe(BACKEND_B);
    // Resolving a record with no pending row is a no-op, not an error.
    await resolvePendingBackendIdentityChange(BACKEND_A);
    expect(await hostStorage.get(OH.backendIdentityChanges)).toHaveLength(1);
  });

  it('dismissBackendIdentityChange drops whatever the record holds', async () => {
    await recordBackendIdentityChange({ ...pendingOnA, resolution: 'replaced' });
    await recordBackendIdentityChange({ ...pendingOnA, backendId: BACKEND_B });
    await dismissBackendIdentityChange(BACKEND_A);
    const rows = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].backendId).toBe(BACKEND_B);
    await dismissBackendIdentityChange(BACKEND_A);
    expect(await hostStorage.get(OH.backendIdentityChanges)).toHaveLength(1);
  });

  it('removeBackend prunes the removed record’s row', async () => {
    await hostStorage.set(OH.backends, [makeRecord(BACKEND_A, 'Desk'), makeRecord(BACKEND_B, 'LAN')]);
    await recordBackendIdentityChange(pendingOnA);
    await recordBackendIdentityChange({ ...pendingOnA, backendId: BACKEND_B });
    expect(await removeBackend(BACKEND_A)).toBe(true);
    const rows = (await hostStorage.get(OH.backendIdentityChanges)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].backendId).toBe(BACKEND_B);
  });
});
