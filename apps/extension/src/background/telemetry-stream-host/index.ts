/**
 * Telemetry stream host — the extension side of the browser live-
 * telemetry plane (OBSERVABILITY_PLAN.md Phase 1).
 *
 * Serves the desktop's watch of browser tabs over the backend WS wire,
 * mirroring what `lifecycle-port-host` does for a chrome runtime port:
 * a forwarded `subscribe` raises a tab-telemetry tracking ref (so
 * webRequest ingestion runs at all — subscription gating at the
 * source) and attaches a hub sink whose deliveries are tick-coalesced
 * into `oh.telemetry.lifecycle.batch` frames; the forwarded detach (or
 * the wire closing) detaches and releases the ref. The engine-owned
 * per-tab watch floors govern exactly as they do for the panel.
 *
 * Privacy gate: telemetry frames are honored from SAME-DEVICE
 * (loopback) wires only. A remote daemon asking to watch live browsing
 * is claimed and dropped — streaming a user's browsing off-device is a
 * posture no current phase ratifies.
 *
 * Consent gate (`backend.allowDesktopWatch`, see `./consent`): with
 * consent off a subscribe answers with a typed refusal instead of a
 * session, the inventory reply reports `watchConsent: false`, and
 * Debug-mode control commands are ignored. A mid-watch flip to off
 * tears every live session down with the same refusal; a flip back on
 * re-announces host-ready so the relay re-joins its live watches.
 *
 * Overflow degrades fidelity, never correctness: a session whose queue
 * outgrows the cap is cleared and re-attached, so the next flush is a
 * fresh `ready` + canonical replay instead of a stream with silent
 * holes the client reducer would misfold.
 */

import type {
  BrowserTabWire,
  TelemetryBrowserIdentity,
  TelemetryDebugControlMessage,
  TelemetryDebugState,
  TelemetryLifecycleConsumerMessage,
  TelemetryLifecycleDetachMessage,
} from '@openheaders/core/protocol';
import {
  TELEMETRY_DEBUG_CONTROL_TYPE,
  TELEMETRY_HOST_READY_TYPE,
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleWireMessage, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { AttachmentHandle, RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';
import {
  type BackendWireHandle,
  listConnectedWires,
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import type { LifecycleBodyFetcher, LifecycleProvenance } from '../lifecycle-port-host';
import { startTracking, stopTracking } from '../modules/tab-telemetry';
import { browserName, platformName } from '../self-host-label';
import { desktopWatchAllowed, subscribeDesktopWatchConsent, watchRefusedFrame } from './consent';
import { watchActivityDrop, watchActivityRaise, watchActivitySync } from './watch-activity';

const SCOPE = 'TelemetryStreamHost';

/** Tick cadence for batch flushes — the rAF-batch posture on the wire. */
export const TELEMETRY_FLUSH_INTERVAL_MS = 25;

/**
 * Queue cap per session. A replay never exceeds the engine store's
 * per-tab cap, so a healthy session stays far below this; sustained
 * overflow means the wire can't drain and the session self-heals with
 * a fresh replay instead of shipping a stream with holes.
 */
export const TELEMETRY_MAX_QUEUED_MESSAGES = 4000;

/**
 * Debug-mode (CDP) seam for the desktop's per-tab fidelity affordance:
 * `getState` snapshots the attach reconciler's posture for the
 * inventory reply; `setPin` / `setEnabled` feed its inputs on a relayed
 * control command. Absent on hosts without CDP — the reply then reports
 * `available: false` and control frames are dropped.
 */
export interface TelemetryDebugSeam {
  getState(): TelemetryDebugState;
  setPin(tabId: number, pinned: boolean): void;
  setEnabled(enabled: boolean): void;
}

export interface TelemetryStreamHostOptions {
  readonly hub: RequestLifecycleHub;
  /** Hydration gate for the watch-session floors, as for the port host. */
  readonly ready?: Promise<void>;
  /** Per-tab CDP-vs-heuristic provenance for the "CDP-enhanced" badge. */
  readonly provenance?: LifecycleProvenance;
  /** On-demand response-body fetch for the `request-body` pull. */
  readonly bodyFetcher?: LifecycleBodyFetcher;
  /** Debug-mode posture + controls; absent where the browser has no CDP. */
  readonly debug?: TelemetryDebugSeam;
  /** Test seams — default to the real connection manager + chrome.tabs. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
  readonly listWires?: typeof listConnectedWires;
  readonly queryTabs?: () => Promise<BrowserTabWire[]>;
  readonly flushIntervalMs?: number;
}

export interface TelemetryStreamHost {
  dispose(): void;
}

interface StreamSession {
  readonly backendId: string;
  readonly tabId: number;
  /** The relay-minted workbench-viewer id this stream is addressed to. */
  readonly consumerId: string;
  readonly trackingReason: string;
  handle: AttachmentHandle | null;
  queue: LifecycleWireMessage[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  unsubscribeProvenance: (() => void) | null;
  closed: boolean;
}

/**
 * One independent session per `(wire, tab, consumer)` — each workbench
 * viewer gets its own replay stream, so a late-joining viewer's fresh
 * `ready` never rides a sibling's stream. The per-tab ingestion refs
 * refcount across consumers, so the no-viewer → silence law holds
 * unchanged.
 */
function sessionKey(backendId: string, tabId: number, consumerId: string): string {
  return `${backendId} ${tabId} ${consumerId}`;
}

/** Bounds for the favicon → `data:` URI resolution below. */
const FAVICON_MAX_BYTES = 24 * 1024;
const FAVICON_FETCH_TIMEOUT_MS = 300;

/**
 * Favicon bytes → small `data:` URI, cached for the worker's lifetime
 * (`null` = known-unfetchable). The workbench renderer's CSP forbids
 * remote images and the desktop must never fetch from arbitrary sites,
 * so the ICON BYTES ride the inventory reply. Source order:
 *
 *   1. Chromium's `_favicon` extension endpoint (the `favicon`
 *      permission) — the browser's OWN favicon cache, keyed by page
 *      URL: zero network, the exact icon the tab strip shows.
 *   2. The tab's `favIconUrl` with `cache: 'force-cache'` (Firefox has
 *      no `_favicon`) — normally answered from the HTTP cache; the
 *      network is touched only for a genuinely cold icon.
 *
 * A resolution that misses the timeout keeps filling the cache in the
 * background — the icon appears on the next inventory refresh instead
 * of stalling the reply window.
 */
const faviconCache = new Map<string, string | null>();

async function fetchIconAsDataUri(url: string): Promise<string | null> {
  const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > FAVICON_MAX_BYTES) return null;
  const contentType = response.headers.get('content-type') ?? 'image/png';
  if (!contentType.startsWith('image/')) return null;
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** The `_favicon` cache endpoint URL, or null where unsupported. */
function chromiumFaviconEndpoint(pageUrl: string): string | null {
  try {
    const base = chrome.runtime.getURL('/_favicon/');
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
  } catch {
    return null;
  }
}

async function resolveFavicon(pageUrl: string, favIconUrl: string | undefined): Promise<string | undefined> {
  if (favIconUrl?.startsWith('data:')) {
    return favIconUrl.length <= FAVICON_MAX_BYTES * 2 ? favIconUrl : undefined;
  }
  const cacheKey = pageUrl || favIconUrl || '';
  if (cacheKey.length === 0) return undefined;
  const cached = faviconCache.get(cacheKey);
  if (cached !== undefined) return cached ?? undefined;

  const fill = (async (): Promise<string | null> => {
    const local = chromiumFaviconEndpoint(pageUrl);
    if (local !== null) {
      try {
        const fromCache = await fetchIconAsDataUri(local);
        if (fromCache !== null) return fromCache;
      } catch {
        // No `favicon` permission / non-Chromium — fall through.
      }
    }
    if (favIconUrl && (favIconUrl.startsWith('http://') || favIconUrl.startsWith('https://'))) {
      try {
        return await fetchIconAsDataUri(favIconUrl);
      } catch {
        return null;
      }
    }
    return null;
  })();
  void fill.then((resolved) => faviconCache.set(cacheKey, resolved));

  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), FAVICON_FETCH_TIMEOUT_MS));
  const won = await Promise.race([fill, timeout]);
  return won ?? undefined;
}

async function queryBrowserTabs(): Promise<BrowserTabWire[]> {
  const raw = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    try {
      chrome.tabs.query({}, (tabList: chrome.tabs.Tab[]) => resolve(tabList ?? []));
    } catch {
      resolve([]);
    }
  });
  return Promise.all(
    raw
      .filter((tab) => typeof tab.id === 'number' && tab.id >= 0)
      .map(async (tab) => {
        const favIconUrl = await resolveFavicon(tab.url ?? '', tab.favIconUrl);
        return {
          tabId: tab.id as number,
          windowId: tab.windowId ?? -1,
          title: tab.title ?? '',
          url: tab.url ?? '',
          active: tab.active === true,
          ...(favIconUrl !== undefined ? { favIconUrl } : {}),
        };
      }),
  );
}

/** This browser's display identity for the inventory reply. */
function browserIdentity(): TelemetryBrowserIdentity {
  return { name: browserName(), platform: platformName() };
}

/** The reported posture where the browser cannot drive CDP at all. */
const DEBUG_UNAVAILABLE: TelemetryDebugState = { available: false, enabled: false, attachedTabs: [], pinnedTabs: [] };

export function startTelemetryStreamHost(options: TelemetryStreamHostOptions): TelemetryStreamHost {
  const { hub, ready, provenance, bodyFetcher, debug } = options;
  const send = options.send ?? sendToBackend;
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;
  const queryTabs = options.queryTabs ?? queryBrowserTabs;
  const flushIntervalMs = options.flushIntervalMs ?? TELEMETRY_FLUSH_INTERVAL_MS;

  const sessions = new Map<string, StreamSession>();
  let disposed = false;

  function flush(session: StreamSession): void {
    session.flushTimer = null;
    if (session.closed || session.queue.length === 0) return;
    const messages = session.queue;
    session.queue = [];
    // A failed send means the wire is down mid-flight — drop the run;
    // the wire-close teardown (or the daemon's re-subscribe on
    // reconnect) rebuilds the view from a fresh replay.
    send(session.backendId, {
      type: TELEMETRY_LIFECYCLE_BATCH_TYPE,
      tabId: session.tabId,
      consumerId: session.consumerId,
      messages,
    });
  }

  function enqueue(session: StreamSession, message: LifecycleWireMessage): void {
    if (session.closed) return;
    session.queue.push(message);
    if (session.queue.length > TELEMETRY_MAX_QUEUED_MESSAGES) {
      // Fidelity-degrading self-heal: restart the stream from a fresh
      // canonical replay rather than dropping arbitrary envelopes.
      logger.warn(SCOPE, `queue overflow for tab ${session.tabId} — re-attaching with a fresh replay`);
      session.queue = [];
      attach(session);
      return;
    }
    if (session.flushTimer === null) {
      session.flushTimer = setTimeout(() => flush(session), flushIntervalMs);
    }
  }

  function makeSink(session: StreamSession): Sink {
    return {
      deliverReady(tabId: number, watermarkMs: number, sessionToken: string | undefined): void {
        enqueue(session, {
          kind: 'ready',
          tabId,
          watermarkMs,
          ...(sessionToken !== undefined ? { sessionToken } : {}),
        });
      },
      deliverUpdate(update: RequestLifecycleUpdate): void {
        enqueue(session, { kind: 'lifecycle-update', update });
      },
      deliverTabCleared(tabId: number): void {
        enqueue(session, { kind: 'tab-cleared', tabId });
      },
      close(): void {
        // Hub-initiated detach; the daemon's next subscribe re-attaches.
      },
    };
  }

  function attach(session: StreamSession): void {
    session.handle?.detach();
    session.handle = hub.attach(session.tabId, makeSink(session));
    if (provenance) {
      enqueue(session, { kind: 'source', tabId: session.tabId, source: provenance.ownerOf(session.tabId) });
    }
  }

  function ensureSession(backendId: string, tabId: number, consumerId: string): StreamSession {
    const key = sessionKey(backendId, tabId, consumerId);
    let session = sessions.get(key);
    if (session) return session;
    const created: StreamSession = {
      backendId,
      tabId,
      consumerId,
      trackingReason: `desktop-watching:${tabId}:${backendId}:${consumerId}`,
      handle: null,
      queue: [],
      flushTimer: null,
      unsubscribeProvenance: null,
      closed: false,
    };
    session = created;
    sessions.set(key, created);
    watchActivityRaise(`lc:${key}`);
    // The watch itself is what turns webRequest ingestion on for the
    // tab — the same ref-count plane the panel's port raises.
    startTracking(tabId, created.trackingReason);
    created.unsubscribeProvenance =
      provenance?.onOwnerChange((changedTabId, owner) => {
        if (changedTabId === created.tabId) enqueue(created, { kind: 'source', tabId: created.tabId, source: owner });
      }) ?? null;
    return created;
  }

  function teardown(session: StreamSession): void {
    if (session.closed) return;
    session.closed = true;
    const key = sessionKey(session.backendId, session.tabId, session.consumerId);
    sessions.delete(key);
    watchActivityDrop(`lc:${key}`);
    session.handle?.detach();
    session.handle = null;
    if (session.flushTimer !== null) {
      clearTimeout(session.flushTimer);
      session.flushTimer = null;
    }
    session.queue = [];
    session.unsubscribeProvenance?.();
    session.unsubscribeProvenance = null;
    stopTracking(session.tabId, session.trackingReason);
  }

  const whenReady = (run: () => void): void => {
    if (ready) {
      void ready.then(() => {
        if (!disposed) run();
      });
    } else {
      run();
    }
  };

  function handleConsumerFrame(frame: TelemetryLifecycleConsumerMessage, wire: BackendWireHandle): void {
    const { tabId, consumerId, message } = frame;
    if (typeof tabId !== 'number' || tabId < 0 || typeof consumerId !== 'string' || typeof message?.kind !== 'string')
      return;
    if (message.kind === 'subscribe') {
      if (!desktopWatchAllowed()) {
        // Typed refusal instead of a session — the desktop renders the
        // gate honestly rather than waiting on an empty stream.
        wire.send(watchRefusedFrame('lifecycle', tabId, consumerId));
        return;
      }
      const session = ensureSession(wire.backendId, tabId, consumerId);
      // Attach waits on the floors' hydration so a cold-SW re-subscribe
      // resolves the persisted session floor, exactly like the port host.
      whenReady(() => {
        if (!session.closed) attach(session);
      });
      return;
    }
    if (message.kind === 'clear-session') {
      whenReady(() => hub.resetSession(tabId));
      return;
    }
    if (message.kind === 'request-body') {
      void bodyFetcher?.requestBody(tabId, message.requestId, message.hopIndex);
    }
  }

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (type === TELEMETRY_LIFECYCLE_CONSUMER_TYPE) {
      // Same-device wires only — claimed and dropped otherwise.
      if (wire.isLoopback()) handleConsumerFrame(frame as TelemetryLifecycleConsumerMessage, wire);
      return true;
    }
    if (type === TELEMETRY_LIFECYCLE_DETACH_TYPE) {
      if (wire.isLoopback()) {
        const { tabId, consumerId } = frame as TelemetryLifecycleDetachMessage;
        if (typeof tabId === 'number' && typeof consumerId === 'string') {
          const session = sessions.get(sessionKey(wire.backendId, tabId, consumerId));
          if (session) teardown(session);
        }
      }
      return true;
    }
    if (type === TELEMETRY_TABS_LIST_TYPE) {
      if (wire.isLoopback()) {
        void queryTabs().then((tabs) => {
          wire.send({
            type: `${TELEMETRY_TABS_LIST_TYPE}:response`,
            payload: {
              tabs,
              browser: browserIdentity(),
              debug: debug?.getState() ?? DEBUG_UNAVAILABLE,
              watchConsent: desktopWatchAllowed(),
            },
          });
        });
      }
      return true;
    }
    if (type === TELEMETRY_DEBUG_CONTROL_TYPE) {
      if (wire.isLoopback()) {
        const { command } = frame as TelemetryDebugControlMessage;
        // Consent off ignores the command (arming CDP is watch-plane
        // reach) but still answers with the current snapshot so the
        // daemon's collection slot settles instead of timing out.
        if (debug && command && typeof command === 'object' && desktopWatchAllowed()) {
          if (command.kind === 'pin' && typeof command.tabId === 'number') {
            debug.setPin(command.tabId, command.pinned === true);
          } else if (command.kind === 'enable') {
            debug.setEnabled(command.enabled === true);
          }
        }
        // Reply even without a seam so the daemon's collection slot
        // settles instead of timing out; the attach a pin just triggered
        // may still be mid-handshake — the inventory read converges it.
        wire.send({
          type: `${TELEMETRY_DEBUG_CONTROL_TYPE}:response`,
          payload: { debug: debug?.getState() ?? DEBUG_UNAVAILABLE },
        });
      }
      return true;
    }
    return false;
  });

  // A closed wire ends every watch it carried — the daemon re-subscribes
  // live watches on the next connect, rebuilding sessions from scratch.
  const unsubscribeClose = subscribeClose((wire) => {
    for (const session of [...sessions.values()]) {
      if (session.backendId === wire.backendId) teardown(session);
    }
  });

  // Boot-race closer: a cold service worker HELLOs from eval-time sync
  // wiring BEFORE this host exists, so a subscribe the daemon relays at
  // the connect event can land unhandled. Announce on every wire that
  // is already up (same-device only — the whole plane is loopback-
  // gated) so the relay re-joins its live watches now that the
  // handlers are registered.
  const listWires = options.listWires ?? listConnectedWires;
  for (const wire of listWires()) {
    if (wire.isLoopback()) wire.send({ type: TELEMETRY_HOST_READY_TYPE });
  }

  // A fresh host publishes its (empty) activity count so a stale value
  // from a killed SW never leaves the popup indicator lit.
  watchActivitySync();

  // Live consent flips: off tears every session down with the typed
  // refusal (the desktop's view flips honest immediately); on
  // re-announces host-ready so the relay re-subscribes the live
  // watches it still holds viewer ports for.
  const unsubscribeConsent = subscribeDesktopWatchConsent((allowed) => {
    if (!allowed) {
      for (const session of [...sessions.values()]) {
        send(session.backendId, watchRefusedFrame('lifecycle', session.tabId, session.consumerId));
        teardown(session);
      }
      return;
    }
    for (const wire of listWires()) {
      if (wire.isLoopback()) wire.send({ type: TELEMETRY_HOST_READY_TYPE });
    }
  });

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterInbound();
      unsubscribeClose();
      unsubscribeConsent();
      for (const session of [...sessions.values()]) teardown(session);
    },
  };
}
