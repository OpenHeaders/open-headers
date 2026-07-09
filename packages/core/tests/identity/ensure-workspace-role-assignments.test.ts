/**
 * Coverage for `ensureWorkspaceRoleAssignments` — the host-neutral
 * reconcile pass that keeps `OH.workspaceRoleAssignments` aligned with
 * the live workspace set (U1.8 per UNIFIED_ORACLE_STATUS.md).
 *
 * Pinned invariants:
 *   - First call against a workspace set mints one owner-role WRA per
 *     workspace for the synthetic principal.
 *   - Re-running with the same set is a no-op (no storage write) — the
 *     returned list is bit-identical to the persisted one.
 *   - Adding a workspace mints exactly one new WRA; the existing WRAs
 *     are untouched.
 *   - Removing a workspace prunes its WRA; surviving WRAs are kept
 *     with their existing ids.
 *   - WRA ids are deterministic in `(hostInstallId, workspaceId)`: same
 *     pair → same id across re-mints, distinct pairs → distinct ids.
 *   - Calling without a prior `ensureSyntheticIdentity` throws — the
 *     helper does not silently mint a synthetic principal of its own.
 *   - Principal-aware (Phase 5 slice 2): another principal's grant on a
 *     workspace never suppresses the synthetic owner mint; foreign rows
 *     survive reconciles for live workspaces and drop with dead ones.
 */

import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
} from '../../src/identity';
import { WorkspaceRoleAssignmentSchema } from '../../src/schemas';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake, type HostStorageFake } from './_host-storage-fake';

const NOW = '2026-05-19T00:00:00.000Z';

// Canonical workspace ids (UUIDv7 layout — version=7, variant=10).
const W1 = '01900000-aaaa-7000-8000-000000000001';
const W2 = '01900000-aaaa-7000-8000-000000000002';
const W3 = '01900000-aaaa-7000-8000-000000000003';

describe('ensureWorkspaceRoleAssignments', () => {
  let fake: HostStorageFake;

  beforeEach(async () => {
    fake = createHostStorageFake();
    setHostStorage(fake);
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
  });

  it('mints one owner-role WRA per workspace on first reconcile', async () => {
    const wras = await ensureWorkspaceRoleAssignments([W1, W2]);
    expect(wras).toHaveLength(2);
    for (const wra of wras) {
      expect(v.safeParse(WorkspaceRoleAssignmentSchema, wra).success).toBe(true);
      expect(wra.role).toBe('owner');
    }
    expect(new Set(wras.map((w) => w.workspaceId))).toEqual(new Set([W1, W2]));
  });

  it('persists WRAs to OH.workspaceRoleAssignments', async () => {
    await ensureWorkspaceRoleAssignments([W1]);
    const persisted = await hostStorage.get(OH.workspaceRoleAssignments);
    expect(persisted).toHaveLength(1);
    expect(persisted?.[0]?.workspaceId).toBe(W1);
  });

  it('binds every WRA to the synthetic principal id', async () => {
    const record = await hostStorage.get(OH.syntheticIdentity);
    const wras = await ensureWorkspaceRoleAssignments([W1, W2]);
    for (const wra of wras) {
      expect(wra.principalId).toBe(record?.principal.id);
    }
  });

  it('is idempotent — re-running with the same set returns bit-identical rows', async () => {
    const first = await ensureWorkspaceRoleAssignments([W1, W2]);
    const second = await ensureWorkspaceRoleAssignments([W1, W2]);
    expect(second).toEqual(first);
  });

  it('mints only the missing WRA when a new workspace is added', async () => {
    const first = await ensureWorkspaceRoleAssignments([W1, W2]);
    const second = await ensureWorkspaceRoleAssignments([W1, W2, W3]);
    expect(second).toHaveLength(3);
    // Existing WRAs survive id-stable.
    const firstW1 = first.find((w) => w.workspaceId === W1);
    const secondW1 = second.find((w) => w.workspaceId === W1);
    expect(secondW1).toEqual(firstW1);
  });

  it('prunes the WRA when a workspace is removed', async () => {
    await ensureWorkspaceRoleAssignments([W1, W2, W3]);
    const next = await ensureWorkspaceRoleAssignments([W1, W3]);
    expect(next.map((w) => w.workspaceId).sort()).toEqual([W1, W3]);
  });

  it('WRA ids are deterministic in (hostInstallId, workspaceId)', async () => {
    const a = await ensureWorkspaceRoleAssignments([W1]);
    // Drop the WRA list; re-reconcile against the same workspace under
    // the same hostInstallId → same id.
    await hostStorage.remove(OH.workspaceRoleAssignments);
    const b = await ensureWorkspaceRoleAssignments([W1]);
    expect(b[0]?.id).toBe(a[0]?.id);
  });

  it('distinct hostInstallIds produce distinct WRA ids for the same workspace', async () => {
    const a = await ensureWorkspaceRoleAssignments([W1]);
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'browser', now: NOW });
    const b = await ensureWorkspaceRoleAssignments([W1]);
    expect(b[0]?.id).not.toBe(a[0]?.id);
  });

  it('throws when called before ensureSyntheticIdentity', async () => {
    setHostStorage(createHostStorageFake());
    await expect(ensureWorkspaceRoleAssignments([W1])).rejects.toThrow(/synthetic identity/);
  });

  it('mints exactly one WRA for a duplicated workspace id', async () => {
    const wras = await ensureWorkspaceRoleAssignments([W1, W1, W2]);
    expect(wras).toHaveLength(2);
    expect(new Set(wras.map((w) => w.workspaceId))).toEqual(new Set([W1, W2]));
  });

  it('serializes concurrent reconciles — the last-fired call wins the persisted state', async () => {
    await Promise.all([
      ensureWorkspaceRoleAssignments([W1]),
      ensureWorkspaceRoleAssignments([W1, W2]),
      ensureWorkspaceRoleAssignments([W1, W2, W3]),
    ]);
    const persisted = await hostStorage.get(OH.workspaceRoleAssignments);
    expect(persisted?.map((w) => w.workspaceId).sort()).toEqual([W1, W2, W3]);
  });

  it('handles an empty workspace list (no-op when persisted list is also empty)', async () => {
    const result = await ensureWorkspaceRoleAssignments([]);
    expect(result).toEqual([]);
    expect(await hostStorage.get(OH.workspaceRoleAssignments)).toBeUndefined();
  });

  describe('multi-principal rows (Phase 5 grants share the slot)', () => {
    const FOREIGN_PRINCIPAL = '01900000-bbbb-7000-8000-000000000009';

    it("a foreign principal's grant does not suppress the synthetic owner mint", async () => {
      await hostStorage.set(OH.workspaceRoleAssignments, [
        {
          id: '01900000-cccc-7000-8000-000000000001',
          principalId: FOREIGN_PRINCIPAL,
          workspaceId: W1,
          role: 'viewer',
        },
      ]);
      const record = await hostStorage.get(OH.syntheticIdentity);
      const wras = await ensureWorkspaceRoleAssignments([W1]);
      expect(wras).toHaveLength(2);
      const synthetic = wras.find((w) => w.principalId === record?.principal.id);
      expect(synthetic?.role).toBe('owner');
      const foreign = wras.find((w) => w.principalId === FOREIGN_PRINCIPAL);
      expect(foreign?.role).toBe('viewer');
    });

    it("foreign rows survive reconciles for live workspaces and drop with dead ones", async () => {
      await ensureWorkspaceRoleAssignments([W1, W2]);
      const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
      await hostStorage.set(OH.workspaceRoleAssignments, [
        ...persisted,
        {
          id: '01900000-cccc-7000-8000-000000000002',
          principalId: FOREIGN_PRINCIPAL,
          workspaceId: W1,
          role: 'editor',
        },
        {
          id: '01900000-cccc-7000-8000-000000000003',
          principalId: FOREIGN_PRINCIPAL,
          workspaceId: W2,
          role: 'viewer',
        },
      ]);
      // W2 is deleted: its rows — synthetic AND foreign — drop; W1's survive.
      const next = await ensureWorkspaceRoleAssignments([W1]);
      expect(next.map((w) => w.workspaceId)).toEqual([W1, W1]);
      expect(next.some((w) => w.principalId === FOREIGN_PRINCIPAL && w.role === 'editor')).toBe(true);
    });
  });
});
