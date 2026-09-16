/**
 * Peer-facing DELEGATED request plane — the Execution Place plan's
 * second channel family beside `peer-requests-rpc.ts`. A context
 * send hands this host an entity to RESOLVE against this host's own
 * workspace, vault, jar and scripts (the CLI, MCP, chains, the web tab
 * until its convergence); a DELEGATED send hands it a request the
 * sending surface already resolved — the transport seam's own shape,
 * final bytes and knobs — and asks only for the socket. This plane
 * opens it, streams the raw response back and stamps where it ran.
 * Nothing here reads the workspace: the frame's `workspaceId` is the
 * gate's subject, never a resolution scope.
 *
 * Gating, in order (the ratified S2 decision — the same gate as the
 * context family, no new capability):
 *
 *   1. The two-tier egress opt-in (`peer-execute-opt-in.ts`) — refused
 *      before any identity resolution, no audit row.
 *   2. The frame MUST name its workspace: the `workspace-server` role
 *      is by definition the workspace's own providing back-end, and the
 *      desktop app on this device resolves its paired user as the
 *      operator; a frame naming a workspace this host lacks meets the
 *      resolver's honest denial. No fallback to the active workspace —
 *      a delegated frame is never "this host's" send.
 *   3. `workspace.write` as the peer's user on that workspace, audited
 *      (network egress on a peer's behalf — the context family's tier).
 *   4. Structural validation of the resolved request (a peer's input);
 *      a malformed frame answers a structured refusal.
 *
 * The send rides the SAME active-send registry as a context send, so
 * the caller's `abortRequestSend` is its Stop, and the SAME
 * flush-batched `requestStreamEvent` emitter fans the head and body
 * chunks back to the calling user's peers. The context does everything
 * after the answer: its snapshot, its jar, its scripts.
 */

import { emitAuditEntry, hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import { DELEGATE_REQUEST_CHANNEL, DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE } from '@openheaders/core/protocol';
import {
  type DelegatedExecutedOn,
  type DelegatedRequestResult,
  type ParsedDelegatedRequestFrame,
  parseDelegatedRequestFrame,
} from '@openheaders/oracle/live/request-exec/delegated-wire';
import { createStreamEmitter, registerActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { type RequestTransport, TransportError } from '@openheaders/oracle/live/request-exec/transport';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { hostDisplayLabel } from './host-os';
import { assertPeerExecuteAllowed } from './peer-execute-opt-in';
import { peerStreamFrameSink } from './peer-stream-sinks';

export interface DelegatedRequestsRpcOptions {
  /** Injectable for tests; defaults to the node transport (the
   *  dispatcher cache is module-global, so this instance shares every
   *  agent tuple with the context family's). */
  transport?: RequestTransport;
}

export function createDelegatedRequestsRpc(options: DelegatedRequestsRpcOptions = {}): WsPeerRpcHooks {
  const transport = options.transport ?? createNodeRequestTransport();
  return {
    owns(type: string): boolean {
      return type === DELEGATE_REQUEST_CHANNEL;
    },
    async dispatch(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<DelegatedRequestResult> {
      await assertPeerExecuteAllowed(peer);
      const workspaceId =
        typeof message.workspaceId === 'string' && message.workspaceId !== '' ? message.workspaceId : null;
      if (workspaceId === null) throw new Error(DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE);
      const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
      const decision = hasCapability(snapshot, 'workspace.write', { workspaceId });
      emitAuditEntry({ actorUserId: peer.userId, capability: 'workspace.write', workspaceId, decision });
      if (!decision.allow) {
        throw new Error(`permission denied: workspace.write on ${workspaceId} (${decision.reason ?? 'denied'})`);
      }
      // Egress attribution: THIS machine opens (or fails to open) the
      // socket on the peer's behalf — the target sees its address.
      const executedOn: DelegatedExecutedOn = { kind: 'backend', name: hostDisplayLabel() };
      const parsed = parseDelegatedRequestFrame(message);
      if (!parsed.ok) return { success: false, error: parsed.error, executedOn };
      return runDelegatedSend(parsed.frame, transport, peerStreamFrameSink(peer.userId), executedOn);
    },
  };
}

/**
 * One delegated exchange: the emitter and the Stop hook exist only
 * while the socket is open; the transport's classified failure rides
 * back as the refusal with its hint (the context stamps it on its own
 * error snapshot). An abort or mid-body failure after the head arrived
 * resolves with the partial body and `streamEndedEarly`, exactly as the
 * seam promises an in-process caller.
 */
async function runDelegatedSend(
  frame: ParsedDelegatedRequestFrame,
  transport: RequestTransport,
  emitFrame: Parameters<typeof createStreamEmitter>[1],
  executedOn: DelegatedExecutedOn,
): Promise<DelegatedRequestResult> {
  const emitter = createStreamEmitter(frame.sendId, emitFrame);
  const controller = new AbortController();
  const unregister = registerActiveSend(frame.sendId, () => controller.abort());
  try {
    const response =
      transport.sendStreaming !== undefined
        ? await transport.sendStreaming(
            frame.request,
            {
              onHead: (head) =>
                emitter.head({
                  status: head.status,
                  statusText: head.statusText,
                  url: head.url,
                  headers: [...head.headers],
                }),
              onChunk: (bytes, totalBytes) => emitter.chunk(bytes, totalBytes),
            },
            controller.signal,
          )
        : await transport.send(frame.request);
    return { success: true, response, executedOn };
  } catch (err) {
    const hint = err instanceof TransportError ? err.hint : undefined;
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      ...(hint !== undefined ? { hint } : {}),
      executedOn,
    };
  } finally {
    emitter.done();
    unregister();
  }
}
