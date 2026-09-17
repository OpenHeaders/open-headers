/**
 * Workbench `executeRequest` route — the node host's seam into the
 * host-neutral request route (`@openheaders/oracle/live/request-route`),
 * the session routes' twin: the node request transport when the frame
 * names no place, the delegating transport over the backend client
 * plane toward an EXPLICIT backend id when it does (the Execution
 * Place plan — this host is the context, the place only opens the
 * socket; the jar registry is the node transport's own, so a delegated
 * send reads and writes the same per-workspace jar), the host's script
 * capability under the mode gate (`resolveScriptRunner`: a forwarded
 * send runs Safe or not at all; a host without a runtime — the
 * headless daemon — runs scriptless), and the host's local broadcast
 * as the live-frame sink (desktop: `webContents.send` to every open
 * renderer). A peer-forwarded send passes its own sink instead, so
 * frames reach the CALLING surface across the backend wire (see
 * `peer-requests-rpc.ts`).
 */

import { hostBridge, type RequestStreamEventWire } from '@openheaders/core/bridge';
import { createDelegatingRequestTransport } from '@openheaders/oracle/live/request-exec/delegating-transport';
import type { RequestTransport } from '@openheaders/oracle/live/request-exec/transport';
import type { RequestRouteHost } from '@openheaders/oracle/live/request-route/host';
import { type ExecuteRequestRouteResult, executeRequestRoute } from '@openheaders/oracle/live/request-route/route';
import { delegatedWireFor } from '@openheaders/oracle/sync/client/delegated-wire-client';
import { cookieJarFor } from '../live/cookie-jar';
import { createNodeRequestTransport } from '../live/node-request-transport';
import { resolveScriptRunner } from './script-capability';

export type ExecuteRequestRpcResult = ExecuteRequestRouteResult;

// Stateless wrapper — the dispatcher cache and cookie-jar registry are
// module-global in the transport layer, so this instance shares every
// agent tuple and jar with the chain runner's and the MCP tools'.
const nodeTransport = createNodeRequestTransport();

function broadcastStreamFrameLocally(event: RequestStreamEventWire): void {
  hostBridge.broadcast('requestStreamEvent', event);
}

export interface NodeRequestRouteHostOptions {
  /** Injectable for tests and the peer plane; default the node transport and the local broadcast. */
  ownTransport?: RequestTransport;
  emitStreamEvent?: (event: RequestStreamEventWire) => void;
}

export function createNodeRequestRouteHost(options: NodeRequestRouteHostOptions = {}): RequestRouteHost {
  const ownTransport = options.ownTransport ?? nodeTransport;
  return {
    transportFor: (placeBackendId, workspaceId) =>
      placeBackendId !== undefined
        ? createDelegatingRequestTransport({ wire: delegatedWireFor(placeBackendId), workspaceId, jars: cookieJarFor })
        : ownTransport,
    resolveScriptRunner: (input) =>
      resolveScriptRunner({ workspaceId: input.workspaceId, hostContext: 'interactive', forwarded: input.forwarded }),
    emitStreamEvent: options.emitStreamEvent ?? broadcastStreamFrameLocally,
  };
}

/** Handle one `executeRequest` bridge message through the shared route over this host's seam. */
export function handleExecuteRequestRpc(
  message: Record<string, unknown>,
  transport: RequestTransport = nodeTransport,
  emitStreamFrame: (event: RequestStreamEventWire) => void = broadcastStreamFrameLocally,
): Promise<ExecuteRequestRpcResult> {
  return executeRequestRoute(
    message,
    createNodeRequestRouteHost({ ownTransport: transport, emitStreamEvent: emitStreamFrame }),
  );
}
