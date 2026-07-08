/**
 * Coverage for the identity-snapshot registry — `installIdentitySnapshot`,
 * `refreshIdentitySnapshotFromHostStorage`, and `recordJoinedOrg`
 * (Phase U5.2 "consume-first join", UNIFIED_ORACLE_MODEL.md §6.2;
 * provenance + fold-by-presence per MULTI_BACKEND_PLAN.md §2).
 *
 * Pinned invariants:
 *   - The snapshot's `orgs` map always carries the home Org;
 *     `installIdentitySnapshot` folds any `joinedOrgs` in alongside it.
 *   - `recordJoinedOrg` persists the backend's Org under `OH.joinedOrgs`
 *     stamped with the delivering `OH.backends` record id, deduplicated
 *     by Org id, and the refreshed snapshot authorizes it.
 *   - Fold-by-presence: the refresh folds a joined Org only while its
 *     backend record exists in `OH.backends` — a DISABLED record still
 *     folds (the kill switch stops the wire, not local usability); a
 *     deleted record unbinds.
 *   - Joined Orgs are normalized to `isPrivate: false` at the registry
 *     boundary — anything that crossed a wire to get here is no longer
 *     "stays on this device."
 *   - Re-joining the same backend is idempotent; a renamed Org overwrites
 *     the stale copy. The joiner's own home-org is never stored as joined.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  authorizedOrgIds,
  claimJoinedOrg,
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  getIdentitySnapshot,
  getOrgBackendBindings,
  installIdentitySnapshot,
  MAX_ORG_NAME_LENGTH,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  renameHomeOrg,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { type JoinedOrgRecord, OH } from '../../src/storage/keys';
import type { BackendConnection, Org } from '../../src/types';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-20T00:00:00.000Z';

/**
 * Inbound test Orgs carry `isPrivate: true` to verify the registry's
 * normalization at the boundary. The persisted projection always reads
 * `isPrivate: false` — joined Orgs are never private.
 */
const BACKEND_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000bb',
  name: 'Backend Org',
  hostKind: 'desktop',
  isPrivate: true,
};
const OTHER_ORG: Org = {
  id: '01900000-0000-7000-8000-0000000000cc',
  name: 'Other Backend',
  hostKind: 'desktop',
  isPrivate: true,
};

const BACKEND_A = '01900000-0000-7000-8000-00000000aaaa';
const BACKEND_B = '01900000-0000-7000-8000-00000000abab';

function makeBackend(id: string, overrides: Partial<BackendConnection> = {}): BackendConnection {
  return {
    id,
    label: '',
    url: 'ws://127.0.0.1:8137',
    authToken: '',
    autoConnect: true,
    enabled: true,
    addedAt: NOW,
    lastConnectedAt: null,
    ...overrides,
  };
}

function seedBackends(backends: BackendConnection[]): Promise<void> {
  return hostStorage.set(OH.backends, backends);
}

/** The receiver-side projection of a joined Org — `isPrivate` stripped. */
const normalized = (org: Org): Org => ({ ...org, isPrivate: false });
const joinedRow = (org: Org, backendId: string): JoinedOrgRecord => ({ org: normalized(org), backendId });

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

  it('recordJoinedOrg persists the backend Org with provenance and authorizes it on refresh', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await refreshIdentitySnapshotFromHostStorage();

    const result = await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    expect(result.snapshot).not.toBeNull();
    expect(authorizedOrgIds(result.snapshot).has(BACKEND_ORG.id)).toBe(true);
    // Persisted form has `isPrivate: false` regardless of inbound value,
    // stamped with the delivering backend record.
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_A)]);
  });

  it('reports firstJoin true on a new backend, false on every reconnect', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    await refreshIdentitySnapshotFromHostStorage();

    expect((await recordJoinedOrg(BACKEND_ORG, BACKEND_A)).firstJoin).toBe(true);
    // A reconnect re-sends the same WELCOME — not a first join.
    expect((await recordJoinedOrg(BACKEND_ORG, BACKEND_A)).firstJoin).toBe(false);
    // A renamed-in-place reconnect is still a reconnect.
    expect((await recordJoinedOrg({ ...BACKEND_ORG, name: 'Renamed' }, BACKEND_A)).firstJoin).toBe(false);
    // A distinct backend is its own first join.
    expect((await recordJoinedOrg(OTHER_ORG, BACKEND_B)).firstJoin).toBe(true);
  });

  it('reports firstJoin false for the joiner own home-org', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    expect((await recordJoinedOrg(record.org, BACKEND_A)).firstJoin).toBe(false);
  });

  it('survives a snapshot rebuild — the joined Org is read back from storage', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    clearIdentitySnapshot();

    const rebuilt = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(rebuilt).has(BACKEND_ORG.id)).toBe(true);
  });

  it('folds a joined Org while its backend record exists — enabled or not', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);

    // Kill switch off: the wire stops, the Org stays folded — synced
    // workspaces remain usable local data.
    await seedBackends([makeBackend(BACKEND_A, { enabled: false })]);
    const disabled = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(disabled).has(BACKEND_ORG.id)).toBe(true);

    // Record deleted: the Org unbinds and drops out of the snapshot.
    await seedBackends([]);
    const removed = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(removed).has(BACKEND_ORG.id)).toBe(false);
  });

  it('does not fold malformed pre-provenance rows', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    // A legacy row written before provenance landed — a bare Org, no
    // wrapper. The refresh skips it rather than crashing or folding it.
    await hostStorage.set(OH.joinedOrgs, [{ ...BACKEND_ORG } as unknown as JoinedOrgRecord]);
    const snapshot = await refreshIdentitySnapshotFromHostStorage();
    expect(authorizedOrgIds(snapshot).has(BACKEND_ORG.id)).toBe(false);
  });

  it('is idempotent — re-joining the same backend does not duplicate the row', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_A)]);
  });

  it('accumulates distinct backends', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    const result = await recordJoinedOrg(OTHER_ORG, BACKEND_B);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([
      joinedRow(BACKEND_ORG, BACKEND_A),
      joinedRow(OTHER_ORG, BACKEND_B),
    ]);
    expect(authorizedOrgIds(result.snapshot).has(BACKEND_ORG.id)).toBe(true);
    expect(authorizedOrgIds(result.snapshot).has(OTHER_ORG.id)).toBe(true);
  });

  it('refreshes a renamed backend Org in place rather than appending', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    const renamed: Org = { ...BACKEND_ORG, name: 'Backend Org (renamed)' };
    await recordJoinedOrg(renamed, BACKEND_A);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(renamed, BACKEND_A)]);
  });

  it('re-stamps provenance in place when the connection record was re-minted', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    // Same Org, different record id (the cap-1 record was recreated).
    await recordJoinedOrg(BACKEND_ORG, BACKEND_B);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_B)]);
  });

  it('normalizes joined Orgs to isPrivate: false at the registry boundary', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    // Inbound carries isPrivate: true (sender's home Org has no notion of
    // who's listening); receiver-side normalization strips it.
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    const stored = await hostStorage.get(OH.joinedOrgs);
    expect(stored?.[0].org.isPrivate).toBe(false);
  });

  it('never stores the joiner own home-org as a joined Org', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await recordJoinedOrg(record.org, BACKEND_A);
    expect(await hostStorage.get(OH.joinedOrgs)).toBeUndefined();
  });

  it('serializes concurrent joins of distinct backends — neither write is clobbered', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    // Both calls race the same empty `OH.joinedOrgs` slot. Without the
    // RMW serializer each reads `[]`, appends its own Org, and the last
    // write drops the other join.
    await Promise.all([recordJoinedOrg(BACKEND_ORG, BACKEND_A), recordJoinedOrg(OTHER_ORG, BACKEND_B)]);
    const stored = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    expect(stored.map((row) => row.org.id).sort()).toEqual([BACKEND_ORG.id, OTHER_ORG.id].sort());
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
    // joinedOrgs → backends. Serialized: the first refresh's four reads
    // form a contiguous block, identical to the second's.
    expect(reads.length).toBe(8);
    expect(reads.slice(0, 4)).toEqual(reads.slice(4, 8));
    // The first key reappears at index 4 (block boundary), not index 1
    // (which an interleaved pair of refreshes would produce).
    expect(reads.indexOf(reads[0], 1)).toBe(4);
  });
});

describe('identity registry — Org→backend bindings + claimJoinedOrg (MULTI_BACKEND_PLAN.md §2/§3)', () => {
  let fake: HostStorageFake;

  beforeEach(() => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    clearIdentitySnapshot();
  });

  it('mirrors the presence-filtered bindings on refresh and clears them with the snapshot', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    await recordJoinedOrg(BACKEND_ORG, BACKEND_A);
    await recordJoinedOrg(OTHER_ORG, BACKEND_B);

    const bindings = getOrgBackendBindings();
    expect(bindings.get(BACKEND_ORG.id)).toBe(BACKEND_A);
    expect(bindings.get(OTHER_ORG.id)).toBe(BACKEND_B);

    // Presence filter: dropping A's record unbinds its Org from the
    // mirror — the routing key never points at a deleted connection.
    await seedBackends([makeBackend(BACKEND_B)]);
    await refreshIdentitySnapshotFromHostStorage();
    expect(getOrgBackendBindings().has(BACKEND_ORG.id)).toBe(false);
    expect(getOrgBackendBindings().get(OTHER_ORG.id)).toBe(BACKEND_B);

    clearIdentitySnapshot();
    expect(getOrgBackendBindings().size).toBe(0);
  });

  it('claims a fresh Org exactly like recordJoinedOrg (joined, firstJoin)', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    const result = await claimJoinedOrg(BACKEND_ORG, BACKEND_A);
    expect(result.outcome).toBe('joined');
    expect(result.outcome === 'joined' && result.firstJoin).toBe(true);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_A)]);
    expect(getOrgBackendBindings().get(BACKEND_ORG.id)).toBe(BACKEND_A);
  });

  it('refuses a claim for an Org bound to a different, still-present backend — never re-binds', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    await claimJoinedOrg(BACKEND_ORG, BACKEND_A);

    const result = await claimJoinedOrg(BACKEND_ORG, BACKEND_B);
    expect(result).toEqual({ outcome: 'refused', boundBackendId: BACKEND_A });
    // The binding and the persisted row are untouched.
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_A)]);
    expect(getOrgBackendBindings().get(BACKEND_ORG.id)).toBe(BACKEND_A);
  });

  it('rebinds when the previously-bound record no longer exists (stale binding)', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await claimJoinedOrg(BACKEND_ORG, BACKEND_A);

    // A's record is deleted; B claims the same Org — a legitimate
    // re-join through a re-minted connection, not a conflict.
    await seedBackends([makeBackend(BACKEND_B)]);
    const result = await claimJoinedOrg(BACKEND_ORG, BACKEND_B);
    expect(result.outcome).toBe('joined');
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_B)]);
  });

  it('re-claiming from the same backend is an idempotent reconnect', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A)]);
    await claimJoinedOrg(BACKEND_ORG, BACKEND_A);
    const result = await claimJoinedOrg(BACKEND_ORG, BACKEND_A);
    expect(result.outcome).toBe('joined');
    expect(result.outcome === 'joined' && result.firstJoin).toBe(false);
    expect(await hostStorage.get(OH.joinedOrgs)).toEqual([joinedRow(BACKEND_ORG, BACKEND_A)]);
  });

  it('treats the joiner own home-org as a no-op join, never a refusal', async () => {
    const record = await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    const result = await claimJoinedOrg(record.org, BACKEND_A);
    expect(result.outcome).toBe('joined');
    expect(result.outcome === 'joined' && result.firstJoin).toBe(false);
    expect(await hostStorage.get(OH.joinedOrgs)).toBeUndefined();
  });

  it('serializes two concurrent claims of the same Org — exactly one wins', async () => {
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    await seedBackends([makeBackend(BACKEND_A), makeBackend(BACKEND_B)]);
    const [a, b] = await Promise.all([claimJoinedOrg(BACKEND_ORG, BACKEND_A), claimJoinedOrg(BACKEND_ORG, BACKEND_B)]);
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(['joined', 'refused']);
    const stored = (await hostStorage.get(OH.joinedOrgs)) ?? [];
    expect(stored).toHaveLength(1);
    const winner = a.outcome === 'joined' ? BACKEND_A : BACKEND_B;
    expect(stored[0].backendId).toBe(winner);
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
