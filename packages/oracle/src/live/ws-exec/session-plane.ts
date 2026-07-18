/**
 * Live plumbing for open WebSocket sessions — host-neutral, the
 * `grpc-exec/stream-plane.ts` sibling for the WS executor plane: the
 * flush-batched `wsStreamEvent` emitter behind the message timeline,
 * and the active-session registry behind the `sendWsMessage` /
 * `closeWsSession` riders (the Stop hook itself stays on the shared
 * HTTP active-send registry — one abort plane for every interactive
 * send).
 *
 * Frames are display-only hints: the resolving `executeWebSocketRequest`
 * RPC's snapshot supersedes every frame. The batch unit is the MESSAGE
 * — the timeline's row — flushed on the shared time window so the
 * broadcast rate stays bounded however chatty the server is; open and
 * end frames emit immediately (they are single and load-bearing).
 */

import type { WsSendSocketIoWire, WsStreamEventWire, WsStreamMessageWire } from '@openheaders/core/bridge';

/** Flush the pending message batch on this cadence — the gRPC
 *  emitter's window; per-message `atMs` stamps keep arrival fidelity
 *  through the batching. */
const FLUSH_INTERVAL_MS = 100;
/** Eager-flush bound — a burst larger than this flushes immediately
 *  instead of pooling a huge batch in memory. */
const FLUSH_MAX_MESSAGES = 256;

// ── Session-frame emitter ───────────────────────────────────────────

export interface WsStreamEmitter {
  /** Push the settled handshake as soon as it arrives — one frame. */
  open(protocol: string, extensions: string): void;
  /** Enqueue one direction-tagged message; flushes by the time window. */
  message(message: WsStreamMessageWire): void;
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
    open(protocol, extensions) {
      if (settled) return;
      emit({ sendId, seq: seq++, kind: 'open', protocol, extensions });
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
    end() {
      if (settled) return;
      flush();
      settled = true;
      emit({ sendId, seq: seq++, kind: 'end' });
    },
  };
}

// ── Active-session registry (upstream riders) ───────────────────────

/** The executor's handle for one open session — what the
 *  `sendWsMessage` / `closeWsSession` RPCs reach. */
export interface ActiveWsSessionHandle {
  /** Resolve `{{refs}}` in `messageText` through the resolver built at
   *  Connect and write it. On a socketio-flavor session the rider's
   *  `socketio` addendum makes `messageText` the JSON arguments array
   *  and the executor frames the EVENT packet. An unresolved reference
   *  or a compose error reports on the RPC alone — the session stays
   *  open. */
  send(messageText: string, socketio?: WsSendSocketIoWire): { success: boolean; error?: string };
  /** Start the clean close (code 1000) — Disconnect. */
  close(): void;
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
 *  reason: no such session (settled, unknown id) or a resolve error. */
export function sendActiveWsSessionMessage(
  sendId: string,
  messageText: string,
  socketio?: WsSendSocketIoWire,
): { success: boolean; error?: string } {
  const handle = activeSessions.get(sendId);
  if (!handle) return { success: false, error: 'No open WebSocket session with this id.' };
  return handle.send(messageText, socketio);
}

/** Start an open session's clean close. False = no such session. */
export function closeActiveWsSession(sendId: string): boolean {
  const handle = activeSessions.get(sendId);
  if (!handle) return false;
  handle.close();
  return true;
}
