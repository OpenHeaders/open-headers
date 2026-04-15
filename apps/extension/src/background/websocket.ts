/**
 * WebSocket connection management — connects to the desktop app
 * and receives V5 resolved rules.
 */

import type { WorkflowRecordingPayload } from '@openheaders/core/protocol';
import type { V5 } from '@openheaders/core/types';
import { isChrome, isEdge, isFirefox, isSafari, runtime, storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { sendMessageWithCallback } from '@utils/messaging';
import { get as getSetting, subscribeKey } from '@/rules/settings/store';
import { handleRecordingInboundMessage, requestInitialRecordingSync } from './modules/recording-sync';
import { scheduleUpdate } from './modules/rule-engine';
import { setRulesFromApp } from './modules/rule-store';
import { generateRulesHash } from './modules/utils';
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
let lastRulesHash = '';

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
  sendMessageWithCallback({ type: 'connectionStatus', connected: isConnected }, (_response, _error) => {});
}

// ── Message handling ──────────────────────────────────────────────

function handleRulesUpdate(rules: V5.Rule[]): void {
  logger.info('WebSocket', `Received ${rules.length} rules from desktop`);

  const newHash = generateRulesHash(rules);
  const changed = newHash !== lastRulesHash;
  lastRulesHash = newHash;

  setRulesFromApp(rules);

  if (changed) {
    scheduleUpdate('rules', { immediate: true });
  }

  // Notify popup
  sendMessageWithCallback({ type: 'rulesUpdated', rules, timestamp: Date.now() }, (_response, _error) => {});
}

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

      if (parsed.type === 'rulesUpdate' && Array.isArray(parsed.rules)) {
        handleRulesUpdate(parsed.rules as V5.Rule[]);
      } else {
        handleOtherMessages(parsed);
      }
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

  reconnectAttempts++;
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
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(true);
  if (isConnecting) return Promise.resolve(false);

  const url = getWsServerUrl();
  if (!url) {
    // Settings rejected the URL (e.g. requireTls violation). Don't
    // schedule a reconnect until the setting changes.
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
 * Force-close the current connection and start a fresh one. Used when
 * `desktop.connection.url` or TLS requirement changes at runtime.
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
