/**
 * Extension install of the host-neutral backend connection manager
 * (`@openheaders/oracle/sync/client/backend-connection-manager`) — the
 * chrome-bound edges live here: the Safari socket adapter, the
 * reachability probe, the settings-store reliability knobs, and the
 * popup `connectionStatus` broadcast. Pure side-effect module —
 * `background.ts` imports it at eval time; call sites import the
 * manager API from the canonical oracle path.
 */

import {
  installBackendConnectionManager,
  restartAllPings,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { isSafari } from '@utils/browser-api';
import { trackProductTelemetryEvent } from './modules/product-telemetry';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';

async function checkServerReachable(wsUrl: string): Promise<boolean> {
  try {
    // Scheme-preserving probe: a wss:// backend (TLS-terminating reverse
    // proxy) must be probed over https, or fetch rejects the URL outright
    // and the wire never dials.
    const httpUrl = wsUrl.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    await fetch(httpUrl, { method: 'GET', signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timeoutId);
    return true;
  } catch (_error) {
    return false;
  }
}

installBackendConnectionManager({
  // Safari folds its pre-check into the reachability probe and its URL
  // adaptation into socket construction, so the shared manager stays
  // browser-agnostic.
  probeReachable: (url) => (isSafari ? safariPreCheck(url) : checkServerReachable(url)),
  createSocket: (url) => new WebSocket(isSafari ? adaptWebSocketUrl(url) : url),
  getReconnectDelayMs: () => getSetting('backend.reconnectDelayMs'),
  getMaxReconnectDelayMs: () => getSetting('backend.maxReconnectDelayMs'),
  getPingIntervalMs: () => getSetting('backend.pingIntervalMs'),
  onConnectionStatusChanged: (connected) => broadcast('connectionStatus', { connected }),
  onConnectFailed: () => trackProductTelemetryEvent({ name: 'error_beacon', code: 'ws-connect-failed' }),
});

// Ping cadence changes take effect on the next tick without a reconnect.
subscribeKey('backend.pingIntervalMs', () => restartAllPings());
