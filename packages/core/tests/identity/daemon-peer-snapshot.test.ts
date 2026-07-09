/**
 * Coverage for `resolveDaemonPeerIdentitySnapshot` (Phase 5 team tier,
 * slice 2) — the per-peer capability snapshot the RBAC gates resolve
 * against. Operator → the registry's real snapshot (localAdmin ⇒
 * allow-all); directory user → their principal's grants, no localAdmin;
 * unknown / deactivated → null (fail-closed as `no-current-user`).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  grantWorkspaceRole,
  hasCapability,
  refreshIdentitySnapshotFromHostStorage,
  resolveDaemonPeerIdentitySnapshot,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake } from './_host-storage-fake';

const W1 = '01900000-aaaa-7000-8000-000000000001';
const W2 = '01900000-aaaa-7000-8000-000000000002';

describe('resolveDaemonPeerIdentitySnapshot', () => {
  let operatorUserId: string;
  let aliceUserId: string;
  let alicePrincipalId: string;

  beforeEach(async () => {
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
    const identity = await hostStorage.get(OH.syntheticIdentity);
    if (!identity) throw new Error('setup failed');
    operatorUserId = identity.user.id;
    await ensureWorkspaceRoleAssignments([W1, W2]);
    await refreshIdentitySnapshotFromHostStorage();
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!created.ok) throw new Error('setup failed');
    aliceUserId = created.record.user.id;
    alicePrincipalId = created.record.principal.id;
  });

  it('the operator resolves to the real snapshot — localAdmin allows any workspace', async () => {
    const snapshot = await resolveDaemonPeerIdentitySnapshot(operatorUserId);
    expect(snapshot?.localAdmin).toBeDefined();
    expect(hasCapability(snapshot, 'workspace.write', { workspaceId: W1 }).allow).toBe(true);
    expect(hasCapability(snapshot, 'workspace.write', { workspaceId: W2 }).allow).toBe(true);
  });

  it('a directory user with no grants denies read and write', async () => {
    const snapshot = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.localAdmin).toBeUndefined();
    expect(hasCapability(snapshot, 'workspace.read', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'no-workspace-role-assignment',
    });
    expect(hasCapability(snapshot, 'workspace.write', { workspaceId: W1 }).allow).toBe(false);
  });

  it('a viewer grant allows read and denies write on that workspace only', async () => {
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    const snapshot = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(hasCapability(snapshot, 'workspace.read', { workspaceId: W1 }).allow).toBe(true);
    expect(hasCapability(snapshot, 'workspace.write', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'insufficient-workspace-role',
    });
    expect(hasCapability(snapshot, 'workspace.read', { workspaceId: W2 }).allow).toBe(false);
  });

  it('an editor grant allows write', async () => {
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'editor' });
    const snapshot = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(hasCapability(snapshot, 'workspace.write', { workspaceId: W1 }).allow).toBe(true);
  });

  it('grant changes are visible on the next resolution — no caching', async () => {
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'editor' });
    const before = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(hasCapability(before, 'workspace.write', { workspaceId: W1 }).allow).toBe(true);
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    const after = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(hasCapability(after, 'workspace.write', { workspaceId: W1 }).allow).toBe(false);
  });

  it("the daemon's own Org is the snapshot's sole org", async () => {
    const identity = await hostStorage.get(OH.syntheticIdentity);
    const snapshot = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect([...(snapshot?.orgs.keys() ?? [])]).toEqual([identity?.org.id]);
  });

  it('a deactivated user resolves to null', async () => {
    await deactivateDaemonUser(aliceUserId);
    expect(await resolveDaemonPeerIdentitySnapshot(aliceUserId)).toBeNull();
  });

  it('an unknown user resolves to null', async () => {
    expect(await resolveDaemonPeerIdentitySnapshot('01890000-0000-7000-8000-000000000000')).toBeNull();
  });

  it('a null snapshot denies as no-current-user', async () => {
    await deactivateDaemonUser(aliceUserId);
    const snapshot = await resolveDaemonPeerIdentitySnapshot(aliceUserId);
    expect(hasCapability(snapshot, 'workspace.read', { workspaceId: W1 })).toEqual({
      allow: false,
      reason: 'no-current-user',
    });
  });
});
