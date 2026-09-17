/**
 * Workbench `executeWebSocketRequest` route on the node host — the
 * host-neutral route in `@openheaders/oracle/live/session-route`
 * over this host's seam (`session-route-host.ts`: the node socket
 * when the frame names no place, the delegating transport toward a
 * named backend otherwise, the script capability gate, the node
 * request transport for the OAuth renewal, the local broadcast). The
 * route owns the contract — uid over draft, the required `sendId`,
 * the pin rules, the failed-outcome snapshot discipline, the
 * `executedOn` stamp; nothing is decided here.
 */

import type { WsStreamEventWire } from '@openheaders/core/bridge';
import {
  type ExecuteWsSessionRouteResult,
  executeWebSocketRequestRoute,
} from '@openheaders/oracle/live/session-route/ws-route';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { createNodeSessionRouteHost } from './session-route-host';

export type ExecuteWebSocketRequestRpcResult = ExecuteWsSessionRouteResult;

/** Handle one `executeWebSocketRequest` bridge message; the transport
 *  and the sink are injectable for tests. */
export function handleExecuteWebSocketRequestRpc(
  message: Record<string, unknown>,
  transport?: WsTransport,
  emitStreamEvent?: (event: WsStreamEventWire) => void,
): Promise<ExecuteWebSocketRequestRpcResult> {
  return executeWebSocketRequestRoute(
    message,
    createNodeSessionRouteHost({
      ...(transport !== undefined ? { wsTransport: transport } : {}),
      ...(emitStreamEvent !== undefined ? { emitWsStreamEvent: emitStreamEvent } : {}),
    }),
  );
}
