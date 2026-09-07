/**
 * Workbench `executeWebSocketRequest` route — the node host's
 * user-facing Connect, the `execute-grpc-request-rpc.ts` sibling for
 * the WebSocketRequest entity kind. Same result discipline: a session
 * that fails before or on the wire still resolves `success: true`
 * with a failed-outcome SNAPSHOT (the session pane renders the
 * outcome's error); `success: false` is reserved for missing input
 * and unexpected
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
 * validated reads the sync caches hydrate from. The session's script
 * hooks ride the host's script capability when it has one
 * (`resolveSessionScriptHost` — the HTTP send's mode gate: a forwarded
 * session runs Safe or not at all); a host without one runs the
 * session scriptless.
 *
 * The run leg (`runWsSessionRpc`) is shared with the GraphQL
 * subscription route, which derives its session from a GraphqlRequest
 * and mounts the protocol client on top.
 */

import { hostBridge, type WsStreamEventWire } from '@openheaders/core/bridge';
import type { GraphqlWsSubscriptionPlan } from '@openheaders/core/graphql';
import { WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedWsSnapshot, WebSocketRequest } from '@openheaders/core/types';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { errorWsSnapshot, executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { createNodeWsTransport } from '../live/node-ws-transport';
import { resolveSessionScriptHost } from './script-capability';

export interface ExecuteWebSocketRequestRpcResult {
  success: boolean;
  snapshot?: ExecutedWsSnapshot;
  error?: string;
}

// Stateless — the transport opens one socket per session, so there is
// no pool to share; one instance keeps the seam symmetric with the
// gRPC handler's.
const nodeWsTransport = createNodeWsTransport();
// The OAuth 2.0 silent-renewal leg dials through the node request
// transport (the HTTP handler's seam — its proxy and trust planes
// cover the token endpoint here too).
const nodeRequestTransport = createNodeRequestTransport();

/**
 * Default live-frame sink for an in-process caller — the host's local
 * broadcast, the `execute-grpc-request-rpc.ts` twin. A peer-forwarded
 * session passes its own sink instead (the Phase D forwarding leg,
 * when demand mints it).
 */
function broadcastWsStreamFrameLocally(event: WsStreamEventWire): void {
  hostBridge.broadcast('wsStreamEvent', event);
}

/** The frame's scope fields as every WS-plane route reads them. */
export interface WsSessionRpcScope {
  environmentId: string | null | undefined;
  requestedWorkspaceId: string | undefined;
}

export function wsSessionRpcScope(message: Record<string, unknown>): WsSessionRpcScope {
  return {
    environmentId:
      typeof message.environmentId === 'string' || message.environmentId === null ? message.environmentId : undefined,
    requestedWorkspaceId: typeof message.workspaceId === 'string' ? message.workspaceId : undefined,
  };
}

/**
 * The run leg every WS-plane route shares: the pin rules verbatim
 * from `executeRequest`, the script capability gate, the session on
 * the injected transport. `graphql` mounts the subscription client.
 */
export async function runWsSessionRpc(
  request: WebSocketRequest,
  scope: WsSessionRpcScope,
  sendId: string,
  transport: WsTransport = nodeWsTransport,
  emitStreamEvent: (event: WsStreamEventWire) => void = broadcastWsStreamFrameLocally,
  graphql?: GraphqlWsSubscriptionPlan,
): Promise<ExecutedWsSnapshot> {
  const activeWorkspaceId = getActiveWorkspaceId();
  const { environmentId, requestedWorkspaceId } = scope;
  // Pin rules verbatim from `executeRequest`: a foreign workspace or
  // an explicit "No environment" runs pinned; otherwise the run
  // resolves against the Active-bound module mirrors.
  const workspaceId =
    requestedWorkspaceId !== undefined && requestedWorkspaceId !== activeWorkspaceId
      ? requestedWorkspaceId
      : environmentId === null
        ? activeWorkspaceId
        : null;
  // A frame stamped with a foreign workspace is a peer-forwarded
  // session — its scripts run Safe unconditionally (never this
  // host's slot). The executor mounts the plane only where a level
  // carries a script.
  const forwarded = requestedWorkspaceId !== undefined && requestedWorkspaceId !== activeWorkspaceId;
  const scriptHost = await resolveSessionScriptHost({ workspaceId: workspaceId ?? activeWorkspaceId, forwarded });
  return executeWsSession(request, {
    workspaceId,
    environmentId,
    transport,
    sendId,
    emitStreamEvent,
    refreshOAuth: buildRefreshOAuthHook(workspaceId ?? undefined, nodeRequestTransport),
    ...(scriptHost !== null ? { scriptHost } : {}),
    ...(graphql !== undefined ? { graphql } : {}),
  });
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
  const scope = wsSessionRpcScope(message);

  if (sendId === undefined) return { success: false, error: 'No sendId provided — a session needs one' };

  try {
    // Storage reads need a concrete workspace either way.
    const readWorkspaceId = scope.requestedWorkspaceId ?? getActiveWorkspaceId();

    let request: WebSocketRequest | undefined;
    if (webSocketRequestUid) {
      const all = await hostStorage.getValidatedArray(
        wsKeys(readWorkspaceId).websocketRequests,
        WebSocketRequestSchema,
      );
      const loaded = all.find((r) => r.uid === webSocketRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorWsSnapshot(`WebSocket request ${webSocketRequestUid} not found`) };
      }
      request = loaded;
    } else {
      request = draft;
    }
    if (!request) return { success: false, error: 'No WebSocket request or draft provided' };

    const snapshot = await runWsSessionRpc(request, scope, sendId, transport, emitStreamEvent);
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
