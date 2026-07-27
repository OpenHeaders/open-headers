/**
 * Peer-facing request-execution plane — answers the workbench request
 * channels (`executeRequest` / `executeGrpcRequest` + the
 * `abortRequestSend` stop counterpart and the gRPC upstream riders
 * `sendGrpcStreamMessage` / `endGrpcClientStream`, the cookie-jar trio,
 * the script-posture fact, and the `getCliStatusSummary` probe) for WS
 * peers, with
 * the per-frame gating law the peer admin plane established: the PEER's
 * identity snapshot resolves fresh on every call (a revocation bites
 * the next frame), the decision gates on a workspace CAPABILITY as the
 * authenticated user, and every capability decision is audited.
 *
 * Tiering mirrors the MCP execute precedent, in order:
 *
 *   1. `executeRequest` / `executeGrpcRequest`: the daemon-side opt-in
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

import type { GrpcStreamEventWire, RequestStreamEventWire } from '@openheaders/core/bridge';
import {
  type Capability,
  emitAuditEntry,
  hasCapability,
  resolveDaemonPeerIdentitySnapshot,
} from '@openheaders/core/identity';
import { PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  endActiveGrpcClientStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { peekCookieJar } from '../live/cookie-jar';
import type { CliProvisionStatus } from './cli-provision';
import { type ExecuteGrpcRequestRpcResult, handleExecuteGrpcRequestRpc } from './execute-grpc-request-rpc';
import { type ExecuteRequestRpcResult, handleExecuteRequestRpc } from './execute-request-rpc';
import { hostDisplayLabel } from './host-os';
import { getHostScriptCapability } from './script-capability';
import { getWsPeerServer } from './ws-peer-slot';

/** Honest opt-in refusal — canonical string lives in the protocol
 *  vocabulary (browser surfaces match it to render host-aware
 *  guidance); re-exported here for this plane's callers and tests. */
export { PEER_EXECUTE_DISABLED_MESSAGE };

const CAPABILITY_BY_CHANNEL: Record<string, Capability> = {
  executeRequest: 'workspace.write',
  // The GrpcRequest entity's Invoke — same tier as the HTTP send: it
  // is network egress on a peer's behalf, so it shares the opt-in AND
  // the write capability.
  executeGrpcRequest: 'workspace.write',
  getCookieJarSummary: 'workspace.read',
  clearCookieJar: 'workspace.write',
  deleteCookieJarEntry: 'workspace.write',
  // Value-free host fact (does a forwarded send run scripts, and in
  // which mode) — read-tier like the jar summary: authenticated
  // admission + per-workspace RBAC, no opt-in.
  getScriptRuntimeInfo: 'workspace.read',
};

export interface PeerRequestsRpcOptions {
  /** Injectable for tests; defaults to the real handler (shared transport singleton). */
  executeRequest?: (
    message: Record<string, unknown>,
    emitStreamFrame: (event: RequestStreamEventWire) => void,
  ) => Promise<ExecuteRequestRpcResult>;
  /** Injectable for tests; defaults to the real gRPC handler. */
  executeGrpcRequest?: (
    message: Record<string, unknown>,
    emitStreamEvent: (event: GrpcStreamEventWire) => void,
  ) => Promise<ExecuteGrpcRequestRpcResult>;
  /**
   * The `getCliStatusSummary` backing — the spine's CLI provisioning
   * service, derived live per call (same truth as the settings card).
   * Absent (test rigs composed without it) the probe answers
   * `{ state: null }` — unknown, never a fabricated state.
   */
  cliStatus?: () => Promise<CliProvisionStatus>;
}

async function peerExecuteAllowed(): Promise<boolean> {
  const values = (await hostStorage.get(OH.settingsUser)) ?? {};
  return (values as Record<string, unknown>)['backend.allowPeerExecute'] === true;
}

/**
 * Live-frame sink for a peer-forwarded send: frames go back down the
 * backend wire to the CALLING user's connected peers (the same-user law
 * the awareness fan-out holds — the caller's surface filters by its
 * minted `sendId`; the user's other surfaces ignore unknown ids). The
 * server slot is re-read per frame so bind swaps flow through; frames
 * are display-only hints, so a dead slot just drops them.
 */
function peerStreamFrameSink(userId: string): (event: RequestStreamEventWire) => void {
  return (event) => {
    getWsPeerServer()?.broadcastFrame(
      { type: 'requestStreamEvent', payload: event },
      { filterPeer: (peer) => peer.userId === userId },
    );
  };
}

/** The gRPC twin — `grpcStreamEvent` frames for a forwarded streaming
 *  invoke fan back under the same same-user law and drop-safety. */
function peerGrpcStreamFrameSink(userId: string): (event: GrpcStreamEventWire) => void {
  return (event) => {
    getWsPeerServer()?.broadcastFrame(
      { type: 'grpcStreamEvent', payload: event },
      { filterPeer: (peer) => peer.userId === userId },
    );
  };
}

export function createPeerRequestsRpc(options: PeerRequestsRpcOptions = {}): WsPeerRpcHooks {
  const executeRequest =
    options.executeRequest ??
    ((message: Record<string, unknown>, emitStreamFrame: (event: RequestStreamEventWire) => void) =>
      handleExecuteRequestRpc(message, undefined, emitStreamFrame));
  const executeGrpcRequest =
    options.executeGrpcRequest ??
    ((message: Record<string, unknown>, emitStreamEvent: (event: GrpcStreamEventWire) => void) =>
      handleExecuteGrpcRequestRpc(message, undefined, emitStreamEvent));

  return {
    owns(type: string): boolean {
      return (
        type === 'abortRequestSend' ||
        type === 'sendGrpcStreamMessage' ||
        type === 'endGrpcClientStream' ||
        type === 'getCliStatusSummary' ||
        type in CAPABILITY_BY_CHANNEL
      );
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<unknown> {
      const type = message.type as string;

      // Stop rides ahead of the capability tier: the frame carries no
      // workspace to gate on, and the caller-minted `sendId` (an
      // unguessable UUID handed out by this host's own executeRequest
      // admission) IS the authorization — the action only cancels the
      // caller's own exchange, it reads nothing. Authenticated
      // admission still gates entry; no capability decision is made,
      // so no audit row (the opt-in tier precedent).
      if (type === 'abortRequestSend') {
        return { success: typeof message.sendId === 'string' && stopActiveSend(message.sendId) };
      }
      // The gRPC upstream riders share that posture verbatim: keyed by
      // the caller's own sendId, they write into / half-close only the
      // caller's open stream — sendId-authorized, no capability row.
      if (type === 'sendGrpcStreamMessage') {
        return typeof message.sendId === 'string' && typeof message.messageText === 'string'
          ? sendActiveGrpcStreamMessage(message.sendId, message.messageText)
          : { success: false, error: 'No stream id or message provided' };
      }
      if (type === 'endGrpcClientStream') {
        return { success: typeof message.sendId === 'string' && endActiveGrpcClientStream(message.sendId) };
      }

      // CLI-status probe — the extension Add-ons row's honest state.
      // Authenticated admission is the whole gate (the admin.status
      // probe posture): a question the UI asks on every popover open,
      // not an enforcement decision, so no identity resolution and no
      // audit row. The payload is the coarse state alone — configPath,
      // tokenId, label, daemonUrl, and parse-error text stay on this
      // machine. A missing backing or a failed read answers `null`
      // (unknown), never a fabricated state.
      if (type === 'getCliStatusSummary') {
        if (!options.cliStatus) return { state: null };
        try {
          return { state: (await options.cliStatus()).state };
        } catch {
          return { state: null };
        }
      }

      // Opt-in tier first — like the MCP tier gate it refuses before
      // any identity resolution and emits no audit row (no capability
      // decision was made).
      if ((type === 'executeRequest' || type === 'executeGrpcRequest') && !(await peerExecuteAllowed())) {
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
        case 'executeRequest': {
          // Egress attribution: THIS machine made (or attempted) the
          // connection on the peer's behalf — the target saw its IP and
          // network locale, not the calling surface's. Stamped at run
          // time on success and error snapshots alike; refusals throw
          // above and carry no snapshot to stamp.
          const result = await executeRequest(message, peerStreamFrameSink(peer.userId));
          return result.snapshot
            ? { ...result, snapshot: { ...result.snapshot, executedOn: { kind: 'backend', name: hostDisplayLabel() } } }
            : result;
        }
        case 'executeGrpcRequest': {
          // Same egress-attribution stamp as the HTTP branch — this
          // machine dialed the gRPC target on the peer's behalf.
          const result = await executeGrpcRequest(message, peerGrpcStreamFrameSink(peer.userId));
          return result.snapshot
            ? { ...result, snapshot: { ...result.snapshot, executedOn: { kind: 'backend', name: hostDisplayLabel() } } }
            : result;
        }
        case 'getCookieJarSummary':
          return { cookies: peekCookieJar(workspaceId)?.list() ?? [] };
        case 'getScriptRuntimeInfo':
          // Forwarded sends only ever ride Safe — the answer is the
          // Safe capability's presence, never the mode slot.
          return { scriptRuntime: getHostScriptCapability('safe') !== null ? 'safe' : null };
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
