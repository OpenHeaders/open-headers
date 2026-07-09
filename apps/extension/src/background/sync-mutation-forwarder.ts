/**
 * Outbound mutation forwarder — Phase C C7 / C15, generalized to the
 * N-backend connection plane (MULTI_BACKEND_PLAN.md §3).
 *
 * Every envelope the local SW oracle commits flows through here:
 *
 *   1. The oracle's `broadcastSyncEvent` host hook fires per committed
 *      envelope (see `background.ts`).
 *   2. The hook calls {@link forwardMutationToBackend}.
 *   3. {@link forwardMutationToBackend} runs the envelope through the
 *      shared outbound transport gate (`evaluateOutboundEnvelope` —
 *      echo guard / consumed-Org tenancy / `workspace.write` authz),
 *      resolves its target from the Org binding — an envelope goes to
 *      exactly the backend whose Org set contains its `orgId`; home-Org
 *      envelopes were already withheld by the tenancy layer (routing
 *      invariant 1) — then writes it to that backend's wire. On send
 *      failure the envelope is enqueued under that backend's pending-out
 *      cursor (C13; invariant 3 — one log, one cursor per backend).
 *
 * Reconnect-flush ({@link flushPendingOutToBackend}, C15) drains one
 * backend's cursor in HLC order, re-runs the same gate, re-sends each
 * allowed envelope on that backend's wire, and acks on success. An
 * envelope the gate now withholds (echo / own-Org / revoked privilege)
 * is ack-dropped rather than re-flushed forever; one whose Org binding
 * moved to another backend (a re-minted connection record) is re-routed
 * to its new cursor. Wire-side dedup (C11) makes the replay safe even
 * if the backend already received the envelope before the disconnect.
 *
 * **Threading.** `broadcastSyncEvent` fires synchronously from
 * applies, but enqueue + flush are async. The forwarder uses a
 * fire-and-forget pattern for enqueue (preserves apply latency); a
 * single in-flight `flush` promise per backend prevents concurrent
 * drains from stepping on each other across reconnect storms, while
 * two backends' flushes proceed independently.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import type { MutationEnvelope, StateVector } from '@openheaders/core/sync';
import type { OracleSyncBroadcastEvent, PendingOutQueue } from '@openheaders/oracle/sync';
import { evaluateOutboundEnvelope, prunePendingOutByPeerVector } from '@openheaders/oracle/sync';

import { logger } from '@utils/logger';
import { isBackendConnected, sendToBackend } from './websocket';

const SCOPE = 'SyncForwarder';

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
const inflightFlushes = new Map<string, Promise<void>>();

function envelopeToFrame(envelope: MutationEnvelope): SyncMutationMessage {
  return {
    type: SYNC_MUTATION_TYPE,
    workspaceId: envelope.workspaceId,
    envelope,
  };
}

export function forwardMutationToBackend(event: OracleSyncBroadcastEvent): void {
  // Peer-sourced content (live delta via the bridge, snapshot bootstrap
  // re-seed) must never bounce back up the wire — only local edits go
  // out. The gate's echo layer stays for the pending-out flush path,
  // which re-evaluates envelopes without a broadcast event in hand.
  if (event.applyOrigin === 'inbound') return;
  const verdict = evaluateOutboundEnvelope(event.envelope);
  if (!verdict.allow) {
    // Echo drops are high-frequency and benign — stay silent. Tenancy +
    // authz drops are rarer and worth a debug line; the gate already
    // audits the authz decision.
    if (verdict.layer !== 'echo') {
      logger.debug(SCOPE, `outbound envelope withheld (${verdict.layer}): ${verdict.reason ?? ''}`);
    }
    return;
  }
  // Routing invariant 1: exactly the backend bound to the envelope's
  // Org. The tenancy layer above only passes consumed Orgs, and every
  // consumed (snapshot-folded) Org has a binding — a miss means the
  // binding raced a registry removal; drop, the resolver-side filters
  // would refuse it everywhere anyway.
  const backendId = getOrgBackendBindings().get(event.envelope.orgId);
  if (!backendId) {
    logger.debug(SCOPE, `outbound envelope for Org ${event.envelope.orgId} has no backend binding — dropped`);
    return;
  }
  const sent = sendToBackend(backendId, envelopeToFrame(event.envelope) as unknown as Record<string, unknown>);
  if (sent) return;

  if (pendingQueue) {
    void pendingQueue.enqueue(backendId, event.envelope).catch((err) => {
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
 * Drain one backend's pending-out cursor in HLC order and re-send each
 * envelope on its wire. Acks on successful send so a partial drain (WS
 * dies mid-flush) leaves the remainder intact for the next flush. Safe
 * to call repeatedly; concurrent calls for the same backend coalesce
 * onto one in-flight promise, while different backends flush
 * independently (invariant 3 — offline edits to backend A's workspace
 * flush to A on A's reconnect, regardless of B's state).
 */
export function flushPendingOutToBackend(backendId: string): Promise<void> {
  const inflight = inflightFlushes.get(backendId);
  if (inflight) return inflight;
  const flush = (async () => {
    try {
      if (!pendingQueue) return;
      if (!isBackendConnected(backendId)) return;

      const acked: string[] = [];
      for await (const env of pendingQueue.drain(backendId)) {
        if (!isBackendConnected(backendId)) break;
        const verdict = evaluateOutboundEnvelope(env);
        if (!verdict.allow) {
          // The gate now withholds this envelope — it echoes a frame the
          // backend already sent, its Org is no longer consumed, or
          // `workspace.write` was revoked between enqueue and flush. Ack
          // to drop it from the queue rather than re-flushing forever.
          acked.push(env.mutationId);
          continue;
        }
        const boundTo = getOrgBackendBindings().get(env.orgId);
        if (boundTo !== backendId) {
          // The Org re-bound (its connection record was re-minted while
          // this envelope sat queued). Re-route to the owning backend's
          // cursor and ack it out of this one.
          if (boundTo) await pendingQueue.enqueue(boundTo, env);
          acked.push(env.mutationId);
          continue;
        }
        const sent = sendToBackend(backendId, envelopeToFrame(env) as unknown as Record<string, unknown>);
        if (!sent) break;
        acked.push(env.mutationId);
      }
      if (acked.length > 0) {
        await pendingQueue.ackAll(backendId, acked);
        logger.info(SCOPE, `flushed ${acked.length} pending envelope(s) to backend`);
      }
    } catch (err) {
      logger.warn(SCOPE, 'pending-out flush failed mid-drain', err);
    } finally {
      inflightFlushes.delete(backendId);
    }
  })();
  inflightFlushes.set(backendId, flush);
  return flush;
}

/**
 * Apply a peer's state vector to its backend's pending-out cursor
 * (Phase C C16): envelopes the peer already has are dropped so the
 * subsequent flush doesn't re-send them. Called by the per-wire
 * handshake's post-SYNCED hook. No-op when no queue is installed.
 */
export async function applyPeerStateVectorToPendingOut(backendId: string, peerVector: StateVector): Promise<void> {
  if (!pendingQueue) return;
  await prunePendingOutByPeerVector(pendingQueue, backendId, peerVector);
}

/** Test-only — counts envelopes dropped because no queue was installed. */
export function __getDroppedNoQueueCount(): number {
  return droppedNoQueue;
}

/** Test-only — reset internal counters between cases. */
export function __resetMutationForwarderForTests(): void {
  pendingQueue = null;
  droppedNoQueue = 0;
  loggedDropOnce = false;
  inflightFlushes.clear();
}
