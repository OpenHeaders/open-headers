/**
 * Live plumbing for open WebSocket sessions — host-neutral, the
 * `grpc-exec/stream-plane.ts` sibling for the WS executor plane: the
 * flush-batched `wsStreamEvent` emitter behind the message timeline,
 * and the active-session registry behind the `sendWsMessage` /
 * `closeWsSession` / `reconnectWsSessionNow` riders (the Stop hook itself stays on the shared
 * HTTP active-send registry — one abort plane for every interactive
 * send).
 *
 * Frames are display-only hints: the resolving `executeWebSocketRequest`
 * RPC's snapshot supersedes every frame. The batch unit is the MESSAGE
 * — the timeline's row — flushed on the shared time window so the
 * broadcast rate stays bounded however chatty the server is; open and
 * end frames emit immediately (they are single and load-bearing).
 */

import type {
  WsHandshakeHeaderWire,
  WsSendBinaryWire,
  WsSendSocketIoWire,
  WsStreamEventWire,
  WsStreamMessageWire,
} from '@openheaders/core/bridge';
import type { ExecutedProxyRoute, ExecutedWsLifecycle } from '@openheaders/core/types';

/** Flush the pending message batch on this cadence — the gRPC
 *  emitter's window; per-message `atMs` stamps keep arrival fidelity
 *  through the batching. */
const FLUSH_INTERVAL_MS = 100;
/** Eager-flush bound — a burst larger than this flushes immediately
 *  instead of pooling a huge batch in memory. */
const FLUSH_MAX_MESSAGES = 256;

// ── Session-frame emitter ───────────────────────────────────────────

export interface WsStreamEmitter {
  /** Push the settled handshake as soon as it arrives — one frame.
   *  `proxyRoute` carries the transport's route decision so the live
   *  session strip attributes honestly before the snapshot settles;
   *  `handshake` carries the dialed URL and the composed request
   *  headers so the timeline's Connected row reads the truth live. */
  open(
    protocol: string,
    extensions: string,
    proxyRoute?: ExecutedProxyRoute,
    handshake?: { url: string; requestHeaders: WsHandshakeHeaderWire[] },
  ): void;
  /** Enqueue one direction-tagged message; flushes by the time window. */
  message(message: WsStreamMessageWire): void;
  /** Push one reconnect-cycle fact — flushes the pooled messages first
   *  so the row lands at its true position, then emits immediately
   *  (single and load-bearing, like open). */
  lifecycle(item: ExecutedWsLifecycle): void;
  /** Settle the emitter (any end path): flush pending messages, then
   *  emit the final `end` frame. */
  end(): void;
}

export function createWsStreamEmitter(sendId: string, emit: (event: WsStreamEventWire) => void): WsStreamEmitter {
  let seq = 0;
  let settled = false;
  let pending: WsStreamMessageWire[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = (): void => {
    clearTimer();
    if (pending.length === 0) return;
    const items = pending;
    pending = [];
    emit({ sendId, seq: seq++, kind: 'messages', items });
  };

  return {
    open(protocol, extensions, proxyRoute, handshake) {
      if (settled) return;
      // Open emits immediately, so the emit instant IS the observed
      // handshake-settled instant — the message frames' atMs law.
      emit({
        sendId,
        seq: seq++,
        kind: 'open',
        protocol,
        extensions,
        ...(proxyRoute !== undefined ? { proxyRoute } : {}),
        ...(handshake !== undefined ? { url: handshake.url, requestHeaders: handshake.requestHeaders } : {}),
        atMs: Date.now(),
      });
    },
    message(message) {
      if (settled) return;
      pending.push(message);
      if (pending.length >= FLUSH_MAX_MESSAGES) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, FLUSH_INTERVAL_MS);
    },
    lifecycle(item) {
      if (settled) return;
      flush();
      emit({ sendId, seq: seq++, kind: 'lifecycle', item, atMs: Date.now() });
    },
    end() {
      if (settled) return;
      flush();
      settled = true;
      // End emits immediately on every settle path — its instant is
      // the observed teardown of the socket.
      emit({ sendId, seq: seq++, kind: 'end', atMs: Date.now() });
    },
  };
}

// ── Active-session registry (upstream riders) ───────────────────────

/** Who is writing: the user's rider (its Before send hook runs), or a
 *  script's `oh.send` (already a hook's product — never re-enters). */
export type WsSendOrigin = 'rider' | 'script';

export interface WsSendResult {
  success: boolean;
  error?: string;
}

/** The executor's handle for one open session — what the
 *  `sendWsMessage` / `closeWsSession` RPCs reach. */
export interface ActiveWsSessionHandle {
  /** Resolve `{{refs}}` in `messageText` through the resolver built at
   *  Connect and write it. On a socketio-flavor session the rider's
   *  `socketio` addendum makes `messageText` the JSON arguments array
   *  and the executor frames the EVENT packet; the `binary` addendum
   *  makes it the encoded byte spelling of ONE binary frame. An
   *  unresolved reference or a compose error reports on the RPC alone
   *  — the session stays open. A rider send runs the Before send hook
   *  first (the answer waits for it; a drop answers with the dropping
   *  level's name); a script's send never does. */
  send(
    messageText: string,
    socketio?: WsSendSocketIoWire,
    binary?: WsSendBinaryWire,
    origin?: WsSendOrigin,
  ): Promise<WsSendResult>;
  /** Start the clean close (code 1000) — Disconnect. */
  close(): void;
  /** Dial the armed reconnect attempt now instead of after its wait.
   *  False = nothing is waiting. */
  reconnectNow(): boolean;
}

const activeSessions = new Map<string, ActiveWsSessionHandle>();

/** Register an open session's handle under its send id. Returns the
 *  unregister disposer — the executor calls it on settle. */
export function registerActiveWsSession(sendId: string, handle: ActiveWsSessionHandle): () => void {
  activeSessions.set(sendId, handle);
  return () => {
    activeSessions.delete(sendId);
  };
}

/** Write one message into an open session. `success: false` names the
 *  reason: no such session (settled, unknown id), a resolve error, or
 *  a Before send level that dropped the message. */
export function sendActiveWsSessionMessage(
  sendId: string,
  messageText: string,
  socketio?: WsSendSocketIoWire,
  binary?: WsSendBinaryWire,
  origin: WsSendOrigin = 'rider',
): Promise<WsSendResult> {
  const handle = activeSessions.get(sendId);
  if (!handle) return Promise.resolve({ success: false, error: 'No open WebSocket session with this id.' });
  return handle.send(messageText, socketio, binary, origin);
}

/** Cut a session's auto-reconnect wait short. False = no such
 *  session, or nothing is waiting. */
export function reconnectActiveWsSessionNow(sendId: string): boolean {
  const handle = activeSessions.get(sendId);
  if (!handle) return false;
  return handle.reconnectNow();
}

/** Start an open session's clean close. False = no such session. */
export function closeActiveWsSession(sendId: string): boolean {
  const handle = activeSessions.get(sendId);
  if (!handle) return false;
  handle.close();
  return true;
}
