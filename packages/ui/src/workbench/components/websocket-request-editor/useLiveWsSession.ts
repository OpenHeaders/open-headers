/**
 * useLiveWsSession — the WS message timeline's live feed for an open
 * session, the `useLiveGrpcStream` sibling on the `wsStreamEvent`
 * broadcast.
 *
 * The editor mints a `sendId`, calls `beginSession(sendId)` BEFORE
 * the `executeWebSocketRequest` RPC goes out, and `endSession()` when
 * it resolves. In between, direction-tagged message batches
 * accumulate into an append-only log whose array reference stays
 * stable across commits (`count` is the committed prefix — the SSE
 * list's identity discipline, so the timeline's per-item caches
 * hold). Each message carries the executing host's `atMs` stamp;
 * `takeSession()` hands the session-only timing to the editor at
 * materialization so the snapshot's messages (same order, same
 * payloads — the executor records and emits each one) join
 * positionally. Never persisted — the ratified timestamps law.
 *
 * Perf shape: frames are flush-batched by the executing host;
 * incoming events mutate a ref and a single rAF per burst commits ONE
 * state object. Display-only hints — the resolving RPC supersedes
 * them.
 */

import { hostBridge, type WsStreamEventWire, type WsStreamMessageWire } from '@openheaders/core/bridge';
import type { ExecutedProxyRoute } from '@openheaders/core/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Session-only timing retained past materialization — joins the
 *  snapshot's messages positionally (messages[i] ↔ timestamps[i]). */
export interface WsSessionTiming {
  /** When Connect left — the "Connecting" lifecycle row. */
  startedAt: number;
  /** When the handshake settled; absent = it never did. */
  connectedAt?: number;
  /** Per-message host stamps in capture order. */
  messageTimestamps: number[];
  /** Stamped by the editor when the session settles. */
  endedAt?: number;
}

export interface LiveWsSession {
  /** The settled handshake, or null until the open frame arrives.
   *  `proxyRoute` is the transport's route decision riding the open
   *  frame — the session strip's live attribution. Absent = direct. */
  open: { protocol: string; extensions: string; proxyRoute?: ExecutedProxyRoute } | null;
  /** When Connect left — the ticking lifecycle base. */
  startedAt: number;
  /** When the handshake settled — the "Connected" row's time. */
  connectedAt?: number;
  /** Append-only message log; reference-stable, `count` committed. */
  items: WsStreamMessageWire[];
  count: number;
  /** Session-only host stamps, positional (items[i] ↔ timestamps[i]);
   *  append-only and reference-stable like `items`. */
  timestamps: number[];
}

interface WsSessionAccumulator {
  sendId: string;
  startedAt: number;
  open: LiveWsSession['open'];
  connectedAt?: number;
  items: WsStreamMessageWire[];
  timestamps: number[];
  lastSeq: number;
}

export function useLiveWsSession(): {
  live: LiveWsSession | null;
  beginSession: (sendId: string) => void;
  endSession: () => void;
  /** Snapshot the session timing (call BEFORE `endSession`). */
  takeSession: () => WsSessionTiming | null;
} {
  const [live, setLive] = useState<LiveWsSession | null>(null);
  const accRef = useRef<WsSessionAccumulator | null>(null);
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
      open: acc.open,
      startedAt: acc.startedAt,
      ...(acc.connectedAt !== undefined ? { connectedAt: acc.connectedAt } : {}),
      items: acc.items,
      count: acc.items.length,
      timestamps: acc.timestamps,
    });
  }, []);

  const scheduleCommit = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(commit);
  }, [commit]);

  const endSession = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    accRef.current = null;
    cancelRaf();
    setLive(null);
  }, [cancelRaf]);

  const takeSession = useCallback((): WsSessionTiming | null => {
    const acc = accRef.current;
    if (!acc) return null;
    return {
      startedAt: acc.startedAt,
      ...(acc.connectedAt !== undefined ? { connectedAt: acc.connectedAt } : {}),
      messageTimestamps: [...acc.timestamps],
    };
  }, []);

  const beginSession = useCallback(
    (sendId: string) => {
      endSession();
      accRef.current = { sendId, startedAt: Date.now(), open: null, items: [], timestamps: [], lastSeq: -1 };
      // Commit the empty state NOW — the session pane keys off a
      // non-null live feed, and no wire event arrives until the
      // handshake settles: without this seed the editor sits on a
      // spinner instead of the timeline's "Connecting" row.
      commit();
      unsubscribeRef.current = hostBridge.subscribe('wsStreamEvent', (event: WsStreamEventWire) => {
        const acc = accRef.current;
        if (!acc || event.sendId !== acc.sendId) return;
        if (event.seq <= acc.lastSeq) return;
        acc.lastSeq = event.seq;
        if (event.kind === 'open') {
          acc.open = {
            protocol: event.protocol,
            extensions: event.extensions,
            ...(event.proxyRoute !== undefined ? { proxyRoute: event.proxyRoute } : {}),
          };
          acc.connectedAt = Date.now();
        } else if (event.kind === 'messages') {
          for (const item of event.items) {
            acc.items.push(item);
            acc.timestamps.push(item.atMs);
          }
        }
        // `end` needs no handling — the resolving RPC ends the session.
        scheduleCommit();
      });
    },
    [endSession, commit, scheduleCommit],
  );

  // Unmount: drop the subscription and any pending frame.
  useEffect(() => endSession, [endSession]);

  return { live, beginSession, endSession, takeSession };
}
