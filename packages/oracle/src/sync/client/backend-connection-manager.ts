/**
 * Backend connection manager — one client FSM per enabled `OH.backends`
 * record (the multi-backend plan §3: one manager, N sockets). Host-neutral:
 * the extension SW and the desktop main process install it with their own
 * socket factory, reachability probe, and reliability-knob getters via
 * {@link installBackendConnectionManager}.
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
 *   - `sendViaWebSocket(…)` — the legacy device-local seam (ws-request
 *     default): the connected loopback wire when there is one, else
 *     the first connected wire.
 *   - `isWebSocketConnected()` / `getReconnectAttempts()` — any-of /
 *     worst-of across wires, for the badge and popup indicators.
 */

import { getBackends, isLoopbackBackendUrl, subscribeBackends, updateBackend } from '@openheaders/core/backends';
import type { BackendConnection } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { dropBackendSyncStatus, refreshSyncStatusAggregate, reportBackendSyncStatus } from './sync-status-aggregate';
import { handshakeRejectEntry, type SyncStatusEntry } from './sync-status-reporter';
import { createTransportConnection, type TransportConnection } from './transport-connection';

const SCOPE = 'ConnectionManager';

/**
 * The host-bound edges of the connection plane. Everything socket- and
 * settings-shaped is injected; the registry, status aggregate, and
 * transport FSM are shared.
 */
export interface BackendConnectionManagerDeps {
  /** Best-effort reachability probe against the host before opening a socket. */
  readonly probeReachable: (url: string) => Promise<boolean>;
  /** Construct the socket — the seam for Safari URL adaptation, Node ws, test fakes. */
  readonly createSocket: (url: string) => WebSocket;
  /** Global reliability knobs (per-host settings surface). */
  readonly getReconnectDelayMs: () => number;
  readonly getMaxReconnectDelayMs: () => number;
  readonly getPingIntervalMs: () => number;
  /** Fired whenever the any-wire-connected aggregate may have changed. */
  readonly onConnectionStatusChanged?: (connected: boolean) => void;
  /**
   * Fired when a dial closes without ever opening — a connect attempt
   * failed (refused, TLS, handshake never completed). Deliberate skips
   * never land here: an unreachable probe opens no socket, and a drop
   * of an established connection reports through `onClose` with
   * `wasOpen`. Hosts hang failure observability off this.
   */
  readonly onConnectFailed?: (backendId: string) => void;
}

let managerDeps: BackendConnectionManagerDeps | null = null;
let unsubscribeRegistry: (() => void) | null = null;

function deps(): BackendConnectionManagerDeps {
  if (!managerDeps) throw new Error('backend connection manager is not installed');
  return managerDeps;
}

/**
 * Install the host edges and subscribe the reconcile loop to the
 * registry mirror. Hosts call this once at boot, before the registry
 * hydrates; re-installing replaces the deps (test harness) without
 * duplicating the registry subscription.
 */
export function installBackendConnectionManager(next: BackendConnectionManagerDeps): void {
  managerDeps = next;
  if (!unsubscribeRegistry) {
    unsubscribeRegistry = subscribeBackends(scheduleReconcile);
  }
}

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
  /**
   * Tail of the per-wire inbound processing chain. Frames on one wire
   * are processed strictly in arrival order: a catch-up replay streams
   * one frame per logged mutation, and dispatching them concurrently
   * races every apply for the same entity onto one FIFO lock — anything
   * queued past the lock timeout throws and that mutation is dropped
   * until a reconnect redelivers it. Never rejects: routeInboundFrame
   * absorbs handler errors, so the chain cannot latch into a failed
   * state.
   */
  inboundTail: Promise<void>;
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
 * can arrive. Subscribers must register at host boot time — before the
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
      logger.warn(SCOPE, `${label} subscriber threw`, err);
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
export type InboundFrameHandler = (frame: unknown, wire: BackendWireHandle) => boolean | Promise<boolean>;
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
      logger.warn(SCOPE, 'inbound frame handler threw', err);
    }
  }
}

// ── Status ────────────────────────────────────────────────────────

function broadcastConnectionStatus(): void {
  managerDeps?.onConnectionStatusChanged?.(isWebSocketConnected());
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
    getReconnectDelayMs: () => deps().getReconnectDelayMs(),
    getMaxReconnectDelayMs: () => deps().getMaxReconnectDelayMs(),
    getPingIntervalMs: () => deps().getPingIntervalMs(),
    probeReachable: (url) => deps().probeReachable(url),
    createSocket: (url) => deps().createSocket(url),
    onOpen: () => {
      logger.info(SCOPE, 'Connected successfully');
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
      logger.info(SCOPE, 'Connection closed');
      broadcastConnectionStatus();
      if (!info.wasOpen && !managed.defunct) managerDeps?.onConnectFailed?.(backendId);
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
        logger.warn(SCOPE, 'Error parsing message:', err);
        return;
      }
      managed.inboundTail = managed.inboundTail.then(() => routeInboundFrame(parsed, handle));
    },
    onStateChange: () => reportWireStatus(managed),
  });
  managed = {
    handle,
    transport,
    rec,
    defunct: false,
    shapeKey: connectionShapeKey(rec),
    inboundTail: Promise.resolve(),
  };
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

// ── Public API ────────────────────────────────────────────────────

/**
 * Ensure every wanted backend connection exists. Idempotent — each
 * transport coalesces concurrent / repeat calls down to one socket.
 * Used by initial boot and the extension's `wsReconnect` SW-eviction
 * safety-net alarm. Returns whether any wire is currently connected.
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

/** Restart every wire's keep-alive ping — the host calls this when its ping-cadence setting changes. */
export function restartAllPings(): void {
  for (const wire of wires.values()) wire.transport.restartPing();
}

/**
 * Should this host attempt any real back-end connection given the
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
/** Handles of every wire whose transport is currently open. Late-started
 *  consumers (the telemetry stream host on a revived service worker) use
 *  this to announce themselves on wires that connected before they did. */
export function listConnectedWires(): BackendWireHandle[] {
  return [...wires.values()].filter((w) => w.transport.isConnected()).map((w) => w.handle);
}

export function isBackendConnected(backendId: string): boolean {
  return wires.get(backendId)?.transport.isConnected() ?? false;
}

/**
 * The default target for device-local, non-Org-routed frames (the
 * ws-request channels — companionReveal, executeRequest, …): the
 * connected loopback wire when there is one — those affordances
 * address the desktop app on this machine — else the first connected
 * wire. Null when nothing is connected.
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
