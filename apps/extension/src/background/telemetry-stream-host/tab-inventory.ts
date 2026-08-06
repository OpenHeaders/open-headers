/**
 * Tab-inventory watch host — the push half of the browser-tab inventory
 * plane. The request/response read (`oh.telemetry.tabs.list`, served by
 * the stream host) answers a moment-in-time snapshot; this host keeps a
 * subscribed desktop CURRENT: while a wire holds a tabs subscription,
 * every tab mutation (`chrome.tabs` events), Debug-posture change, and
 * consent flip pushes a fresh full snapshot over the wire, debounced to
 * one frame per settle window.
 *
 * The no-viewer → silence law, applied to the inventory plane: the
 * `chrome.tabs` listeners are attached only while at least one wire is
 * subscribed and detached when the last watch ends, so an idle browser
 * emits nothing.
 *
 * Full-state snapshots on purpose (never deltas): a snapshot is an
 * idempotent upsert, so a frame lost to a dying wire heals on the next
 * change instead of desyncing a delta stream — and the daemon relay can
 * seed a late-joining workbench viewer by simply re-subscribing.
 *
 * Same-device gate: like every telemetry frame, subscribe/detach are
 * honored from loopback wires only. Service-worker eviction drops the
 * subscription state with the wire; the daemon re-subscribes on the
 * next connect (or the `host ready` announce), exactly as it re-joins
 * lifecycle watches.
 */

import type { BrowserTabWire, TelemetryTabsListResponsePayload } from '@openheaders/core/protocol';
import {
  TELEMETRY_TABS_DETACH_TYPE,
  TELEMETRY_TABS_PUSH_TYPE,
  TELEMETRY_TABS_SUBSCRIBE_TYPE,
} from '@openheaders/core/protocol';
import {
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import { desktopWatchAllowed, subscribeDesktopWatchConsent } from './consent';
import type { TelemetryDebugSeam } from './index';
import { browserIdentity, DEBUG_UNAVAILABLE, queryBrowserTabs } from './tab-snapshot';

const SCOPE = 'TabInventoryHost';

/**
 * Settle window between the first inventory-changing event and the
 * pushed snapshot. Tab churn is bursty (a page load mutates title,
 * URL, and favicon in quick succession) — one trailing frame per burst
 * keeps the wire quiet without the change feeling anything but instant.
 */
export const TAB_INVENTORY_DEBOUNCE_MS = 150;

export interface TabInventoryHostOptions {
  /** Debug-mode posture for the snapshot + change pushes. */
  readonly debug?: TelemetryDebugSeam;
  /** Test seams — default to the real connection manager + chrome.tabs. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
  readonly queryTabs?: () => Promise<BrowserTabWire[]>;
  readonly debounceMs?: number;
}

export interface TabInventoryHost {
  dispose(): void;
}

/** The structural shape shared by every `chrome.tabs` event — lets the
 *  host treat them uniformly with one no-arg listener. */
interface TabsEventLike {
  addListener(callback: () => void): void;
  removeListener(callback: () => void): void;
}

/**
 * The `chrome.tabs` events that can change what the inventory reports.
 * Window lifecycle needs no separate listeners — closing a window fires
 * `onRemoved` per tab, and a new window's first tab arrives via
 * `onCreated`. Resolved at attach time (not module load) and filtered
 * live: browsers that lack an event simply contribute the ones they
 * have.
 */
function liveTabEvents(): TabsEventLike[] {
  const { tabs } = chrome;
  const events: Array<TabsEventLike | undefined> = [
    tabs.onCreated,
    tabs.onRemoved,
    tabs.onUpdated,
    tabs.onMoved,
    tabs.onAttached,
    tabs.onDetached,
    tabs.onReplaced,
    tabs.onActivated,
  ];
  return events.filter((event): event is TabsEventLike => event !== undefined);
}

export function startTabInventoryHost(options: TabInventoryHostOptions = {}): TabInventoryHost {
  const send = options.send ?? sendToBackend;
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;
  const queryTabs = options.queryTabs ?? queryBrowserTabs;
  const debounceMs = options.debounceMs ?? TAB_INVENTORY_DEBOUNCE_MS;
  const debug = options.debug;

  const watchedWires = new Set<string>();
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let listenersAttached = false;
  let unsubscribeDebug: (() => void) | null = null;
  let disposed = false;

  function snapshotPayload(): Promise<TelemetryTabsListResponsePayload> {
    return queryTabs().then((tabs) => ({
      tabs,
      browser: browserIdentity(),
      debug: debug?.getState() ?? DEBUG_UNAVAILABLE,
      watchConsent: desktopWatchAllowed(),
    }));
  }

  function pushTo(backendIds: Iterable<string>): void {
    const targets = [...backendIds];
    if (targets.length === 0) return;
    void snapshotPayload().then((payload) => {
      if (disposed) return;
      for (const backendId of targets) {
        // A failed send means the wire died mid-flight — its close
        // callback tears the watch down; nothing to retry here.
        if (watchedWires.has(backendId)) send(backendId, { type: TELEMETRY_TABS_PUSH_TYPE, payload });
      }
    });
  }

  /** Debounced fan-out to every subscribed wire. */
  function schedulePush(): void {
    if (disposed || watchedWires.size === 0 || pushTimer !== null) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      pushTo(watchedWires);
    }, debounceMs);
  }

  const onTabsEvent = (): void => schedulePush();
  let attachedEvents: TabsEventLike[] = [];

  function attachListeners(): void {
    if (listenersAttached) return;
    listenersAttached = true;
    attachedEvents = liveTabEvents();
    for (const event of attachedEvents) event.addListener(onTabsEvent);
    unsubscribeDebug = debug?.onChange?.(() => schedulePush()) ?? null;
  }

  function detachListeners(): void {
    if (!listenersAttached) return;
    listenersAttached = false;
    for (const event of attachedEvents) event.removeListener(onTabsEvent);
    attachedEvents = [];
    unsubscribeDebug?.();
    unsubscribeDebug = null;
    if (pushTimer !== null) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
  }

  function dropWire(backendId: string): void {
    if (!watchedWires.delete(backendId)) return;
    if (watchedWires.size === 0) detachListeners();
  }

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (type === TELEMETRY_TABS_SUBSCRIBE_TYPE) {
      // Same-device wires only — claimed and dropped otherwise.
      if (wire.isLoopback()) {
        if (!watchedWires.has(wire.backendId)) {
          watchedWires.add(wire.backendId);
          attachListeners();
          logger.info(SCOPE, `inventory watch opened for wire ${wire.backendId}`);
        }
        // Snapshot-on-subscribe, re-subscribe included: the seed frame a
        // late-joining workbench viewer renders from. Undebounced — the
        // subscriber is waiting.
        pushTo([wire.backendId]);
      }
      return true;
    }
    if (type === TELEMETRY_TABS_DETACH_TYPE) {
      if (wire.isLoopback()) dropWire(wire.backendId);
      return true;
    }
    return false;
  });

  // A closed wire ends its watch — the daemon re-subscribes on the next
  // connect (or the host-ready announce), rebuilding it from scratch.
  const unsubscribeCloseHandle = subscribeClose((wire) => {
    dropWire(wire.backendId);
  });

  // Consent flips change what the snapshot reports (`watchConsent`
  // gates every row's affordances) — push so the desktop's rail flips
  // honest immediately, in both directions.
  const unsubscribeConsent = subscribeDesktopWatchConsent(() => schedulePush());

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterInbound();
      unsubscribeCloseHandle();
      unsubscribeConsent();
      watchedWires.clear();
      detachListeners();
    },
  };
}
