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

import type { DaemonAdmin, Org, OrgMembership, Principal, User, WorkspaceRoleAssignment } from '../types';

/**
 * The capability axis. Slice 1 ships the three privileges the renderer→SW
 * dispatch boundary needs to gate; finer-grained verbs (e.g. `vault.read`,
 * `rule.publish`) layer on top in later slices without changing the
 * resolver contract.
 */
export type Capability = 'workspace.read' | 'workspace.write' | 'workspace.list' | 'daemon.admin';

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
  | 'auth-required'
  | 'target-org-not-authorized';

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
  /**
   * Org-id → Org row for every Org this identity belongs to. V5 ships a
   * single synthetic home-org; multi-org membership (real team Orgs
   * joined via a daemon) folds more rows in without changing the shape.
   * Consulted by the org-catalogue helpers that drive the workspace
   * org-binding UI (UNIFIED_ORACLE_MODEL.md §6.2 / §6.4).
   */
  orgs: ReadonlyMap<string, Org>;
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
 * The set of org ids this host is authorized to read envelopes for —
 * both at the sender-side transport readers and at the receiver-side
 * ingest filter (UNIFIED_ORACLE_MODEL.md §6.1, §8.2, §10.2 — "one sync
 * filter"). State-vector reader, delta-stream reader, snapshot builder,
 * and the inbound `applyInboundMutationBatch` ingest path all enforce
 * `envelope.orgId ∈ authorizedOrgIds(...)`.
 *
 * The authorized set is **every Org the identity belongs to** —
 * `snapshot.orgs`, which the registry keeps in lockstep with the
 * persisted membership rows. A fresh V5 install carries exactly one
 * (the synthetic home Org). Joining another backend adds that backend's
 * Org to `snapshot.orgs` (Phase U5), and this helper folds it in with
 * no change at the call sites — that is what lets a joined backend's
 * workspaces sync down while the joiner's own Org stays unauthorized on
 * the target.
 *
 * Pre-bootstrap / null snapshot → empty set → deny-all. Matches the
 * resolver's `no-current-user` branch; envelopes minted before identity
 * hydration carry the {@link PRE_BOOTSTRAP_ORG_ID} sentinel from
 * `@openheaders/core/sync` and are filtered out by the empty set
 * without a special case.
 */
export function authorizedOrgIds(snapshot: IdentitySnapshot | null): ReadonlySet<string> {
  if (!snapshot) return new Set();
  return new Set(snapshot.orgs.keys());
}

/** Inputs for {@link canPublishWorkspace} — the workspace + the Org to publish into. */
export interface PublishGateContext {
  /** The workspace whose `orgId` would be re-homed. */
  workspaceId: string;
  /** The authenticated backend's `Org` the workspace would be published into. */
  targetOrgId: string;
}

/**
 * The Phase U5.6 Publish gate — whether this identity may re-home a
 * workspace into an authenticated backend's `Org` (UNIFIED_ORACLE_
 * MODEL.md §6.5). Publish is the only path data travels UP to a LAN /
 * WAN backend, so it carries a stricter gate than the local-only
 * Combine: BOTH conditions must hold.
 *
 *   1. `workspace.write` on the workspace — the caller owns/edits the
 *      data it is about to push up.
 *   2. The target `Org` is in the authorized (joined) set — a join
 *      (U5.2) must have landed the backend's `Org` first. Publishing
 *      into an unjoined `Org` would strand the workspace under a
 *      binding that won't sync.
 *
 * Pure over the snapshot; the dispatcher resolves it via
 * `getIdentitySnapshot()` and maps a deny onto the `target-not-
 * authorized` Publish failure reason.
 */
export function canPublishWorkspace(snapshot: IdentitySnapshot | null, ctx: PublishGateContext): CapabilityDecision {
  const write = hasCapability(snapshot, 'workspace.write', { workspaceId: ctx.workspaceId });
  if (!write.allow) return write;
  if (!authorizedOrgIds(snapshot).has(ctx.targetOrgId)) {
    return { allow: false, reason: 'target-org-not-authorized' };
  }
  return { allow: true };
}
