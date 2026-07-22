/**
 * Telemetry console host — the extension side of the console-plane
 * stream (OBSERVABILITY_PLAN.md Phase 4).
 *
 * Serves the desktop's console watch over the backend WS wire,
 * mirroring what `console-stream-port-host` does for a chrome runtime
 * port: a forwarded subscribe attaches a `ConsoleStreamHub` sink whose
 * deliveries are tick-coalesced into `oh.telemetry.console.batch`
 * frames; the forwarded detach (or the wire closing) detaches. One
 * independent session per `(wire, tab, consumer)` — the telemetry
 * plane's per-consumer law.
 *
 * Capture is Debug-mode gated at the source: the hub only ever holds
 * entries for CDP-attached tabs, so a watch on an un-armed tab streams
 * `ready` and then silence — no tracking refs to raise, unlike the
 * lifecycle host (webRequest ingestion is a lifecycle concern).
 *
 * View-only: the only inbound frames are the watch handshake — eval
 * verbs never cross this seam (scriptable-plane boundary, PLAN §9).
 *
 * Privacy gate: console frames are honored from SAME-DEVICE (loopback)
 * wires only, exactly like the lifecycle channels.
 *
 * Consent gate (`backend.allowDesktopWatch`, see `./consent`): a
 * subscribe with consent off answers with the typed refusal instead of
 * a session, and a mid-watch flip to off tears live sessions down the
 * same way. The flip-on re-announce is the lifecycle host's job — one
 * host-ready per wire re-joins every plane's watches.
 *
 * Overflow degrades fidelity, never correctness: a session whose queue
 * outgrows the cap is cleared and re-attached, so the next flush is a
 * fresh `ready` + canonical replay instead of a stream with silent
 * holes (the client clears on `ready`, so replay never duplicates).
 */

import type { ConsoleStreamUpdate, ConsoleStreamWireMessage } from '@openheaders/core/console-stream';
import type { TelemetryConsoleConsumerMessage, TelemetryConsoleDetachMessage } from '@openheaders/core/protocol';
import {
  TELEMETRY_CONSOLE_BATCH_TYPE,
  TELEMETRY_CONSOLE_CONSUMER_TYPE,
  TELEMETRY_CONSOLE_DETACH_TYPE,
} from '@openheaders/core/protocol';
import type { AttachmentHandle, ConsoleStreamHub, Sink } from '@openheaders/oracle/console-stream-hub';
import {
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import { desktopWatchAllowed, subscribeDesktopWatchConsent, watchRefusedFrame } from './consent';
import { TELEMETRY_FLUSH_INTERVAL_MS } from './index';
import { watchActivityDrop, watchActivityRaise } from './watch-activity';

const SCOPE = 'TelemetryConsoleHost';

/**
 * Queue cap per session. A replay never exceeds the hub store's per-tab
 * retention (1000 entries), so a healthy session stays below this;
 * sustained overflow means the wire can't drain and the session
 * self-heals with a fresh replay instead of shipping holes.
 */
export const CONSOLE_MAX_QUEUED_MESSAGES = 2000;

export interface TelemetryConsoleHostOptions {
  readonly hub: ConsoleStreamHub;
  /** Test seams — default to the real connection manager. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
  readonly flushIntervalMs?: number;
}

export interface TelemetryConsoleHost {
  dispose(): void;
}

interface ConsoleSession {
  readonly backendId: string;
  readonly tabId: number;
  readonly consumerId: string;
  handle: AttachmentHandle | null;
  queue: ConsoleStreamWireMessage[];
  flushTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

function sessionKey(backendId: string, tabId: number, consumerId: string): string {
  return `${backendId} ${tabId} ${consumerId}`;
}

export function startTelemetryConsoleHost(options: TelemetryConsoleHostOptions): TelemetryConsoleHost {
  const { hub } = options;
  const send = options.send ?? sendToBackend;
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;
  const flushIntervalMs = options.flushIntervalMs ?? TELEMETRY_FLUSH_INTERVAL_MS;

  const sessions = new Map<string, ConsoleSession>();

  function flush(session: ConsoleSession): void {
    session.flushTimer = null;
    if (session.closed || session.queue.length === 0) return;
    const messages = session.queue;
    session.queue = [];
    // A failed send means the wire is down mid-flight — drop the run;
    // the wire-close teardown (or the daemon's re-subscribe on
    // reconnect) rebuilds the view from a fresh replay.
    send(session.backendId, {
      type: TELEMETRY_CONSOLE_BATCH_TYPE,
      tabId: session.tabId,
      consumerId: session.consumerId,
      messages,
    });
  }

  function enqueue(session: ConsoleSession, message: ConsoleStreamWireMessage): void {
    if (session.closed) return;
    session.queue.push(message);
    if (session.queue.length > CONSOLE_MAX_QUEUED_MESSAGES) {
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

  function makeSink(session: ConsoleSession): Sink {
    return {
      deliverReady(tabId: number): void {
        enqueue(session, { kind: 'ready', tabId });
      },
      deliverUpdate(update: ConsoleStreamUpdate): void {
        enqueue(session, { kind: 'console-update', update });
      },
      close(): void {
        // Hub-initiated detach; the daemon's next subscribe re-attaches.
      },
    };
  }

  function attach(session: ConsoleSession): void {
    session.handle?.detach();
    session.handle = hub.attach(session.tabId, makeSink(session));
  }

  function teardown(session: ConsoleSession): void {
    if (session.closed) return;
    session.closed = true;
    const key = sessionKey(session.backendId, session.tabId, session.consumerId);
    sessions.delete(key);
    watchActivityDrop(`co:${key}`);
    session.handle?.detach();
    session.handle = null;
    if (session.flushTimer !== null) {
      clearTimeout(session.flushTimer);
      session.flushTimer = null;
    }
    session.queue = [];
  }

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (type === TELEMETRY_CONSOLE_CONSUMER_TYPE) {
      // Same-device wires only — claimed and dropped otherwise.
      if (wire.isLoopback()) {
        const { tabId, consumerId } = frame as TelemetryConsoleConsumerMessage;
        if (typeof tabId === 'number' && tabId >= 0 && typeof consumerId === 'string') {
          if (!desktopWatchAllowed()) {
            wire.send(watchRefusedFrame('console', tabId, consumerId));
            return true;
          }
          const key = sessionKey(wire.backendId, tabId, consumerId);
          let session = sessions.get(key);
          if (!session) {
            session = {
              backendId: wire.backendId,
              tabId,
              consumerId,
              handle: null,
              queue: [],
              flushTimer: null,
              closed: false,
            };
            sessions.set(key, session);
            watchActivityRaise(`co:${key}`);
          }
          attach(session);
        }
      }
      return true;
    }
    if (type === TELEMETRY_CONSOLE_DETACH_TYPE) {
      if (wire.isLoopback()) {
        const { tabId, consumerId } = frame as TelemetryConsoleDetachMessage;
        if (typeof tabId === 'number' && typeof consumerId === 'string') {
          const session = sessions.get(sessionKey(wire.backendId, tabId, consumerId));
          if (session) teardown(session);
        }
      }
      return true;
    }
    return false;
  });

  // A closed wire ends every watch it carried — the daemon re-subscribes
  // live watches on its next connect, rebuilding sessions from scratch.
  const unsubscribeClose = subscribeClose((wire) => {
    for (const session of [...sessions.values()]) {
      if (session.backendId === wire.backendId) teardown(session);
    }
  });

  // Consent flip to off: refuse-and-teardown, exactly as at subscribe.
  const unsubscribeConsent = subscribeDesktopWatchConsent((allowed) => {
    if (allowed) return;
    for (const session of [...sessions.values()]) {
      send(session.backendId, watchRefusedFrame('console', session.tabId, session.consumerId));
      teardown(session);
    }
  });

  return {
    dispose(): void {
      unregisterInbound();
      unsubscribeClose();
      unsubscribeConsent();
      for (const session of [...sessions.values()]) teardown(session);
    },
  };
}
