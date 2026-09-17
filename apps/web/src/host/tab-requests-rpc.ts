/**
 * The web tab's own HTTP send — the Execution Place plan's Phase W:
 * the tab is a CONTEXT. `executeRequest` / `executeGraphqlRequest`
 * resolve IN the tab against its synced mirrors (the workspace, its
 * environment pointer, its live values, its files, its own vault) over
 * the host-neutral request route every send host runs
 * (`@openheaders/oracle/live/request-route`), and only the socket
 * moves: this module is the tab's seam into that route — every send
 * rides the delegating transport toward the serving daemon (the
 * workspace's server place by construction; a frame naming a place
 * names this one) over the tab's one wire (`delegated-wire.ts`) with
 * the tab's jar (in memory, per workspace, gone with the tab — the jar
 * key never rides), the daemon's live frames feed the runner's
 * observer and the tab's own emitter re-broadcasts them under the
 * caller's send id. Scripts do not run in the tab until the sandbox
 * slice lands — the seam resolves no runner and the Settings tab's
 * fact sheet says so.
 *
 * The jar inspection trio answers here too, from the tab's own jars.
 * A Stop hits the in-tab registry first; a miss forwards up the wire
 * for a forwarded gRPC invoke's exchange.
 */

import { cookieJarFor, peekCookieJar } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { createDelegatingRequestTransport } from '@openheaders/oracle/live/request-exec/delegating-transport';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import type { RequestRouteHost } from '@openheaders/oracle/live/request-route/host';
import { executeGraphqlRequestRoute, executeRequestRoute } from '@openheaders/oracle/live/request-route/route';
import { peekActiveWorkspaceId } from '@openheaders/oracle/workspace/extension-workspace-store';
import { webDelegatedWire } from './delegated-wire';
import { broadcastLocal } from './web-broadcast';
import { callWireRpc } from './wire-rpc';

const TAB_CHANNELS = [
  'executeRequest',
  'executeGraphqlRequest',
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
  // The tab's live-frame sink — the in-tab fan-out `useLiveSendStream` reads.
  emitStreamEvent: (event) => broadcastLocal('requestStreamEvent', event),
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
    case 'abortRequestSend':
      return handleAbortRequestSendRpc(message);
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

/** Stop — the in-tab send by its caller-minted id first; a miss is a
 *  forwarded gRPC invoke whose exchange lives on the daemon. */
async function handleAbortRequestSendRpc(message: Record<string, unknown>): Promise<{ success: boolean }> {
  const sendId = typeof message.sendId === 'string' ? message.sendId : undefined;
  if (sendId === undefined) return { success: false };
  if (stopActiveSend(sendId)) return { success: true };
  try {
    const result = await callWireRpc({ type: 'abortRequestSend', sendId });
    return result && typeof result === 'object' && (result as { success?: unknown }).success === true
      ? { success: true }
      : { success: false };
  } catch {
    return { success: false };
  }
}
