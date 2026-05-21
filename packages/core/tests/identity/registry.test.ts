/**
 * Coverage for the identity-snapshot registry — `installIdentitySnapshot`,
 * `refreshIdentitySnapshotFromHostStorage`, and `recordJoinedOrg`
 * (Phase U5.2 "consume-first join", UNIFIED_ORACLE_MODEL.md §6.2).
 *
 * Pinned invariants:
 *   - The snapshot's `orgs` map always carries the synthetic home-org;
 *     `installIdentitySnapshot` folds any `joinedOrgs` in alongside it.
 *   - `recordJoinedOrg` persists the backend's Org under `OH.joinedOrgs`,
 *     deduplicated by id, and the refreshed snapshot authorizes it.
 *   - Re-joining the same backend is idempotent; a renamed Org overwrites
 *     the stale copy. The joiner's own home-org is never stored as joined.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  authorizedOrgIds,
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  installIdentitySnapshot,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { Org } from '../../src/types';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-20T00:00:00.000Z';

const BACKEND_ORG: Org = { id: '01900000-0000-7000-8000-0000000000bb', name: 'Backend Org', isSynthetic: true };
const OTHER_ORG: Org = { id: '01900000-0000-7000-8000-0000000000cc', name: 'Other Backend', isSynthetic: true };

describe('identity registry — joined-Org folding (U5.2)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    clearIdentitySnapshot();
  });

  it('installIdentitySnapshot folds joinedOrgs in alongside the home-org', async () => {
    const record = await ensureSyntheticIdentity({ now: NOW });
    const snapshot = installIdentitySnapshot({ record, wras: [], joinedOrgs: [BACKEND_ORG] });
    expect([...snapshot.orgs.keys()].sort()).toEqual([record.org.id, BACKEND_ORG.id].sort());
    expect(authorizedOrgIds(snapshot).has(BACKEND_ORG.id)).toBe(true);
  });

  it('recordJoinedOrg persists the backend Org and authorizes it on refresh', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    const snapshot = await recordJoinedOrg(BACKEND_ORG);
    expect(snapshot).not.toBeNull();
    expect(authorizedOrgIds(snapshot).has(BACKEND_ORG.id)).toBe(true);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG]);
  });

  it('survives a snapshot rebuild — the joined Org is read back from storage', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    clearIdentitySnapshot();

    const rebuilt = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(rebuilt).has(BACKEND_ORG.id)).toBe(true);
  });

  it('is idempotent — re-joining the same backend does not duplicate the row', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    await recordJoinedOrg(BACKEND_ORG);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG]);
  });

  it('accumulates distinct backends', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    const snapshot = await recordJoinedOrg(OTHER_ORG);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG, OTHER_ORG]);
    expect(authorizedOrgIds(snapshot).has(BACKEND_ORG.id)).toBe(true);
    expect(authorizedOrgIds(snapshot).has(OTHER_ORG.id)).toBe(true);
  });

  it('refreshes a renamed backend Org in place rather than appending', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    const renamed: Org = { ...BACKEND_ORG, name: 'Backend Org (renamed)' };
    await recordJoinedOrg(renamed);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([renamed]);
  });

  it('never stores the joiner own home-org as a joined Org', async () => {
    const record = await ensureSyntheticIdentity({ now: NOW });
    await recordJoinedOrg(record.org);
    expect(await hostStorage.get(OH.joinedOrgs)).toBeUndefined();
  });

  it('serializes concurrent joins of distinct backends — neither write is clobbered', async () => {
    await ensureSyntheticIdentity({ now: NOW });
    // Both calls race the same empty `OH.joinedOrgs` slot. Without the
    // RMW serializer each reads `[]`, appends its own Org, and the last
    // write drops the other join.
    await Promise.all([recordJoinedOrg(BACKEND_ORG), recordJoinedOrg(OTHER_ORG)]);
    const stored = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    expect(stored.map((o) => o.id).sort()).toEqual([BACKEND_ORG.id, OTHER_ORG.id].sort());
  });
});
