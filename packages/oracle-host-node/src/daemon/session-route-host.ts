/**
 * The node host's session-route seam — what the daemon (and the
 * desktop app through the same spine) contributes to the host-neutral
 * session routes in `@openheaders/oracle/live/session-route`: its own
 * node transports when the frame names no place, the delegating
 * transport over the backend client plane toward an EXPLICIT backend
 * id when it does (the Execution Place plan — the executor stays
 * here, only the socket moves), the host's script capability under
 * the HTTP send's mode gate (`resolveSessionScriptHost`: a forwarded
 * session runs Safe or not at all; a host without a runtime runs
 * scriptless), the node request transport for the OAuth 2.0 silent
 * renewal (its proxy and trust planes cover the token endpoint), and
 * the host's local broadcast as the live-frame sink.
 */

import { hostBridge, type MqttStreamEventWire, type WsStreamEventWire } from '@openheaders/core/bridge';
import type { MqttByteTransport } from '@openheaders/oracle/live/mqtt-exec/transport';
import {
  delegatedMqttTransportLease,
  delegatedWsTransportLease,
  ownTransportLease,
  type SessionRouteHost,
} from '@openheaders/oracle/live/session-route/host';
import type { WsTransport } from '@openheaders/oracle/live/ws-exec/transport';
import { delegatedSocketWireFor } from '@openheaders/oracle/sync/client/delegated-wire-client';
import { createNodeMqttTransport } from '../live/node-mqtt-transport';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { createNodeWsTransport } from '../live/node-ws-transport';
import { resolveSessionScriptHost } from './script-capability';

// Stateless — each transport opens one socket per session, so there is
// no pool to share; one instance apiece keeps the seams symmetric with
// the HTTP and gRPC handlers'.
const nodeWsTransport = createNodeWsTransport();
const nodeMqttTransport = createNodeMqttTransport();
const nodeRequestTransport = createNodeRequestTransport();

/** Default live-frame sinks for an in-process caller — the host's local
 *  broadcast, the `execute-grpc-request-rpc.ts` twin. */
function broadcastWsStreamFrameLocally(event: WsStreamEventWire): void {
  hostBridge.broadcast('wsStreamEvent', event);
}
function broadcastMqttStreamFrameLocally(event: MqttStreamEventWire): void {
  hostBridge.broadcast('mqttStreamEvent', event);
}

export interface NodeSessionRouteHostOptions {
  /** Injectable for tests; default the node transports and the local broadcast. */
  wsTransport?: WsTransport;
  mqttTransport?: MqttByteTransport;
  emitWsStreamEvent?: (event: WsStreamEventWire) => void;
  emitMqttStreamEvent?: (event: MqttStreamEventWire) => void;
}

export function createNodeSessionRouteHost(options: NodeSessionRouteHostOptions = {}): SessionRouteHost {
  const wsTransport = options.wsTransport ?? nodeWsTransport;
  const mqttTransport = options.mqttTransport ?? nodeMqttTransport;
  return {
    wsTransportFor: (placeBackendId, workspaceId) =>
      placeBackendId !== undefined
        ? delegatedWsTransportLease(delegatedSocketWireFor(placeBackendId), workspaceId)
        : ownTransportLease(wsTransport),
    mqttTransportFor: (placeBackendId, workspaceId) =>
      placeBackendId !== undefined
        ? delegatedMqttTransportLease(delegatedSocketWireFor(placeBackendId), workspaceId)
        : ownTransportLease(mqttTransport),
    resolveScriptHost: resolveSessionScriptHost,
    refreshTransportFor: () => nodeRequestTransport,
    emitWsStreamEvent: options.emitWsStreamEvent ?? broadcastWsStreamFrameLocally,
    emitMqttStreamEvent: options.emitMqttStreamEvent ?? broadcastMqttStreamFrameLocally,
  };
}
