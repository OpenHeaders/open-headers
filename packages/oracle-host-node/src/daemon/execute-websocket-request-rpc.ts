/**
 * Workbench `executeWebSocketRequest` route — the node host's
 * user-facing Connect, the `execute-grpc-request-rpc.ts` sibling for
 * the WebSocketRequest entity kind. Same result discipline: a session
 * that fails before or on the wire still resolves `success: true`
 * with an error SNAPSHOT (the session pane renders `snapshot.error`);
 * `success: false` is reserved for missing input and unexpected
 * throws. The RPC resolves when the session SETTLES — server close,
 * Disconnect rider, Stop-abort, or a pre-open failure.
 *
 * Same workspace/environment semantics as `executeRequest`: unpinned
 * (`workspaceId: null`) when the caller's workspace is this host's
 * runtime-Active one, pinned for a forwarded frame, and an explicit
 * `environmentId: null` forces the pinned dispatch (the caller's "No
 * environment" state).
 *
 * The entity loads from the workspace's storage slots — the same
 * validated reads the sync caches hydrate from. No scripts on WS
 * sessions (the Phase G parity decision), so the executor is called
 * directly.
 */

import { hostBridge, type WsStreamEventWire } from '@openheaders/core/bridge';
import { WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedWsSnapshot, WebSocketRequest } from '@openheaders/core/types';
import { errorWsSnapshot, executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createNodeWsTransport } from '../live/node-ws-transport';

export interface ExecuteWebSocketRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedWsSnapshot;
  error?: string;
}

// Stateless — the transport opens one socket per session, so there is
// no pool to share; one instance keeps the seam symmetric with the
// gRPC handler's.
const nodeWsTransport = createNodeWsTransport();

/**
 * Default live-frame sink for an in-process caller — the host's local
 * broadcast, the `execute-grpc-request-rpc.ts` twin. A peer-forwarded
 * session passes its own sink instead (the Phase D forwarding leg,
 * when demand mints it).
 */
function broadcastWsStreamFrameLocally(event: WsStreamEventWire): void {
  hostBridge.broadcast('wsStreamEvent', event);
}

/** Handle one `executeWebSocketRequest` bridge message.
 *  `webSocketRequestUid` takes precedence over `draft` (the channel
 *  contract); `sendId` is required — the session is interactive. */
export async function handleExecuteWebSocketRequestRpc(
  message: Record<string, unknown>,
  transport: WsTransport = nodeWsTransport,
  emitStreamEvent: (event: WsStreamEventWire) => void = broadcastWsStreamFrameLocally,
): Promise<ExecuteWebSocketRequestRpcResult> {
  const webSocketRequestUid = typeof message.webSocketRequestUid === 'string' ? message.webSocketRequestUid : undefined;
  const draft = message.draft as WebSocketRequest | undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const environmentId =
    typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined;
  const requestedWorkspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;

  if (sendId === undefined) return { success: false, error: 'No sendId provided — a session needs one' };

  try {
    const activeWorkspaceId = getActiveWorkspaceId();
    // Pin rules verbatim from `executeRequest`: a foreign workspace or
    // an explicit "No environment" runs pinned; otherwise the run
    // resolves against the Active-bound module mirrors.
    const workspaceId =
      requestedWorkspaceId !== undefined && requestedWorkspaceId !== activeWorkspaceId
        ? requestedWorkspaceId
        : environmentId === null
          ? activeWorkspaceId
          : null;
    // Storage reads need a concrete workspace either way.
    const readWorkspaceId = requestedWorkspaceId ?? activeWorkspaceId;

    let request: WebSocketRequest | undefined;
    if (webSocketRequestUid) {
      const all = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).websocketRequests, WebSocketRequestSchema);
      const loaded = all.find((r) => r.uid === webSocketRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorWsSnapshot(`WebSocket request ${webSocketRequestUid} not found`) };
      }
      request = loaded;
    } else {
      request = draft;
    }
    if (!request) return { success: false, error: 'No WebSocket request or draft provided' };

    const snapshot = await executeWsSession(request, {
      workspaceId,
      environmentId,
      transport,
      sendId,
      emitStreamEvent,
    });
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
