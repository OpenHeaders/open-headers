/**
 * WebSocket connection management — connects to the desktop app
 * and receives V5 resolved rules.
 */

import type { WorkflowRecordingPayload } from '@openheaders/core/protocol';
import { WS_SERVER_URL as CORE_WS_SERVER_URL } from '@openheaders/core/protocol';
import type { V5 } from '@openheaders/core/types';
import { isChrome, isEdge, isFirefox, isSafari, runtime, storage } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { sendMessageWithCallback } from '@utils/messaging';
import { scheduleUpdate } from './modules/rule-engine';
import { setRulesFromApp } from './modules/rule-store';
import { generateRulesHash } from './modules/utils';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';

// ── Configuration ─────────────────────────────────────────────────

const WS_SERVER_URL = CORE_WS_SERVER_URL;
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY = 6000;

// ── State ─────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;
let isConnected = false;
let reconnectAttempts = 0;
let lastRulesHash = '';

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
  if (parsed.type === 'videoRecordingStateChanged') {
    sendMessageWithCallback(
      { type: 'videoRecordingStateChanged', enabled: parsed.enabled as boolean },
      (_response, _error) => {},
    );
  } else if (parsed.type === 'recordingHotkeyResponse' || parsed.type === 'recordingHotkeyChanged') {
    if (parsed.type === 'recordingHotkeyChanged') {
      storage.local.set({
        recordingHotkey: parsed.hotkey,
        recordingHotkeyEnabled: parsed.enabled !== undefined ? parsed.enabled : true,
      });
    }
    sendMessageWithCallback(
      {
        type: 'recordingHotkeyResponse',
        hotkey: parsed.hotkey as string,
        enabled: parsed.enabled !== undefined ? (parsed.enabled as boolean) : true,
      },
      (_response, _error) => {},
    );
  } else if (parsed.type === 'recordingHotkeyPressed') {
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
  broadcastConnectionStatus();

  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectAttempts++;
  const delay = Math.min(RECONNECT_DELAY_MS * 2 ** (reconnectAttempts - 1), MAX_RECONNECT_DELAY);

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

  isConnecting = true;

  return new Promise<boolean>((resolve) => {
    if (isSafari) {
      safariPreCheck(WS_SERVER_URL).then((canConnect) => {
        if (canConnect) {
          connectStandardWebSocket(adaptWebSocketUrl(WS_SERVER_URL));
        } else {
          handleConnectionFailure();
        }
        resolve(canConnect);
      });
    } else {
      connectStandardWebSocket(WS_SERVER_URL);
      resolve(true);
    }
  });
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
