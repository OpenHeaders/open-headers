/**
 * Peer-facing leave-a-workspace verb (the access-foundation plan §8 F2,
 * QD) — the self-service inverse of an admin grant.
 *
 * `leaveWorkspace` acts only on the CALLER's own principal: the caller
 * names a workspace, never a user, so the channel needs no capability
 * gate beyond authenticated admission — dropping your own grant is the
 * one act every granted user may take. Leaving IS a self-revoke: the
 * WRA row is dropped (a re-grant is a fresh grant, no declined state),
 * audited as `daemon.workspace-leave`, and the same retraction fan-out
 * the admin revoke rides (S5c) evicts the workspace from all of the
 * leaver's open tabs — the calling one included, so the UI needs no
 * second removal path.
 *
 * A managed row refuses: `origin: 'idp'` is owned by the per-login
 * claims reconcile, which would silently re-mint the pair on the next
 * login — leaving it would be a lie, so the refusal names the identity
 * provider (the SSO declared floor is deliberately unleavable, the
 * Slack-#general posture). Any OTHER origin value a newer server may
 * stamp refuses too (deny-by-default on enforcement, the F1 tolerance
 * law): only an origin-less manual grant is the caller's to drop.
 */

import {
  emitAuditEntry,
  listDaemonUsers,
  listWorkspaceRolesForPrincipal,
  revokeWorkspaceRole,
} from '@openheaders/core/identity';
import type { OracleWsServer, WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { retractWorkspaceRowsFromUserPeers } from './grant-workspace-retract';

export const LEAVE_WORKSPACE_CHANNEL = 'leaveWorkspace';

export interface PeerWorkspaceLeaveDeps {
  getWsServer(): OracleWsServer | null;
}

export function createPeerWorkspaceLeaveRpc(deps: PeerWorkspaceLeaveDeps): WsPeerRpcHooks {
  return {
    owns(type: string): boolean {
      return type === LEAVE_WORKSPACE_CHANNEL;
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      if (!workspaceId) return { ok: false, error: 'missing workspaceId' };
      const record = (await listDaemonUsers()).find((r) => r.user.id === peer.userId);
      if (!record) return { ok: false, error: 'unknown user' };
      const row = (await listWorkspaceRolesForPrincipal(record.principal.id)).find(
        (wra) => wra.workspaceId === workspaceId,
      );
      if (!row) return { ok: false, reason: 'not-granted', error: 'you hold no grant on this workspace' };
      if (row.origin !== undefined) {
        return {
          ok: false,
          reason: 'managed',
          error:
            row.origin === 'idp'
              ? 'this workspace grant is managed by your identity provider'
              : 'this workspace grant is managed and cannot be left',
        };
      }
      const revoked = await revokeWorkspaceRole(record.principal.id, workspaceId);
      if (!revoked.ok) return { ok: false, error: revoked.reason };
      emitAuditEntry({
        actorUserId: record.user.id,
        capability: 'daemon.workspace-leave',
        workspaceId,
        decision: { allow: true },
      });
      await retractWorkspaceRowsFromUserPeers(record.user.id, [workspaceId], deps.getWsServer);
      return { ok: true };
    },
  };
}
