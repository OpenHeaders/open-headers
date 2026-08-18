/**
 * Host-neutral capability resolver — the single code path every host runs
 * before applying a privileged action (the unified-oracle model §5.8).
 *
 * Reads from a synchronous snapshot of the identity rows persisted by
 * `ensureSyntheticIdentity` + `ensureWorkspaceRoleAssignments`. Synthetic
 * rows resolve to ALLOW via the same branches a real Org / real WRA would
 * — no `if (mode === ...)` checks, no `user.isStandalone` gating (the
 * `isStandalone` / `isPrivate` flags are informational per §5.3).
 */

import type { DaemonAdmin, Org, OrgMembership, Principal, User, WorkspaceRoleAssignment } from '../types';

/**
 * The capability axis. Slice 1 ships the three privileges the renderer→SW
 * dispatch boundary needs to gate; finer-grained verbs (e.g. `vault.read`,
 * `rule.publish`) layer on top in later slices without changing the
 * resolver contract.
 */
export type Capability =
  | 'workspace.read'
  | 'workspace.write'
  | 'workspace.observe'
  | 'workspace.list'
  | 'workspace.create'
  | 'daemon.admin';

/**
 * The `OrgMembership.functionalRoles` entry that grants a directory user
 * `workspace.create`. Toggled per user via the daemon admin surface;
 * `owner`/`admin` primary roles and LocalAdmin hold the capability
 * implicitly.
 */
export const WORKSPACE_CREATE_FUNCTIONAL_ROLE = 'workspace.create';

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
  | 'workspace-create-not-granted'
  | 'not-daemon-admin'
  | 'unknown-capability'
  | 'auth-required'
  | 'seat-limit-reached'
  | 'personal-seats-disabled'
  | 'personal-license-invalid'
  | 'personal-license-identity-mismatch'
  | 'personal-license-no-identity';

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
   * single private home Org; multi-org membership (real team Orgs
   * joined via a daemon) folds more rows in without changing the shape.
   * Consulted by the org-catalogue helpers that drive the workspace
   * org-binding UI (the unified-oracle model §6.2 / §6.4).
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

  if (capability === 'workspace.create') {
    // Org-scoped, not workspace-scoped — no WRA exists yet for the
    // workspace being minted. LocalAdmin and org owners/admins hold it
    // implicitly; a plain member needs the functional-role grant.
    if (snapshot.localAdmin) {
      return { allow: true };
    }
    const { primaryRole, functionalRoles } = snapshot.membership;
    if (primaryRole === 'owner' || primaryRole === 'admin') {
      return { allow: true };
    }
    return functionalRoles.includes(WORKSPACE_CREATE_FUNCTIONAL_ROLE)
      ? { allow: true }
      : { allow: false, reason: 'workspace-create-not-granted' };
  }

  if (capability === 'workspace.read' || capability === 'workspace.write' || capability === 'workspace.observe') {
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
    // `workspace.observe` (the agent-traffic plan §4): live-traffic
    // observation is a categorically larger grant than a config read,
    // so a viewer's `workspace.read` deliberately does not carry it —
    // the same owner/editor floor as `workspace.write`.
    return wra.role === 'owner' || wra.role === 'editor'
      ? { allow: true }
      : { allow: false, reason: 'insufficient-workspace-role' };
  }

  return { allow: false, reason: 'unknown-capability' };
}

/**
 * The set of org ids this host is authorized to read envelopes for —
 * both at the sender-side transport readers and at the receiver-side
 * ingest filter (the unified-oracle model §6.1, §8.2, §10.2 — "one sync
 * filter"). State-vector reader, delta-stream reader, snapshot builder,
 * and the inbound `applyInboundMutationBatch` ingest path all enforce
 * `envelope.orgId ∈ authorizedOrgIds(...)`.
 *
 * The authorized set is **every Org the identity belongs to** —
 * `snapshot.orgs`, which the registry keeps in lockstep with the
 * persisted membership rows. A fresh V5 install carries exactly one
 * (the private home Org). Joining another backend adds that backend's
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

/**
 * The subset of {@link authorizedOrgIds} this identity *consumes* from a
 * joined backend — every authorized Org minus the identity's own home Org
 * (the unified-oracle model §6.5, Phase U6).
 *
 * A fresh V5 install carries only its private home Org, so this set is
 * empty — nothing is consumed, nothing syncs down. After a join (U5.2)
 * the backend's Org folds into `snapshot.orgs`; it is authorized but not
 * the home Org, so it appears here.
 *
 * This is the Phase U6 outbound filter's allow-set: the joiner emits an
 * envelope onto the wire only when its `orgId` is a consumed Org. Own-Org
 * envelopes never go up (the backend would drop them anyway — U6 stops
 * the wasteful send at the source).
 *
 * Pre-bootstrap / null snapshot → empty set.
 */
export function consumedOrgIds(snapshot: IdentitySnapshot | null): ReadonlySet<string> {
  if (!snapshot) return new Set();
  const homeOrgId = snapshot.user.homeOrgId;
  const consumed = new Set<string>();
  for (const orgId of snapshot.orgs.keys()) {
    if (orgId !== homeOrgId) consumed.add(orgId);
  }
  return consumed;
}
