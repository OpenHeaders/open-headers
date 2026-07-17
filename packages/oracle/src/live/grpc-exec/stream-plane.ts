/**
 * Live plumbing for gRPC streaming calls — host-neutral, the
 * `send-stream.ts` sibling for the gRPC executor plane: the
 * flush-batched `grpcStreamEvent` emitter behind the message
 * timeline, and the active-stream registry behind the
 * `sendGrpcStreamMessage` / `endGrpcClientStream` riders (the Stop
 * hook itself stays on the shared HTTP active-send registry — one
 * abort plane for every interactive send).
 *
 * Frames are display-only hints: the resolving `executeGrpcRequest`
 * RPC's snapshot supersedes every frame. Unlike the HTTP emitter's
 * byte batching, the batch unit here is the MESSAGE — the timeline's
 * row — flushed on the same time window so the broadcast rate stays
 * bounded however chatty the server is; head and end frames emit
 * immediately (they are single and load-bearing).
 */

import type { GrpcStreamEventWire, GrpcStreamMessageWire } from '@openheaders/core/bridge';

/** Flush the pending message batch on this cadence — the HTTP
 *  emitter's window; per-message `atMs` stamps keep arrival fidelity
 *  through the batching. */
const FLUSH_INTERVAL_MS = 100;
/** Eager-flush bound — a burst larger than this flushes immediately
 *  instead of pooling a huge batch in memory. */
const FLUSH_MAX_MESSAGES = 256;

// ── Stream-frame emitter ────────────────────────────────────────────

export interface GrpcStreamEmitter {
  /** Push the response head as soon as it arrives — one frame. */
  head(httpStatus: number, headers: ReadonlyArray<{ key: string; value: string }>): void;
  /** Enqueue one direction-tagged message; flushes by the time window. */
  message(message: GrpcStreamMessageWire): void;
  /** Settle the emitter (any end path): flush pending messages, then
   *  emit the final `end` frame. */
  end(): void;
}

export function createGrpcStreamEmitter(sendId: string, emit: (event: GrpcStreamEventWire) => void): GrpcStreamEmitter {
  let seq = 0;
  let settled = false;
  let pending: GrpcStreamMessageWire[] = [];
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
    head(httpStatus, headers) {
      if (settled) return;
      emit({ sendId, seq: seq++, kind: 'head', httpStatus, headers: headers.map((h) => ({ ...h })) });
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

// ── Active-stream registry (upstream riders) ────────────────────────

/** The executor's handle for one open client/bidi stream — what the
 *  `sendGrpcStreamMessage` / `endGrpcClientStream` RPCs reach. */
export interface ActiveGrpcStreamHandle {
  /** Encode `messageText` against the call's input type and write it
   *  upstream. An encode failure reports on the RPC alone — the
   *  stream stays open. */
  send(messageText: string): { success: boolean; error?: string };
  /** Half-close the client side ("End Streaming"). */
  end(): void;
}

const activeStreams = new Map<string, ActiveGrpcStreamHandle>();

/** Register an open stream's upstream handle under its send id.
 *  Returns the unregister disposer — the executor calls it on settle. */
export function registerActiveGrpcStream(sendId: string, handle: ActiveGrpcStreamHandle): () => void {
  activeStreams.set(sendId, handle);
  return () => {
    activeStreams.delete(sendId);
  };
}

/** Write one upstream message. `success: false` with no error = no
 *  such stream (settled, unknown id, or a server-stream call, which
 *  never registers a handle). */
export function sendActiveGrpcStreamMessage(sendId: string, messageText: string): { success: boolean; error?: string } {
  const handle = activeStreams.get(sendId);
  if (!handle) return { success: false, error: 'No open gRPC stream with this id.' };
  return handle.send(messageText);
}

/** Half-close an open stream's client side. False = no such stream. */
export function endActiveGrpcClientStream(sendId: string): boolean {
  const handle = activeStreams.get(sendId);
  if (!handle) return false;
  handle.end();
  return true;
}
