/**
 * WebSocket wiring — the thin shell around {@link createTransportConnection}.
 *
 * The transport state machine (`transport-connection.ts`) owns the
 * socket lifecycle: probe, open, ping, backoff, the protocol latch.
 * This module owns everything *around* the socket — inbound frame
 * routing, the open/close subscriber fan-out, sync-status reporting —
 * and is the single owner of the connection registry state that decides
 * *whether* a connection is wanted (the primary `OH.backends` record's
 * url / authToken / enabled / autoConnect). Every one of those funnels
 * through `scheduleReconnect` here; no other module opens sockets.
 */

import { getPrimaryBackend, subscribeBackends, updatePrimaryBackend } from '@openheaders/core/backends';
import { report as reportStatus } from '@openheaders/ui/shared/status';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { isSafari } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';
import { createTransportConnection } from './transport-connection';

// ── Configuration (live from the backend registry mirror) ─────────

function getWsServerUrl(): string {
  return getPrimaryBackend()?.url ?? '';
}

// ── Connection status ─────────────────────────────────────────────

function broadcastConnectionStatus(): void {
  broadcast('connectionStatus', { connected: transport.isConnected() });
}

/**
 * Subscribers fired on each WS connect transition (after the
 * post-open setup but before any inbound message). Phase C C15
 * uses this to drain the pending-out queue once the wire is back;
 * the handshake initiator drives HELLO + STATE_VECTOR from here.
 */
const onConnectSubscribers = new Set<() => void>();
const onCloseSubscribers = new Set<() => void>();

export function subscribeOnWebSocketOpen(cb: () => void): () => void {
  onConnectSubscribers.add(cb);
  return () => onConnectSubscribers.delete(cb);
}

/**
 * Subscribers fired when the socket transitions from any state into
 * closed. The handshake initiator uses this to reset its FSM so the
 * next reconnect re-runs HELLO + STATE_VECTOR from `idle`.
 */
export function subscribeOnWebSocketClose(cb: () => void): () => void {
  onCloseSubscribers.add(cb);
  return () => onCloseSubscribers.delete(cb);
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

function fireOnWebSocketClose(): void {
  for (const cb of [...onCloseSubscribers]) {
    try {
      cb();
    } catch (err) {
      logger.warn('WebSocket', 'onClose subscriber threw', err);
    }
  }
}

/**
 * Inbound frame handlers — tried in registration order. The first
 * handler to return `true` (or resolve to `true`) wins; the rest are
 * skipped. Handlers MUST return `false` for frames they don't own so
 * the next handler can claim them.
 *
 * Phase C registers two handlers in order:
 *
 *   1. handshake initiator — claims HELLO/WELCOME/STATE_VECTOR/SNAPSHOT/SYNCED.
 *   2. mutation receiver — claims `oh.sync.mutation` + `oh.sync.mutationBatch`.
 *
 * The legacy pre-handshake `pong` (server reply to ping) is unowned
 * and silently drops out the bottom.
 */
type InboundFrameHandler = (frame: unknown) => boolean | Promise<boolean>;
const inboundFrameHandlers: InboundFrameHandler[] = [];

export function registerInboundFrameHandler(handler: InboundFrameHandler): () => void {
  inboundFrameHandlers.push(handler);
  return () => {
    const i = inboundFrameHandlers.indexOf(handler);
    if (i >= 0) inboundFrameHandlers.splice(i, 1);
  };
}

async function routeInboundFrame(frame: unknown): Promise<void> {
  for (const handler of [...inboundFrameHandlers]) {
    try {
      const handled = await handler(frame);
      if (handled) return;
    } catch (err) {
      logger.warn('WebSocket', 'inbound frame handler threw', err);
    }
  }
}

/**
 * Mirror the socket's state into the `sync` Status subsystem.
 *
 * Semantic intent vs actual state:
 *   - no enabled backend → green "Running in this browser" (the SW IS the back-end)
 *   - autoConnect OFF   → green "Back-end sync disabled" (user opted out, not a failure)
 *   - autoConnect ON + connected → green "Connected to back-end"
 *   - autoConnect ON + URL rejected → yellow "Desktop URL rejected by settings"
 *   - autoConnect ON + disconnected + attempts=0 → yellow "Connecting…"
 *   - autoConnect ON + disconnected + attempts>0 → yellow "Reconnecting (attempt N)"
 */
function reportSyncStatus(): void {
  const primary = getPrimaryBackend();
  if (!primary?.enabled) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Running in this browser',
    });
    return;
  }
  if (!primary.autoConnect) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Back-end sync disabled',
    });
    return;
  }
  if (transport.isConnected()) {
    reportStatus({
      subsystem: 'sync',
      state: 'green',
      message: 'Connected to back-end',
    });
    return;
  }
  if (!getWsServerUrl()) {
    reportStatus({
      subsystem: 'sync',
      state: 'yellow',
      message: 'Desktop URL rejected by settings',
    });
    return;
  }
  const attempts = transport.reconnectAttempts();
  reportStatus({
    subsystem: 'sync',
    state: 'yellow',
    message: attempts <= 1 ? 'Connecting to back-end…' : `Reconnecting (attempt ${attempts})`,
    context: { attempts },
  });
}

// ── Reachability probe ────────────────────────────────────────────

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

// ── Transport ─────────────────────────────────────────────────────

const transport = createTransportConnection({
  getUrl: () => getWsServerUrl() || null,
  shouldConnect: shouldAttemptBackendConnection,
  getReconnectDelayMs: () => getSetting('backend.reconnectDelayMs'),
  getMaxReconnectDelayMs: () => getSetting('backend.maxReconnectDelayMs'),
  getPingIntervalMs: () => getSetting('backend.pingIntervalMs'),
  // Safari folds its pre-check into the reachability probe and its URL
  // adaptation into socket construction, so the transport itself stays
  // browser-agnostic.
  probeReachable: (url) => (isSafari ? safariPreCheck(url) : checkServerReachable(url)),
  createSocket: (url) => new WebSocket(isSafari ? adaptWebSocketUrl(url) : url),
  onOpen: () => {
    logger.info('WebSocket', 'Connected successfully');
    // Registry bookkeeping only — `lastConnectedAt` is not part of the
    // connection-shaping key below, so this write never re-dials.
    void updatePrimaryBackend({ lastConnectedAt: new Date().toISOString() }).catch(() => {
      /* best-effort */
    });
    broadcastConnectionStatus();
    reportSyncStatus();
    // Subscribers fire after status reporting so any handler reading
    // wire state observes a consistent view. The handshake initiator
    // drives HELLO + STATE_VECTOR from here.
    fireOnWebSocketOpen();
  },
  onClose: (info) => {
    logger.info('WebSocket', 'Connection closed');
    broadcastConnectionStatus();
    if (info.protocolIncompatible) {
      reportStatus({
        subsystem: 'sync',
        state: 'red',
        message: 'Desktop app speaks a newer protocol — update extension',
        context: { closeCode: info.code, reason: info.reason },
      });
    } else {
      reportSyncStatus();
    }
    if (info.wasOpen) fireOnWebSocketClose();
  },
  onMessage: (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch (err) {
      logger.warn('WebSocket', 'Error parsing message:', err);
      return;
    }
    void routeInboundFrame(parsed);
  },
  onStateChange: () => reportSyncStatus(),
});

// ── Public API ────────────────────────────────────────────────────

/**
 * Ensure a backend connection exists if one is wanted. Idempotent —
 * the transport coalesces concurrent / repeat calls down to one socket.
 * Used by initial boot and the `wsReconnect` SW-eviction safety-net
 * alarm.
 */
export function connectWebSocket(): Promise<boolean> {
  // Report explicitly: the pill message depends on `mode` / `autoConnect`
  // / `url`, and `ensureConnected()` may not move the transport's state
  // (e.g. autoConnect off keeps the machine idle), so `onStateChange`
  // alone would not refresh a settings-derived message.
  reportSyncStatus();
  transport.ensureConnected();
  return Promise.resolve(transport.isConnected());
}

/**
 * Force-close the current connection and (if a connection is still
 * wanted) start a fresh one. Funnels every `backend.*` settings change
 * that invalidates the current socket.
 */
export function reconnectWebSocket(): void {
  transport.reconnect();
}

// A switch commit can land the enabled flag + URL (+ token) in one
// burst of registry writes; reconnecting per notification would tear
// down and re-open two or three sockets back-to-back. Coalesce the
// burst into a single reconnect on the microtask after the writes
// settle.
let reconnectQueued = false;
function scheduleReconnect(): void {
  if (reconnectQueued) return;
  reconnectQueued = true;
  queueMicrotask(() => {
    reconnectQueued = false;
    reconnectWebSocket();
  });
}

// A connection-shaping setting changed: re-evaluate the transport, and
// refresh the status pill alongside — its message depends on `mode` /
// `autoConnect` / `url` directly, and flipping one of those may leave
// the transport in the same state (so `onStateChange` would not fire).
function onConnectionSettingsChanged(): void {
  reportSyncStatus();
  scheduleReconnect();
}

// Single owner of every connection-triggering registry field. The
// primary record's `url` / `authToken` invalidate the current endpoint;
// `enabled` / `autoConnect` flip whether a connection is wanted at all —
// `transport.reconnect` handles both directions (it re-evaluates
// `shouldConnect` and stays idle when the answer is "no"). Registry
// bookkeeping (`lastConnectedAt`, label) is excluded via the shape key
// so stamping a successful connect never re-dials it.
function connectionShapeKey(): string {
  const p = getPrimaryBackend();
  return p ? JSON.stringify([p.url, p.authToken, p.enabled, p.autoConnect]) : '';
}
let lastConnectionShape = connectionShapeKey();
subscribeBackends(() => {
  const next = connectionShapeKey();
  if (next === lastConnectionShape) return;
  lastConnectionShape = next;
  onConnectionSettingsChanged();
});
// Ping cadence changes take effect on the next tick without a reconnect.
subscribeKey('backend.pingIntervalMs', () => transport.restartPing());

/**
 * Should the extension attempt a real back-end connection given the
 * registry? No enabled primary record means there's nothing to connect
 * to; `autoConnect=false` means the user opted out.
 */
export function shouldAttemptBackendConnection(): boolean {
  const primary = getPrimaryBackend();
  return Boolean(primary?.enabled && primary.autoConnect);
}

export function isWebSocketConnected(): boolean {
  return transport.isConnected();
}

export function isWebSocketConnecting(): boolean {
  return transport.isConnecting();
}

export function getReconnectAttempts(): number {
  return transport.reconnectAttempts();
}

export function sendViaWebSocket(data: Record<string, unknown>): boolean {
  return transport.send(data);
}
