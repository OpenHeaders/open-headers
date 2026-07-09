/**
 * Directory-user workspace grants (Phase 5 team tier, slice 2).
 *
 * Grant / revoke / list `WorkspaceRoleAssignment` rows for principals
 * beyond the host's own synthetic one — the RBAC axis a daemon's
 * directory users are authorized on. Rows live in the same
 * `OH.workspaceRoleAssignments` slot the boot reconcile owns; every
 * writer shares {@link withWorkspaceRoleAssignmentsLock} so a grant
 * never races the reconcile's read-modify-write.
 *
 * The reconcile remains the only workspace-liveness authority: a grant
 * against a workspace id that never materializes is dropped on the next
 * reconcile pass, exactly like an owner row whose workspace was deleted.
 */

import { hostStorage } from '../storage/host-storage';
import { OH } from '../storage/keys';
import type { WorkspaceRole, WorkspaceRoleAssignment } from '../types';
import { uuidv7 } from '../utils/uuidv7';
import { withWorkspaceRoleAssignmentsLock } from './ensure-workspace-role-assignments';

export interface GrantWorkspaceRoleInput {
  principalId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export type GrantWorkspaceRoleResult =
  | { readonly ok: true; readonly record: WorkspaceRoleAssignment; readonly updated: boolean }
  | { readonly ok: false; readonly reason: 'empty-principal' | 'empty-workspace' };

export type RevokeWorkspaceRoleResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'not-found' };

/**
 * Upsert one grant: a fresh `(principal, workspace)` pair mints a new
 * row; an existing pair updates its role in place, keeping the row id
 * stable so audit references stay valid across a role change.
 */
export async function grantWorkspaceRole(input: GrantWorkspaceRoleInput): Promise<GrantWorkspaceRoleResult> {
  if (!input.principalId) return { ok: false, reason: 'empty-principal' };
  if (!input.workspaceId) return { ok: false, reason: 'empty-workspace' };
  return withWorkspaceRoleAssignmentsLock(async () => {
    const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
    const existing = persisted.find(
      (wra) => wra.principalId === input.principalId && wra.workspaceId === input.workspaceId,
    );
    if (existing) {
      if (existing.role === input.role) return { ok: true, record: existing, updated: false };
      const record: WorkspaceRoleAssignment = { ...existing, role: input.role };
      await hostStorage.set(
        OH.workspaceRoleAssignments,
        persisted.map((wra) => (wra.id === existing.id ? record : wra)),
      );
      return { ok: true, record, updated: true };
    }
    const record: WorkspaceRoleAssignment = {
      id: uuidv7(),
      principalId: input.principalId,
      workspaceId: input.workspaceId,
      role: input.role,
    };
    await hostStorage.set(OH.workspaceRoleAssignments, [...persisted, record]);
    return { ok: true, record, updated: false };
  });
}

/** Drop the `(principal, workspace)` grant. */
export async function revokeWorkspaceRole(
  principalId: string,
  workspaceId: string,
): Promise<RevokeWorkspaceRoleResult> {
  return withWorkspaceRoleAssignmentsLock(async () => {
    const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
    const next = persisted.filter((wra) => !(wra.principalId === principalId && wra.workspaceId === workspaceId));
    if (next.length === persisted.length) return { ok: false, reason: 'not-found' };
    await hostStorage.set(OH.workspaceRoleAssignments, next);
    return { ok: true };
  });
}

/** Every persisted grant for one principal. */
export async function listWorkspaceRolesForPrincipal(principalId: string): Promise<WorkspaceRoleAssignment[]> {
  const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
  return persisted.filter((wra) => wra.principalId === principalId);
}
