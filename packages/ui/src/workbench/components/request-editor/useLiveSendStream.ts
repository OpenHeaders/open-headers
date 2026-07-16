/**
 * useLiveSendStream — the response panel's live-tail feed for an
 * in-flight interactive send.
 *
 * The editor mints a `sendId`, calls `beginStream(sendId)` BEFORE the
 * `executeRequest` RPC goes out, and `endStream()` when it resolves.
 * In between, `requestStreamEvent` broadcasts tagged with that id
 * accumulate here: the head renders as soon as it arrives, body chunks
 * decode into a bounded tail window (last N chars — a stream can run
 * for hours; the full capped body arrives with the RPC snapshot).
 *
 * SSE sends (the head declares `text/event-stream`) additionally feed
 * the live EVENT LIST: chunks run through an incremental block parse —
 * a carry buffer split at complete block boundaries, each byte parsed
 * exactly once — and every parsed event mints a session-only arrival
 * timestamp. The event log is append-only and its arrays keep their
 * reference across commits; the committed `count` is the visible
 * prefix. `takeSseSession()` hands the timestamps to the editor at
 * materialization so the snapshot-parsed list (same parser, same
 * bytes) can join them positionally.
 *
 * Perf shape: frames are already flush-batched by the executing host;
 * incoming events mutate a ref and a single rAF per burst commits ONE
 * state object, so render cost stays bounded no matter the chunk rate.
 * Frames are display-only hints — the resolving RPC supersedes them,
 * so dropped or late frames need no recovery path.
 */

import { hostBridge, type RequestStreamEventWire, type RequestStreamHeadWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isSseResponse, parseSseEventItems, type SseEventItem, sliceCompleteSseBlocks } from './response/response-sse';

/** Tail window — plenty to eyeball a stream; the snapshot carries the
 *  full capped body once the send settles. */
const TAIL_WINDOW_CHARS = 32 * 1024;

/** Live event feed of an SSE send — the event list's input. `items`
 *  and `timestamps` are append-only and reference-stable across
 *  commits; `count` is the committed visible prefix. */
export interface LiveSseFeed {
  items: SseEventItem[];
  count: number;
  /** Session-only arrival times, epoch ms — items[i] ↔ timestamps[i]. */
  timestamps: number[];
  /** When the response head arrived — the connected lifecycle row. */
  connectedAt: number;
}

/**
 * Session-only stream timing the editor retains past materialization —
 * the live phase's timestamps, positionally joinable onto the
 * snapshot's parsed events. Never persisted (no snapshot shape
 * change); re-opened saved bodies simply have none.
 */
export interface SseStreamSession {
  connectedAt: number;
  /** Per-event mint times in parse order. */
  eventTimestamps: number[];
  /** Stamped by the editor when the send settles. */
  endedAt?: number;
}

export interface LiveSendStream {
  /** Response head, or null until the head frame arrives. */
  head: RequestStreamHeadWire | null;
  /** When the send left — the live meta strip's ticking elapsed base. */
  startedAt: number;
  /** Decoded tail of the body received so far (bounded window). */
  tailText: string;
  /** Total body bytes received so far (cap-bounded). */
  totalBytes: number;
  /** Non-null when the head declared `text/event-stream` — the live
   *  phase renders the event list instead of the text tail. */
  sse: LiveSseFeed | null;
}

interface SseAccumulator {
  /** Bytes after the last complete block boundary, awaiting more. */
  carry: string;
  items: SseEventItem[];
  timestamps: number[];
  connectedAt: number;
}

interface StreamAccumulator {
  sendId: string;
  decoder: TextDecoder;
  startedAt: number;
  head: RequestStreamHeadWire | null;
  tailText: string;
  totalBytes: number;
  lastSeq: number;
  sse: SseAccumulator | null;
  /** Arrival time of the most recent chunk frame — the timestamp slot
   *  for a trailing block still in the carry at materialization. */
  lastChunkAt: number;
}

export function useLiveSendStream(): {
  live: LiveSendStream | null;
  beginStream: (sendId: string) => void;
  endStream: () => void;
  /** Snapshot the SSE session timing (call BEFORE `endStream`) — null
   *  for non-SSE sends. */
  takeSseSession: () => SseStreamSession | null;
} {
  const [live, setLive] = useState<LiveSendStream | null>(null);
  const accRef = useRef<StreamAccumulator | null>(null);
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
      tailText: acc.tailText,
      totalBytes: acc.totalBytes,
      sse: acc.sse
        ? {
            items: acc.sse.items,
            count: acc.sse.items.length,
            timestamps: acc.sse.timestamps,
            connectedAt: acc.sse.connectedAt,
          }
        : null,
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

  const takeSseSession = useCallback((): SseStreamSession | null => {
    const acc = accRef.current;
    if (!acc?.sse) return null;
    const eventTimestamps = [...acc.sse.timestamps];
    // A trailing block the capture cut mid-way never flushed live, but
    // the materialized parse mints a record for it — its slot gets the
    // last frame's arrival time so the positional join stays aligned.
    const remainder = acc.sse.carry === '' ? null : parseSseEventItems(acc.sse.carry);
    if (remainder) for (let i = 0; i < remainder.items.length; i++) eventTimestamps.push(acc.lastChunkAt);
    return { connectedAt: acc.sse.connectedAt, eventTimestamps };
  }, []);

  const beginStream = useCallback(
    (sendId: string) => {
      endStream();
      accRef.current = {
        sendId,
        // fatal: false — a flush boundary can split a multi-byte
        // sequence; the streaming decoder carries it across chunks.
        decoder: new TextDecoder('utf-8', { fatal: false }),
        startedAt: Date.now(),
        head: null,
        tailText: '',
        totalBytes: 0,
        lastSeq: -1,
        sse: null,
        lastChunkAt: 0,
      };
      unsubscribeRef.current = hostBridge.subscribe('requestStreamEvent', (event: RequestStreamEventWire) => {
        const acc = accRef.current;
        if (!acc || event.sendId !== acc.sendId) return;
        if (event.seq <= acc.lastSeq) return;
        acc.lastSeq = event.seq;
        if (event.kind === 'head') {
          acc.head = event.head;
          if (isSseResponse(event.head.headers)) {
            acc.sse = { carry: '', items: [], timestamps: [], connectedAt: Date.now() };
          }
        } else if (event.kind === 'chunk') {
          const text = acc.decoder.decode(base64ToBytes(event.chunkBase64), { stream: true });
          acc.tailText = (acc.tailText + text).slice(-TAIL_WINDOW_CHARS);
          acc.totalBytes = event.totalBytes;
          acc.lastChunkAt = Date.now();
          if (acc.sse) {
            const { complete, rest } = sliceCompleteSseBlocks(acc.sse.carry + text);
            acc.sse.carry = rest;
            const parsed = complete === '' ? null : parseSseEventItems(complete);
            if (parsed) {
              for (const item of parsed.items) {
                acc.sse.items.push(item);
                acc.sse.timestamps.push(acc.lastChunkAt);
              }
            }
          }
        }
        // `done` needs no handling — the resolving RPC ends the stream.
        scheduleCommit();
      });
    },
    [endStream, scheduleCommit],
  );

  // Unmount: drop the subscription and any pending frame.
  useEffect(() => endStream, [endStream]);

  return { live, beginStream, endStream, takeSseSession };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
