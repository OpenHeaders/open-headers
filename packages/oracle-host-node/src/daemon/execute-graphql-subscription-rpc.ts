/**
 * Workbench `executeGraphqlSubscription` route on the node host —
 * `execute-websocket-request-rpc.ts`'s sibling for the GraphqlRequest
 * entity kind's ONE operation that leaves the POST: the host-neutral
 * route in `@openheaders/oracle/live/session-route` (the entity
 * compiled into the WebSocket session it rides, the
 * `graphql-transport-ws` client mounted, the result a WebSocket
 * snapshot) over this host's seam (`session-route-host.ts`).
 */

import type { WsStreamEventWire } from '@openheaders/core/bridge';
import {
  type ExecuteWsSessionRouteResult,
  executeGraphqlSubscriptionRoute,
} from '@openheaders/oracle/live/session-route/ws-route';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { createNodeSessionRouteHost } from './session-route-host';

/** Handle one `executeGraphqlSubscription` bridge message; the
 *  transport and the sink are injectable for tests. */
export function handleExecuteGraphqlSubscriptionRpc(
  message: Record<string, unknown>,
  transport?: WsTransport,
  emitStreamEvent?: (event: WsStreamEventWire) => void,
): Promise<ExecuteWsSessionRouteResult> {
  return executeGraphqlSubscriptionRoute(
    message,
    createNodeSessionRouteHost({
      ...(transport !== undefined ? { wsTransport: transport } : {}),
      ...(emitStreamEvent !== undefined ? { emitWsStreamEvent: emitStreamEvent } : {}),
    }),
  );
}
