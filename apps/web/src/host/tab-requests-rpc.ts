/**
 * The web tab's own HTTP send and gRPC call — the Execution Place
 * plan's Phase W: the tab is a CONTEXT. `executeRequest` /
 * `executeGraphqlRequest` resolve IN the tab against its synced
 * mirrors (the workspace, its environment pointer, its live values,
 * its files, its own vault) over the host-neutral request route every
 * send host runs (`@openheaders/oracle/live/request-route`), and
 * `executeGrpcRequest` resolves and ENCODES in the tab — the registry
 * from the spec the tab holds — over the host-neutral gRPC route
 * (`@openheaders/oracle/live/grpc-route`); only the socket moves. This
 * module is the tab's seam into both routes: every send rides the
 * delegating transport toward the serving daemon (the workspace's
 * server place by construction; a frame naming a place names this
 * one) over the tab's one wire (`delegated-wire.ts`) with the tab's
 * jar (in memory, per workspace, gone with the tab — the jar key
 * never rides), every call the delegating gRPC transport over the
 * same wire, the daemon's live frames feed the executors' observers
 * and the tab's own emitters re-broadcast them under the caller's send
 * id. The scripts around them run through the tab's Safe script
 * runtime — the sandbox iframe `install-script-sandbox.ts` registers,
 * resolved through the one host-neutral capability gate every host
 * uses.
 *
 * The jar inspection trio answers here too, from the tab's own jars;
 * the gRPC upstream riders from the host-neutral active-stream
 * registry; a Stop from the in-tab active-send registry.
 */

import {
  endActiveGrpcClientStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { delegatedGrpcTransportLease, type GrpcRouteHost } from '@openheaders/oracle/live/grpc-route/host';
import { executeGrpcRequestRoute } from '@openheaders/oracle/live/grpc-route/route';
import { cookieJarFor, peekCookieJar } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { createDelegatingRequestTransport } from '@openheaders/oracle/live/request-exec/delegating-transport';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import type { RequestRouteHost } from '@openheaders/oracle/live/request-route/host';
import { executeGraphqlRequestRoute, executeRequestRoute } from '@openheaders/oracle/live/request-route/route';
import {
  resolveInteractiveScriptRunner,
  resolveSessionScriptHost,
} from '@openheaders/oracle/live/script-host/capability';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { webDelegatedGrpcWire, webDelegatedWire } from './delegated-wire';
import { broadcastLocal } from './web-broadcast';

const TAB_CHANNELS = [
  'executeRequest',
  'executeGraphqlRequest',
  'executeGrpcRequest',
  'sendGrpcStreamMessage',
  'endGrpcClientStream',
  'abortRequestSend',
  'getCookieJarSummary',
  'clearCookieJar',
  'deleteCookieJarEntry',
] as const;

export function isTabRequestsChannel(type: unknown): type is (typeof TAB_CHANNELS)[number] {
  return typeof type === 'string' && (TAB_CHANNELS as readonly string[]).includes(type);
}

/** The tab's seam into the shared request route — see the module doc. */
export const webRequestRouteHost: RequestRouteHost = {
  transportFor: (_placeBackendId, workspaceId) =>
    createDelegatingRequestTransport({ wire: webDelegatedWire, workspaceId, jars: cookieJarFor }),
  resolveScriptRunner: resolveInteractiveScriptRunner,
  // The tab's live-frame sink — the in-tab fan-out `useLiveSendStream` reads.
  emitStreamEvent: (event) => broadcastLocal('requestStreamEvent', event),
};

/** The tab's seam into the shared gRPC route — the delegating gRPC
 *  transport toward the serving daemon for every call, the OAuth
 *  renewal through the tab's delegating HTTP leg with its jar. */
export const webGrpcRouteHost: GrpcRouteHost = {
  transportFor: (_placeBackendId, workspaceId) => delegatedGrpcTransportLease(webDelegatedGrpcWire, workspaceId),
  resolveScriptHost: resolveSessionScriptHost,
  refreshTransportFor: (workspaceId) =>
    createDelegatingRequestTransport({ wire: webDelegatedWire, workspaceId, jars: cookieJarFor }),
  // The tab's live-frame sink — the in-tab fan-out `useLiveGrpcStream` reads.
  emitStreamEvent: (event) => broadcastLocal('grpcStreamEvent', event),
};

/**
 * Dispatch one tab-answered request channel. Only call for channels
 * {@link isTabRequestsChannel} owns.
 */
export async function dispatchTabRequestsRpc(
  type: (typeof TAB_CHANNELS)[number],
  message: Record<string, unknown>,
): Promise<unknown> {
  switch (type) {
    case 'executeRequest':
      return executeRequestRoute(message, webRequestRouteHost);
    case 'executeGraphqlRequest':
      return executeGraphqlRequestRoute(message, webRequestRouteHost);
    case 'executeGrpcRequest':
      return executeGrpcRequestRoute(message, webGrpcRouteHost);
    case 'sendGrpcStreamMessage':
      // The riders answer from the host-neutral active-stream registry
      // — the call's own handle, keyed by the invoke's sendId.
      return typeof message.sendId === 'string' && typeof message.messageText === 'string'
        ? sendActiveGrpcStreamMessage(message.sendId, message.messageText)
        : { success: false, error: 'No stream id or message provided' };
    case 'endGrpcClientStream':
      return { success: typeof message.sendId === 'string' && endActiveGrpcClientStream(message.sendId) };
    case 'abortRequestSend':
      // Every send and call this tab runs registers here — the shared
      // registry; an unknown id answers the honest `false`.
      return { success: typeof message.sendId === 'string' && stopActiveSend(message.sendId) };
    case 'getCookieJarSummary':
      return { cookies: peekCookieJar(jarKeyOf(message))?.list() ?? [] };
    case 'clearCookieJar':
      peekCookieJar(jarKeyOf(message))?.clear();
      return { success: true };
    case 'deleteCookieJarEntry': {
      if (typeof message.name === 'string' && typeof message.domain === 'string' && typeof message.path === 'string') {
        peekCookieJar(jarKeyOf(message))?.delete(message.name, message.domain, message.path);
      }
      return { success: true };
    }
  }
}

/** The jar a channel means — the stated workspace, else the tab's
 *  active one (the key an unpinned send runs under). */
function jarKeyOf(message: Record<string, unknown>): string {
  return typeof message.workspaceId === 'string' ? message.workspaceId : (peekActiveWorkspaceId() ?? 'default');
}
