/**
 * Telemetry console host — the extension side of the console-plane
 * stream (the observability plan Phase 4).
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
 * Frames are cut by size (see `./frame-batcher`), like the lifecycle
 * host's: a replay crosses as several frames, and an entry that cannot
 * fit one is left out and logged.
 */

import type { ConsoleStreamUpdate, ConsoleStreamWireMessage } from '@openheaders/core/console-stream';
import type { TelemetryConsoleConsumerMessage, TelemetryConsoleDetachMessage } from '@openheaders/core/protocol';
import {
  fitsFrame,
  TELEMETRY_CONSOLE_BATCH_TYPE,
  TELEMETRY_CONSOLE_CONSUMER_TYPE,
  TELEMETRY_CONSOLE_DETACH_TYPE,
} from '@openheaders/core/protocol';
import type { AttachmentHandle, ConsoleStreamHub, Sink } from '@openheaders/oracle/console-stream-hub';
import {
  backendMaxFrameBytes,
  registerInboundFrameHandler,
  sendSerializedToBackend,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import { desktopWatchAllowed, subscribeDesktopWatchConsent, watchRefusedFrame } from './consent';
import { createFrameBatcher, type FrameBatcher } from './frame-batcher';
import { TELEMETRY_FLUSH_INTERVAL_MS } from './index';
import { watchActivityDrop, watchActivityRaise } from './watch-activity';

const SCOPE = 'TelemetryConsoleHost';

export interface TelemetryConsoleHostOptions {
  readonly hub: ConsoleStreamHub;
  /** Test seams — default to the real connection manager. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  /**
   * Where a batch frame goes, as the text it crosses the wire as. A host
   * given only `send` is handed each batch parsed back from that text.
   */
  readonly sendSerialized?: (backendId: string, frame: string) => boolean;
  /** The largest frame a backend accepts, in bytes. */
  readonly maxFrameBytes?: (backendId: string) => number;
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
  readonly batcher: FrameBatcher<ConsoleStreamWireMessage>;
  closed: boolean;
}

function sessionKey(backendId: string, tabId: number, consumerId: string): string {
  return `${backendId} ${tabId} ${consumerId}`;
}

export function startTelemetryConsoleHost(options: TelemetryConsoleHostOptions): TelemetryConsoleHost {
  const { hub } = options;
  const send = options.send ?? sendToBackend;
  const objectSeam = options.send;
  const sendSerialized =
    options.sendSerialized ??
    (objectSeam
      ? (backendId: string, frame: string) => objectSeam(backendId, JSON.parse(frame) as Record<string, unknown>)
      : sendSerializedToBackend);
  const maxFrameBytes = options.maxFrameBytes ?? backendMaxFrameBytes;
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;
  const flushIntervalMs = options.flushIntervalMs ?? TELEMETRY_FLUSH_INTERVAL_MS;

  const sessions = new Map<string, ConsoleSession>();

  function enqueue(session: ConsoleSession, message: ConsoleStreamWireMessage): void {
    if (!session.closed) session.batcher.enqueue(message);
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
    session.batcher.clear();
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
            const backendId = wire.backendId;
            session = {
              backendId,
              tabId,
              consumerId,
              handle: null,
              batcher: createFrameBatcher<ConsoleStreamWireMessage>({
                envelope: { type: TELEMETRY_CONSOLE_BATCH_TYPE, tabId, consumerId },
                flushIntervalMs,
                maxFrameBytes: () => maxFrameBytes(backendId),
                send: (frame) => sendSerialized(backendId, frame),
                fit: (_message, serialized, maxBytes) => (fitsFrame(serialized, maxBytes) ? serialized : null),
                onLeftOut: () => {
                  logger.warn(SCOPE, `a console entry for tab ${tabId} cannot fit one frame — left out`);
                },
              }),
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
