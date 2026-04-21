/**
 * WebSocket connection management — connects to the desktop app
 * and receives V5 resolved rules.
 */

import type { WorkflowRecordingPayload } from '@openheaders/core/protocol';
import { broadcast } from '@utils/bridge';
import { isChrome, isEdge, isFirefox, isSafari, runtime, storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { get as getSetting, subscribeKey } from '@/workbench/settings/store';
import { report as reportStatus } from '@/shared/status';
import { handleRecordingInboundMessage, requestInitialRecordingSync } from './modules/recording-sync';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';

// ── Configuration (live from settings store) ─────────────────────

function getWsServerUrl(): string {
  return getSetting('desktop.connection.url');
}

function getReconnectDelayMs(): number {
  return getSetting('desktop.connection.reconnectDelayMs');
}

function getMaxReconnectDelayMs(): number {
  return getSetting('desktop.connection.maxReconnectDelayMs');
}

// ── State ─────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;
let isConnected = false;
let reconnectAttempts = 0;

// ── Keep-alive ────────────────────────────────────────────────────
//
// Strict corporate proxies and idle-timeouts will silently kill a WS
// connection that sees no traffic. A periodic application-level ping
// (driven by `desktop.connection.pingIntervalMs`) keeps the pipe warm
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
  const interval = getSetting('desktop.connection.pingIntervalMs');
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
      }),
    );
    logger.info('WebSocket', 'Sent browser info to desktop app');
  }
}

// ── Connection status ─────────────────────────────────────────────

function broadcastConnectionStatus(): void {
  broadcast('connectionStatus', { connected: isConnected });
}

/**
 * Mirror the socket's state into the `sync` Status subsystem.
 *
 * Semantic intent vs actual state:
 *   - autoConnect OFF  → green "Desktop sync disabled" (user opted out, not a failure)
 *   - autoConnect ON + connected → green "Connected to desktop"
 *   - autoConnect ON + disconnected + attempts=0 → yellow "Connecting…"
 *   - autoConnect ON + disconnected + attempts>0 → yellow "Reconnecting (attempt N)"
 */
function reportSyncStatus(): void {
  if (!getSetting('desktop.connection.autoConnect')) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Desktop sync disabled',
    });
    return;
  }
  if (isConnected) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Connected to desktop',
    });
    return;
  }
  const attempts = reconnectAttempts;
  reportStatus({
    subsystem: 'sync',
    state: 'yellow',
    message: attempts <= 1 ? 'Connecting to desktop…' : `Reconnecting (attempt ${attempts})`,
    context: { attempts },
  });
}

// ── Message handling ──────────────────────────────────────────────
//
// Inbound messages today are limited to recording sync and recording
// hotkey signals. Team-workspace data sync (rules/collections/vars)
// lands in v2 — when it does, it'll go through a workspace-scoped
// channel that writes to the per-workspace stores, not a global
// workbench-push like the pre-v5 "desktop pushes rules" flow.

function handleOtherMessages(parsed: Record<string, unknown>): void {
  if (handleRecordingInboundMessage(parsed)) return;

  if (parsed.type === 'recordingHotkeyPressed') {
    storage.local.set({
      hotkeyCommand: { type: 'TOGGLE_RECORDING', timestamp: Date.now() },
    });
  }
}

function createMessageHandler(): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    try {
      const parsed = JSON.parse(event.data as string);
      handleOtherMessages(parsed);
    } catch (err) {
      logger.warn('WebSocket', 'Error parsing message:', err);
    }
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
  if (!getSetting('desktop.connection.autoConnect')) {
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
        requestInitialRecordingSync();
      };

      socket.onmessage = createMessageHandler();

      socket.onclose = () => {
        clearTimeout(connectionTimeout);
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
  // Single autoConnect chokepoint. Every entry path — initial boot,
  // `wsReconnect` alarm, URL-change subscriber, reconnect scheduler,
  // autoConnect-flip subscriber — funnels through here. If the user
  // has Auto-Connect off, no path can sneak a socket open. Previously
  // each call site had to remember to gate, and the URL-change
  // subscriber + reconnect-on-failure both bypassed it.
  if (!getSetting('desktop.connection.autoConnect')) {
    reportSyncStatus();
    return Promise.resolve(false);
  }

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
 * a fresh one. Used when `desktop.connection.url` or TLS requirement
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
  void connectWebSocket();
}

// Any change to the desktop URL forces a reconnect against the new endpoint.
subscribeKey('desktop.connection.url', () => reconnectWebSocket());
// Ping interval changes take effect on the next tick without a reconnect —
// restart the timer with the new cadence.
subscribeKey('desktop.connection.pingIntervalMs', () => {
  if (isConnected) startPingTimer();
});

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

export function sendRecordingViaWebSocket(recording: WorkflowRecordingPayload): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(JSON.stringify({ type: 'saveWorkflow', recording }));
    return true;
  } catch (error) {
    logger.error('WebSocket', 'Error sending recording:', error);
    return false;
  }
}
