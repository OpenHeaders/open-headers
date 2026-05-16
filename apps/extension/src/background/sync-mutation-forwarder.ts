/**
 * Outbound mutation forwarder — Phase C C7 / C15.
 *
 * Every envelope the local SW oracle commits flows through here:
 *
 *   1. The oracle's `broadcastSyncEvent` host hook fires per committed
 *      envelope (see `background.ts`).
 *   2. The hook calls {@link forwardMutationToBackend}.
 *   3. {@link forwardMutationToBackend} consults the configurable
 *      {@link shouldForwardMutation} predicate (C11 echo guard), then
 *      writes the envelope to the backend WS via
 *      `sendViaWebSocket`. On failure, the envelope is enqueued in
 *      the persistent pending-out queue (C13).
 *
 * Reconnect-flush ({@link flushPendingOutToBackend}, C15) drains the
 * queue in HLC order, re-sends each envelope, and acks on success.
 * Wire-side dedup (C11) makes the replay safe even if the backend
 * already received the envelope before the disconnect.
 *
 * **Threading.** `broadcastSyncEvent` fires synchronously from
 * applies, but enqueue + flush are async. The forwarder uses a
 * fire-and-forget pattern for enqueue (preserves apply latency); a
 * single in-flight `flush` promise prevents concurrent drains from
 * stepping on each other across reconnect storms.
 */

import { DEFAULT_REMOTE_ID } from '@openheaders/oracle/sync';
import {
  SYNC_MUTATION_TYPE,
  type SyncMutationMessage,
} from '@openheaders/core/protocol';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import type { PendingOutQueue } from '@openheaders/oracle/sync';

import { logger } from '@utils/logger';
import { isWebSocketConnected, sendViaWebSocket } from './websocket';

const SCOPE = 'SyncForwarder';

export type ShouldForwardMutation = (event: OracleSyncBroadcastEvent) => boolean;

let shouldForward: ShouldForwardMutation = () => true;

/**
 * Swap the predicate used by {@link forwardMutationToBackend}. The
 * C11 dedup layer calls this at module-load to install the
 * seen-from-peer filter.
 */
export function setShouldForwardMutation(predicate: ShouldForwardMutation): void {
  shouldForward = predicate;
}

let pendingQueue: PendingOutQueue | null = null;

/**
 * Install the pending-out queue. Called once during boot wiring
 * after the persistence provider has been chosen (default IDB on
 * the extension SW). Without this, the forwarder falls back to
 * count-only drop telemetry.
 */
export function setPendingOutQueue(queue: PendingOutQueue | null): void {
  pendingQueue = queue;
}

let droppedNoQueue = 0;
let loggedDropOnce = false;
let inflightFlush: Promise<void> | null = null;

function envelopeToFrame(event: OracleSyncBroadcastEvent): SyncMutationMessage {
  return {
    type: SYNC_MUTATION_TYPE,
    workspaceId: event.envelope.workspaceId,
    envelope: event.envelope,
  };
}

export function forwardMutationToBackend(event: OracleSyncBroadcastEvent): void {
  if (!shouldForward(event)) return;
  const frame = envelopeToFrame(event);
  const sent = sendViaWebSocket(frame as unknown as Record<string, unknown>);
  if (sent) return;

  if (pendingQueue) {
    void pendingQueue.enqueue(DEFAULT_REMOTE_ID, event.envelope).catch((err) => {
      logger.warn(SCOPE, 'enqueue to pending-out queue failed', err);
    });
    return;
  }
  // No queue installed (test harness, cold boot). Count drops for
  // telemetry; once-per-window log to avoid flooding.
  droppedNoQueue++;
  if (!loggedDropOnce) {
    logger.info(SCOPE, 'no pending-out queue installed; outbound envelope dropped');
    loggedDropOnce = true;
  }
}

/**
 * Drain the pending-out queue in HLC order and re-send each
 * envelope. Acks on successful send so a partial drain (WS dies
 * mid-flush) leaves the remainder intact for the next flush. Safe
 * to call repeatedly; concurrent calls coalesce onto one in-flight
 * promise.
 */
export function flushPendingOutToBackend(): Promise<void> {
  if (inflightFlush) return inflightFlush;
  inflightFlush = (async () => {
    try {
      if (!pendingQueue) return;
      if (!isWebSocketConnected()) return;

      const acked: string[] = [];
      for await (const env of pendingQueue.drain(DEFAULT_REMOTE_ID)) {
        if (!isWebSocketConnected()) break;
        const frame: SyncMutationMessage = {
          type: SYNC_MUTATION_TYPE,
          workspaceId: env.workspaceId,
          envelope: env,
        };
        const sent = sendViaWebSocket(frame as unknown as Record<string, unknown>);
        if (!sent) break;
        acked.push(env.mutationId);
      }
      if (acked.length > 0) {
        await pendingQueue.ackAll(DEFAULT_REMOTE_ID, acked);
        logger.info(SCOPE, `flushed ${acked.length} pending envelope(s) to backend`);
      }
    } catch (err) {
      logger.warn(SCOPE, 'pending-out flush failed mid-drain', err);
    } finally {
      inflightFlush = null;
    }
  })();
  return inflightFlush;
}

/** Test-only — counts envelopes dropped because no queue was installed. */
export function __getDroppedNoQueueCount(): number {
  return droppedNoQueue;
}

/** Test-only — reset internal counters between cases. */
export function __resetMutationForwarderForTests(): void {
  shouldForward = () => true;
  pendingQueue = null;
  droppedNoQueue = 0;
  loggedDropOnce = false;
  inflightFlush = null;
}
