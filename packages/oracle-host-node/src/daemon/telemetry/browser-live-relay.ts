/**
 * Browser live-telemetry relay (OBSERVABILITY_PLAN.md Phase 1) — the
 * daemon-side bridge between workbench lifecycle lifelines and the
 * extension peer that owns the browser tab.
 *
 * Deliberately NOT a second store or hub: the extension's request-
 * lifecycle hub stays the ONE browser-truth engine, its per-tab watch
 * floors included. The relay forwards the workbench consumer handshake
 * (`subscribe` / `clear-session` / `request-body`) to the owning peer
 * over the telemetry channels and fans the peer's batched
 * `LifecycleWireMessage` envelopes back to every port watching that
 * `(nodeId, tabId)` partition — frame-for-frame, no re-derivation, so
 * the workbench's client reducer sees exactly what the in-browser
 * panel port would.
 *
 * Subscription gating end to end: the first port for a partition sends
 * `subscribe` (which raises the extension's tab-telemetry tracking
 * ref); the LAST port's disconnect sends the detach frame that releases
 * it. No viewer → silence, at the source.
 *
 * Peer lifecycle: a watch survives the peer's socket (extension SW
 * eviction, reconnect) — on the peer's next connect every live watch
 * for its `nodeId` re-sends `subscribe`, and the fresh `ready` + replay
 * rebuilds each consumer's mirror. Routing is by the REGISTRY summary's
 * `nodeId` (authenticated identity), never by anything a frame claims.
 *
 * The tab-inventory read (`listTabs`) is request/response over the same
 * wire: one `oh.telemetry.tabs.list` frame per connected peer, replies
 * correlated FIFO per peer on the standard `<type>:response` channel;
 * peers that never answer (CLI, another desktop) drop out at the
 * collection timeout.
 */

import { getLifelineServer, type IncomingLifelinePort } from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  isTelemetryStorageMethod,
  parseQualifiedConsolePortName,
  parseQualifiedStoragePortName,
  TELEMETRY_CONSOLE_BATCH_TYPE,
  TELEMETRY_CONSOLE_CONSUMER_TYPE,
  TELEMETRY_CONSOLE_DETACH_TYPE,
  TELEMETRY_DEBUG_CONTROL_TYPE,
  TELEMETRY_HOST_READY_TYPE,
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_STORAGE_CALL_TYPE,
  TELEMETRY_STORAGE_CONSUMER_TYPE,
  TELEMETRY_STORAGE_DETACH_TYPE,
  TELEMETRY_STORAGE_INVALIDATION_TYPE,
  TELEMETRY_TABS_DETACH_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
  TELEMETRY_TABS_PORT_NAME,
  TELEMETRY_TABS_PUSH_TYPE,
  TELEMETRY_TABS_SUBSCRIBE_TYPE,
  TELEMETRY_WATCH_REFUSED_TYPE,
  type TelemetryDebugCommand,
  type TelemetryDebugControlResponsePayload,
  type TelemetryDebugState,
  type TelemetryPeerTabsWire,
  type TelemetryStorageMethod,
  type TelemetryTabsListResponsePayload,
  type TelemetryTabsWatchMessage,
  type TelemetryWatchPlane,
} from '@openheaders/core/protocol';
import { type LifecycleConsumerMessage, parseQualifiedLifecyclePortName } from '@openheaders/core/request-lifecycle';
import type { OracleWsServer, PeerSummary, WsPeerPushHooks } from '../../host-runtime/ws-server';

const SCOPE = 'BrowserLiveRelay';

const TABS_LIST_RESPONSE_TYPE = `${TELEMETRY_TABS_LIST_TYPE}:response`;
const DEBUG_CONTROL_RESPONSE_TYPE = `${TELEMETRY_DEBUG_CONTROL_TYPE}:response`;
const STORAGE_CALL_RESPONSE_TYPE = `${TELEMETRY_STORAGE_CALL_TYPE}:response`;

/** How long `listTabs` waits for each peer's inventory reply. */
export const TABS_LIST_TIMEOUT_MS = 800;

/** How long `debugControl` waits for the peer's post-command snapshot. */
export const DEBUG_CONTROL_TIMEOUT_MS = 800;

/**
 * How long `storageCall` waits for the peer's verb reply. Storage verbs
 * do real page work (content-script injection, cursor-paged IndexedDB
 * reads, cache-document assembly), so the window is far wider than the
 * inventory read's — a verb that misses it settles `ok: false` and the
 * Storage view renders its unreadable state.
 */
export const STORAGE_CALL_TIMEOUT_MS = 10_000;

/** Reported for a peer whose reply predates the debug field (defensive). */
const DEBUG_UNAVAILABLE: TelemetryDebugState = { available: false, enabled: false, attachedTabs: [], pinnedTabs: [] };

/**
 * One answering peer's inventory row — the shared wire vocabulary
 * ({@link TelemetryPeerTabsWire}): the peer's snapshot payload joined
 * with its authenticated identity, identical whether it was pulled
 * (`listTabs`) or pushed (the inventory watch).
 */
export type BrowserTelemetryPeerTabs = TelemetryPeerTabsWire;

export interface BrowserLiveRelay {
  /** Inbound push seam for the WS server (batch + tabs-list replies). */
  readonly peerPush: WsPeerPushHooks;
  /** Late-bound live server slot — the bind supervisor's swaps flow through. */
  setWsServer(server: OracleWsServer | null): void;
  /** Register the qualified-lifeline acceptor. Returns the uninstall. */
  installLifeline(): () => void;
  /** Browser-tab inventory across every answering extension peer. */
  listTabs(): Promise<{ peers: BrowserTelemetryPeerTabs[] }>;
  /**
   * Relay one Debug-mode control command to the peer named by the
   * stable qualifier; resolves the peer's post-command state snapshot,
   * or `null` when the peer is absent or never answers.
   */
  debugControl(nodeId: string, command: TelemetryDebugCommand): Promise<TelemetryDebugState | null>;
  /**
   * Relay one storage bridge verb to the peer named by the stable
   * qualifier (OBSERVABILITY_PLAN.md Phase 3 — reads AND writes, the
   * actuator model). Replies are correlated by a relay-minted `callId`
   * (storage verbs run concurrently — FIFO is not enough). `ok` false =
   * peer absent or reply missed the window; a verb-level failure rides
   * inside `payload`, exactly as on the in-browser bridge.
   */
  storageCall(
    nodeId: string,
    method: TelemetryStorageMethod,
    params: unknown,
  ): Promise<{ ok: boolean; payload: unknown }>;
  /** Drop pending inventory waits + peer subscriptions. Idempotent. */
  dispose(): void;
}

interface WatchEntry {
  /** The stable partition qualifier ({@link peerKey}) this watch rides on. */
  readonly peerKey: string;
  readonly tabId: number;
  /**
   * Live viewer ports keyed by their relay-minted consumer id. Each
   * consumer rides its OWN extension-side stream session, so batches
   * route point-to-point and one viewer's replay never resets another's
   * mirror (the redundant-`ready` reset a shared stream used to cause).
   */
  readonly ports: Map<string, IncomingLifelinePort>;
}

interface PendingTabsSlot {
  settle(payload: TelemetryTabsListResponsePayload | null): void;
}

interface PendingDebugSlot {
  settle(payload: TelemetryDebugControlResponsePayload | null): void;
}

interface PendingStorageSlot {
  settle(ok: boolean, payload: unknown): void;
}

/**
 * One tab's storage watch on one peer — viewer ports keyed by their
 * relay-minted consumer id, mirroring {@link WatchEntry}. The only
 * downstream traffic is the CDP tier's invalidation notes, routed
 * point-to-point to the consumer they address.
 */
interface StorageWatchEntry {
  readonly peerKey: string;
  readonly tabId: number;
  readonly ports: Map<string, IncomingLifelinePort>;
}

/**
 * One tab's console watch on one peer — viewer ports keyed by their
 * relay-minted consumer id, mirroring {@link WatchEntry}. Downstream
 * traffic is the peer's tick-coalesced `ConsoleStreamWireMessage`
 * batches, fanned point-to-point to the consumer they address.
 */
interface ConsoleWatchEntry {
  readonly peerKey: string;
  readonly tabId: number;
  readonly ports: Map<string, IncomingLifelinePort>;
}

/**
 * The stable partition qualifier for a peer — its HELLO `installId`
 * when it sends one, else its `nodeId`. The qualifier is what rides in
 * the qualified lifeline port name and the tab inventory, and what
 * watches key on. `installId` keeps it invariant across reconnects:
 * the HELLO `nodeId` is the ACTIVE workspace's writer identity, which
 * changes after a join → adopt, and keying on it orphans every live
 * watch on a wire flap.
 */
function peerKey(peer: PeerSummary): string {
  return peer.installId ?? peer.nodeId;
}

function watchKey(key: string, tabId: number): string {
  return `${key} ${tabId}`;
}

function isConsumerMessage(msg: unknown): msg is LifecycleConsumerMessage {
  const kind = (msg as { kind?: unknown } | null)?.kind;
  return kind === 'subscribe' || kind === 'clear-session' || kind === 'request-body';
}

export function createBrowserLiveRelay(): BrowserLiveRelay {
  let server: OracleWsServer | null = null;
  let unsubscribePeerChange: (() => void) | null = null;
  const watches = new Map<string, WatchEntry>();
  const storageWatches = new Map<string, StorageWatchEntry>();
  const consoleWatches = new Map<string, ConsoleWatchEntry>();
  /** Workbench viewers of the whole-inventory watch, keyed by their
   *  relay-minted consumer id. Unpartitioned — every viewer sees every
   *  peer's pushes. */
  const tabsWatchPorts = new Map<string, IncomingLifelinePort>();
  const pendingTabs = new Map<string, PendingTabsSlot[]>();
  const pendingDebug = new Map<string, PendingDebugSlot[]>();
  const pendingStorage = new Map<string, PendingStorageSlot>();
  let consumerSeq = 0;
  let storageCallSeq = 0;

  function sendToPeer(key: string, frame: Record<string, unknown>): void {
    server?.broadcastFrame(frame, { filterPeer: (p) => peerKey(p) === key });
  }

  /** Fan one watch envelope to every open inventory viewer port. */
  function fanToTabsWatchers(message: TelemetryTabsWatchMessage): void {
    for (const port of tabsWatchPorts.values()) port.postMessage(message);
  }

  /**
   * Accept one `oh-tabs` viewer port — the workbench Sources rail's
   * inventory watch. Every accept re-broadcasts `tabs.subscribe` to all
   * peers: on the first port that opens the peers' watches; on a later
   * port it makes each peer re-push its snapshot, which seeds the new
   * viewer (snapshots are idempotent upserts, so existing viewers just
   * fold a no-op). The LAST port's disconnect detaches every peer — the
   * no-viewer → silence law on the inventory plane.
   */
  function acceptTabsPort(port: IncomingLifelinePort): boolean {
    if (port.name !== TELEMETRY_TABS_PORT_NAME) return false;
    const consumerId = `c${++consumerSeq}`;
    tabsWatchPorts.set(consumerId, port);
    if (tabsWatchPorts.size === 1) logger.info(SCOPE, 'tab-inventory watch opened');
    // Same-device wires only, like every telemetry frame.
    server?.broadcastFrame({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, { loopbackOnly: true });
    port.onDisconnect(() => {
      tabsWatchPorts.delete(consumerId);
      if (tabsWatchPorts.size === 0) {
        logger.info(SCOPE, 'last tab-inventory viewer left — detaching peers');
        server?.broadcastFrame({ type: TELEMETRY_TABS_DETACH_TYPE }, { loopbackOnly: true });
      }
    });
    return true;
  }

  function forwardConsumer(key: string, tabId: number, consumerId: string, message: LifecycleConsumerMessage): void {
    sendToPeer(key, { type: TELEMETRY_LIFECYCLE_CONSUMER_TYPE, tabId, consumerId, message });
  }

  /**
   * Accept one `oh-storage:<tabId>@<nodeId>` viewer port — the storage
   * sibling of the lifecycle acceptor. The subscribe raises the peer's
   * per-consumer storage watch (invalidation notes flow back through
   * it); the port's disconnect ends exactly this consumer's watch.
   */
  function acceptStoragePort(port: IncomingLifelinePort): boolean {
    const target = parseQualifiedStoragePortName(port.name);
    if (target === null || target.tabId < 0) return false;
    const key = watchKey(target.nodeId, target.tabId);
    const consumerId = `c${++consumerSeq}`;
    let entry = storageWatches.get(key);
    if (!entry) {
      entry = { peerKey: target.nodeId, tabId: target.tabId, ports: new Map() };
      storageWatches.set(key, entry);
      logger.info(SCOPE, `storage watch opened for tab ${target.tabId} on peer ${target.nodeId}`);
    }
    entry.ports.set(consumerId, port);
    sendToPeer(target.nodeId, { type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: target.tabId, consumerId });
    port.onDisconnect(() => {
      const live = storageWatches.get(key);
      if (!live) return;
      live.ports.delete(consumerId);
      sendToPeer(target.nodeId, { type: TELEMETRY_STORAGE_DETACH_TYPE, tabId: target.tabId, consumerId });
      if (live.ports.size === 0) storageWatches.delete(key);
    });
    return true;
  }

  /**
   * Accept one `oh-console:<tabId>@<nodeId>` viewer port — the console
   * sibling of the lifecycle acceptor. Subscribe-on-open: the console
   * watch has no consumer vocabulary beyond the handshake (view-only
   * plane), so the port's very existence is the subscription and its
   * disconnect ends exactly this consumer's stream session.
   */
  function acceptConsolePort(port: IncomingLifelinePort): boolean {
    const target = parseQualifiedConsolePortName(port.name);
    if (target === null || target.tabId < 0) return false;
    const key = watchKey(target.nodeId, target.tabId);
    const consumerId = `c${++consumerSeq}`;
    let entry = consoleWatches.get(key);
    if (!entry) {
      entry = { peerKey: target.nodeId, tabId: target.tabId, ports: new Map() };
      consoleWatches.set(key, entry);
      logger.info(SCOPE, `console watch opened for tab ${target.tabId} on peer ${target.nodeId}`);
    }
    entry.ports.set(consumerId, port);
    sendToPeer(target.nodeId, { type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: target.tabId, consumerId });
    port.onDisconnect(() => {
      const live = consoleWatches.get(key);
      if (!live) return;
      live.ports.delete(consumerId);
      sendToPeer(target.nodeId, { type: TELEMETRY_CONSOLE_DETACH_TYPE, tabId: target.tabId, consumerId });
      if (live.ports.size === 0) consoleWatches.delete(key);
    });
    return true;
  }

  function acceptPort(port: IncomingLifelinePort): boolean {
    const target = parseQualifiedLifecyclePortName(port.name);
    // Only real browser tabs ride the qualified shape — synthetic
    // partitions (the proxy sentinel) stay on their own acceptors.
    if (target === null || target.tabId < 0) {
      return acceptStoragePort(port) || acceptConsolePort(port) || acceptTabsPort(port);
    }
    const key = watchKey(target.nodeId, target.tabId);
    const consumerId = `c${++consumerSeq}`;
    let entry = watches.get(key);
    if (!entry) {
      entry = { peerKey: target.nodeId, tabId: target.tabId, ports: new Map() };
      watches.set(key, entry);
      logger.info(SCOPE, `watch opened for tab ${target.tabId} on peer ${target.nodeId}`);
    }
    entry.ports.set(consumerId, port);
    port.onMessage<LifecycleConsumerMessage>((msg) => {
      if (!isConsumerMessage(msg)) return;
      forwardConsumer(target.nodeId, target.tabId, consumerId, msg);
    });
    port.onDisconnect(() => {
      const live = watches.get(key);
      if (!live) return;
      live.ports.delete(consumerId);
      // End THIS viewer's stream session; the extension's per-tab
      // ingestion refs refcount across consumers, so the last detach is
      // what actually stops ingestion (the no-viewer → silence law).
      sendToPeer(target.nodeId, { type: TELEMETRY_LIFECYCLE_DETACH_TYPE, tabId: target.tabId, consumerId });
      if (live.ports.size === 0) watches.delete(key);
    });
    return true;
  }

  function handleBatch(message: Record<string, unknown>, peer: PeerSummary): void {
    const tabId = message.tabId;
    const consumerId = message.consumerId;
    const messages = message.messages;
    if (typeof tabId !== 'number' || typeof consumerId !== 'string' || !Array.isArray(messages)) return;
    const entry = watches.get(watchKey(peerKey(peer), tabId));
    // Point-to-point: the batch belongs to exactly one consumer's
    // session — a viewer that just left simply drops its tail frames.
    const port = entry?.ports.get(consumerId);
    if (!port) return;
    for (const wireMessage of messages) {
      port.postMessage(wireMessage);
    }
  }

  function handleConsoleBatch(message: Record<string, unknown>, peer: PeerSummary): void {
    const tabId = message.tabId;
    const consumerId = message.consumerId;
    const messages = message.messages;
    if (typeof tabId !== 'number' || typeof consumerId !== 'string' || !Array.isArray(messages)) return;
    const entry = consoleWatches.get(watchKey(peerKey(peer), tabId));
    // Point-to-point: the batch belongs to exactly one consumer's
    // session — a viewer that just left simply drops its tail frames.
    const port = entry?.ports.get(consumerId);
    if (!port) return;
    for (const wireMessage of messages) {
      port.postMessage(wireMessage);
    }
  }

  function handleTabsResponse(message: Record<string, unknown>, peer: PeerSummary): void {
    const queue = pendingTabs.get(peerKey(peer));
    const slot = queue?.shift();
    if (!slot) return;
    const payload = message.payload as TelemetryTabsListResponsePayload | undefined;
    slot.settle(payload && Array.isArray(payload.tabs) ? payload : null);
  }

  /** One peer's payload → the shared inventory row, identical for the
   *  pulled read and the pushed watch. */
  function peerTabsRow(payload: TelemetryTabsListResponsePayload, peer: PeerSummary): BrowserTelemetryPeerTabs {
    return {
      // `nodeId` on the inventory wire carries the STABLE qualifier —
      // it is what the workbench passes back in qualified port names.
      nodeId: peerKey(peer),
      agent: peer.agent,
      browser: payload.browser,
      debug: payload.debug ?? DEBUG_UNAVAILABLE,
      tabs: payload.tabs,
      watchConsent: payload.watchConsent !== false,
    };
  }

  /** One pushed inventory snapshot from a subscribed peer → upsert
   *  envelope to every open viewer port. */
  function handleTabsPush(message: Record<string, unknown>, peer: PeerSummary): void {
    if (tabsWatchPorts.size === 0) return;
    const payload = message.payload as TelemetryTabsListResponsePayload | undefined;
    if (!payload || !Array.isArray(payload.tabs)) return;
    fanToTabsWatchers({ kind: 'peer-tabs', peer: peerTabsRow(payload, peer) });
  }

  function handleDebugResponse(message: Record<string, unknown>, peer: PeerSummary): void {
    const queue = pendingDebug.get(peerKey(peer));
    const slot = queue?.shift();
    if (!slot) return;
    const payload = message.payload as TelemetryDebugControlResponsePayload | undefined;
    slot.settle(payload && typeof payload.debug === 'object' && payload.debug !== null ? payload : null);
  }

  function handleStorageResponse(message: Record<string, unknown>): void {
    const callId = message.callId;
    if (typeof callId !== 'string') return;
    const slot = pendingStorage.get(callId);
    if (!slot) return;
    pendingStorage.delete(callId);
    // A consent-refused verb settles `ok: false` — the same honest
    // unreadable state a vanished peer produces, without the timeout.
    if (message.refused === 'consent-off') {
      slot.settle(false, null);
      return;
    }
    slot.settle(true, message.payload ?? null);
  }

  /**
   * The peer's consent gate refused a watch (at subscribe, or by
   * tearing a live session down on a mid-watch flip). Lifecycle-plane
   * refusals ride to the viewer port as a `watch-refused` wire envelope
   * — the Traffic Monitor renders the gate from it. Storage/console
   * refusals only drop the daemon-side watch bookkeeping: consent is
   * per-browser, so the lifecycle envelope already tells the panel the
   * whole tab is refused, and those planes' port vocabularies stay
   * untouched.
   */
  function handleWatchRefused(message: Record<string, unknown>, peer: PeerSummary): void {
    const tabId = message.tabId;
    const consumerId = message.consumerId;
    const plane = message.plane as TelemetryWatchPlane | undefined;
    if (typeof tabId !== 'number' || typeof consumerId !== 'string') return;
    logger.info(SCOPE, `peer ${peerKey(peer)} refused ${plane ?? 'unknown'} watch for tab ${tabId} (consent off)`);
    if (plane === 'lifecycle') {
      const entry = watches.get(watchKey(peerKey(peer), tabId));
      const port = entry?.ports.get(consumerId);
      port?.postMessage({ kind: 'watch-refused', tabId, reason: 'consent-off' });
    }
  }

  function handleStorageInvalidation(message: Record<string, unknown>, peer: PeerSummary): void {
    const tabId = message.tabId;
    const consumerId = message.consumerId;
    const kind = message.kind;
    if (typeof tabId !== 'number' || typeof consumerId !== 'string' || typeof kind !== 'string') return;
    const entry = storageWatches.get(watchKey(peerKey(peer), tabId));
    // Point-to-point: the note belongs to exactly one consumer's watch.
    const port = entry?.ports.get(consumerId);
    if (!port) return;
    port.postMessage({ tabId, kind });
  }

  const peerPush: WsPeerPushHooks = {
    owns(type) {
      return (
        type === TELEMETRY_LIFECYCLE_BATCH_TYPE ||
        type === TELEMETRY_CONSOLE_BATCH_TYPE ||
        type === TABS_LIST_RESPONSE_TYPE ||
        type === TELEMETRY_TABS_PUSH_TYPE ||
        type === DEBUG_CONTROL_RESPONSE_TYPE ||
        type === STORAGE_CALL_RESPONSE_TYPE ||
        type === TELEMETRY_STORAGE_INVALIDATION_TYPE ||
        type === TELEMETRY_HOST_READY_TYPE ||
        type === TELEMETRY_WATCH_REFUSED_TYPE
      );
    },
    handle(message, peer) {
      if (message.type === TELEMETRY_LIFECYCLE_BATCH_TYPE) handleBatch(message, peer);
      else if (message.type === TELEMETRY_CONSOLE_BATCH_TYPE) handleConsoleBatch(message, peer);
      else if (message.type === TELEMETRY_HOST_READY_TYPE) rejoinPeerWatches(peer, 'telemetry host ready');
      else if (message.type === TELEMETRY_TABS_PUSH_TYPE) handleTabsPush(message, peer);
      else if (message.type === DEBUG_CONTROL_RESPONSE_TYPE) handleDebugResponse(message, peer);
      else if (message.type === STORAGE_CALL_RESPONSE_TYPE) handleStorageResponse(message);
      else if (message.type === TELEMETRY_STORAGE_INVALIDATION_TYPE) handleStorageInvalidation(message, peer);
      else if (message.type === TELEMETRY_WATCH_REFUSED_TYPE) handleWatchRefused(message, peer);
      else handleTabsResponse(message, peer);
    },
  };

  /**
   * Re-send `subscribe` for every live watch the peer owns. Fired at
   * the peer's connect event (SW eviction, wire flap) AND on its
   * telemetry-host-ready announce — a cold service worker HELLOs
   * before its telemetry handlers register, so the connect-time
   * subscribe can land unhandled; the announce closes that boot race.
   */
  function rejoinPeerWatches(peer: PeerSummary, cause: string): void {
    for (const entry of watches.values()) {
      if (entry.peerKey !== peerKey(peer) || entry.ports.size === 0) continue;
      logger.info(SCOPE, `peer ${entry.peerKey} ${cause} — re-subscribing tab ${entry.tabId}`);
      for (const consumerId of entry.ports.keys()) {
        forwardConsumer(entry.peerKey, entry.tabId, consumerId, { kind: 'subscribe' });
      }
    }
    // Storage watches ride the same lifecycle: the extension's watch set
    // died with its wire (or the cold SW), so re-open every live one.
    for (const entry of storageWatches.values()) {
      if (entry.peerKey !== peerKey(peer) || entry.ports.size === 0) continue;
      for (const consumerId of entry.ports.keys()) {
        sendToPeer(entry.peerKey, { type: TELEMETRY_STORAGE_CONSUMER_TYPE, tabId: entry.tabId, consumerId });
      }
    }
    // Console watches too — the fresh subscribe replays the hub's
    // retained per-tab log into each consumer's mirror.
    for (const entry of consoleWatches.values()) {
      if (entry.peerKey !== peerKey(peer) || entry.ports.size === 0) continue;
      for (const consumerId of entry.ports.keys()) {
        sendToPeer(entry.peerKey, { type: TELEMETRY_CONSOLE_CONSUMER_TYPE, tabId: entry.tabId, consumerId });
      }
    }
    // The inventory watch rides the same lifecycle: a watched peer that
    // (re)connects is re-subscribed, and its snapshot-on-subscribe push
    // upserts it into every viewer's rail without a pull.
    if (tabsWatchPorts.size > 0) {
      sendToPeer(peerKey(peer), { type: TELEMETRY_TABS_SUBSCRIBE_TYPE });
    }
  }

  return {
    peerPush,
    setWsServer(next) {
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = next;
      if (next) {
        unsubscribePeerChange = next.subscribePeerChange((event) => {
          if (event.kind === 'connect') {
            rejoinPeerWatches(event.peer, 'reconnected');
            return;
          }
          // A closed wire drops the peer from every viewer's rail — an
          // SW-eviction flap re-adds it via the reconnect's subscribe
          // push, so consumers debounce the removal, not the relay.
          fanToTabsWatchers({ kind: 'peer-gone', nodeId: peerKey(event.peer) });
        });
        // Peers already past handshake on an attached server (relay
        // installed after first bind) get their watches re-joined too.
        for (const peer of next.listConnectedPeers()) rejoinPeerWatches(peer, 'already connected');
      }
    },
    installLifeline() {
      return getLifelineServer().onConnect((port) => {
        acceptPort(port);
      });
    },
    listTabs() {
      const liveServer = server;
      if (!liveServer) return Promise.resolve({ peers: [] });
      const peers = liveServer.listConnectedPeers();
      return Promise.all(
        peers.map(
          (peer) =>
            new Promise<BrowserTelemetryPeerTabs | null>((resolve) => {
              const key = peerKey(peer);
              let queue = pendingTabs.get(key);
              if (!queue) {
                queue = [];
                pendingTabs.set(key, queue);
              }
              const slot: PendingTabsSlot = {
                settle(payload) {
                  clearTimeout(timer);
                  resolve(payload ? peerTabsRow(payload, peer) : null);
                },
              };
              const timer = setTimeout(() => {
                const idx = queue.indexOf(slot);
                if (idx >= 0) queue.splice(idx, 1);
                resolve(null);
              }, TABS_LIST_TIMEOUT_MS);
              queue.push(slot);
              liveServer.broadcastFrame(
                { type: TELEMETRY_TABS_LIST_TYPE },
                { filterPeer: (p) => p.peerId === peer.peerId },
              );
            }),
        ),
      ).then((collected) => ({ peers: collected.filter((p): p is BrowserTelemetryPeerTabs => p !== null) }));
    },
    debugControl(nodeId, command) {
      const liveServer = server;
      if (!liveServer) return Promise.resolve(null);
      const peer = liveServer.listConnectedPeers().find((p) => peerKey(p) === nodeId);
      if (!peer) return Promise.resolve(null);
      return new Promise<TelemetryDebugState | null>((resolve) => {
        let queue = pendingDebug.get(nodeId);
        if (!queue) {
          queue = [];
          pendingDebug.set(nodeId, queue);
        }
        const slot: PendingDebugSlot = {
          settle(payload) {
            clearTimeout(timer);
            resolve(payload ? payload.debug : null);
          },
        };
        const timer = setTimeout(() => {
          const idx = queue.indexOf(slot);
          if (idx >= 0) queue.splice(idx, 1);
          resolve(null);
        }, DEBUG_CONTROL_TIMEOUT_MS);
        queue.push(slot);
        liveServer.broadcastFrame(
          { type: TELEMETRY_DEBUG_CONTROL_TYPE, command },
          { filterPeer: (p) => p.peerId === peer.peerId },
        );
      });
    },
    storageCall(nodeId, method, params) {
      const liveServer = server;
      if (!liveServer || !isTelemetryStorageMethod(method)) return Promise.resolve({ ok: false, payload: null });
      const peer = liveServer.listConnectedPeers().find((p) => peerKey(p) === nodeId);
      if (!peer) return Promise.resolve({ ok: false, payload: null });
      return new Promise<{ ok: boolean; payload: unknown }>((resolve) => {
        const callId = `sc${++storageCallSeq}`;
        const slot: PendingStorageSlot = {
          settle(ok, payload) {
            clearTimeout(timer);
            resolve({ ok, payload });
          },
        };
        const timer = setTimeout(() => {
          pendingStorage.delete(callId);
          resolve({ ok: false, payload: null });
        }, STORAGE_CALL_TIMEOUT_MS);
        pendingStorage.set(callId, slot);
        liveServer.broadcastFrame(
          { type: TELEMETRY_STORAGE_CALL_TYPE, callId, method, params },
          { filterPeer: (p) => p.peerId === peer.peerId },
        );
      });
    },
    dispose() {
      unsubscribePeerChange?.();
      unsubscribePeerChange = null;
      server = null;
      for (const queue of pendingTabs.values()) {
        for (const slot of queue.splice(0)) slot.settle(null);
      }
      pendingTabs.clear();
      for (const queue of pendingDebug.values()) {
        for (const slot of queue.splice(0)) slot.settle(null);
      }
      pendingDebug.clear();
      for (const slot of pendingStorage.values()) slot.settle(false, null);
      pendingStorage.clear();
      watches.clear();
      storageWatches.clear();
      consoleWatches.clear();
      tabsWatchPorts.clear();
    },
  };
}
