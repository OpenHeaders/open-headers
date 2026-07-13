/**
 * Peer-facing request-execution plane — answers the workbench request
 * channels (`executeRequest` + the cookie-jar trio) for WS peers, with
 * the per-frame gating law the peer admin plane established: the PEER's
 * identity snapshot resolves fresh on every call (a revocation bites
 * the next frame), the decision gates on a workspace CAPABILITY as the
 * authenticated user, and every capability decision is audited.
 *
 * Tiering mirrors the MCP execute precedent, in order:
 *
 *   1. `executeRequest` only: the daemon-side opt-in
 *      (`backend.allowPeerExecute`, default OFF, read fresh from the
 *      settings record per frame) — network egress on a peer's behalf
 *      is an operator decision, never implied by pairing. The refusal
 *      is honest (it names the setting), not the admin plane's uniform
 *      deny: this channel's existence is public contract.
 *   2. Capability as the peer's user on the TARGET workspace —
 *      `workspace.write` for a send (the MCP execute mapping) and for
 *      the destructive jar clear and per-entry delete;
 *      `workspace.read` for the value-free jar summary. The jar channels carry no opt-in: they ride
 *      authenticated admission + this per-workspace RBAC.
 *
 * The gates live HERE, beside the channel table — the in-process
 * `dispatchRpc` reaches the same handlers ungated because its caller
 * is the operator by construction.
 */

import {
  type Capability,
  emitAuditEntry,
  hasCapability,
  resolveDaemonPeerIdentitySnapshot,
} from '@openheaders/core/identity';
import { hostStorage, OH } from '@openheaders/core/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { peekCookieJar } from '../live/cookie-jar';
import { type ExecuteRequestRpcResult, handleExecuteRequestRpc } from './execute-request-rpc';

/** Honest opt-in refusal — the web seam renders it on the Send surface. */
export const PEER_EXECUTE_DISABLED_MESSAGE =
  'Sending requests from connected devices is disabled on this host. Enable it in Settings → Backend.';

const CAPABILITY_BY_CHANNEL: Record<string, Capability> = {
  executeRequest: 'workspace.write',
  getCookieJarSummary: 'workspace.read',
  clearCookieJar: 'workspace.write',
  deleteCookieJarEntry: 'workspace.write',
};

export interface PeerRequestsRpcOptions {
  /** Injectable for tests; defaults to the real handler (shared transport singleton). */
  executeRequest?: (message: Record<string, unknown>) => Promise<ExecuteRequestRpcResult>;
}

async function peerExecuteAllowed(): Promise<boolean> {
  const values = (await hostStorage.get(OH.settingsUser)) ?? {};
  return (values as Record<string, unknown>)['backend.allowPeerExecute'] === true;
}

export function createPeerRequestsRpc(options: PeerRequestsRpcOptions = {}): WsPeerRpcHooks {
  const executeRequest = options.executeRequest ?? handleExecuteRequestRpc;

  return {
    owns(type: string): boolean {
      return type in CAPABILITY_BY_CHANNEL;
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;

      // Opt-in tier first — like the MCP tier gate it refuses before
      // any identity resolution and emits no audit row (no capability
      // decision was made).
      if (type === 'executeRequest' && !(await peerExecuteAllowed())) {
        throw new Error(PEER_EXECUTE_DISABLED_MESSAGE);
      }

      // Capability tier — the target workspace is the one the frame
      // names; an unstated one resolves to this host's active workspace,
      // matching the handlers' own fallback.
      const workspaceId =
        typeof message.workspaceId === 'string' ? message.workspaceId : (getActiveWorkspaceId() ?? 'default');
      const capability = CAPABILITY_BY_CHANNEL[type];
      const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
      const decision = hasCapability(snapshot, capability, { workspaceId });
      emitAuditEntry({ actorUserId: peer.userId, capability, workspaceId, decision });
      if (!decision.allow) {
        throw new Error(`permission denied: ${capability} on ${workspaceId} (${decision.reason ?? 'denied'})`);
      }

      switch (type) {
        case 'executeRequest':
          return await executeRequest(message);
        case 'getCookieJarSummary':
          return { cookies: peekCookieJar(workspaceId)?.list() ?? [] };
        case 'clearCookieJar':
          peekCookieJar(workspaceId)?.clear();
          return { success: true };
        case 'deleteCookieJarEntry':
          if (
            typeof message.name === 'string' &&
            typeof message.domain === 'string' &&
            typeof message.path === 'string'
          ) {
            peekCookieJar(workspaceId)?.delete(message.name, message.domain, message.path);
          }
          return { success: true };
        default:
          // Unreachable by construction — `owns` gated entry.
          throw new Error(`peer-requests: unknown channel '${type}'`);
      }
    },
  };
}
