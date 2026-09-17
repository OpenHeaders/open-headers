/**
 * The web tab's own sessions — the Execution Place plan's Phase W,
 * the `tab-requests-rpc.ts` sibling for the three session kinds
 * (WebSocket, MQTT over every scheme, GraphQL subscription). The tab
 * is the CONTEXT: the session's executor runs here — the handshake or
 * the dial resolved against the tab's synced mirrors and its own
 * vault, every rider's text resolved here, the timeline and the
 * snapshot built here — and only the socket moves: the delegating
 * session transports ship the resolved open to the serving daemon,
 * the workspace's server place by construction, over the tab's one
 * wire (`delegated-wire.ts`'s socket family), and the daemon's raw
 * socket events feed the executor. The route itself is the
 * host-neutral one every session host runs
 * (`@openheaders/oracle/live/session-route`); this module is the
 * tab's seam into it: every session leases the delegating transport
 * (the tab has exactly one place, so a frame naming one names this
 * one), the OAuth 2.0 renewal dials through the tab's delegating HTTP
 * leg with its jar, the live frames fan out on the in-tab broadcast
 * the session hooks read, and no script host is mounted — the tab's
 * sessions run scriptless until the sandbox slice lands (the Settings
 * tab's fact sheet says so). The riders answer from the host-neutral
 * active-session registries; a Stop rides `abortRequestSend`, which
 * `tab-requests-rpc.ts` answers from the shared active-send registry.
 */

import { cookieJarFor } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { createDelegatingRequestTransport } from '@openheaders/oracle/live/request-exec/delegating-transport';
import {
  delegatedMqttTransportLease,
  delegatedWsTransportLease,
  type SessionRouteHost,
} from '@openheaders/oracle/live/session-route/host';
import { executeMqttRequestRoute } from '@openheaders/oracle/live/session-route/mqtt-route';
import {
  dispatchSessionRider,
  isSessionRiderChannel,
  SESSION_RIDER_CHANNELS,
} from '@openheaders/oracle/live/session-route/riders';
import {
  executeGraphqlSubscriptionRoute,
  executeWebSocketRequestRoute,
} from '@openheaders/oracle/live/session-route/ws-route';
import { webDelegatedSocketWire, webDelegatedWire } from './delegated-wire';
import { broadcastLocal } from './web-broadcast';

const TAB_CONNECT_CHANNELS = ['executeWebSocketRequest', 'executeGraphqlSubscription', 'executeMqttRequest'] as const;
const TAB_SESSION_CHANNELS = [...TAB_CONNECT_CHANNELS, ...SESSION_RIDER_CHANNELS] as const;

export type TabSessionsChannel = (typeof TAB_SESSION_CHANNELS)[number];

export function isTabSessionsChannel(type: unknown): type is TabSessionsChannel {
  return typeof type === 'string' && (TAB_SESSION_CHANNELS as readonly string[]).includes(type);
}

/** The tab's seam into the shared session route — see the module doc. */
export const webSessionRouteHost: SessionRouteHost = {
  wsTransportFor: (_placeBackendId, workspaceId) => delegatedWsTransportLease(webDelegatedSocketWire, workspaceId),
  mqttTransportFor: (_placeBackendId, workspaceId) => delegatedMqttTransportLease(webDelegatedSocketWire, workspaceId),
  refreshTransportFor: (workspaceId) =>
    createDelegatingRequestTransport({ wire: webDelegatedWire, workspaceId, jars: cookieJarFor }),
  emitWsStreamEvent: (event) => broadcastLocal('wsStreamEvent', event),
  emitMqttStreamEvent: (event) => broadcastLocal('mqttStreamEvent', event),
};

/**
 * Dispatch one tab-answered session channel. Only call for channels
 * {@link isTabSessionsChannel} owns.
 */
export function dispatchTabSessionsRpc(type: TabSessionsChannel, message: Record<string, unknown>): Promise<unknown> {
  if (isSessionRiderChannel(type)) return dispatchSessionRider(type, message);
  switch (type) {
    case 'executeWebSocketRequest':
      return executeWebSocketRequestRoute(message, webSessionRouteHost);
    case 'executeGraphqlSubscription':
      return executeGraphqlSubscriptionRoute(message, webSessionRouteHost);
    case 'executeMqttRequest':
      return executeMqttRequestRoute(message, webSessionRouteHost);
  }
}
