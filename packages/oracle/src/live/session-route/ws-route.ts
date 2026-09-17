/**
 * The workbench WebSocket routes — `executeWebSocketRequest` and
 * `executeGraphqlSubscription` — the ONE host-neutral answer every
 * host that runs the session's EXECUTOR gives (the daemon and the
 * desktop app through the node spine, the web tab as its own
 * context), over the host seam in `host.ts`. Same result discipline
 * everywhere: a session that fails before or on the wire still
 * resolves `success: true` with a failed-outcome SNAPSHOT (the session
 * pane renders the outcome's error — a place's refusal rides it
 * verbatim); `success: false` is reserved for missing input and
 * unexpected throws. The RPC resolves when the session SETTLES —
 * server close, Disconnect rider, Stop-abort, or a pre-open failure.
 *
 * The entity loads from the workspace's storage slots (the same
 * validated reads the sync caches hydrate from) or rides as the
 * editor's live draft; the GraphQL subscription compiles its entity
 * into the WebSocket session it rides (`compileGraphqlSubscription`:
 * the URL derived, the subprotocol offered, the SAME uid + path so the
 * ancestor chain resolves unchanged) and mounts the
 * `graphql-transport-ws` client on top — its result IS a WebSocket
 * snapshot. Where the socket opens is the host's lease: its own
 * socket, or a place's through the delegating transport, the
 * answering host stamped on the snapshot.
 */

import type { GraphqlWsSubscriptionPlan } from '@openheaders/core/graphql';
import { compileGraphqlSubscription } from '@openheaders/core/graphql';
import { GraphqlRequestSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { ExecutedWsSnapshot, GraphqlRequest, WebSocketRequest } from '@openheaders/core/types';
import { hostStorage, wsKeys } from '../../storage';
import { buildRefreshOAuthHook } from '../request-exec/oauth-refresh';
import { errorWsSnapshot, executeWsSession } from '../ws-exec/execute';
import type { SessionRouteHost } from './host';
import {
  NO_ACTIVE_WORKSPACE_MESSAGE,
  NO_SEND_ID_MESSAGE,
  pinSessionScope,
  type SessionRouteScope,
  type SessionRunScope,
  sessionRouteScope,
} from './scope';

export interface ExecuteWsSessionRouteResult {
  success: boolean;
  snapshot?: ExecutedWsSnapshot;
  error?: string;
}

/**
 * The run leg both routes share: the pin rules, the host's lease for
 * the frame's place, the script capability gate, the session on the
 * leased transport, the answering host stamped. `graphql` mounts the
 * subscription client.
 */
async function runWsSessionRoute(
  request: WebSocketRequest,
  scope: SessionRouteScope,
  pinned: SessionRunScope,
  sendId: string,
  host: SessionRouteHost,
  graphql?: GraphqlWsSubscriptionPlan,
): Promise<ExecutedWsSnapshot> {
  const { workspaceId, readWorkspaceId, forwarded } = pinned;
  const lease = host.wsTransportFor(scope.placeBackendId, readWorkspaceId);
  const scriptHost =
    host.resolveScriptHost !== undefined
      ? await host.resolveScriptHost({ workspaceId: readWorkspaceId, forwarded })
      : null;
  const refreshTransport = host.refreshTransportFor?.(readWorkspaceId);
  const snapshot = await executeWsSession(request, {
    workspaceId,
    environmentId: scope.environmentId,
    transport: lease.transport,
    sendId,
    emitStreamEvent: host.emitWsStreamEvent,
    ...(refreshTransport !== undefined
      ? { refreshOAuth: buildRefreshOAuthHook(workspaceId ?? undefined, refreshTransport) }
      : {}),
    ...(scriptHost !== null ? { scriptHost } : {}),
    ...(graphql !== undefined ? { graphql } : {}),
  });
  const executedOn = lease.executedOn();
  return executedOn !== null ? { ...snapshot, executedOn } : snapshot;
}

/** One `executeWebSocketRequest` frame. `webSocketRequestUid` takes
 *  precedence over `draft` (the channel contract); `sendId` is
 *  required — the session is interactive. */
export async function executeWebSocketRequestRoute(
  message: Record<string, unknown>,
  host: SessionRouteHost,
): Promise<ExecuteWsSessionRouteResult> {
  const webSocketRequestUid = typeof message.webSocketRequestUid === 'string' ? message.webSocketRequestUid : undefined;
  const draft = message.draft as WebSocketRequest | undefined;
  const scope = sessionRouteScope(message);
  if (scope.sendId === undefined) return { success: false, error: NO_SEND_ID_MESSAGE };
  try {
    const pinned = pinSessionScope(scope);
    if (pinned === null) return { success: true, snapshot: errorWsSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
    let request: WebSocketRequest | undefined;
    if (webSocketRequestUid) {
      const all = await hostStorage.getValidatedArray(
        wsKeys(pinned.readWorkspaceId).websocketRequests,
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
    return { success: true, snapshot: await runWsSessionRoute(request, scope, pinned, scope.sendId, host) };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/** One `executeGraphqlSubscription` frame. `graphqlRequestUid` takes
 *  precedence over `draft`; `operationName` overrides the stored
 *  pick; `sendId` is required. A compile refusal (a URL outside
 *  http(s) / ws(s), an auth type the WebSocket mask cannot carry) is
 *  a failed-outcome snapshot like a pre-wire failure. */
export async function executeGraphqlSubscriptionRoute(
  message: Record<string, unknown>,
  host: SessionRouteHost,
): Promise<ExecuteWsSessionRouteResult> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  const scope = sessionRouteScope(message);
  if (scope.sendId === undefined) return { success: false, error: NO_SEND_ID_MESSAGE };
  try {
    const pinned = pinSessionScope(scope);
    if (pinned === null) return { success: true, snapshot: errorWsSnapshot(NO_ACTIVE_WORKSPACE_MESSAGE) };
    let entity: GraphqlRequest | undefined;
    if (graphqlRequestUid) {
      const all = await hostStorage.getValidatedArray(
        wsKeys(pinned.readWorkspaceId).graphqlRequests,
        GraphqlRequestSchema,
      );
      const loaded = all.find((r) => r.uid === graphqlRequestUid);
      if (!loaded) {
        return { success: true, snapshot: errorWsSnapshot(`GraphQL request ${graphqlRequestUid} not found`) };
      }
      entity = loaded;
    } else {
      entity = draft;
    }
    if (!entity) return { success: false, error: 'No GraphQL request or draft provided' };
    const compiled = compileGraphqlSubscription(entity, operationName !== undefined ? { operationName } : {});
    if (!compiled.ok) return { success: true, snapshot: errorWsSnapshot(compiled.error) };
    return {
      success: true,
      snapshot: await runWsSessionRoute(compiled.request, scope, pinned, scope.sendId, host, compiled.plan),
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
