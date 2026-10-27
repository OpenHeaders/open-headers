/**
 * Coverage for the hub's delivered-row ledger (the workspace-list scope
 * plan, Part 4) — which workspaces' `__global__` row history a
 * directory principal holds in full. Per-principal rows beside the WRA
 * slot; a mark is idempotent, a clear is exact, and the grant surface's
 * revoke paths clear the pair.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearWorkspaceListDelivered,
  createDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  listDeliveredWorkspaceIds,
  markWorkspaceListDelivered,
  reconcileIdpWorkspaceRoles,
  revokeWorkspaceRole,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake } from './_host-storage-fake';

const W1 = '01900000-aaaa-7000-8000-000000000001';
const W2 = '01900000-aaaa-7000-8000-000000000002';

describe('workspace-list delivered-row ledger', () => {
  let alice: string;
  let bob: string;

  beforeEach(async () => {
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
    const a = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    const b = await createDaemonUser({ displayName: 'Bob', email: 'bob@openheaders.io' });
    if (!a.ok || !b.ok) throw new Error('setup failed');
    alice = a.record.principal.id;
    bob = b.record.principal.id;
  });

  it('starts empty and marks per principal', async () => {
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set());
    await markWorkspaceListDelivered(alice, [W1, W2]);
    await markWorkspaceListDelivered(bob, [W2]);
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W1, W2]));
    expect(await listDeliveredWorkspaceIds(bob)).toEqual(new Set([W2]));
  });

  it('a repeated mark writes nothing', async () => {
    await markWorkspaceListDelivered(alice, [W1]);
    const before = await hostStorage.get(OH.workspaceListDeliveries);
    await markWorkspaceListDelivered(alice, [W1]);
    await markWorkspaceListDelivered(alice, []);
    expect(await hostStorage.get(OH.workspaceListDeliveries)).toBe(before);
  });

  it('clears exactly the named pairs and leaves the other principal alone', async () => {
    await markWorkspaceListDelivered(alice, [W1, W2]);
    await markWorkspaceListDelivered(bob, [W1]);
    await clearWorkspaceListDelivered(alice, [W1]);
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W2]));
    expect(await listDeliveredWorkspaceIds(bob)).toEqual(new Set([W1]));
    const before = await hostStorage.get(OH.workspaceListDeliveries);
    await clearWorkspaceListDelivered(alice, [W1]);
    expect(await hostStorage.get(OH.workspaceListDeliveries)).toBe(before);
  });

  it('concurrent marks for one principal both persist (the ledger lock)', async () => {
    await Promise.all([markWorkspaceListDelivered(alice, [W1]), markWorkspaceListDelivered(alice, [W2])]);
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W1, W2]));
  });

  it('a manual revoke clears the pair; a re-grant does not mark', async () => {
    await grantWorkspaceRole({ principalId: alice, workspaceId: W1, role: 'viewer' });
    await markWorkspaceListDelivered(alice, [W1, W2]);
    expect(await revokeWorkspaceRole(alice, W1)).toEqual({ ok: true });
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W2]));
    await grantWorkspaceRole({ principalId: alice, workspaceId: W1, role: 'viewer' });
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W2]));
  });

  it("the IdP reconcile's revoke leg clears the dropped pairs only", async () => {
    await reconcileIdpWorkspaceRoles(alice, [
      { workspaceId: W1, role: 'viewer' },
      { workspaceId: W2, role: 'editor' },
    ]);
    await markWorkspaceListDelivered(alice, [W1, W2]);
    const outcome = await reconcileIdpWorkspaceRoles(alice, [{ workspaceId: W1, role: 'viewer' }]);
    expect(outcome.revoked).toEqual([{ workspaceId: W2, role: 'editor' }]);
    expect(await listDeliveredWorkspaceIds(alice)).toEqual(new Set([W1]));
  });
});
