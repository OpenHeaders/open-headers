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
 * Two exchanges ride it, one per transport seam: the HTTP send
 * (`delegateRequest` — the head and body chunks fanned live as
 * `requestStreamEvent` frames) and the UNARY gRPC call
 * (`delegateGrpcInvoke` — the message the context encoded against the
 * spec IT holds, the whole reply answered at once; the streaming
 * shapes are sockets and ride `delegated-sockets-rpc.ts`).
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
 * Both exchanges ride the SAME active-send registry as a context send,
 * so the caller's `abortRequestSend` is its Stop. The HTTP send's
 * flush-batched `requestStreamEvent` emitter fans the head and body
 * chunks back to the calling user's peers. The context does everything
 * after the answer: its snapshot, its jar, its scripts.
 */

import { emitAuditEntry, hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import {
  DELEGATE_GRPC_INVOKE_CHANNEL,
  DELEGATE_REQUEST_CHANNEL,
  DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE,
} from '@openheaders/core/protocol';
import {
  type DelegatedGrpcInvokeResult,
  encodeDelegatedGrpcResponse,
  parseDelegatedGrpcInvokeFrame,
} from '@openheaders/oracle/live/grpc-exec/delegated-wire';
import { type GrpcTransport, GrpcTransportError } from '@openheaders/oracle/live/grpc-exec/transport';
import {
  type DelegatedExecutedOn,
  type DelegatedRequestResult,
  type ParsedDelegatedRequestFrame,
  parseDelegatedRequestFrame,
} from '@openheaders/oracle/live/request-exec/delegated-wire';
import { createStreamEmitter, registerActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { type RequestTransport, TransportError } from '@openheaders/oracle/live/request-exec/transport';
import type { WsPeerRpcContext, WsPeerRpcHooks } from '../host-runtime/ws-server';
import { createNodeGrpcTransport } from '../live/node-grpc-transport';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { daemonExecutedOn } from './executed-on';
import { defaultPeerExecuteOptIn, type PeerExecuteOptIn } from './peer-execute-opt-in';
import { peerStreamFrameSink } from './peer-stream-sinks';

export interface DelegatedRequestsRpcOptions {
  /** Injectable for tests; defaults to the node transport (the
   *  dispatcher cache is module-global, so this instance shares every
   *  agent tuple with the context family's). */
  transport?: RequestTransport;
  /** Injectable for tests; defaults to the node gRPC transport (one
   *  HTTP/2 session per call — nothing pooled to share). */
  grpcTransport?: GrpcTransport;
  /** The egress opt-in gate — the spine composes one per host posture;
   *  absent (test rigs) the desktop's remote-off default. */
  peerExecute?: PeerExecuteOptIn;
}

export function createDelegatedRequestsRpc(options: DelegatedRequestsRpcOptions = {}): WsPeerRpcHooks {
  const transport = options.transport ?? createNodeRequestTransport();
  const grpcTransport = options.grpcTransport ?? createNodeGrpcTransport();
  const peerExecute = options.peerExecute ?? defaultPeerExecuteOptIn();

  /** The gate, in order — the frame's workspace comes out as the
   *  audited subject; every refusal throws. */
  async function gate(message: Record<string, unknown>, peer: WsPeerRpcContext): Promise<string> {
    await peerExecute.assert(peer);
    const workspaceId =
      typeof message.workspaceId === 'string' && message.workspaceId !== '' ? message.workspaceId : null;
    if (workspaceId === null) throw new Error(DELEGATED_SEND_WORKSPACE_REQUIRED_MESSAGE);
    const snapshot = await resolveDaemonPeerIdentitySnapshot(peer.userId);
    const decision = hasCapability(snapshot, 'workspace.write', { workspaceId });
    emitAuditEntry({ actorUserId: peer.userId, capability: 'workspace.write', workspaceId, decision });
    if (!decision.allow) {
      throw new Error(`permission denied: workspace.write on ${workspaceId} (${decision.reason ?? 'denied'})`);
    }
    return workspaceId;
  }

  return {
    owns(type: string): boolean {
      return type === DELEGATE_REQUEST_CHANNEL || type === DELEGATE_GRPC_INVOKE_CHANNEL;
    },
    async dispatch(
      message: Record<string, unknown>,
      peer: WsPeerRpcContext,
    ): Promise<DelegatedRequestResult | DelegatedGrpcInvokeResult> {
      await gate(message, peer);
      // Egress attribution: THIS machine opens (or fails to open) the
      // socket on the peer's behalf — the target sees its address.
      const executedOn: DelegatedExecutedOn = daemonExecutedOn();
      if (message.type === DELEGATE_GRPC_INVOKE_CHANNEL) {
        const parsed = parseDelegatedGrpcInvokeFrame(message);
        if (!parsed.ok) return { success: false, error: parsed.error, executedOn };
        return runDelegatedGrpcInvoke(parsed.frame, grpcTransport, executedOn);
      }
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

/**
 * One delegated unary call: the Stop hook exists only while the
 * session is open; the reply comes back whole (a non-zero grpc-status
 * is a normal reply, the seam's law); a pre-head failure rides back as
 * the refusal with the canonical status and the trust remedy the
 * transport classified. An abort after the head resolves with the
 * partial body, exactly as the seam promises an in-process caller.
 */
async function runDelegatedGrpcInvoke(
  frame: { sendId: string; workspaceId: string; request: Parameters<GrpcTransport['invoke']>[0] },
  transport: GrpcTransport,
  executedOn: DelegatedExecutedOn,
): Promise<DelegatedGrpcInvokeResult> {
  const controller = new AbortController();
  const unregister = registerActiveSend(frame.sendId, () => controller.abort());
  try {
    const response = await transport.invoke(frame.request, controller.signal);
    return { success: true, response: encodeDelegatedGrpcResponse(response), executedOn };
  } catch (err) {
    const classified = err instanceof GrpcTransportError ? err : null;
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      ...(classified?.canonicalStatus !== undefined ? { canonicalStatus: classified.canonicalStatus } : {}),
      ...(classified?.hint !== undefined ? { hint: classified.hint } : {}),
      executedOn,
    };
  } finally {
    unregister();
  }
}
