/**
 * Outbound mutation plane — the wire-agnostic core behind every host's
 * mutation forwarder. One instance per host install: the N-backend
 * hosts (`mutation-forwarder.ts`, riding the connection manager) and
 * the web tab's single fixed wire both run this exact gate/queue/flush
 * skeleton; only the {@link OutboundWirePort} differs.
 *
 * Per committed envelope ({@link OutboundMutationPlane.forward}):
 *
 *   1. The shared outbound transport gate (`evaluateOutboundEnvelope` —
 *      echo guard / consumed-Org tenancy / `workspace.write` authz).
 *      Consume-only join falls out of the tenancy layer: home-Org
 *      envelopes are withheld structurally.
 *   2. The port resolves the envelope's target from its Org — an
 *      envelope goes to exactly the backend whose Org set contains its
 *      `orgId` (routing invariant 1); a `null` resolution drops.
 *   3. Send on the target's wire; on failure the envelope lands in the
 *      pending-out queue under that backend's cursor (invariant 3 —
 *      one log, one cursor per backend).
 *
 * Reconnect-flush ({@link OutboundMutationPlane.flush}) drains one
 * backend's cursor in HLC order, re-runs the same gate, re-sends each
 * allowed envelope, and acks on success. An envelope the gate now
 * withholds (echo / own-Org / revoked privilege) is ack-dropped rather
 * than re-flushed forever; one whose Org re-resolved to another backend
 * is re-routed to its new cursor (or ack-dropped when it resolves
 * nowhere). Wire-side dedup makes the replay safe even if the backend
 * already received the envelope before the disconnect.
 *
 * **Threading.** `broadcastSyncEvent` fires synchronously from applies,
 * but enqueue + flush are async. Enqueue is fire-and-forget (preserves
 * apply latency); a single in-flight flush promise per backend prevents
 * concurrent drains from stepping on each other across reconnect
 * storms, while two backends' flushes proceed independently.
 */

import { SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import type { MutationEnvelope, StateVector } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import type { OracleSyncBroadcastEvent } from '../host-hooks';
import { evaluateOutboundEnvelope } from '../outbound-gate';
import { prunePendingOutByPeerVector } from '../pending-out-prune';
import type { PendingOutQueue } from '../pending-out-queue';

const SCOPE = 'SyncForwarder';

/**
 * The host-bound transport edges. The N-backend install routes through
 * the connection manager; the web tab's install closes over its single
 * fixed wire and resolves only Orgs bound to it.
 */
export interface OutboundWirePort {
  /** Owning backend for an Org's envelopes; `null` routes nowhere (drop). */
  resolveBackendId(orgId: string): string | null;
  send(backendId: string, frame: Record<string, unknown>): boolean;
  isConnected(backendId: string): boolean;
}

export interface OutboundMutationPlane {
  /**
   * Install the pending-out queue. Called once during boot wiring after
   * the persistence provider has been chosen. Without this, the plane
   * falls back to count-only drop telemetry.
   */
  setPendingOutQueue(queue: PendingOutQueue | null): void;
  /**
   * Observe genuine outbound failures — a pending-out enqueue that threw
   * (the envelope is at risk of loss) or a flush that died mid-drain.
   * Routine queueing while disconnected never fires. Hosts hang failure
   * observability off this; the plane stays observability-neutral.
   */
  setFailureObserver(fn: ((kind: 'enqueue' | 'flush') => void) | null): void;
  /** Forward one locally-committed envelope up its Org's wire (or queue it). */
  forward(event: OracleSyncBroadcastEvent): void;
  /** Drain one backend's pending-out cursor in HLC order and re-send. */
  flush(backendId: string): Promise<void>;
  /**
   * Fold a peer's post-catch-up state vector into its backend's
   * pending-out cursor: envelopes the peer already has are dropped so
   * the subsequent flush doesn't re-send them. No-op without a queue.
   */
  applyPeerVector(backendId: string, peerVector: StateVector): Promise<void>;
  /** Test-only — envelopes dropped because no queue was installed. */
  __getDroppedNoQueueCount(): number;
  /** Test-only — reset internal state between cases. */
  __reset(): void;
}

function envelopeToFrame(envelope: MutationEnvelope): SyncMutationMessage {
  return {
    type: SYNC_MUTATION_TYPE,
    workspaceId: envelope.workspaceId,
    envelope,
  };
}

export function createOutboundMutationPlane(port: OutboundWirePort): OutboundMutationPlane {
  let pendingQueue: PendingOutQueue | null = null;
  let droppedNoQueue = 0;
  let loggedDropOnce = false;
  let failureObserver: ((kind: 'enqueue' | 'flush') => void) | null = null;
  const inflightFlushes = new Map<string, Promise<void>>();

  const forward = (event: OracleSyncBroadcastEvent): void => {
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
    // Routing invariant 1: exactly the backend the port resolves for the
    // envelope's Org. The tenancy layer above only passes consumed Orgs,
    // and every consumed Org has a binding — a miss means the binding
    // raced a registry removal; drop, the resolver-side filters would
    // refuse it everywhere anyway.
    const backendId = port.resolveBackendId(event.envelope.orgId);
    if (!backendId) {
      logger.debug(SCOPE, `outbound envelope for Org ${event.envelope.orgId} has no backend binding — dropped`);
      return;
    }
    const sent = port.send(backendId, envelopeToFrame(event.envelope) as unknown as Record<string, unknown>);
    if (sent) return;

    if (pendingQueue) {
      void pendingQueue.enqueue(backendId, event.envelope).catch((err) => {
        logger.warn(SCOPE, 'enqueue to pending-out queue failed', err);
        failureObserver?.('enqueue');
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
  };

  const flush = (backendId: string): Promise<void> => {
    const inflight = inflightFlushes.get(backendId);
    if (inflight) return inflight;
    const run = (async () => {
      try {
        if (!pendingQueue) return;
        if (!port.isConnected(backendId)) return;

        const acked: string[] = [];
        for await (const env of pendingQueue.drain(backendId)) {
          if (!port.isConnected(backendId)) break;
          const verdict = evaluateOutboundEnvelope(env);
          if (!verdict.allow) {
            // The gate now withholds this envelope — it echoes a frame the
            // backend already sent, its Org is no longer consumed, or
            // `workspace.write` was revoked between enqueue and flush. Ack
            // to drop it from the queue rather than re-flushing forever.
            acked.push(env.mutationId);
            continue;
          }
          const boundTo = port.resolveBackendId(env.orgId);
          if (boundTo !== backendId) {
            // The Org re-bound (its connection record was re-minted while
            // this envelope sat queued). Re-route to the owning backend's
            // cursor and ack it out of this one.
            if (boundTo) await pendingQueue.enqueue(boundTo, env);
            acked.push(env.mutationId);
            continue;
          }
          const sent = port.send(backendId, envelopeToFrame(env) as unknown as Record<string, unknown>);
          if (!sent) break;
          acked.push(env.mutationId);
        }
        if (acked.length > 0) {
          await pendingQueue.ackAll(backendId, acked);
          logger.info(SCOPE, `flushed ${acked.length} pending envelope(s) to backend`);
        }
      } catch (err) {
        logger.warn(SCOPE, 'pending-out flush failed mid-drain', err);
        failureObserver?.('flush');
      } finally {
        inflightFlushes.delete(backendId);
      }
    })();
    inflightFlushes.set(backendId, run);
    return run;
  };

  return {
    setPendingOutQueue: (queue) => {
      pendingQueue = queue;
    },
    setFailureObserver: (fn) => {
      failureObserver = fn;
    },
    forward,
    flush,
    applyPeerVector: async (backendId, peerVector) => {
      if (!pendingQueue) return;
      await prunePendingOutByPeerVector(pendingQueue, backendId, peerVector);
    },
    __getDroppedNoQueueCount: () => droppedNoQueue,
    __reset: () => {
      pendingQueue = null;
      droppedNoQueue = 0;
      loggedDropOnce = false;
      failureObserver = null;
      inflightFlushes.clear();
    },
  };
}
