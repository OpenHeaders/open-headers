/**
 * Coverage for the durable Org-conflict registry
 * (`OH.backendOrgConflicts` — the multi-backend plan §2's Org-uniqueness
 * invariant, persisted). Pinned invariants:
 *   - One row per (backendId, orgId): a repeat refusal upserts in place.
 *   - A successful claim clears exactly its own row.
 *   - `removeBackend` prunes the removed record's rows but keeps rows
 *     naming it as the PROVIDER — those still describe the refused
 *     backend's last attempt.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  __clearBackendsForTests,
  clearBackendOrgConflict,
  recordBackendOrgConflict,
  removeBackend,
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
    addedAt: '2026-07-01T00:00:00.000Z',
    lastConnectedAt: null,
  };
}

describe('backend Org-conflict registry (durable rows)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    __clearBackendsForTests();
  });

  it('records a refusal and upserts on repeat — one row per (backendId, orgId)', async () => {
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-shared',
      orgName: 'Shared Org',
      boundBackendId: BACKEND_A,
    });
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-shared',
      orgName: 'Shared Org (renamed)',
      boundBackendId: BACKEND_A,
    });
    const rows = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].orgName).toBe('Shared Org (renamed)');
    expect(rows[0].boundBackendId).toBe(BACKEND_A);
    expect(rows[0].at.length).toBeGreaterThan(0);
  });

  it('keeps distinct (backendId, orgId) rows apart', async () => {
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-shared',
      orgName: 'Shared Org',
      boundBackendId: BACKEND_A,
    });
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-other',
      orgName: 'Other Org',
      boundBackendId: BACKEND_A,
    });
    expect(await hostStorage.get(OH.backendOrgConflicts)).toHaveLength(2);
  });

  it('clearBackendOrgConflict drops exactly its own row', async () => {
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-shared',
      orgName: 'Shared Org',
      boundBackendId: BACKEND_A,
    });
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-other',
      orgName: 'Other Org',
      boundBackendId: BACKEND_A,
    });
    await clearBackendOrgConflict(BACKEND_B, 'org-shared');
    const rows = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].orgId).toBe('org-other');
    // Clearing a missing row is a no-op, not an error.
    await clearBackendOrgConflict(BACKEND_B, 'org-shared');
    expect(await hostStorage.get(OH.backendOrgConflicts)).toHaveLength(1);
  });

  it('removeBackend prunes the removed record’s rows, keeps provider-side rows', async () => {
    await hostStorage.set(OH.backends, [makeRecord(BACKEND_A, 'Desk'), makeRecord(BACKEND_B, 'LAN')]);
    // B was refused an Org A provides, and A was refused an Org B provides.
    await recordBackendOrgConflict({
      backendId: BACKEND_B,
      orgId: 'org-a',
      orgName: 'Org A',
      boundBackendId: BACKEND_A,
    });
    await recordBackendOrgConflict({
      backendId: BACKEND_A,
      orgId: 'org-b',
      orgName: 'Org B',
      boundBackendId: BACKEND_B,
    });
    expect(await removeBackend(BACKEND_A)).toBe(true);
    const rows = (await hostStorage.get(OH.backendOrgConflicts)) ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].backendId).toBe(BACKEND_B);
    expect(rows[0].boundBackendId).toBe(BACKEND_A);
  });
});
