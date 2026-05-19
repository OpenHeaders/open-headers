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

import { DEFAULT_REMOTE_ID, prunePendingOutByPeerVector } from '@openheaders/oracle/sync';
import type { StateVector } from '@openheaders/core/sync';
import {
  SYNC_MUTATION_TYPE,
  type SyncMutationMessage,
} from '@openheaders/core/protocol';
import {
  emitAuditEntry,
  getIdentitySnapshot,
  hasCapability,
} from '@openheaders/core/identity';
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

/**
 * Per-envelope SW→peer gate (Phase U2.3). The local user must hold
 * `workspace.write` on the envelope's workspaceId before the SW
 * forwards the envelope upstream. Synthetic LocalAdmin always allows;
 * post-promotion this becomes the real WRA check.
 *
 * Deny is silent + logged — the envelope was already committed locally
 * (this gate runs *after* the local oracle's apply), so denying simply
 * prevents wire propagation. The audit entry is the forensic record.
 */
function isForwardAllowed(workspaceId: string): boolean {
  const snapshot = getIdentitySnapshot();
  const decision = hasCapability(snapshot, 'workspace.write', { workspaceId });
  emitAuditEntry({
    actorUserId: snapshot?.user.id ?? 'unknown',
    capability: 'workspace.write',
    workspaceId,
    decision,
  });
  if (!decision.allow) {
    logger.warn(SCOPE, `outbound envelope dropped: ${decision.reason ?? 'denied'} on ws ${workspaceId}`);
    return false;
  }
  return true;
}

export function forwardMutationToBackend(event: OracleSyncBroadcastEvent): void {
  if (!shouldForward(event)) return;
  if (!isForwardAllowed(event.envelope.workspaceId)) return;
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
        if (!isForwardAllowed(env.workspaceId)) {
          // Privilege revoked between enqueue and flush. Ack to drop
          // the envelope from the queue rather than re-flushing
          // forever; the audit log already records the deny.
          acked.push(env.mutationId);
          continue;
        }
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

/**
 * Apply a peer's state vector to the pending-out queue (Phase C C16):
 * envelopes the peer already has are dropped from the queue so the
 * subsequent flush doesn't re-send them. Called by the handshake
 * post-SYNCED hook once STATE_VECTOR wiring is live; today it's a
 * directly callable function so tests + future call sites can drive
 * it explicitly. No-op when no queue is installed.
 */
export async function applyPeerStateVectorToPendingOut(peerVector: StateVector): Promise<void> {
  if (!pendingQueue) return;
  await prunePendingOutByPeerVector(pendingQueue, DEFAULT_REMOTE_ID, peerVector);
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
