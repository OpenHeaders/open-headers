/**
 * Workbench `executeMqttRequest` route on the node host — the
 * `execute-websocket-request-rpc.ts` sibling: the host-neutral route
 * in `@openheaders/oracle/live/session-route` over this host's seam
 * (`session-route-host.ts`). The route owns the contract — uid over
 * draft, the required `sendId`, the pin rules, the failed-outcome
 * snapshot discipline (a CONNACK refusal reason rides it verbatim),
 * the `executedOn` stamp; nothing is decided here.
 */

import type { MqttStreamEventWire } from '@openheaders/core/bridge';
import type { MqttByteTransport } from '@openheaders/oracle/live/mqtt-exec/transport';
import {
  type ExecuteMqttSessionRouteResult,
  executeMqttRequestRoute,
} from '@openheaders/oracle/live/session-route/mqtt-route';
import { createNodeSessionRouteHost } from './session-route-host';

export type ExecuteMqttRequestRpcResult = ExecuteMqttSessionRouteResult;

/** Handle one `executeMqttRequest` bridge message; the transport and
 *  the sink are injectable for tests. */
export function handleExecuteMqttRequestRpc(
  message: Record<string, unknown>,
  transport?: MqttByteTransport,
  emitStreamEvent?: (event: MqttStreamEventWire) => void,
): Promise<ExecuteMqttRequestRpcResult> {
  return executeMqttRequestRoute(
    message,
    createNodeSessionRouteHost({
      ...(transport !== undefined ? { mqttTransport: transport } : {}),
      ...(emitStreamEvent !== undefined ? { emitMqttStreamEvent: emitStreamEvent } : {}),
    }),
  );
}
