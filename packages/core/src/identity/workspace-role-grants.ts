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
import type { WorkspaceRole, WorkspaceRoleAssignment, WorkspaceRoleOrigin } from '../types';
import { uuidv7 } from '../utils/uuidv7';
import { withWorkspaceRoleAssignmentsLock } from './ensure-workspace-role-assignments';

export interface GrantWorkspaceRoleInput {
  principalId: string;
  workspaceId: string;
  role: WorkspaceRole;
  /**
   * Provenance stamped on the row. Absent = a manual act; the row goes
   * sticky (an operator upsert over an IdP-mapped row strips its
   * `origin`, taking the grant out of the mapping's ownership).
   */
  origin?: WorkspaceRoleOrigin;
}

export type GrantWorkspaceRoleResult =
  | { readonly ok: true; readonly record: WorkspaceRoleAssignment; readonly updated: boolean }
  | { readonly ok: false; readonly reason: 'empty-principal' | 'empty-workspace' };

export type RevokeWorkspaceRoleResult = { readonly ok: true } | { readonly ok: false; readonly reason: 'not-found' };

/**
 * Upsert one grant: a fresh `(principal, workspace)` pair mints a new
 * row; an existing pair updates its role in place, keeping the row id
 * stable so audit references stay valid across a role change. The
 * caller's `origin` is written on both branches — the last writer owns
 * the row's provenance.
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
      if (existing.role === input.role && existing.origin === input.origin) {
        return { ok: true, record: existing, updated: false };
      }
      const record: WorkspaceRoleAssignment = {
        id: existing.id,
        principalId: existing.principalId,
        workspaceId: existing.workspaceId,
        role: input.role,
        ...(input.origin !== undefined ? { origin: input.origin } : {}),
      };
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
      ...(input.origin !== undefined ? { origin: input.origin } : {}),
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

export interface DesiredIdpGrant {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface ReconcileIdpWorkspaceRolesResult {
  /** Fresh `idp` rows minted this pass. */
  readonly granted: readonly DesiredIdpGrant[];
  /** Existing `idp` rows whose role changed in place. */
  readonly updated: readonly DesiredIdpGrant[];
  /** `idp` rows dropped because the claims no longer justify them. */
  readonly revoked: readonly DesiredIdpGrant[];
  /** Desired pairs skipped because a manual (origin-less) row holds them. */
  readonly skippedManual: readonly DesiredIdpGrant[];
}

/**
 * Reconcile one principal's IdP-mapped grants against the desired set a
 * login's claims produce. The mapping owns exactly the rows stamped
 * `origin: 'idp'`:
 *
 *   - a desired pair with no row is inserted as `idp`;
 *   - a desired pair held by an `idp` row is re-roled in place;
 *   - an `idp` row absent from the desired set is dropped (the IdP is
 *     authoritative for the rows it minted);
 *   - a manual (origin-less) row always wins its pair — the mapping
 *     neither re-roles nor drops it, and reports the skip.
 *
 * One read-modify-write under the shared WRA lock, same discipline as
 * every other writer of `OH.workspaceRoleAssignments`.
 */
export async function reconcileIdpWorkspaceRoles(
  principalId: string,
  desired: readonly DesiredIdpGrant[],
): Promise<ReconcileIdpWorkspaceRolesResult> {
  return withWorkspaceRoleAssignmentsLock(async () => {
    const persisted = (await hostStorage.get(OH.workspaceRoleAssignments)) ?? [];
    const desiredByWorkspace = new Map(desired.map((d) => [d.workspaceId, d]));
    const granted: DesiredIdpGrant[] = [];
    const updated: DesiredIdpGrant[] = [];
    const revoked: DesiredIdpGrant[] = [];
    const skippedManual: DesiredIdpGrant[] = [];
    const next: WorkspaceRoleAssignment[] = [];

    for (const wra of persisted) {
      if (wra.principalId !== principalId) {
        next.push(wra);
        continue;
      }
      const want = desiredByWorkspace.get(wra.workspaceId);
      if (want) desiredByWorkspace.delete(wra.workspaceId);
      if (wra.origin !== 'idp') {
        if (want && want.role !== wra.role) skippedManual.push(want);
        next.push(wra);
        continue;
      }
      if (!want) {
        revoked.push({ workspaceId: wra.workspaceId, role: wra.role });
        continue;
      }
      if (want.role === wra.role) {
        next.push(wra);
        continue;
      }
      updated.push(want);
      next.push({ ...wra, role: want.role });
    }

    for (const want of desiredByWorkspace.values()) {
      granted.push(want);
      next.push({
        id: uuidv7(),
        principalId,
        workspaceId: want.workspaceId,
        role: want.role,
        origin: 'idp',
      });
    }

    if (granted.length > 0 || updated.length > 0 || revoked.length > 0) {
      await hostStorage.set(OH.workspaceRoleAssignments, next);
    }
    return { granted, updated, revoked, skippedManual };
  });
}
