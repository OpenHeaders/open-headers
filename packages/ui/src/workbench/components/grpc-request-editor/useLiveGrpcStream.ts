/**
 * useLiveGrpcStream — the gRPC message timeline's live feed for an
 * in-flight streaming invoke, the `useLiveSendStream` sibling on the
 * `grpcStreamEvent` broadcast.
 *
 * The editor mints a `sendId`, calls `beginStream(sendId)` BEFORE the
 * `executeGrpcRequest` RPC goes out, and `endStream()` when it
 * resolves. In between, direction-tagged message batches accumulate
 * into an append-only log whose array reference stays stable across
 * commits (`count` is the committed prefix — the SSE list's identity
 * discipline, so the timeline's per-item caches hold). Each message
 * carries the executing host's `atMs` stamp; `takeSession()` hands the
 * session-only timing to the editor at materialization so the
 * snapshot's frames (same order, same frames — the executor records
 * and emits each one) join positionally. Never persisted — the
 * ratified timestamps law.
 *
 * Perf shape: frames are flush-batched by the executing host; incoming
 * events mutate a ref and a single rAF per burst commits ONE state
 * object. Display-only hints — the resolving RPC supersedes them.
 */

import { type GrpcStreamEventWire, type GrpcStreamMessageWire, hostBridge } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Session-only stream timing retained past materialization — joins
 *  the snapshot's frames positionally (messages[i] ↔ timestamps[i]). */
export interface GrpcStreamSession {
  /** When the invoke left — the "Request sent" lifecycle row. */
  startedAt: number;
  /** When the response head arrived; absent = it never did. */
  connectedAt?: number;
  /** Per-message host stamps in capture order. */
  messageTimestamps: number[];
  /** Stamped by the editor when the invoke settles. */
  endedAt?: number;
}

export interface LiveGrpcStream {
  /** Response head, or null until the head frame arrives. */
  head: { httpStatus: number; headers: Array<{ key: string; value: string }> } | null;
  /** When the invoke left — the ticking lifecycle base. */
  startedAt: number;
  /** When the head arrived — the "Response received" row's time. */
  connectedAt?: number;
  /** Messages that preceded the head in CALL order — the executor's
   *  stamp off the head event, immune to message-batch pooling. */
  headAtMessage?: number;
  /** Append-only message log; reference-stable, `count` committed. */
  items: GrpcStreamMessageWire[];
  count: number;
  /** Session-only host stamps, positional (items[i] ↔ timestamps[i]);
   *  append-only and reference-stable like `items`. */
  timestamps: number[];
}

interface GrpcStreamAccumulator {
  sendId: string;
  startedAt: number;
  head: LiveGrpcStream['head'];
  connectedAt?: number;
  headAtMessage?: number;
  items: GrpcStreamMessageWire[];
  timestamps: number[];
  lastSeq: number;
}

export function useLiveGrpcStream(): {
  live: LiveGrpcStream | null;
  beginStream: (sendId: string) => void;
  endStream: () => void;
  /** Snapshot the session timing (call BEFORE `endStream`). */
  takeSession: () => GrpcStreamSession | null;
} {
  const [live, setLive] = useState<LiveGrpcStream | null>(null);
  const accRef = useRef<GrpcStreamAccumulator | null>(null);
  const rafRef = useRef<number | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const cancelRaf = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const commit = useCallback(() => {
    rafRef.current = null;
    const acc = accRef.current;
    if (!acc) return;
    setLive({
      head: acc.head,
      startedAt: acc.startedAt,
      ...(acc.connectedAt !== undefined ? { connectedAt: acc.connectedAt } : {}),
      ...(acc.headAtMessage !== undefined ? { headAtMessage: acc.headAtMessage } : {}),
      items: acc.items,
      count: acc.items.length,
      timestamps: acc.timestamps,
    });
  }, []);

  const scheduleCommit = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const endStream = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    accRef.current = null;
    cancelRaf();
    setLive(null);
  }, [cancelRaf]);

  const takeSession = useCallback((): GrpcStreamSession | null => {
    const acc = accRef.current;
    if (!acc) return null;
    return {
      startedAt: acc.startedAt,
      ...(acc.connectedAt !== undefined ? { connectedAt: acc.connectedAt } : {}),
      messageTimestamps: [...acc.timestamps],
    };
  }, []);

  const beginStream = useCallback(
    (sendId: string) => {
      endStream();
      accRef.current = { sendId, startedAt: Date.now(), head: null, items: [], timestamps: [], lastSeq: -1 };
      unsubscribeRef.current = hostBridge.subscribe('grpcStreamEvent', (event: GrpcStreamEventWire) => {
        const acc = accRef.current;
        if (!acc || event.sendId !== acc.sendId) return;
        if (event.seq <= acc.lastSeq) return;
        acc.lastSeq = event.seq;
        if (event.kind === 'head') {
          acc.head = { httpStatus: event.httpStatus, headers: event.headers };
          acc.connectedAt = Date.now();
        } else if (event.kind === 'messages') {
          for (const item of event.items) {
            acc.items.push(item);
            acc.timestamps.push(item.atMs);
          }
        }
        // `end` needs no handling — the resolving RPC ends the stream.
        scheduleCommit();
      });
    },
    [endStream, scheduleCommit],
  );

  // Unmount: drop the subscription and any pending frame.
  useEffect(() => endStream, [endStream]);

  return { live, beginStream, endStream, takeSession };
}
