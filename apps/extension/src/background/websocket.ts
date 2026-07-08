/**
 * Backend connection manager — one client FSM per enabled `OH.backends`
 * record (MULTI_BACKEND_PLAN.md §3: one manager, N sockets).
 *
 * The transport state machine (`transport-connection.ts`) owns each
 * socket's lifecycle: probe, open, ping, backoff, the protocol latch.
 * This module owns everything *around* the sockets — the registry
 * reconcile that decides which wires exist (dial new enabled records,
 * tear down removed/disabled ones, re-dial shape changes), inbound
 * frame routing with the delivering connection attached, the open/close
 * subscriber fan-out, and per-wire status reporting into the aggregate.
 * No other module opens sockets.
 *
 * Every consumer that used to read "the" socket reads a routed or
 * aggregated view instead:
 *
 *   - `sendToBackend(backendId, …)` — the routing seam; the mutation
 *     forwarder resolves the target from the envelope's Org binding.
 *   - `sendViaWebSocket(…)` — the legacy device-local seam (focusApp,
 *     ws-request default): the connected loopback wire when there is
 *     one, else the first connected wire.
 *   - `isWebSocketConnected()` / `getReconnectAttempts()` — any-of /
 *     worst-of across wires, for the badge and popup indicators.
 */

import { getBackends, isLoopbackBackendUrl, subscribeBackends, updateBackend } from '@openheaders/core/backends';
import type { BackendConnection } from '@openheaders/core/types';
import { get as getSetting, subscribeKey } from '@openheaders/ui/workbench/settings/store';
import { broadcast } from '@utils/bridge';
import { isSafari } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { adaptWebSocketUrl, safariPreCheck } from './safari-websocket-adapter';
import { dropBackendSyncStatus, refreshSyncStatusAggregate, reportBackendSyncStatus } from './sync-status-aggregate';
import { handshakeRejectEntry, type SyncStatusEntry } from './sync-status-reporter';
import { createTransportConnection, type TransportConnection } from './transport-connection';

// ── Wire handles ──────────────────────────────────────────────────

/**
 * The per-connection view handed to frame handlers, open/close
 * subscribers, and the per-wire sync wiring. `record()` is the latest
 * registry record (bookkeeping writes flow through without a re-dial);
 * `isLoopback()` classifies the URL this wire actually dialed, which is
 * what the local-only inbound gates must evaluate (routing invariant 4).
 */
export interface BackendWireHandle {
  readonly backendId: string;
  record(): BackendConnection;
  isLoopback(): boolean;
  isConnected(): boolean;
  send(data: Record<string, unknown>): boolean;
}

interface ManagedWire {
  readonly handle: BackendWireHandle;
  readonly transport: TransportConnection;
  rec: BackendConnection;
  defunct: boolean;
  shapeKey: string;
}

const wires = new Map<string, ManagedWire>();

// ── Subscriber fan-outs ───────────────────────────────────────────

export interface WireLifecycleEvent {
  readonly kind: 'created' | 'removed';
  readonly wire: BackendWireHandle;
}

/**
 * Fired when the reconcile pass creates or removes a wire. `created`
 * fires before the wire's first dial so per-connection services (the
 * handshake initiator, status reporters) are attached before any frame
 * can arrive. Subscribers must register at SW eval time — before the
 * registry hydrates — so no replay of pre-existing wires is needed.
 */
const lifecycleSubscribers = new Set<(event: WireLifecycleEvent) => void>();

export function subscribeWireLifecycle(cb: (event: WireLifecycleEvent) => void): () => void {
  lifecycleSubscribers.add(cb);
  return () => lifecycleSubscribers.delete(cb);
}

/**
 * Subscribers fired on each wire's connect transition (after the
 * post-open setup but before any inbound message). The per-wire
 * handshake initiator drives HELLO + STATE_VECTOR from here.
 */
const onConnectSubscribers = new Set<(wire: BackendWireHandle) => void>();
const onCloseSubscribers = new Set<(wire: BackendWireHandle) => void>();

export function subscribeOnWebSocketOpen(cb: (wire: BackendWireHandle) => void): () => void {
  onConnectSubscribers.add(cb);
  return () => onConnectSubscribers.delete(cb);
}

/**
 * Subscribers fired when a wire transitions from open into closed. The
 * per-wire handshake wiring uses this to reset its FSM so the next
 * reconnect re-runs HELLO + STATE_VECTOR from `idle`.
 */
export function subscribeOnWebSocketClose(cb: (wire: BackendWireHandle) => void): () => void {
  onCloseSubscribers.add(cb);
  return () => onCloseSubscribers.delete(cb);
}

function fireSubscribers<T>(subscribers: Set<(arg: T) => void>, arg: T, label: string): void {
  for (const cb of [...subscribers]) {
    try {
      cb(arg);
    } catch (err) {
      logger.warn('WebSocket', `${label} subscriber threw`, err);
    }
  }
}

/**
 * Inbound frame handlers — tried in registration order, each receiving
 * the delivering wire's handle. The first handler to return `true` (or
 * resolve to `true`) wins; the rest are skipped. Handlers MUST return
 * `false` for frames they don't own so the next handler can claim them.
 *
 * The sync wiring registers three in order: the per-wire handshake
 * initiator (HELLO-flow frames), the mutation receiver, the awareness
 * receiver. The legacy pre-handshake `pong` is unowned and silently
 * drops out the bottom.
 */
type InboundFrameHandler = (frame: unknown, wire: BackendWireHandle) => boolean | Promise<boolean>;
const inboundFrameHandlers: InboundFrameHandler[] = [];

export function registerInboundFrameHandler(handler: InboundFrameHandler): () => void {
  inboundFrameHandlers.push(handler);
  return () => {
    const i = inboundFrameHandlers.indexOf(handler);
    if (i >= 0) inboundFrameHandlers.splice(i, 1);
  };
}

async function routeInboundFrame(frame: unknown, wire: BackendWireHandle): Promise<void> {
  for (const handler of [...inboundFrameHandlers]) {
    try {
      const handled = await handler(frame, wire);
      if (handled) return;
    } catch (err) {
      logger.warn('WebSocket', 'inbound frame handler threw', err);
    }
  }
}

// ── Status ────────────────────────────────────────────────────────

function broadcastConnectionStatus(): void {
  broadcast('connectionStatus', { connected: isWebSocketConnected() });
}

/**
 * The wire-level entry for one connection. Semantic intent vs actual
 * state (the no-enabled-backend green lives in the aggregate's empty
 * case):
 *   - autoConnect OFF   → green "Back-end sync disabled" (user opted out)
 *   - connected         → green "Connected to back-end"
 *   - empty URL         → yellow "Desktop URL rejected by settings"
 *   - disconnected + attempts≤1 → yellow "Connecting…"
 *   - disconnected + attempts>1 → yellow "Reconnecting (attempt N)"
 */
function wireLevelEntry(wire: ManagedWire): SyncStatusEntry {
  if (!wire.rec.autoConnect) {
    return { state: 'green', message: 'Back-end sync disabled' };
  }
  if (wire.transport.isConnected()) {
    return { state: 'green', message: 'Connected to back-end' };
  }
  if (!wire.rec.url) {
    return { state: 'yellow', message: 'Desktop URL rejected by settings' };
  }
  const attempts = wire.transport.reconnectAttempts();
  return {
    state: 'yellow',
    message: attempts <= 1 ? 'Connecting to back-end…' : `Reconnecting (attempt ${attempts})`,
    context: { attempts },
  };
}

function reportWireStatus(wire: ManagedWire): void {
  if (wire.defunct) return;
  reportBackendSyncStatus(wire.handle.backendId, wireLevelEntry(wire));
}

// ── Reachability probe ────────────────────────────────────────────

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

// ── Wire construction + reconcile ─────────────────────────────────

function createWire(rec: BackendConnection): ManagedWire {
  const backendId = rec.id;
  // The handle closes over the managed wire so `record()` always reads
  // the latest reconciled record.
  let managed: ManagedWire;
  const handle: BackendWireHandle = {
    backendId,
    record: () => managed.rec,
    isLoopback: () => isLoopbackBackendUrl(managed.rec.url),
    isConnected: () => managed.transport.isConnected(),
    send: (data) => managed.transport.send(data),
  };
  const transport = createTransportConnection({
    getUrl: () => managed.rec.url || null,
    shouldConnect: () => !managed.defunct && managed.rec.enabled && managed.rec.autoConnect,
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
      // connection-shape key, so this write never re-dials.
      void updateBackend(backendId, { lastConnectedAt: new Date().toISOString() }).catch(() => {
        /* best-effort */
      });
      broadcastConnectionStatus();
      reportWireStatus(managed);
      // Subscribers fire after status reporting so any handler reading
      // wire state observes a consistent view. The handshake initiator
      // drives HELLO + STATE_VECTOR from here.
      fireSubscribers(onConnectSubscribers, handle, 'onOpen');
    },
    onClose: (info) => {
      logger.info('WebSocket', 'Connection closed');
      broadcastConnectionStatus();
      if (info.peerRefused) {
        // The transport latched idle — this entry is the slot's final
        // word until a credential/URL change re-dials, so it must carry
        // the reject reason (the row's re-pair CTA keys off it), not
        // the wire-level "Connecting…" that would otherwise overwrite
        // the in-band WELCOME rejection on every reconnect flap.
        const reason = info.rejectReason ?? (info.protocolIncompatible ? 'protocol-too-old' : null);
        reportBackendSyncStatus(backendId, handshakeRejectEntry(reason));
      } else {
        reportWireStatus(managed);
      }
      if (info.wasOpen) fireSubscribers(onCloseSubscribers, handle, 'onClose');
    },
    onMessage: (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch (err) {
        logger.warn('WebSocket', 'Error parsing message:', err);
        return;
      }
      void routeInboundFrame(parsed, handle);
    },
    onStateChange: () => reportWireStatus(managed),
  });
  managed = { handle, transport, rec, defunct: false, shapeKey: connectionShapeKey(rec) };
  return managed;
}

// `lastConnectedAt` / label are bookkeeping — excluded from the shape
// key so stamping a successful connect never tears down the socket that
// produced it. `enabled` is handled by wire presence, not the key.
function connectionShapeKey(rec: BackendConnection): string {
  return JSON.stringify([rec.url, rec.authToken, rec.autoConnect]);
}

function removeWire(wire: ManagedWire): void {
  wire.defunct = true;
  fireSubscribers(lifecycleSubscribers, { kind: 'removed', wire: wire.handle } as WireLifecycleEvent, 'lifecycle');
  // Tear down the socket + any in-flight attempt; with `defunct` set the
  // trailing `beginAttempt` observes `shouldConnect() === false` and the
  // machine settles in `idle` with no timers pending.
  wire.transport.reconnect();
  wires.delete(wire.handle.backendId);
  dropBackendSyncStatus(wire.handle.backendId);
  broadcastConnectionStatus();
}

/**
 * Reconcile the wire map against the registry mirror: dial new enabled
 * records, tear down removed/disabled ones, re-dial shape changes, and
 * let bookkeeping updates flow through without touching the socket.
 */
function reconcileWires(): void {
  const desired = new Map(
    getBackends()
      .filter((b) => b.enabled)
      .map((b) => [b.id, b]),
  );
  for (const wire of [...wires.values()]) {
    if (!desired.has(wire.handle.backendId)) removeWire(wire);
  }
  for (const [id, rec] of desired) {
    const existing = wires.get(id);
    if (!existing) {
      const wire = createWire(rec);
      wires.set(id, wire);
      fireSubscribers(lifecycleSubscribers, { kind: 'created', wire: wire.handle } as WireLifecycleEvent, 'lifecycle');
      reportWireStatus(wire);
      wire.transport.ensureConnected();
      continue;
    }
    existing.rec = rec;
    const shape = connectionShapeKey(rec);
    if (shape !== existing.shapeKey) {
      existing.shapeKey = shape;
      reportWireStatus(existing);
      existing.transport.reconnect();
    }
  }
  refreshSyncStatusAggregate();
}

// A switch commit can land the enabled flag + URL (+ token) in one
// burst of registry writes; reconciling per notification would tear
// down and re-open sockets back-to-back. Coalesce the burst into a
// single reconcile on the microtask after the writes settle.
let reconcileQueued = false;
function scheduleReconcile(): void {
  if (reconcileQueued) return;
  reconcileQueued = true;
  queueMicrotask(() => {
    reconcileQueued = false;
    reconcileWires();
  });
}

subscribeBackends(scheduleReconcile);
// Ping cadence changes take effect on the next tick without a reconnect.
subscribeKey('backend.pingIntervalMs', () => {
  for (const wire of wires.values()) wire.transport.restartPing();
});

// ── Public API ────────────────────────────────────────────────────

/**
 * Ensure every wanted backend connection exists. Idempotent — each
 * transport coalesces concurrent / repeat calls down to one socket.
 * Used by initial boot and the `wsReconnect` SW-eviction safety-net
 * alarm. Returns whether any wire is currently connected.
 */
export function connectWebSocket(): Promise<boolean> {
  reconcileWires();
  for (const wire of wires.values()) wire.transport.ensureConnected();
  return Promise.resolve(isWebSocketConnected());
}

/**
 * Force-close every current connection and (where still wanted) start
 * fresh ones.
 */
export function reconnectWebSocket(): void {
  for (const wire of wires.values()) wire.transport.reconnect();
}

/**
 * Should the extension attempt any real back-end connection given the
 * registry? True when at least one enabled record has auto-connect on.
 */
export function shouldAttemptBackendConnection(): boolean {
  return getBackends().some((b) => b.enabled && b.autoConnect);
}

/** True when at least one wire is connected. */
export function isWebSocketConnected(): boolean {
  for (const wire of wires.values()) if (wire.transport.isConnected()) return true;
  return false;
}

export function isWebSocketConnecting(): boolean {
  for (const wire of wires.values()) if (wire.transport.isConnecting()) return true;
  return false;
}

/** Worst-of reconnect attempts across wires — drives the badge threshold. */
export function getReconnectAttempts(): number {
  let max = 0;
  for (const wire of wires.values()) max = Math.max(max, wire.transport.reconnectAttempts());
  return max;
}

/** Send one frame to a specific backend. False when its wire is down. */
export function sendToBackend(backendId: string, data: Record<string, unknown>): boolean {
  return wires.get(backendId)?.transport.send(data) ?? false;
}

/** True when the given backend's wire is currently connected. */
export function isBackendConnected(backendId: string): boolean {
  return wires.get(backendId)?.transport.isConnected() ?? false;
}

/**
 * The default target for device-local, non-Org-routed frames (focusApp,
 * ws-request): the connected loopback wire when there is one — those
 * affordances address the desktop app on this machine — else the first
 * connected wire. Null when nothing is connected.
 */
function defaultWire(): ManagedWire | null {
  let firstConnected: ManagedWire | null = null;
  for (const wire of wires.values()) {
    if (!wire.transport.isConnected()) continue;
    if (isLoopbackBackendUrl(wire.rec.url)) return wire;
    firstConnected ??= wire;
  }
  return firstConnected;
}

/** The default wire's backend id, or null when nothing is connected. */
export function getDefaultWireBackendId(): string | null {
  return defaultWire()?.handle.backendId ?? null;
}

/**
 * Send one frame on the default wire (see {@link getDefaultWireBackendId}).
 * The legacy singular seam — Org-routed traffic goes through
 * {@link sendToBackend} instead.
 */
export function sendViaWebSocket(data: Record<string, unknown>): boolean {
  return defaultWire()?.transport.send(data) ?? false;
}
