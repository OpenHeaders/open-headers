/**
 * useLiveMqttSession — the MQTT message timeline's live feed for an
 * open session, the `useLiveWsSession` sibling on the
 * `mqttStreamEvent` broadcast.
 *
 * The editor mints a `sendId`, calls `beginSession(sendId)` BEFORE the
 * `executeMqttRequest` RPC goes out, and `endSession()` when it
 * resolves. In between, timeline items — PUBLISH messages both
 * directions plus subscription lifecycle facts — accumulate into an
 * append-only log whose array reference stays stable across commits
 * (`count` is the committed prefix — the SSE list's identity
 * discipline, so the timeline's per-item caches hold). Each item
 * carries the executing host's `atMs` stamp; `takeSession()` hands the
 * session-only timing to the editor at materialization so the
 * snapshot's events (same order, same payloads — the executor records
 * and emits each one) join positionally. Never persisted — the
 * ratified timestamps law.
 *
 * Perf shape: frames are flush-batched by the executing host; incoming
 * events mutate a ref and a single rAF per burst commits ONE state
 * object. Display-only hints — the resolving RPC supersedes them.
 */

import { hostBridge, type MqttStreamEventWire, type MqttStreamItemWire } from '@openheaders/core/bridge';
import type { ExecutedProxyRoute } from '@openheaders/core/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Session-only timing retained past materialization — joins the
 *  snapshot's events positionally (events[i] ↔ timestamps[i]). */
export interface MqttSessionTiming {
  /** When Connect left — the "Connecting" lifecycle row. */
  startedAt: number;
  /** When the CONNACK accepted; absent = it never did. Host-stamped
   *  from the open frame's `atMs`; observation-stamped toward hosts
   *  that predate the lifecycle stamps. */
  connectedAt?: number;
  /** Per-item host stamps in capture order. */
  itemTimestamps: number[];
  /** When the broker socket's teardown was observed — the end frame's
   *  host stamp, on every settle path. Absent = no end frame arrived
   *  (a session that never dialed). */
  disconnectedAt?: number;
  /** Stamped by the editor at the user's Disconnect/Cancel click;
   *  absent = the session ended without one. */
  closeRequestedAt?: number;
  /** Stamped by the editor when the session settles. */
  endedAt?: number;
}

export interface LiveMqttSession {
  /** The accepted CONNACK's facts, or null until the open frame
   *  arrives. `remainingLength` is the CONNACK frame's Remaining
   *  Length as observed on the wire (absent from hosts that predate
   *  the fact); `clientId` is what the CONNECT actually carried;
   *  `proxyRoute` is the transport's route decision riding the open
   *  frame. */
  open: {
    sessionPresent: boolean;
    reasonCode: number;
    remainingLength?: number;
    clientId: string;
    proxyRoute?: ExecutedProxyRoute;
  } | null;
  /** When Connect left — the ticking lifecycle base. */
  startedAt: number;
  /** When the CONNACK accepted — the "Connected" row's time. */
  connectedAt?: number;
  /** Append-only item log; reference-stable, `count` committed. */
  items: MqttStreamItemWire[];
  count: number;
  /** Session-only host stamps, positional (items[i] ↔ timestamps[i]);
   *  append-only and reference-stable like `items`. */
  timestamps: number[];
}

interface MqttSessionAccumulator {
  sendId: string;
  startedAt: number;
  open: LiveMqttSession['open'];
  connectedAt?: number;
  disconnectedAt?: number;
  items: MqttStreamItemWire[];
  timestamps: number[];
  lastSeq: number;
}

export function useLiveMqttSession(): {
  live: LiveMqttSession | null;
  beginSession: (sendId: string) => void;
  endSession: () => void;
  /** Snapshot the session timing (call BEFORE `endSession`). */
  takeSession: () => MqttSessionTiming | null;
} {
  const [live, setLive] = useState<LiveMqttSession | null>(null);
  const accRef = useRef<MqttSessionAccumulator | null>(null);
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

  const takeSession = useCallback((): MqttSessionTiming | null => {
    const acc = accRef.current;
    if (!acc) return null;
    return {
      startedAt: acc.startedAt,
      ...(acc.connectedAt !== undefined ? { connectedAt: acc.connectedAt } : {}),
      itemTimestamps: [...acc.timestamps],
      ...(acc.disconnectedAt !== undefined ? { disconnectedAt: acc.disconnectedAt } : {}),
    };
  }, []);

  const beginSession = useCallback(
    (sendId: string) => {
      endSession();
      accRef.current = { sendId, startedAt: Date.now(), open: null, items: [], timestamps: [], lastSeq: -1 };
      // Commit the empty state NOW — the session pane keys off a
      // non-null live feed, and no wire event arrives until the
      // CONNACK settles: without this seed the editor sits on a
      // spinner instead of the timeline's "Connecting" row.
      commit();
      unsubscribeRef.current = hostBridge.subscribe('mqttStreamEvent', (event: MqttStreamEventWire) => {
        const acc = accRef.current;
        if (!acc || event.sendId !== acc.sendId) return;
        if (event.seq <= acc.lastSeq) return;
        acc.lastSeq = event.seq;
        if (event.kind === 'open') {
          acc.open = {
            sessionPresent: event.sessionPresent,
            reasonCode: event.reasonCode,
            ...(event.remainingLength !== undefined ? { remainingLength: event.remainingLength } : {}),
            clientId: event.clientId,
            ...(event.proxyRoute !== undefined ? { proxyRoute: event.proxyRoute } : {}),
          };
          acc.connectedAt = event.atMs ?? Date.now();
        } else if (event.kind === 'items') {
          for (const item of event.items) {
            acc.items.push(item);
            acc.timestamps.push(item.atMs);
          }
        } else {
          // The end frame carries the host's teardown instant; the
          // resolving RPC still ends the session.
          acc.disconnectedAt = event.atMs ?? Date.now();
        }
        scheduleCommit();
      });
    },
    [endSession, commit, scheduleCommit],
  );

  // Unmount: drop the subscription and any pending frame.
  useEffect(() => endSession, [endSession]);

  return { live, beginSession, endSession, takeSession };
}
