/**
 * Coverage for the directory-user grant surface (Phase 5 team tier,
 * slice 2) — grant / revoke / list `WorkspaceRoleAssignment` rows for
 * principals beyond the host's own synthetic one, sharing the
 * `OH.workspaceRoleAssignments` slot (and writer lock) with the boot
 * reconcile.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDaemonUser,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  grantWorkspaceRole,
  listWorkspaceRolesForPrincipal,
  revokeWorkspaceRole,
} from '../../src/identity';
import { hostStorage, setHostStorage } from '../../src/storage/host-storage';
import { OH } from '../../src/storage/keys';
import { createHostStorageFake } from './_host-storage-fake';

const W1 = '01900000-aaaa-7000-8000-000000000001';
const W2 = '01900000-aaaa-7000-8000-000000000002';

describe('workspace role grants', () => {
  let alicePrincipalId: string;

  beforeEach(async () => {
    setHostStorage(createHostStorageFake());
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
    const created = await createDaemonUser({ displayName: 'Alice', email: 'alice@openheaders.io' });
    if (!created.ok) throw new Error('setup failed');
    alicePrincipalId = created.record.principal.id;
  });

  it('mints a new WRA row for a fresh (principal, workspace) pair', async () => {
    const result = await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.updated).toBe(false);
    expect(result.record.principalId).toBe(alicePrincipalId);
    expect(result.record.workspaceId).toBe(W1);
    expect(result.record.role).toBe('viewer');
    const persisted = await hostStorage.get(OH.workspaceRoleAssignments);
    expect(persisted).toHaveLength(1);
  });

  it('re-granting updates the role in place, id-stable', async () => {
    const first = await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    const second = await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'editor' });
    if (!first.ok || !second.ok) throw new Error('grant failed');
    expect(second.updated).toBe(true);
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.role).toBe('editor');
    expect(await hostStorage.get(OH.workspaceRoleAssignments)).toHaveLength(1);
  });

  it('re-granting the same role is a reported no-op', async () => {
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    const again = await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    expect(again.ok && !again.updated).toBe(true);
  });

  it('refuses empty ids', async () => {
    expect(await grantWorkspaceRole({ principalId: '', workspaceId: W1, role: 'viewer' })).toEqual({
      ok: false,
      reason: 'empty-principal',
    });
    expect(await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: '', role: 'viewer' })).toEqual({
      ok: false,
      reason: 'empty-workspace',
    });
  });

  it('revoke drops exactly the (principal, workspace) row', async () => {
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W2, role: 'editor' });
    expect(await revokeWorkspaceRole(alicePrincipalId, W1)).toEqual({ ok: true });
    const remaining = await listWorkspaceRolesForPrincipal(alicePrincipalId);
    expect(remaining.map((w) => w.workspaceId)).toEqual([W2]);
  });

  it('revoking a grant that does not exist reports not-found', async () => {
    expect(await revokeWorkspaceRole(alicePrincipalId, W1)).toEqual({ ok: false, reason: 'not-found' });
  });

  it("grants coexist with the reconcile's synthetic owner rows", async () => {
    await ensureWorkspaceRoleAssignments([W1]);
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    // Re-reconciling the same workspace set keeps both rows.
    const wras = await ensureWorkspaceRoleAssignments([W1]);
    expect(wras).toHaveLength(2);
    expect(await listWorkspaceRolesForPrincipal(alicePrincipalId)).toHaveLength(1);
  });

  it('list is scoped to the requested principal', async () => {
    const bob = await createDaemonUser({ displayName: 'Bob' });
    if (!bob.ok) throw new Error('setup failed');
    await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    await grantWorkspaceRole({ principalId: bob.record.principal.id, workspaceId: W1, role: 'editor' });
    const alices = await listWorkspaceRolesForPrincipal(alicePrincipalId);
    expect(alices).toHaveLength(1);
    expect(alices[0].role).toBe('viewer');
  });

  it('concurrent grants for distinct pairs both persist (shared writer lock)', async () => {
    await Promise.all([
      grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' }),
      grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W2, role: 'editor' }),
    ]);
    expect(await listWorkspaceRolesForPrincipal(alicePrincipalId)).toHaveLength(2);
  });
});
