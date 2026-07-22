/**
 * Telemetry storage host — the extension side of the storage-plane relay
 * (OBSERVABILITY_PLAN.md Phase 3).
 *
 * Serves the desktop's Storage tool window over the backend WS wire by
 * RELAYING the existing DevTools-bridge storage verbs: an inbound
 * `oh.telemetry.storage.call` dispatches into the SAME handler maps the
 * in-browser panel's RPCs resolve to (application-storage inspector +
 * cookie jar), and the reply rides `<type>:response` correlated by the
 * caller's `callId` — calls run concurrently, so FIFO correlation is not
 * enough. The method whitelist is `TELEMETRY_STORAGE_METHODS`: console
 * eval and source-map verbs never cross this seam.
 *
 * Storage watches are per `(wire, tab, consumer)` — the telemetry
 * plane's per-consumer law. A watch's only stream is the CDP tier's
 * invalidation note ("went stale, refetch", no data), forwarded
 * point-to-point to the consumer whose watch covers the tab. Writes are
 * the same relayed verbs — the desktop-as-remote-control actuator model
 * (PLAN §7): the desktop never touches browser APIs.
 *
 * Privacy gate: storage frames are honored from SAME-DEVICE (loopback)
 * wires only, exactly like the lifecycle channels — reading a user's
 * cookies/storage off-device is a posture no phase ratifies.
 *
 * Consent gate (`backend.allowDesktopWatch`, see `./consent`): consent
 * off refuses the whole plane — watches answer with the typed refusal,
 * and the relayed verbs (reads AND writes: a watch-only gate with
 * readable cookie verbs would be a hole) answer `refused: 'consent-off'`
 * with a null payload so the caller settles instead of timing out.
 */

import type {
  TelemetryStorageCallMessage,
  TelemetryStorageConsumerMessage,
  TelemetryStorageDetachMessage,
} from '@openheaders/core/protocol';
import {
  isTelemetryStorageMethod,
  TELEMETRY_STORAGE_CALL_TYPE,
  TELEMETRY_STORAGE_CONSUMER_TYPE,
  TELEMETRY_STORAGE_DETACH_TYPE,
  TELEMETRY_STORAGE_INVALIDATION_TYPE,
} from '@openheaders/core/protocol';
import {
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { logger } from '@utils/logger';
import type { MessageHandlerContext } from '@/types/browser';
import { cookieJarHandlers } from '../modules/message-handler/handlers/cookie-jar';
import { storageInspectorHandlers } from '../modules/message-handler/handlers/storage-inspector';
import type { HandlerMap, MessageHandler } from '../modules/message-handler/types';
import { subscribeStorageInvalidations } from '../modules/storage-inspector';
import { desktopWatchAllowed, subscribeDesktopWatchConsent, watchRefusedFrame } from './consent';
import { watchActivityDrop, watchActivityRaise } from './watch-activity';

const SCOPE = 'TelemetryStorageHost';

const STORAGE_CALL_RESPONSE_TYPE = `${TELEMETRY_STORAGE_CALL_TYPE}:response`;

/** The relayed verb tables — the panel's own dispatch, nothing rewired. */
const relayedHandlers: HandlerMap = { ...storageInspectorHandlers, ...cookieJarHandlers };

/**
 * Inert services context for relayed dispatch. Every storage/cookie
 * handler reads only `message` + `respond`; the context exists to
 * satisfy the shared handler contract, and a handler growing a real
 * dependency on it must not be relayed silently — hence the loud no-ops.
 */
const RELAY_CONTEXT: MessageHandlerContext = {
  isWebSocketConnected: () => false,
  sendViaWebSocket: () => {
    logger.warn(SCOPE, 'relayed handler touched sendViaWebSocket — not supported on the relay path');
    return false;
  },
  scheduleUpdate: () => {
    logger.warn(SCOPE, 'relayed handler touched scheduleUpdate — not supported on the relay path');
  },
  revalidateTrackedRequests: () => Promise.resolve(),
  updateBadgeCallback: () => {},
};

export interface TelemetryStorageHostOptions {
  /** Test seams — default to the real connection manager + CDP tier. */
  readonly send?: (backendId: string, frame: Record<string, unknown>) => boolean;
  readonly registerInbound?: typeof registerInboundFrameHandler;
  readonly subscribeClose?: typeof subscribeOnWebSocketClose;
  readonly subscribeInvalidations?: typeof subscribeStorageInvalidations;
  readonly handlers?: HandlerMap;
}

export interface TelemetryStorageHost {
  dispose(): void;
}

interface StorageWatch {
  readonly backendId: string;
  readonly tabId: number;
  readonly consumerId: string;
}

function watchKey(backendId: string, tabId: number, consumerId: string): string {
  return `${backendId} ${tabId} ${consumerId}`;
}

export function startTelemetryStorageHost(options: TelemetryStorageHostOptions = {}): TelemetryStorageHost {
  const send = options.send ?? sendToBackend;
  const registerInbound = options.registerInbound ?? registerInboundFrameHandler;
  const subscribeClose = options.subscribeClose ?? subscribeOnWebSocketClose;
  const subscribeInvalidations = options.subscribeInvalidations ?? subscribeStorageInvalidations;
  const handlers = options.handlers ?? relayedHandlers;

  const watches = new Map<string, StorageWatch>();

  function handleCall(frame: TelemetryStorageCallMessage, send: (payload: Record<string, unknown>) => void): void {
    const { callId, method, params } = frame;
    if (typeof callId !== 'string' || callId.length === 0 || !isTelemetryStorageMethod(method)) return;
    if (!desktopWatchAllowed()) {
      send({ type: STORAGE_CALL_RESPONSE_TYPE, callId, payload: null, refused: 'consent-off' });
      return;
    }
    const handler: MessageHandler | undefined = handlers[method];
    if (!handler) {
      send({ type: STORAGE_CALL_RESPONSE_TYPE, callId, payload: null });
      return;
    }
    const message: Record<string, unknown> = {
      ...(params && typeof params === 'object' ? (params as Record<string, unknown>) : {}),
      type: method,
    };
    handler({
      message,
      sender: {},
      respond: (payload: unknown) => {
        send({ type: STORAGE_CALL_RESPONSE_TYPE, callId, payload: payload ?? null });
      },
      ctx: RELAY_CONTEXT,
    });
  }

  const unsubscribeInvalidations = subscribeInvalidations((tabId, kind) => {
    for (const watch of watches.values()) {
      if (watch.tabId !== tabId) continue;
      send(watch.backendId, {
        type: TELEMETRY_STORAGE_INVALIDATION_TYPE,
        tabId,
        consumerId: watch.consumerId,
        kind,
      });
    }
  });

  const unregisterInbound = registerInbound((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (type === TELEMETRY_STORAGE_CALL_TYPE) {
      // Same-device wires only — claimed and dropped otherwise.
      if (wire.isLoopback()) handleCall(frame as TelemetryStorageCallMessage, (payload) => wire.send(payload));
      return true;
    }
    if (type === TELEMETRY_STORAGE_CONSUMER_TYPE) {
      if (wire.isLoopback()) {
        const { tabId, consumerId } = frame as TelemetryStorageConsumerMessage;
        if (typeof tabId === 'number' && tabId >= 0 && typeof consumerId === 'string') {
          if (!desktopWatchAllowed()) {
            wire.send(watchRefusedFrame('storage', tabId, consumerId));
            return true;
          }
          const key = watchKey(wire.backendId, tabId, consumerId);
          if (!watches.has(key)) {
            watches.set(key, { backendId: wire.backendId, tabId, consumerId });
            watchActivityRaise(`st:${key}`);
          }
        }
      }
      return true;
    }
    if (type === TELEMETRY_STORAGE_DETACH_TYPE) {
      if (wire.isLoopback()) {
        const { tabId, consumerId } = frame as TelemetryStorageDetachMessage;
        if (typeof tabId === 'number' && typeof consumerId === 'string') {
          const key = watchKey(wire.backendId, tabId, consumerId);
          if (watches.delete(key)) watchActivityDrop(`st:${key}`);
        }
      }
      return true;
    }
    return false;
  });

  function dropWatch(key: string): void {
    if (watches.delete(key)) watchActivityDrop(`st:${key}`);
  }

  // A closed wire ends every watch it carried — the daemon re-subscribes
  // live watches on its next connect, exactly like the lifecycle plane.
  const unsubscribeClose = subscribeClose((wire) => {
    for (const [key, watch] of watches) {
      if (watch.backendId === wire.backendId) dropWatch(key);
    }
  });

  // Consent flip to off: refuse-and-drop, exactly as at subscribe.
  const unsubscribeConsent = subscribeDesktopWatchConsent((allowed) => {
    if (allowed) return;
    for (const [key, watch] of watches) {
      send(watch.backendId, watchRefusedFrame('storage', watch.tabId, watch.consumerId));
      dropWatch(key);
    }
  });

  return {
    dispose(): void {
      unregisterInbound();
      unsubscribeClose();
      unsubscribeConsent();
      unsubscribeInvalidations();
      for (const key of [...watches.keys()]) dropWatch(key);
    },
  };
}
