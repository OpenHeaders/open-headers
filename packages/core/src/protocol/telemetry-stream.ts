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
export const TELEMETRY_HOST_READY_TYPE = 'oh.telemetry.host.ready' as const;

/** Host → extension: one consumer message for one browser tab. */
export interface TelemetryLifecycleConsumerMessage {
  type: typeof TELEMETRY_LIFECYCLE_CONSUMER_TYPE;
  tabId: number;
  message: LifecycleConsumerMessage;
}

/** Host → extension: the host's last viewer of the tab disconnected. */
export interface TelemetryLifecycleDetachMessage {
  type: typeof TELEMETRY_LIFECYCLE_DETACH_TYPE;
  tabId: number;
}

/**
 * Extension → host: an ordered, tick-coalesced run of lifecycle wire
 * envelopes for one tab. Order within and across batches is delivery
 * order — a `ready` always precedes its replay, replay precedes live.
 */
export interface TelemetryLifecycleBatchMessage {
  type: typeof TELEMETRY_LIFECYCLE_BATCH_TYPE;
  tabId: number;
  messages: LifecycleWireMessage[];
}

/** Host → extension: browser-tab inventory request (reply on `<type>:response`). */
export interface TelemetryTabsListMessage {
  type: typeof TELEMETRY_TABS_LIST_TYPE;
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

/** `payload` of the `oh.telemetry.tabs.list:response` reply frame. */
export interface TelemetryTabsListResponsePayload {
  tabs: BrowserTabWire[];
  /** Who is answering — drives the source rail's per-browser header. */
  browser: TelemetryBrowserIdentity;
}

export type TelemetryStreamMessage =
  | TelemetryLifecycleConsumerMessage
  | TelemetryLifecycleDetachMessage
  | TelemetryLifecycleBatchMessage
  | TelemetryTabsListMessage
  | TelemetryHostReadyMessage;
