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
 * Overflow degrades fidelity, never correctness: a session whose queue
 * outgrows the cap is cleared and re-attached, so the next flush is a
 * fresh `ready` + canonical replay instead of a stream with silent
 * holes the client reducer would misfold.
 */

import type {
  BrowserTabWire,
  TelemetryLifecycleConsumerMessage,
  TelemetryLifecycleDetachMessage,
} from '@openheaders/core/protocol';
import {
  TELEMETRY_LIFECYCLE_BATCH_TYPE,
  TELEMETRY_LIFECYCLE_CONSUMER_TYPE,
  TELEMETRY_LIFECYCLE_DETACH_TYPE,
  TELEMETRY_TABS_LIST_TYPE,
} from '@openheaders/core/protocol';
import type { LifecycleWireMessage, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { AttachmentHandle, RequestLifecycleHub, Sink } from '@openheaders/oracle/request-lifecycle-hub';
import {
  type BackendWireHandle,
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import type { LifecycleBodyFetcher, LifecycleProvenance } from '../lifecycle-port-host';
import { startTracking, stopTracking } from '../modules/tab-telemetry';

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

export interface TelemetryStreamHostOptions {
  readonly hub: RequestLifecycleHub;
  /** Hydration gate for the watch-session floors, as for the port host. */
  readonly ready?: Promise<void>;
  /** Per-tab CDP-vs-heuristic provenance for the "CDP-enhanced" badge. */
  readonly provenance?: LifecycleProvenance;
  /** On-demand response-body fetch for the `request-body` pull. */
  readonly bodyFetcher?: LifecycleBodyFetcher;
  /** Test seams — default to the real connection manager + chrome.tabs. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
  readonly queryTabs?: () => Promise<BrowserTabWire[]>;
  readonly flushIntervalMs?: number;
}

export interface TelemetryStreamHost {
  dispose(): void;
}

interface StreamSession {
  readonly backendId: string;
  readonly tabId: number;
  readonly trackingReason: string;
  handle: AttachmentHandle | null;
  queue: LifecycleWireMessage[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  unsubscribeProvenance: (() => void) | null;
  closed: boolean;
}

function sessionKey(backendId: string, tabId: number): string {
  return `${backendId} ${tabId}`;
}

async function queryBrowserTabs(): Promise<BrowserTabWire[]> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({}, (tabList: chrome.tabs.Tab[]) => {
        const tabs: BrowserTabWire[] = [];
        for (const tab of tabList ?? []) {
          if (typeof tab.id !== 'number' || tab.id < 0) continue;
          tabs.push({
            tabId: tab.id,
            windowId: tab.windowId ?? -1,
            title: tab.title ?? '',
            url: tab.url ?? '',
            active: tab.active === true,
          });
        }
        resolve(tabs);
      });
    } catch {
      resolve([]);
    }
  });
}

export function startTelemetryStreamHost(options: TelemetryStreamHostOptions): TelemetryStreamHost {
  const { hub, ready, provenance, bodyFetcher } = options;
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
    send(session.backendId, { type: TELEMETRY_LIFECYCLE_BATCH_TYPE, tabId: session.tabId, messages });
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

  function ensureSession(backendId: string, tabId: number): StreamSession {
    const key = sessionKey(backendId, tabId);
    let session = sessions.get(key);
    if (session) return session;
    const created: StreamSession = {
      backendId,
      tabId,
      trackingReason: `desktop-watching:${tabId}:${backendId}`,
      handle: null,
      queue: [],
      flushTimer: null,
      unsubscribeProvenance: null,
      closed: false,
    };
    session = created;
    sessions.set(key, created);
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
    sessions.delete(sessionKey(session.backendId, session.tabId));
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
    const { tabId, message } = frame;
    if (typeof tabId !== 'number' || tabId < 0 || typeof message?.kind !== 'string') return;
    if (message.kind === 'subscribe') {
      const session = ensureSession(wire.backendId, tabId);
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
        const { tabId } = frame as TelemetryLifecycleDetachMessage;
        if (typeof tabId === 'number') {
          const session = sessions.get(sessionKey(wire.backendId, tabId));
          if (session) teardown(session);
        }
      }
      return true;
    }
    if (type === TELEMETRY_TABS_LIST_TYPE) {
      if (wire.isLoopback()) {
        void queryTabs().then((tabs) => {
          wire.send({ type: `${TELEMETRY_TABS_LIST_TYPE}:response`, payload: { tabs } });
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

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unregisterInbound();
      unsubscribeClose();
      for (const session of [...sessions.values()]) teardown(session);
    },
  };
}
