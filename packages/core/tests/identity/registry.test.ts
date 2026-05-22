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
  getIdentitySnapshot,
  installIdentitySnapshot,
  MAX_ORG_NAME_LENGTH,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  renameHomeOrg,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import type { Org } from '../../src/types';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-20T00:00:00.000Z';

const BACKEND_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Backend Org',
  hostKind: 'desktop',
  isSynthetic: true,
};
const OTHER_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000cc',
  name: 'Other Backend',
  hostKind: 'desktop',
  isSynthetic: true,
};

describe('identity registry — joined-Org folding (U5.2)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    clearIdentitySnapshot();
  });

  it('installIdentitySnapshot folds joinedOrgs in alongside the home-org', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    const snapshot = installIdentitySnapshot({ record, wras: [], joinedOrgs: [BACKEND_ORG] });
    expect([...snapshot.orgs.keys()].sort()).toEqual([record.org.id, BACKEND_ORG.id].sort());
    expect(authorizedOrgIds(snapshot).has(BACKEND_ORG.id)).toBe(true);
  });

  it('recordJoinedOrg persists the backend Org and authorizes it on refresh', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    const result = await recordJoinedOrg(BACKEND_ORG);
    expect(result.snapshot).not.toBeNull();
    expect(authorizedOrgIds(result.snapshot).has(BACKEND_ORG.id)).toBe(true);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG]);
  });

  it('reports firstJoin true on a new backend, false on every reconnect', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    expect((await recordJoinedOrg(BACKEND_ORG)).firstJoin).toBe(true);
    // A reconnect re-sends the same WELCOME — not a first join.
    expect((await recordJoinedOrg(BACKEND_ORG)).firstJoin).toBe(false);
    // A renamed-in-place reconnect is still a reconnect.
    expect((await recordJoinedOrg({ ...BACKEND_ORG, name: 'Renamed' })).firstJoin).toBe(false);
    // A distinct backend is its own first join.
    expect((await recordJoinedOrg(OTHER_ORG)).firstJoin).toBe(true);
  });

  it('reports firstJoin false for the joiner own home-org', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    expect((await recordJoinedOrg(record.org)).firstJoin).toBe(false);
  });

  it('survives a snapshot rebuild — the joined Org is read back from storage', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    clearIdentitySnapshot();

    const rebuilt = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(rebuilt).has(BACKEND_ORG.id)).toBe(true);
  });

  it('is idempotent — re-joining the same backend does not duplicate the row', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    await recordJoinedOrg(BACKEND_ORG);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG]);
  });

  it('accumulates distinct backends', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    const result = await recordJoinedOrg(OTHER_ORG);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([BACKEND_ORG, OTHER_ORG]);
    expect(authorizedOrgIds(result.snapshot).has(BACKEND_ORG.id)).toBe(true);
    expect(authorizedOrgIds(result.snapshot).has(OTHER_ORG.id)).toBe(true);
  });

  it('refreshes a renamed backend Org in place rather than appending', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(BACKEND_ORG);
    const renamed: Org = { ...BACKEND_ORG, name: 'Backend Org (renamed)' };
    await recordJoinedOrg(renamed);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([renamed]);
  });

  it('never stores the joiner own home-org as a joined Org', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(record.org);
    expect(await hostStorage.get(OH.joinedOrgs)).toBeUndefined();
  });

  it('serializes concurrent joins of distinct backends — neither write is clobbered', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    // Both calls race the same empty `OH.joinedOrgs` slot. Without the
    // RMW serializer each reads `[]`, appends its own Org, and the last
    // write drops the other join.
    await Promise.all([recordJoinedOrg(BACKEND_ORG), recordJoinedOrg(OTHER_ORG)]);
    const stored = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    expect(stored.map((o) => o.id).sort()).toEqual([BACKEND_ORG.id, OTHER_ORG.id].sort());
  });

  it('serializes concurrent snapshot refreshes — their reads never interleave', async () => {
    // Cross-phase audit Q3: `refreshIdentitySnapshotFromHostStorage` is a
    // three-`get`-then-install sequence funnelled by three writers (boot,
    // the WRA reconcile, `recordJoinedOrg`). Two concurrent refreshes
    // must not interleave their reads — otherwise a refresh that read a
    // stale `OH.joinedOrgs` can install last and drop a joined Org.
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    const reads: string[] = [];
    const base = fake.get.bind(fake);
    fake.get = async (spec) => {
      reads.push(spec.key);
      // Yield so an unserialized peer refresh could slip a read in.
      await Promise.resolve();
      await Promise.resolve();
      return base(spec);
    };
    await Promise.all([refreshIdentitySnapshotFromHostStorage(), refreshIdentitySnapshotFromHostStorage()]);
    // Each refresh reads syntheticIdentity → workspaceRoleAssignments →
    // joinedOrgs. Serialized: the first refresh's three reads form a
    // contiguous block, identical to the second's.
    expect(reads.length).toBe(6);
    expect(reads.slice(0, 3)).toEqual(reads.slice(3, 6));
    // The first key reappears at index 3 (block boundary), not index 1
    // (which an interleaved pair of refreshes would produce).
    expect(reads.indexOf(reads[0], 1)).toBe(3);
  });
});

describe('identity registry — home-Org rename (Bug B 2c)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    clearIdentitySnapshot();
  });

  it('renames the home Org inside OH.syntheticIdentity and refreshes the snapshot', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Chrome', now: NOW });
    await refreshIdentitySnapshotFromHostStorage();

    const result = await renameHomeOrg('Work Chrome');
    expect(result).toEqual({ ok: true });

    const stored = await hostStorage.get(OH.syntheticIdentity);
    expect(stored?.org.name).toBe('Work Chrome');
    // Untouched fields ride through — only the name changes.
    expect(stored?.org.id).toBe(record.org.id);
    expect(stored?.org.hostKind).toBe('browser');
    expect(getIdentitySnapshot()?.orgs.get(record.org.id)?.name).toBe('Work Chrome');
  });

  it('trims surrounding whitespace before persisting', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await renameHomeOrg('  Padded Name  ');
    expect((await hostStorage.get(OH.syntheticIdentity))?.org.name).toBe('Padded Name');
  });

  it('caps the name at MAX_ORG_NAME_LENGTH', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await renameHomeOrg('x'.repeat(MAX_ORG_NAME_LENGTH + 25));
    const stored = await hostStorage.get(OH.syntheticIdentity);
    expect(stored?.org.name.length).toBe(MAX_ORG_NAME_LENGTH);
  });

  it('rejects an all-whitespace name without writing', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Chrome', now: NOW });
    const result = await renameHomeOrg('   ');
    expect(result).toEqual({ ok: false, reason: 'empty-name' });
    expect((await hostStorage.get(OH.syntheticIdentity))?.org.name).toBe(record.org.name);
  });

  it('reports no-identity when the synthetic record has not been bootstrapped', async () => {
    const result = await renameHomeOrg('Anything');
    expect(result).toEqual({ ok: false, reason: 'no-identity' });
  });

  it('is a no-op write when the name is unchanged', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Chrome', now: NOW });
    let writes = 0;
    const baseSet = fake.set.bind(fake);
    fake.set = async (spec, value) => {
      writes += 1;
      return baseSet(spec, value);
    };
    const result = await renameHomeOrg('Chrome');
    expect(result).toEqual({ ok: true });
    expect(writes).toBe(0);
  });

  it('serializes concurrent renames — the last queued write wins intact', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await Promise.all([renameHomeOrg('First'), renameHomeOrg('Second')]);
    const name = (await hostStorage.get(OH.syntheticIdentity))?.org.name;
    expect(['First', 'Second']).toContain(name);
  });
});
