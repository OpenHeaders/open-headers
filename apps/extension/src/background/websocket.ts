/**
 * WebSocket connection management — connects to the desktop app
 * and receives resolved rules.
 */

import { PROTOCOL_INCOMPATIBLE_CLOSE_CODE, PROTOCOL_VERSION } from '@openheaders/core/protocol';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { isChrome, isEdge, isFirefox, isSafari, runtime } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';
import { handleIncomingMutationFrame } from './sync-mutation-receiver';

// ── Configuration (live from settings store) ─────────────────────

function getWsServerUrl(): string {
  return getSetting('backend.url');
}

function getReconnectDelayMs(): number {
  return getSetting('backend.reconnectDelayMs');
}

function getMaxReconnectDelayMs(): number {
  return getSetting('backend.maxReconnectDelayMs');
}

// ── State ─────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;
let isConnected = false;
let reconnectAttempts = 0;
// Set once the desktop app has rejected this build's protocol version.
// Suppresses the reconnect loop until either the extension updates
// (extension restart wipes this) or the setting URL changes.
let protocolIncompatible = false;

// ── Keep-alive ────────────────────────────────────────────────────
//
// Strict corporate proxies and idle-timeouts will silently kill a WS
// connection that sees no traffic. A periodic application-level ping
// (driven by `backend.pingIntervalMs`) keeps the pipe warm
// and gives us a fast-fail detection if the socket has been torn down
// underneath us — `socket.send` will throw and we fall through to
// `handleConnectionFailure`, which triggers the usual reconnect loop.

function clearPingTimer(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function startPingTimer(): void {
  clearPingTimer();
  const interval = getSetting('backend.pingIntervalMs');
  if (interval <= 0) return;
  pingTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify({ type: 'ping', t: Date.now() }));
    } catch (err) {
      logger.debug('WebSocket', 'ping failed, treating as disconnect:', (err as Error).message);
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      handleConnectionFailure();
    }
  }, interval);
}

// ── Browser info ──────────────────────────────────────────────────

function getBrowserName(): string {
  if (isFirefox) return 'firefox';
  if (isChrome) return 'chrome';
  if (isEdge) return 'edge';
  if (isSafari) return 'safari';
  return 'unknown';
}

function getBrowserVersion(): string {
  try {
    if (navigator?.userAgent) {
      const ua = navigator.userAgent;
      let match: RegExpMatchArray | null = null;
      if (isFirefox) match = ua.match(/Firefox\/(\S+)/);
      else if (isEdge) match = ua.match(/Edg\/(\S+)/);
      else if (isChrome) match = ua.match(/Chrome\/(\S+)/);
      else if (isSafari) match = ua.match(/Version\/(\S+)/);
      if (match?.[1]) return match[1];
    }
  } catch (_e) {
    /* ignore */
  }
  return '';
}

function sendBrowserInfo(): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: 'browserInfo',
        browser: getBrowserName(),
        version: getBrowserVersion(),
        extensionVersion: runtime.getManifest().version,
        protocolVersion: PROTOCOL_VERSION,
      }),
    );
    logger.info('WebSocket', `Sent browser info (protocol v${PROTOCOL_VERSION})`);
  }
}

// ── Connection status ─────────────────────────────────────────────

function broadcastConnectionStatus(): void {
  broadcast('connectionStatus', { connected: isConnected });
}

/**
 * Subscribers fired on each WS connect transition (after the
 * post-open setup but before any inbound message). Phase C C15
 * uses this to drain the pending-out queue once the wire is back.
 */
const onConnectSubscribers = new Set<() => void>();

export function subscribeOnWebSocketOpen(cb: () => void): () => void {
  onConnectSubscribers.add(cb);
  return () => onConnectSubscribers.delete(cb);
}

function fireOnWebSocketOpen(): void {
  for (const cb of [...onConnectSubscribers]) {
    try {
      cb();
    } catch (err) {
      logger.warn('WebSocket', 'onOpen subscriber threw', err);
    }
  }
}

/**
 * Mirror the socket's state into the `sync` Status subsystem.
 *
 * Semantic intent vs actual state:
 *   - mode = in-browser → green "Running in this browser" (the SW IS the back-end)
 *   - autoConnect OFF   → green "Back-end sync disabled" (user opted out, not a failure)
 *   - autoConnect ON + connected → green "Connected to back-end"
 *   - autoConnect ON + disconnected + attempts=0 → yellow "Connecting…"
 *   - autoConnect ON + disconnected + attempts>0 → yellow "Reconnecting (attempt N)"
 */
function reportSyncStatus(): void {
  if (getSetting('backend.mode') === 'in-browser') {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Running in this browser',
    });
    return;
  }
  if (!getSetting('backend.autoConnect')) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Back-end sync disabled',
    });
    return;
  }
  if (isConnected) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Connected to back-end',
    });
    return;
  }
  const attempts = reconnectAttempts;
  reportStatus({
    subsystem: 'sync',
    state: 'yellow',
    message: attempts <= 1 ? 'Connecting to back-end…' : `Reconnecting (attempt ${attempts})`,
    context: { attempts },
  });
}

// ── Message handling ──────────────────────────────────────────────
//
// Inbound frames route through the mutation-stream receiver
// (C8). Frames that don't match a known mutation kind are dropped
// silently — the pre-handshake `pong` is the only other expected
// inbound message in v1, and the C8 receiver ignores it by
// returning `false` from `handleIncomingMutationFrame`.

function createMessageHandler(): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data as string);
    } catch (err) {
      logger.warn('WebSocket', 'Error parsing message:', err);
      return;
    }
    void handleIncomingMutationFrame(parsed);
  };
}

// ── Connection management ─────────────────────────────────────────

function handleConnectionFailure(): void {
  socket = null;
  isConnecting = false;
  isConnected = false;
  clearPingTimer();
  broadcastConnectionStatus();

  if (reconnectTimer) clearTimeout(reconnectTimer);

  // Auto-connect off → don't schedule a reconnect. A failed manual
  // connect should NOT silently transition into a retry loop.
  if (!getSetting('backend.autoConnect')) {
    reconnectAttempts = 0;
    reportSyncStatus();
    return;
  }

  reconnectAttempts++;
  reportSyncStatus();
  const delay = Math.min(getReconnectDelayMs() * 2 ** (reconnectAttempts - 1), getMaxReconnectDelayMs());

  logger.debug('WebSocket', `Scheduling reconnection attempt ${reconnectAttempts} in ${delay}ms`);
  reconnectTimer = setTimeout(() => {
    void connectWebSocket();
  }, delay);
}

async function checkServerReachable(wsUrl: string): Promise<boolean> {
  try {
    const httpUrl = wsUrl.replace('ws://', 'http://');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);
    await fetch(httpUrl, { method: 'GET', signal: controller.signal, mode: 'no-cors' });
    clearTimeout(timeoutId);
    return true;
  } catch (_error) {
    return false;
  }
}

function connectStandardWebSocket(url: string): void {
  const log = reconnectAttempts === 0 ? logger.info : logger.debug;
  log.call(logger, 'WebSocket', 'Starting WebSocket connection:', url);

  checkServerReachable(url).then((isReachable) => {
    if (!isReachable) {
      logger.debug('WebSocket', 'Server not reachable, will retry');
      handleConnectionFailure();
      return;
    }

    let connectionTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      connectionTimeout = setTimeout(() => {
        logger.debug('WebSocket', 'Connection timed out');
        handleConnectionFailure();
      }, 3000);

      socket = new WebSocket(url);

      socket.onerror = () => {
        clearTimeout(connectionTimeout);
        logger.debug('WebSocket', 'Connection issue detected');
      };

      socket.onopen = () => {
        clearTimeout(connectionTimeout);
        logger.info('WebSocket', 'Connected successfully');
        isConnecting = false;
        isConnected = true;
        reconnectAttempts = 0;
        broadcastConnectionStatus();
        reportSyncStatus();
        sendBrowserInfo();
        startPingTimer();
        fireOnWebSocketOpen();
      };

      socket.onmessage = createMessageHandler();

      socket.onclose = (event?: CloseEvent) => {
        clearTimeout(connectionTimeout);
        if (event?.code === PROTOCOL_INCOMPATIBLE_CLOSE_CODE) {
          logger.warn('WebSocket', `Desktop rejected protocol v${PROTOCOL_VERSION}: ${event.reason || 'no reason'}`);
          protocolIncompatible = true;
          socket = null;
          isConnecting = false;
          isConnected = false;
          clearPingTimer();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectAttempts = 0;
          broadcastConnectionStatus();
          reportStatus({
            subsystem: 'sync',
            state: 'red',
            message: 'Desktop app speaks a newer protocol — update extension',
            context: { closeCode: event.code, reason: event.reason },
          });
          return;
        }
        logger.info('WebSocket', 'Connection closed');
        handleConnectionFailure();
      };
    } catch (_e) {
      clearTimeout(connectionTimeout);
      logger.debug('WebSocket', 'Error creating connection');
      handleConnectionFailure();
    }
  });
}

// ── Public API ────────────────────────────────────────────────────

export function connectWebSocket(): Promise<boolean> {
  // `in-browser` mode means the extension's own service worker is the
  // back-end — no external host to reach. Skip the wire entirely.
  if (getSetting('backend.mode') === 'in-browser') {
    reportSyncStatus();
    return Promise.resolve(false);
  }
  // Single autoConnect chokepoint. Every entry path — initial boot,
  // `wsReconnect` alarm, URL-change subscriber, reconnect scheduler,
  // autoConnect-flip subscriber — funnels through here. If the user
  // has Auto-Connect off, no path can sneak a socket open. Previously
  // each call site had to remember to gate, and the URL-change
  // subscriber + reconnect-on-failure both bypassed it.
  if (!getSetting('backend.autoConnect')) {
    reportSyncStatus();
    return Promise.resolve(false);
  }

  if (protocolIncompatible) return Promise.resolve(false);
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(true);
  if (isConnecting) return Promise.resolve(false);

  const url = getWsServerUrl();
  if (!url) {
    // Settings rejected the URL (e.g. requireTls violation). Don't
    // schedule a reconnect until the setting changes.
    reportStatus({
      subsystem: 'sync',
      state: 'yellow',
      message: 'Desktop URL rejected by settings',
    });
    return Promise.resolve(false);
  }

  isConnecting = true;

  return new Promise<boolean>((resolve) => {
    if (isSafari) {
      safariPreCheck(url).then((canConnect) => {
        if (canConnect) {
          connectStandardWebSocket(adaptWebSocketUrl(url));
        } else {
          handleConnectionFailure();
        }
        resolve(canConnect);
      });
    } else {
      connectStandardWebSocket(url);
      resolve(true);
    }
  });
}

/**
 * Force-close the current connection and (if autoConnect is on) start
 * a fresh one. Used when `backend.url` or TLS requirement
 * changes at runtime. The connect call itself enforces the autoConnect
 * gate, so passing through here when the setting is off cleanly tears
 * down the old socket without opening a new one.
 */
export function reconnectWebSocket(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    try {
      socket.close();
    } catch {
      // ignore
    }
    socket = null;
  }
  isConnected = false;
  isConnecting = false;
  reconnectAttempts = 0;
  // URL change is the user reacting to a problem — clear the
  // incompatibility latch so they can re-try (e.g. after updating
  // the desktop app or pointing at a different host).
  protocolIncompatible = false;
  void connectWebSocket();
}

// Any change to the back-end URL forces a reconnect against the new endpoint.
subscribeKey('backend.url', () => reconnectWebSocket());
// Mode changes (in-browser ↔ desktop-app / daemon / remote) require a
// transport flip — tear down the current socket and let `connectWebSocket`
// re-evaluate. `in-browser` short-circuits early so we close cleanly.
subscribeKey('backend.mode', () => reconnectWebSocket());
// Ping interval changes take effect on the next tick without a reconnect —
// restart the timer with the new cadence.
subscribeKey('backend.pingIntervalMs', () => {
  if (isConnected) startPingTimer();
});

/**
 * Should the extension attempt a real back-end connection given the
 * current settings? `in-browser` mode means there's nothing to connect
 * to; `autoConnect=false` means the user opted out. Other call sites
 * use this to gate alarms / re-subscriptions so they stay idle when
 * the wire isn't wanted.
 */
export function shouldAttemptBackendConnection(): boolean {
  if (getSetting('backend.mode') === 'in-browser') return false;
  return Boolean(getSetting('backend.autoConnect'));
}

export function isWebSocketConnected(): boolean {
  return isConnected && socket !== null && socket.readyState === WebSocket.OPEN;
}

export function isWebSocketConnecting(): boolean {
  return isConnecting;
}

export function getReconnectAttempts(): number {
  return reconnectAttempts;
}

export function sendViaWebSocket(data: Record<string, unknown>): boolean {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('WebSocket', 'Error sending:', error);
      return false;
    }
  }
  return false;
}
