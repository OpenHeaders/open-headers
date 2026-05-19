/**
 * Host-neutral capability resolver — the single code path every host runs
 * before applying a privileged action (UNIFIED_ORACLE_MODEL.md §5.8).
 *
 * Reads from a synchronous snapshot of the identity rows persisted by
 * `ensureSyntheticIdentity` + `ensureWorkspaceRoleAssignments`. Synthetic
 * rows resolve to ALLOW via the same branches a real Org / real WRA would
 * — no `if (mode === ...)` checks, no `user.isSynthetic` gating (the
 * `isSynthetic` flag is informational per §5.3).
 */

import type { DaemonAdmin, OrgMembership, Principal, User, WorkspaceRoleAssignment } from '../types';

/**
 * The capability axis. Slice 1 ships the three privileges the renderer→SW
 * dispatch boundary needs to gate; finer-grained verbs (e.g. `vault.read`,
 * `rule.publish`) layer on top in later slices without changing the
 * resolver contract.
 */
export type Capability =
  | 'workspace.read'
  | 'workspace.write'
  | 'workspace.list'
  | 'daemon.admin';

export interface CapabilityContext {
  /** Required for `workspace.*` capabilities; ignored for `daemon.*`. */
  workspaceId?: string;
}

export interface CapabilityDecision {
  allow: boolean;
  /** Stable kebab-case reason code; surfaced into the audit emit + RPC error frame. */
  reason?: CapabilityDenyReason;
}

export type CapabilityDenyReason =
  | 'no-current-user'
  | 'workspace-id-required'
  | 'no-workspace-role-assignment'
  | 'insufficient-workspace-role'
  | 'not-daemon-admin'
  | 'unknown-capability'
  | 'auth-required';

/**
 * The view of identity state the resolver consults. The registry produces
 * one of these per `getIdentitySnapshot()` call; the resolver is pure over
 * it. No fields here are mode-conditional — synthetic and real rows
 * populate the same shape.
 */
export interface IdentitySnapshot {
  user: User;
  principal: Principal;
  membership: OrgMembership;
  /** `LocalAdmin` if the user owns this install (per §9.4); absent otherwise. */
  localAdmin?: DaemonAdmin;
  /** Workspace-id → WRA for this user's principal. */
  wraByWorkspaceId: ReadonlyMap<string, WorkspaceRoleAssignment>;
}

/**
 * Pure capability check. The caller resolves the snapshot via
 * `getIdentitySnapshot()` (or its async refresher) and threads it in.
 */
export function hasCapability(
  snapshot: IdentitySnapshot | null,
  capability: Capability,
  ctx: CapabilityContext = {},
): CapabilityDecision {
  if (!snapshot) {
    return { allow: false, reason: 'no-current-user' };
  }

  if (capability === 'daemon.admin') {
    return snapshot.localAdmin ? { allow: true } : { allow: false, reason: 'not-daemon-admin' };
  }

  if (capability === 'workspace.list') {
    // Metadata-list read: any installed snapshot is allowed. The list is
    // scoped to "which workspaces exist on this host"; per-workspace
    // visibility is enforced by `workspace.read` downstream.
    return { allow: true };
  }

  if (capability === 'workspace.read' || capability === 'workspace.write') {
    const { workspaceId } = ctx;
    if (!workspaceId) {
      return { allow: false, reason: 'workspace-id-required' };
    }
    if (snapshot.localAdmin) {
      return { allow: true };
    }
    const wra = snapshot.wraByWorkspaceId.get(workspaceId);
    if (!wra) {
      return { allow: false, reason: 'no-workspace-role-assignment' };
    }
    if (capability === 'workspace.read') {
      return { allow: true };
    }
    return wra.role === 'owner' || wra.role === 'editor'
      ? { allow: true }
      : { allow: false, reason: 'insufficient-workspace-role' };
  }

  return { allow: false, reason: 'unknown-capability' };
}

/**
 * The set of org ids this host is authorized to read envelopes for at
 * the transport boundary (UNIFIED_ORACLE_MODEL.md §6.1, §8.2, §10.2 —
 * "one sync filter"). State-vector reader, delta-stream reader, and
 * snapshot builder all enforce `envelope.orgId ∈ authorizedOrgIds(...)`
 * before yielding.
 *
 * V5 ships with a single home Org per identity. Multi-org membership
 * (real team Orgs alongside the home-org) layers on later by extending
 * this helper to fold `snapshot.membership` and any future team-Org
 * memberships into the set — the call sites never need to change.
 *
 * Pre-bootstrap / null snapshot → empty set → deny-all. Matches the
 * resolver's `no-current-user` branch; envelopes minted before identity
 * hydration carry the {@link PRE_BOOTSTRAP_ORG_ID} sentinel from
 * `@openheaders/core/sync` and are filtered out by the empty set
 * without a special case.
 */
export function authorizedOrgIds(snapshot: IdentitySnapshot | null): ReadonlySet<string> {
  if (!snapshot) return new Set();
  return new Set([snapshot.user.homeOrgId]);
}
