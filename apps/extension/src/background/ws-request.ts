/**
 * Request/response correlation over the Phase C WebSocket — Phase C M2c.2.
 *
 * The SW <-> desktop wire already routes RPCs through `dispatchSyncRpc`
 * on the receiving side, which replies with `{ type: '${type}:response',
 * payload }`. What's missing on the SW client side is a Promise wrapper
 * that matches an outbound request to its response. This module fills
 * that gap.
 *
 * Concurrency model: per-connection, per-type FIFO queue. One TCP
 * socket preserves delivery order, so the Nth pending request of a
 * given type on a given backend pairs with the Nth `:response` frame
 * that backend delivers. No correlation id on the wire — keeps the wire
 * protocol unchanged while still supporting concurrent in-flight
 * requests of different types (and serialized in-flight requests of the
 * same type), and responses never cross between backends.
 *
 * Failure modes that resolve to a rejected Promise (not a thrown call):
 *   - WS not connected when send is attempted    ⇒ Error('not-connected')
 *   - server echoes `__error` on the response    ⇒ Error(serverMessage)
 *   - no response inside `timeoutMs`              ⇒ Error('timeout')
 *   - the connection drops while pending          ⇒ Error('not-connected')
 *
 * The close flush is what makes `timeoutMs: 0` (no deadline — wait for
 * the response or the wire's death) safe: without it an unbounded slot
 * would linger across a reconnect and FIFO-mismatch the next request
 * of its type.
 *
 * Used by the M2c.2 peer-data-presence relay; future cross-host RPCs
 * (handshake-time auth, M3 Coexist namespacing) can reuse this helper
 * verbatim.
 */

import { logger } from '@openheaders/core/utils';
import {
  getDefaultWireBackendId,
  registerInboundFrameHandler,
  sendToBackend,
  subscribeOnWebSocketClose,
} from '@openheaders/oracle/sync/client/backend-connection-manager';

interface PendingSlot {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  /** Null for deadline-free requests (`timeoutMs: 0`). */
  timer: ReturnType<typeof setTimeout> | null;
}

// Keyed `${backendId}\u0000${type}` — a response only ever settles a
// request sent on the same connection.
const pendingByType = new Map<string, PendingSlot[]>();
let handlerInstalled = false;

function queueKey(backendId: string, type: string): string {
  return `${backendId}\u0000${type}`;
}

function ensureFrameHandler(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;
  // A dropped wire rejects everything pending on it — the response can
  // no longer arrive, and a lingering slot would FIFO-mismatch the
  // next same-type request after the reconnect.
  subscribeOnWebSocketClose((wire) => {
    const prefix = `${wire.backendId}\u0000`;
    for (const [key, queue] of pendingByType) {
      if (!key.startsWith(prefix)) continue;
      for (const slot of queue.splice(0)) {
        if (slot.timer !== null) clearTimeout(slot.timer);
        slot.reject(new Error('not-connected'));
      }
    }
  });
  registerInboundFrameHandler((frame: unknown, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const type = (frame as { type?: unknown }).type;
    if (typeof type !== 'string') return false;
    const responseSuffix = ':response';
    if (!type.endsWith(responseSuffix)) return false;
    const requestType = type.slice(0, type.length - responseSuffix.length);
    const queue = pendingByType.get(queueKey(wire.backendId, requestType));
    if (!queue || queue.length === 0) return false;
    const slot = queue.shift();
    if (!slot) return false;
    if (slot.timer !== null) clearTimeout(slot.timer);
    const error = (frame as { __error?: unknown }).__error;
    if (typeof error === 'string' && error.length > 0) {
      slot.reject(new Error(error));
    } else {
      slot.resolve((frame as { payload?: unknown }).payload);
    }
    return true;
  });
}

export interface WsRequestOptions {
  /**
   * Reject the Promise after this many ms with `Error('timeout')`.
   * Defaults to 5000. `0` means NO deadline — wait until the response
   * arrives or the wire drops (the close flush rejects then); for
   * open-ended calls like a streaming gRPC invoke, completion is the
   * settled response, not a clock.
   */
  timeoutMs?: number;
  /**
   * Target backend for the request. Defaults to the device-local
   * default wire (the connected loopback backend when there is one).
   */
  backendId?: string;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Send a typed message and await its `${type}:response` reply. Awaits in
 * FIFO order per connection + type. The payload of the response is
 * returned verbatim; the caller narrows it with the channel's response
 * schema.
 */
export function wsRequest<T>(
  message: { type: string } & Record<string, unknown>,
  options: WsRequestOptions = {},
): Promise<T> {
  ensureFrameHandler();
  return new Promise<T>((resolve, reject) => {
    const backendId = options.backendId ?? getDefaultWireBackendId();
    if (!backendId) {
      reject(new Error('not-connected'));
      return;
    }
    const key = queueKey(backendId, message.type);
    let queue = pendingByType.get(key);
    if (!queue) {
      queue = [];
      pendingByType.set(key, queue);
    }
    const waitMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer =
      waitMs > 0
        ? setTimeout(() => {
            const idx = queue?.indexOf(slot) ?? -1;
            if (idx >= 0) queue?.splice(idx, 1);
            reject(new Error('timeout'));
          }, waitMs)
        : null;
    const slot: PendingSlot = {
      resolve: (value) => resolve(value as T),
      reject,
      timer,
    };
    queue.push(slot);

    const sent = sendToBackend(backendId, message);
    if (!sent) {
      // Roll back: the queue slot would otherwise wait for a response
      // that no peer received the request for, until the timeout fires.
      const idx = queue.indexOf(slot);
      if (idx >= 0) queue.splice(idx, 1);
      if (timer !== null) clearTimeout(timer);
      reject(new Error('not-connected'));
    }
  });
}

/** Test-only: drop every pending request so unit tests start clean. */
export function __resetWsRequestForTests(): void {
  for (const queue of pendingByType.values()) {
    for (const slot of queue) {
      if (slot.timer !== null) clearTimeout(slot.timer);
      slot.reject(new Error('reset'));
    }
  }
  pendingByType.clear();
  handlerInstalled = false;
  logger.debug('WsRequest', 'reset for tests');
}
