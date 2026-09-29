/**
 * Workbench `executeGrpcRequest` route — the node host's seam into the
 * host-neutral gRPC route (`@openheaders/oracle/live/grpc-route`), the
 * request and session routes' twin: the node HTTP/2 transport when the
 * frame names no place, the delegating gRPC transport over the backend
 * client plane toward an EXPLICIT backend id when it does (the
 * Execution Place plan — this host is the context, the registry and
 * the encode are its own, the place only opens the session: the
 * desktop app's own call toward a server), the host's script
 * capability under the mode gate (`resolveSessionScriptHost`: a
 * forwarded call runs Safe or not at all; a host without a runtime
 * runs scriptless), the OAuth 2.0 renewal over the node request
 * transport (its proxy and trust planes cover the token endpoint here
 * too), and the host's local broadcast as the live-frame sink. A
 * peer-forwarded call passes its own sink instead, so frames reach
 * the CALLING surface across the backend wire (see
 * `peer-requests-rpc.ts`).
 */

import { type GrpcStreamEventWire, hostBridge } from '@openheaders/core/bridge';
import type { GrpcTransport } from '@openheaders/oracle/live/grpc-exec/transport';
import { delegatedGrpcTransportLease, type GrpcRouteHost } from '@openheaders/oracle/live/grpc-route/host';
import { type ExecuteGrpcRequestRouteResult, executeGrpcRequestRoute } from '@openheaders/oracle/live/grpc-route/route';
import { ownTransportLease } from '@openheaders/oracle/live/session-route/host';
import { delegatedGrpcWireFor } from '@openheaders/oracle/sync/client/delegated-wire-client';
import { createNodeGrpcTransport } from '../live/node-grpc-transport';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { resolveSessionScriptHost } from './script-capability';

export type ExecuteGrpcRequestRpcResult = ExecuteGrpcRequestRouteResult;

// Stateless — the transport opens one HTTP/2 session per invoke, so
// there is no pool to share; one instance keeps the seam symmetric
// with the HTTP handler's.
const nodeGrpcTransport = createNodeGrpcTransport();
// The OAuth 2.0 silent-renewal leg dials through the node request
// transport (the HTTP handler's seam).
const nodeRequestTransport = createNodeRequestTransport();

/**
 * Default live-frame sink for an in-process caller — the host's local
 * broadcast, the `execute-request-rpc.ts` twin.
 */
function broadcastGrpcStreamFrameLocally(event: GrpcStreamEventWire): void {
  hostBridge.broadcast('grpcStreamEvent', event);
}

export interface NodeGrpcRouteHostOptions {
  /** Injectable for tests and the peer plane; default the node transport and the local broadcast. */
  ownTransport?: GrpcTransport;
  emitStreamEvent?: (event: GrpcStreamEventWire) => void;
}

export function createNodeGrpcRouteHost(options: NodeGrpcRouteHostOptions = {}): GrpcRouteHost {
  const ownTransport = options.ownTransport ?? nodeGrpcTransport;
  return {
    transportFor: (placeBackendId, workspaceId) =>
      placeBackendId !== undefined
        ? delegatedGrpcTransportLease(delegatedGrpcWireFor(placeBackendId), workspaceId)
        : ownTransportLease(ownTransport),
    resolveScriptHost: resolveSessionScriptHost,
    refreshTransportFor: () => nodeRequestTransport,
    emitStreamEvent: options.emitStreamEvent ?? broadcastGrpcStreamFrameLocally,
  };
}

/** Handle one `executeGrpcRequest` bridge message through the shared route over this host's seam. */
export function handleExecuteGrpcRequestRpc(
  message: Record<string, unknown>,
  transport: GrpcTransport = nodeGrpcTransport,
  emitStreamEvent: (event: GrpcStreamEventWire) => void = broadcastGrpcStreamFrameLocally,
): Promise<ExecuteGrpcRequestRpcResult> {
  return executeGrpcRequestRoute(message, createNodeGrpcRouteHost({ ownTransport: transport, emitStreamEvent }));
}
