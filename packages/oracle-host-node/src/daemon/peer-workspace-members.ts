/**
 * Peer-facing workspace-members plane (the access-foundation plan §8
 * F4) — owner self-service grant management, the `leaveWorkspace`
 * sibling: the OWNER of a workspace manages its grants without
 * `daemon.admin` (the F1 owner-membership semantic).
 *
 * Three channels, all resolving the caller's identity snapshot fresh
 * per frame (a revocation bites the very next call):
 *
 *   - `listWorkspaceMembers` — any granted user may list the
 *     workspace's members (`workspace.read` floor: you may see who else
 *     can see what you see). Owners additionally get the grantable
 *     candidates — ACTIVE directory principals with no row on this
 *     workspace, projected minimally (name, email, kind) so the picker
 *     works without exposing roles, grants, or last-seen.
 *   - `grantWorkspaceMember` — upsert, gated on the caller's owner row.
 *     Assigns `editor | viewer` ONLY: the plane never touches an owner
 *     row (no co-owner minting, no owner demotion — owner grants stay
 *     on the admin plane), refuses managed (`origin`-stamped) rows
 *     deny-by-default (the F1 tolerance law, same line the leave verb
 *     draws), and a NEW grant rides the live workspace offer.
 *   - `revokeWorkspaceMember` — same gate and boundaries; the revoke
 *     rides the S5c retraction fan-out so the member's open tabs evict
 *     the workspace live.
 *
 * Mutations stamp the OWNER-gate decision under the dedicated
 * `daemon.workspace-grant` / `daemon.workspace-revoke` vocabulary —
 * allow rows even when the domain then refuses (the gate decision is
 * the audited fact, the peer-admin-rpc discipline); the list read is
 * unaudited like the visibility probe.
 */

import {
  daemonUserPrincipalKind,
  emitAuditEntry,
  grantWorkspaceRole,
  hasCapability,
  type IdentitySnapshot,
  listDaemonUsers,
  listWorkspaceRolesForWorkspace,
  resolveDaemonPeerIdentitySnapshot,
  revokeWorkspaceRole,
} from '@openheaders/core/identity';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { DaemonUserRecord, WorkspaceRoleAssignment } from '@openheaders/core/types';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { OracleWsServer, WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { offerWorkspaceRowsToUserPeers } from './grant-workspace-offer';
import { retractWorkspaceRowsFromUserPeers } from './grant-workspace-retract';

export const LIST_WORKSPACE_MEMBERS_CHANNEL = 'listWorkspaceMembers';
export const GRANT_WORKSPACE_MEMBER_CHANNEL = 'grantWorkspaceMember';
export const REVOKE_WORKSPACE_MEMBER_CHANNEL = 'revokeWorkspaceMember';

export interface PeerWorkspaceMembersDeps {
  getWsServer(): OracleWsServer | null;
}

interface MemberProjection {
  userId: string;
  displayName: string;
  email: string | null;
  kind: string;
  role: string;
  origin?: string;
  operator?: boolean;
}

function managedRefusal(origin: string): { ok: false; reason: 'managed'; error: string } {
  return {
    ok: false,
    reason: 'managed',
    error:
      origin === 'idp'
        ? 'this workspace grant is managed by the identity provider'
        : 'this workspace grant is managed and cannot be changed here',
  };
}

const OWNER_MANAGED_REFUSAL = {
  ok: false,
  reason: 'owner-managed',
  error: 'owner grants are managed by a server admin',
} as const;

function memberEmail(record: DaemonUserRecord): string | null {
  return record.userIdentity.kind === 'email' ? record.userIdentity.value : null;
}

/**
 * The owner gate for a mutation frame: the caller's OWN row on the
 * workspace must carry the owner role — `localAdmin` deliberately
 * confers nothing here (admin ≠ data-access; the operator holds real
 * owner rows via the boot reconcile, so no bypass is needed).
 */
function ownerGateDecision(
  snapshot: IdentitySnapshot | null,
  workspaceId: string,
): { allow: boolean; reason?: 'no-current-user' | 'no-workspace-role-assignment' | 'insufficient-workspace-role' } {
  if (!snapshot) return { allow: false, reason: 'no-current-user' };
  const wra = snapshot.wraByWorkspaceId.get(workspaceId);
  if (!wra) return { allow: false, reason: 'no-workspace-role-assignment' };
  if (wra.role !== 'owner') return { allow: false, reason: 'insufficient-workspace-role' };
  return { allow: true };
}

async function projectMembers(
  rows: readonly WorkspaceRoleAssignment[],
): Promise<{ members: MemberProjection[]; grantedPrincipalIds: Set<string> }> {
  const members: MemberProjection[] = [];
  const grantedPrincipalIds = new Set<string>();
  const identity = await hostStorage.get(OH.syntheticIdentity);
  const records = await listDaemonUsers();
  const byPrincipalId = new Map(records.map((r) => [r.principal.id, r]));
  for (const wra of rows) {
    grantedPrincipalIds.add(wra.principalId);
    if (identity && wra.principalId === identity.principal.id) {
      members.push({
        userId: identity.user.id,
        displayName: identity.user.displayName,
        email: identity.userIdentity.kind === 'email' ? identity.userIdentity.value : null,
        kind: 'user',
        role: wra.role,
        ...(wra.origin !== undefined ? { origin: wra.origin } : {}),
        operator: true,
      });
      continue;
    }
    const record = byPrincipalId.get(wra.principalId);
    // Orphan rows (no directory record) and deactivated principals are
    // not members — a deactivated user cannot access anything, and the
    // forensic row is the admin plane's to see.
    if (!record || record.deactivatedAt !== null) continue;
    members.push({
      userId: record.user.id,
      displayName: record.user.displayName,
      email: memberEmail(record),
      kind: daemonUserPrincipalKind(record),
      role: wra.role,
      ...(wra.origin !== undefined ? { origin: wra.origin } : {}),
    });
  }
  return { members, grantedPrincipalIds };
}

export function createPeerWorkspaceMembersRpc(deps: PeerWorkspaceMembersDeps): WsPeerRpcHooks {
  return {
    owns(type: string): boolean {
      return (
        type === LIST_WORKSPACE_MEMBERS_CHANNEL ||
        type === GRANT_WORKSPACE_MEMBER_CHANNEL ||
        type === REVOKE_WORKSPACE_MEMBER_CHANNEL
      );
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      if (!workspaceId) return { ok: false, error: 'missing workspaceId' };
      const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);

      if (type === LIST_WORKSPACE_MEMBERS_CHANNEL) {
        const read = hasCapability(snapshot, 'workspace.read', { workspaceId });
        if (!read.allow) {
          return { ok: false, reason: 'not-granted', error: 'you hold no grant on this workspace' };
        }
        const rows = await listWorkspaceRolesForWorkspace(workspaceId);
        const { members, grantedPrincipalIds } = await projectMembers(rows);
        const callerRole = snapshot?.wraByWorkspaceId.get(workspaceId)?.role ?? null;
        if (callerRole !== 'owner') return { ok: true, callerRole, members };
        // Owner-only: the add picker's candidates — active, not yet
        // granted, minimally projected.
        const candidates = (await listDaemonUsers())
          .filter((r) => r.deactivatedAt === null && !grantedPrincipalIds.has(r.principal.id))
          .map((r) => ({
            userId: r.user.id,
            displayName: r.user.displayName,
            email: memberEmail(r),
            kind: daemonUserPrincipalKind(r),
          }));
        return { ok: true, callerRole, members, candidates };
      }

      const gate = ownerGateDecision(snapshot, workspaceId);
      emitAuditEntry({
        actorUserId: peer.userId,
        capability: type === GRANT_WORKSPACE_MEMBER_CHANNEL ? 'daemon.workspace-grant' : 'daemon.workspace-revoke',
        workspaceId,
        decision: gate,
      });
      if (!gate.allow) {
        return { ok: false, reason: 'not-owner', error: 'only a workspace owner can manage its members' };
      }

      const userId = typeof message.userId === 'string' ? message.userId : '';
      if (!userId) return { ok: false, error: 'missing userId' };
      const record = (await listDaemonUsers()).find((r) => r.user.id === userId);
      if (!record) return { ok: false, error: 'unknown user' };
      const row = (await listWorkspaceRolesForWorkspace(workspaceId)).find(
        (wra) => wra.principalId === record.principal.id,
      );

      if (type === GRANT_WORKSPACE_MEMBER_CHANNEL) {
        const role = typeof message.role === 'string' ? message.role : '';
        if (role !== 'editor' && role !== 'viewer') {
          return { ok: false, error: 'role must be editor or viewer' };
        }
        if (record.deactivatedAt !== null) return { ok: false, error: 'user is deactivated' };
        // Validate against the live workspace set, the users.grant
        // posture — refuse up front instead of minting a row the next
        // reconcile silently drops.
        if (!getWorkspace(workspaceId)) return { ok: false, error: 'unknown workspace' };
        if (row?.role === 'owner') return OWNER_MANAGED_REFUSAL;
        if (row?.origin !== undefined) return managedRefusal(row.origin);
        const result = await grantWorkspaceRole({ principalId: record.principal.id, workspaceId, role });
        if (!result.ok) return { ok: false, error: result.reason };
        if (!row) {
          // A fresh grant reaches the member's already-open tabs now; a
          // role change moves no rows, so nothing rides.
          await offerWorkspaceRowsToUserPeers(record.user.id, [workspaceId], deps.getWsServer);
        }
        return { ok: true, updated: result.updated };
      }

      if (!row) return { ok: false, reason: 'not-granted', error: 'this user holds no grant on this workspace' };
      if (row.role === 'owner') return OWNER_MANAGED_REFUSAL;
      if (row.origin !== undefined) return managedRefusal(row.origin);
      const revoked = await revokeWorkspaceRole(record.principal.id, workspaceId);
      if (!revoked.ok) return { ok: false, error: revoked.reason };
      await retractWorkspaceRowsFromUserPeers(record.user.id, [workspaceId], deps.getWsServer);
      return { ok: true };
    },
  };
}
