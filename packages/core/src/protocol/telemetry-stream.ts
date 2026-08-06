/**
 * Browser-telemetry streaming wire types — the observability plane's
 * lifecycle channels on the extension ↔ daemon WebSocket
 * (OBSERVABILITY_PLAN.md Phase 1).
 *
 * Telemetry plane ≠ sync plane: these frames share the WS lifeline with
 * the sync channels but never touch the mutation log or sync engine —
 * everything here is ephemeral observation, in-memory on both ends.
 *
 * Direction and gating:
 *
 *   - host → extension: {@link TelemetryLifecycleConsumerMessage}
 *     forwards ONE workbench consumer message (`subscribe` /
 *     `clear-session` / `request-body`) for one browser tab;
 *     {@link TelemetryLifecycleDetachMessage} ends the host's watch on
 *     the tab (last workbench viewer left). Nothing streams until a
 *     `subscribe` arrives — the no-viewer → silence law.
 *   - extension → host: {@link TelemetryLifecycleBatchMessage} carries a
 *     tick-coalesced ordered run of `LifecycleWireMessage` envelopes for
 *     one tab — the same envelopes the extension's panel port would see,
 *     so the receiving side needs no second reducer vocabulary.
 *   - host → extension: {@link TelemetryTabsListMessage} asks for the
 *     browser-tab inventory (the context the workbench's tab picker
 *     renders); the extension answers on the standard
 *     `<type>:response` reply channel with
 *     {@link TelemetryTabsListResponsePayload}.
 *
 * The extension honors telemetry frames from SAME-DEVICE (loopback)
 * wires only: streaming a user's live browsing to an off-device daemon
 * is a privacy posture change no current phase ratifies. Frames from
 * off-device wires are claimed and dropped.
 */

import type { LifecycleConsumerMessage, LifecycleWireMessage } from '../request-lifecycle';

export const TELEMETRY_LIFECYCLE_CONSUMER_TYPE = 'oh.telemetry.lifecycle.consumer' as const;
export const TELEMETRY_LIFECYCLE_DETACH_TYPE = 'oh.telemetry.lifecycle.detach' as const;
export const TELEMETRY_LIFECYCLE_BATCH_TYPE = 'oh.telemetry.lifecycle.batch' as const;
export const TELEMETRY_TABS_LIST_TYPE = 'oh.telemetry.tabs.list' as const;
export const TELEMETRY_TABS_SUBSCRIBE_TYPE = 'oh.telemetry.tabs.subscribe' as const;
export const TELEMETRY_TABS_DETACH_TYPE = 'oh.telemetry.tabs.detach' as const;
export const TELEMETRY_TABS_PUSH_TYPE = 'oh.telemetry.tabs.push' as const;
export const TELEMETRY_HOST_READY_TYPE = 'oh.telemetry.host.ready' as const;
export const TELEMETRY_DEBUG_CONTROL_TYPE = 'oh.telemetry.debug.control' as const;
export const TELEMETRY_WATCH_REFUSED_TYPE = 'oh.telemetry.watch.refused' as const;

/**
 * The workbench-side tab-inventory watch lifeline. Unqualified on
 * purpose — the inventory spans EVERY connected peer, so the watch has
 * no `<tabId>@<nodeId>` partition to name. While at least one port is
 * open the host's relay holds a tabs subscription on every peer;
 * the last disconnect releases them (the no-viewer → silence law,
 * applied to the inventory plane).
 */
export const TELEMETRY_TABS_PORT_NAME = 'oh-tabs' as const;

/** Which telemetry plane a refusal addresses. */
export type TelemetryWatchPlane = 'lifecycle' | 'storage' | 'console';

/**
 * Extension → host: a watch subscribe (or a mid-watch session) was
 * refused by the browser-side consent gate (`backend.allowDesktopWatch`
 * — identity decides WHO may attach, consent decides WHAT an attached
 * peer may subscribe to). Coarse by design, like the NM bootstrap's
 * refusals: one reason on the wire, detail stays in the extension's
 * log. The peer's rules/sync planes are untouched — this frame is what
 * lets the desktop render the refusal honestly instead of an empty
 * stream.
 */
export interface TelemetryWatchRefusedMessage {
  type: typeof TELEMETRY_WATCH_REFUSED_TYPE;
  plane: TelemetryWatchPlane;
  tabId: number;
  consumerId: string;
  reason: 'consent-off';
}

/**
 * Host → extension: one consumer message for one browser tab, on behalf
 * of ONE workbench consumer. `consumerId` is minted by the host's relay
 * per workbench viewer port and scopes the whole stream: the extension
 * keeps an independent session per `(wire, tab, consumer)`, so a new
 * viewer's subscribe/replay never resets a sibling viewer's stream (the
 * redundant-`ready` flash), and an overflow self-heal replays only the
 * consumer whose queue overflowed.
 */
export interface TelemetryLifecycleConsumerMessage {
  type: typeof TELEMETRY_LIFECYCLE_CONSUMER_TYPE;
  tabId: number;
  consumerId: string;
  message: LifecycleConsumerMessage;
}

/** Host → extension: one workbench viewer of the tab disconnected. */
export interface TelemetryLifecycleDetachMessage {
  type: typeof TELEMETRY_LIFECYCLE_DETACH_TYPE;
  tabId: number;
  consumerId: string;
}

/**
 * Extension → host: an ordered, tick-coalesced run of lifecycle wire
 * envelopes for one tab, addressed to the one consumer whose session
 * produced it. Order within and across batches is delivery order — a
 * `ready` always precedes its replay, replay precedes live.
 */
export interface TelemetryLifecycleBatchMessage {
  type: typeof TELEMETRY_LIFECYCLE_BATCH_TYPE;
  tabId: number;
  consumerId: string;
  messages: LifecycleWireMessage[];
}

/** Host → extension: browser-tab inventory request (reply on `<type>:response`). */
export interface TelemetryTabsListMessage {
  type: typeof TELEMETRY_TABS_LIST_TYPE;
}

/**
 * Host → extension: open this wire's tab-inventory watch. The extension
 * answers with an immediate {@link TelemetryTabsPushMessage} snapshot
 * and keeps pushing debounced snapshots on every tab, Debug-posture, or
 * consent change until the watch is detached or the wire closes.
 * Idempotent — a re-subscribe on an already-watched wire just re-pushes
 * the current snapshot (the relay uses this to seed a late-joining
 * workbench viewer).
 */
export interface TelemetryTabsSubscribeMessage {
  type: typeof TELEMETRY_TABS_SUBSCRIBE_TYPE;
}

/** Host → extension: close this wire's tab-inventory watch. */
export interface TelemetryTabsDetachMessage {
  type: typeof TELEMETRY_TABS_DETACH_TYPE;
}

/**
 * Extension → host: one full inventory snapshot for this browser —
 * the same payload the request/response read answers with, pushed
 * whenever the inventory changes while a watch is open. Full-state on
 * purpose: snapshots are idempotent upserts, so a dropped frame heals
 * on the next change instead of desyncing a delta stream.
 */
export interface TelemetryTabsPushMessage {
  type: typeof TELEMETRY_TABS_PUSH_TYPE;
  payload: TelemetryTabsListResponsePayload;
}

/**
 * Extension → host: the telemetry stream host just came up on an
 * already-connected wire. A cold service worker HELLOs from its
 * eval-time sync wiring BEFORE the lifecycle pipeline registers the
 * telemetry handlers, so a subscribe the host relays at the peer's
 * connect event can land unhandled and drop. This announce closes that
 * boot race: the relay re-joins the peer's live watches on receipt,
 * exactly as it does at the connect event.
 */
export interface TelemetryHostReadyMessage {
  type: typeof TELEMETRY_HOST_READY_TYPE;
}

/** One open browser tab, as the extension's context-provider reports it. */
export interface BrowserTabWire {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  active: boolean;
  /**
   * The tab's favicon as a small `data:` URI, resolved by the extension
   * (the workbench renderer's CSP forbids remote images, and the desktop
   * must never fetch from arbitrary sites itself). Absent while the
   * extension's favicon cache is cold or the icon is unfetchable.
   */
  favIconUrl?: string;
}

/** The answering browser's display identity (build target + platform). */
export interface TelemetryBrowserIdentity {
  /** Browser family name, e.g. `Chrome` / `Firefox` / `Edge` / `Safari`. */
  name: string;
  /** Human platform label (`macOS`, `Windows`, …) or null when unknown. */
  platform: string | null;
}

/**
 * The answering browser's Debug-mode (CDP) posture — the fidelity ladder
 * the Traffic Monitor's tab rows render. Mirrors the extension's own
 * attach reconciler: `pinnedTabs` is the explicit per-tab overlay
 * (recorded even while the master switch is off), `attachedTabs` is the
 * committed set. `available` is false where the browser cannot drive
 * the debugging protocol (Firefox / Safari).
 */
export interface TelemetryDebugState {
  available: boolean;
  /** The `inspection.cdpEnabled` master switch. */
  enabled: boolean;
  attachedTabs: number[];
  pinnedTabs: number[];
}

/**
 * Host → extension: one Debug-mode control command from the paired
 * desktop — pin/unpin a tab into the attach scope, or flip the master
 * switch. Same consent posture as the extension's own footer control:
 * the command only feeds the attach reconciler's inputs, and the
 * browser's debugger banner remains the per-tab consent surface.
 */
export type TelemetryDebugCommand =
  | { kind: 'pin'; tabId: number; pinned: boolean }
  | { kind: 'enable'; enabled: boolean };

export interface TelemetryDebugControlMessage {
  type: typeof TELEMETRY_DEBUG_CONTROL_TYPE;
  command: TelemetryDebugCommand;
}

/**
 * `payload` of the `oh.telemetry.debug.control:response` reply frame —
 * the post-command state snapshot. An attach the command just triggered
 * may still be mid-handshake (the banner), so `attachedTabs` converges
 * on a later inventory read.
 */
export interface TelemetryDebugControlResponsePayload {
  debug: TelemetryDebugState;
}

/** `payload` of the `oh.telemetry.tabs.list:response` reply frame. */
export interface TelemetryTabsListResponsePayload {
  tabs: BrowserTabWire[];
  /** Who is answering — drives the source rail's per-browser header. */
  browser: TelemetryBrowserIdentity;
  /** The browser's Debug-mode posture — drives the tab rows' attach affordance. */
  debug: TelemetryDebugState;
  /**
   * Whether this browser's consent gate currently admits watch
   * subscriptions at all (`backend.allowDesktopWatch`). Absent means
   * consenting — only a peer that actively refuses reports `false`, so
   * older peers keep rendering as watchable.
   */
  watchConsent?: boolean;
}

/**
 * One connected browser peer's inventory, as the host relay projects it
 * to workbench viewers: the peer's snapshot payload joined with its
 * authenticated wire identity. `nodeId` carries the STABLE partition
 * qualifier (the HELLO `installId` when the peer sends one) — the same
 * value the workbench passes back in qualified lifeline port names.
 */
export interface TelemetryPeerTabsWire {
  nodeId: string;
  agent: string;
  browser: TelemetryBrowserIdentity;
  debug: TelemetryDebugState;
  tabs: ReadonlyArray<BrowserTabWire>;
  watchConsent: boolean;
}

/**
 * Host relay → workbench viewer, on the {@link TELEMETRY_TABS_PORT_NAME}
 * lifeline: per-peer inventory upserts as pushes arrive, and a
 * `peer-gone` when a peer's wire closes. Consumers key on `nodeId` —
 * a `peer-tabs` replaces that peer's whole entry.
 */
export type TelemetryTabsWatchMessage =
  | { kind: 'peer-tabs'; peer: TelemetryPeerTabsWire }
  | { kind: 'peer-gone'; nodeId: string };

export type TelemetryStreamMessage =
  | TelemetryLifecycleConsumerMessage
  | TelemetryLifecycleDetachMessage
  | TelemetryLifecycleBatchMessage
  | TelemetryTabsListMessage
  | TelemetryTabsSubscribeMessage
  | TelemetryTabsDetachMessage
  | TelemetryTabsPushMessage
  | TelemetryHostReadyMessage
  | TelemetryDebugControlMessage
  | TelemetryWatchRefusedMessage;
