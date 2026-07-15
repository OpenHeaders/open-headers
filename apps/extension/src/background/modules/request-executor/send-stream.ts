/**
 * Live plumbing for interactive sends — the active-send registry behind
 * the `abortRequestSend` RPC (Stop button) and the flush-batched
 * `requestStreamEvent` frame emitter behind the response panel's live
 * tail.
 *
 * Frames are display-only hints: the resolving `executeRequest` RPC's
 * snapshot supersedes every frame, so a dropped frame is harmless. The
 * emitter batches body chunks by time/byte window so the broadcast rate
 * stays bounded no matter how chatty the wire is; an ordinary response
 * completes before the first flush window and never emits a chunk frame
 * at all — which is exactly the signal used to decide whether the live
 * stream phase "engaged" (see `chunkFramesSent`).
 */

import type { RequestStreamHeadWire } from '@openheaders/core/bridge';
import { broadcast } from '@utils/bridge';

/**
 * Flush the pending chunk buffer on this cadence. TIME is what engages
 * the live phase: an ordinary response — however large — completes
 * inside the first window and never emits a chunk frame (the RPC
 * snapshot is about to carry the whole body anyway); only a read still
 * in progress when the timer fires is genuinely streaming.
 */
const FLUSH_INTERVAL_MS = 100;
/** Per-frame byte bound — a flush larger than this splits into several
 *  frames, and once the live phase engaged, pending bytes past it flush
 *  eagerly instead of waiting out the window. */
const FLUSH_MAX_BYTES = 64 * 1024;

// ── Active-send registry ────────────────────────────────────────────

const activeSends = new Map<string, () => void>();

/**
 * Register an in-flight send's stop hook under its caller-minted id.
 * Returns the unregister disposer — the executor calls it when the
 * exchange settles (any path). Re-registering an id replaces the hook;
 * ids are caller-minted UUIDs, so collisions mean caller reuse.
 */
export function registerActiveSend(sendId: string, onStop: () => void): () => void {
  activeSends.set(sendId, onStop);
  return () => {
    activeSends.delete(sendId);
  };
}

/**
 * Stop an in-flight send. Returns false when no send with that id is
 * active (already settled, never registered). The hook is the
 * executor's closure — it marks the send user-stopped and aborts the
 * exchange, which materializes the snapshot from whatever arrived.
 */
export function stopActiveSend(sendId: string): boolean {
  const onStop = activeSends.get(sendId);
  if (!onStop) return false;
  onStop();
  return true;
}

// ── Stream-frame emitter ────────────────────────────────────────────

export interface StreamEmitter {
  /** Push the response head as soon as it arrives — one frame. */
  head(head: RequestStreamHeadWire): void;
  /** Enqueue body bytes; flushes by the time/byte window, never per call. */
  chunk(bytes: Uint8Array, totalBytes: number): void;
  /**
   * Settle the emitter (any end path). Emits the final `done` frame and
   * clears the flush timer. Pending bytes are flushed first ONLY when a
   * chunk frame already went out — a body that arrived entirely within
   * the first flush window rides the RPC snapshot alone.
   */
  done(): void;
  /** Chunk frames actually broadcast — >0 means the live phase engaged. */
  chunkFramesSent(): number;
}

export function createStreamEmitter(sendId: string): StreamEmitter {
  let seq = 0;
  let chunkFrames = 0;
  let settled = false;
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let totalSoFar = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = (): void => {
    clearTimer();
    if (pendingBytes === 0) return;
    const joined = new Uint8Array(pendingBytes);
    let offset = 0;
    for (const part of pending) {
      joined.set(part, offset);
      offset += part.byteLength;
    }
    pending = [];
    pendingBytes = 0;
    // A burst larger than the per-frame bound splits into several
    // contiguous frames (text decoding needs every byte, in order).
    for (let at = 0; at < joined.byteLength; at += FLUSH_MAX_BYTES) {
      chunkFrames++;
      broadcast('requestStreamEvent', {
        sendId,
        seq: seq++,
        kind: 'chunk',
        chunkBase64: bytesToBase64(joined.subarray(at, at + FLUSH_MAX_BYTES)),
        totalBytes: totalSoFar,
      });
    }
  };

  return {
    head(head) {
      if (settled) return;
      broadcast('requestStreamEvent', { sendId, seq: seq++, kind: 'head', head });
    },
    chunk(bytes, totalBytes) {
      if (settled || bytes.byteLength === 0) return;
      pending.push(bytes);
      pendingBytes += bytes.byteLength;
      totalSoFar = totalBytes;
      // Eager flush on byte pressure only AFTER the live phase engaged —
      // before that, the time window alone decides (see FLUSH_INTERVAL_MS).
      if (chunkFrames > 0 && pendingBytes >= FLUSH_MAX_BYTES) {
        flush();
        return;
      }
      if (timer === null) timer = setTimeout(flush, FLUSH_INTERVAL_MS);
    },
    done() {
      if (settled) return;
      settled = true;
      // Flush the tail only when the live phase engaged — otherwise the
      // whole body is about to arrive in the RPC snapshot anyway.
      if (chunkFrames > 0) flush();
      clearTimer();
      pending = [];
      pendingBytes = 0;
      broadcast('requestStreamEvent', { sendId, seq: seq++, kind: 'done' });
    },
    chunkFramesSent() {
      return chunkFrames;
    },
  };
}

/** Chunk-safe binary → base64 (avoids per-byte string concat and the
 *  argument-spread ceiling on `String.fromCharCode`). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const STEP = 0x8000;
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  }
  return btoa(binary);
}
