/**
 * Workbench `executeGraphqlSubscription` route — the node host's
 * user-facing subscription, `execute-websocket-request-rpc.ts`'s
 * sibling for the GraphqlRequest entity kind's ONE operation that
 * leaves the POST. The entity loads from the workspace's storage slot
 * (or rides as the editor's live draft), compiles into the WebSocket
 * session it rides (`compileGraphqlSubscription`: the URL derived, the
 * subprotocol offered, the SAME uid + path so the ancestor chain
 * resolves unchanged) and runs the exact run leg `executeWebSocketRequest`
 * runs, with the `graphql-transport-ws` client mounted. The result IS
 * a WebSocket snapshot; the session pane renders it as one.
 *
 * Same result discipline: a compile refusal (a URL outside http(s) /
 * ws(s), an auth type the WebSocket mask cannot carry) and a session
 * that fails before or on the wire resolve `success: true` with a
 * failed-outcome snapshot; `success: false` is reserved for missing
 * input and unexpected throws.
 */

import type { WsStreamEventWire } from '@openheaders/core/bridge';
import { compileGraphqlSubscription } from '@openheaders/core/graphql';
import { GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { GraphqlRequest } from '@openheaders/core/types';
import { errorWsSnapshot } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { getActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import {
  type ExecuteWebSocketRequestRpcResult,
  runWsSessionRpc,
  wsSessionRpcScope,
} from './execute-websocket-request-rpc';

/** Handle one `executeGraphqlSubscription` bridge message.
 *  `graphqlRequestUid` takes precedence over `draft`; `operationName`
 *  overrides the stored pick; `sendId` is required. */
export async function handleExecuteGraphqlSubscriptionRpc(
  message: Record<string, unknown>,
  transport?: WsTransport,
  emitStreamEvent?: (event: WsStreamEventWire) => void,
): Promise<ExecuteWebSocketRequestRpcResult> {
  const graphqlRequestUid = typeof message.graphqlRequestUid === 'string' ? message.graphqlRequestUid : undefined;
  const draft = message.draft as GraphqlRequest | undefined;
  const operationName = typeof message.operationName === 'string' ? message.operationName : undefined;
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  const scope = wsSessionRpcScope(message);

  if (sendId === undefined) return { success: false, error: 'No sendId provided — a session needs one' };

  try {
    let entity: GraphqlRequest | undefined;
    if (graphqlRequestUid) {
      const readWorkspaceId = scope.requestedWorkspaceId ?? getActiveWorkspaceId();
      const all = await hostStorage.getValidatedArray(wsKeys(readWorkspaceId).graphqlRequests, GraphqlRequestSchema);
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
    const snapshot = await runWsSessionRpc(compiled.request, scope, sendId, transport, emitStreamEvent, compiled.plan);
    return { success: true, snapshot };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
