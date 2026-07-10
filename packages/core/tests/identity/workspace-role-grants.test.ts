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
  reconcileIdpWorkspaceRoles,
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

  it('grant persists the caller origin; a manual upsert strips it (last writer owns provenance)', async () => {
    const mapped = await grantWorkspaceRole({
      principalId: alicePrincipalId,
      workspaceId: W1,
      role: 'viewer',
      origin: 'idp',
    });
    if (!mapped.ok) throw new Error('grant failed');
    expect(mapped.record.origin).toBe('idp');
    const manual = await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
    if (!manual.ok) throw new Error('grant failed');
    expect(manual.updated).toBe(true);
    expect(manual.record.id).toBe(mapped.record.id);
    expect(manual.record.origin).toBeUndefined();
  });

  describe('reconcileIdpWorkspaceRoles', () => {
    it('mints idp rows for fresh desired pairs and reports them granted', async () => {
      const outcome = await reconcileIdpWorkspaceRoles(alicePrincipalId, [
        { workspaceId: W1, role: 'editor' },
        { workspaceId: W2, role: 'viewer' },
      ]);
      expect(outcome.granted).toHaveLength(2);
      expect(outcome.updated).toHaveLength(0);
      expect(outcome.revoked).toHaveLength(0);
      const rows = await listWorkspaceRolesForPrincipal(alicePrincipalId);
      expect(rows.map((r) => r.origin)).toEqual(['idp', 'idp']);
    });

    it('re-roles an existing idp row in place and drops one the claims no longer justify', async () => {
      await reconcileIdpWorkspaceRoles(alicePrincipalId, [
        { workspaceId: W1, role: 'viewer' },
        { workspaceId: W2, role: 'editor' },
      ]);
      const outcome = await reconcileIdpWorkspaceRoles(alicePrincipalId, [{ workspaceId: W1, role: 'editor' }]);
      expect(outcome.updated).toEqual([{ workspaceId: W1, role: 'editor' }]);
      expect(outcome.revoked).toEqual([{ workspaceId: W2, role: 'editor' }]);
      const rows = await listWorkspaceRolesForPrincipal(alicePrincipalId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ workspaceId: W1, role: 'editor', origin: 'idp' });
    });

    it('an unchanged desired set is a no-op', async () => {
      await reconcileIdpWorkspaceRoles(alicePrincipalId, [{ workspaceId: W1, role: 'viewer' }]);
      const before = await listWorkspaceRolesForPrincipal(alicePrincipalId);
      const outcome = await reconcileIdpWorkspaceRoles(alicePrincipalId, [{ workspaceId: W1, role: 'viewer' }]);
      expect(outcome).toEqual({ granted: [], updated: [], revoked: [], skippedManual: [] });
      expect(await listWorkspaceRolesForPrincipal(alicePrincipalId)).toEqual(before);
    });

    it('a manual row wins its pair: never re-roled, never dropped, reported skipped', async () => {
      await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'viewer' });
      const conflicting = await reconcileIdpWorkspaceRoles(alicePrincipalId, [{ workspaceId: W1, role: 'owner' }]);
      expect(conflicting.skippedManual).toEqual([{ workspaceId: W1, role: 'owner' }]);
      expect(conflicting.granted).toHaveLength(0);
      // The manual row survives a reconcile that desires nothing, too.
      const empty = await reconcileIdpWorkspaceRoles(alicePrincipalId, []);
      expect(empty.revoked).toHaveLength(0);
      const rows = await listWorkspaceRolesForPrincipal(alicePrincipalId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ workspaceId: W1, role: 'viewer' });
      expect(rows[0].origin).toBeUndefined();
    });

    it('a manual row matching the desired role is not reported skipped', async () => {
      await grantWorkspaceRole({ principalId: alicePrincipalId, workspaceId: W1, role: 'editor' });
      const outcome = await reconcileIdpWorkspaceRoles(alicePrincipalId, [{ workspaceId: W1, role: 'editor' }]);
      expect(outcome).toEqual({ granted: [], updated: [], revoked: [], skippedManual: [] });
    });

    it("scopes strictly to the principal: other principals' idp rows survive", async () => {
      const bob = await createDaemonUser({ displayName: 'Bob', email: 'bob@openheaders.io' });
      if (!bob.ok) throw new Error('setup failed');
      await reconcileIdpWorkspaceRoles(bob.record.principal.id, [{ workspaceId: W1, role: 'viewer' }]);
      await reconcileIdpWorkspaceRoles(alicePrincipalId, []);
      expect(await listWorkspaceRolesForPrincipal(bob.record.principal.id)).toHaveLength(1);
    });
  });
});
