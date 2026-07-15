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
 * Perf shape: frames are already flush-batched by the executing host;
 * incoming events mutate a ref and a single rAF per burst commits ONE
 * state object, so render cost stays bounded no matter the chunk rate.
 * Frames are display-only hints — the resolving RPC supersedes them,
 * so dropped or late frames need no recovery path.
 */

import { hostBridge, type RequestStreamEventWire, type RequestStreamHeadWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Tail window — plenty to eyeball a stream; the snapshot carries the
 *  full capped body once the send settles. */
const TAIL_WINDOW_CHARS = 32 * 1024;

export interface LiveSendStream {
  /** Response head, or null until the head frame arrives. */
  head: RequestStreamHeadWire | null;
  /** Decoded tail of the body received so far (bounded window). */
  tailText: string;
  /** Total body bytes received so far (cap-bounded). */
  totalBytes: number;
}

interface StreamAccumulator {
  sendId: string;
  decoder: TextDecoder;
  head: RequestStreamHeadWire | null;
  tailText: string;
  totalBytes: number;
  lastSeq: number;
}

export function useLiveSendStream(): {
  live: LiveSendStream | null;
  beginStream: (sendId: string) => void;
  endStream: () => void;
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
    setLive({ head: acc.head, tailText: acc.tailText, totalBytes: acc.totalBytes });
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

  const beginStream = useCallback(
    (sendId: string) => {
      endStream();
      accRef.current = {
        sendId,
        // fatal: false — a flush boundary can split a multi-byte
        // sequence; the streaming decoder carries it across chunks.
        decoder: new TextDecoder('utf-8', { fatal: false }),
        head: null,
        tailText: '',
        totalBytes: 0,
        lastSeq: -1,
      };
      unsubscribeRef.current = hostBridge.subscribe('requestStreamEvent', (event: RequestStreamEventWire) => {
        const acc = accRef.current;
        if (!acc || event.sendId !== acc.sendId) return;
        if (event.seq <= acc.lastSeq) return;
        acc.lastSeq = event.seq;
        if (event.kind === 'head') {
          acc.head = event.head;
        } else if (event.kind === 'chunk') {
          const text = acc.decoder.decode(base64ToBytes(event.chunkBase64), { stream: true });
          acc.tailText = (acc.tailText + text).slice(-TAIL_WINDOW_CHARS);
          acc.totalBytes = event.totalBytes;
        }
        // `done` needs no handling — the resolving RPC ends the stream.
        scheduleCommit();
      });
    },
    [endStream, scheduleCommit],
  );

  // Unmount: drop the subscription and any pending frame.
  useEffect(() => endStream, [endStream]);

  return { live, beginStream, endStream };
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
