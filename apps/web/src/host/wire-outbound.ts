/**
 * Outbound side of the web tab's single wire — the one-backend analog
 * of the extension SW's mutation forwarder (invariants unchanged):
 *
 *   - Every locally-committed envelope runs through the shared
 *     outbound transport gate ({@link evaluateOutboundEnvelope}: reach
 *     floor, echo guard, consumed-Org tenancy, `workspace.write`
 *     authz). Consume-only join falls out of the tenancy layer — the
 *     tab's own home-Org data is withheld structurally, so the local
 *     workspace never pollutes the daemon.
 *   - An allowed envelope goes up the wire when it is open; otherwise
 *     it lands in the IDB pending-out queue under the fixed backend
 *     cursor and the post-SYNCED flush drains it in HLC order.
 *   - Awareness is ephemeral: forwarded when the wire is open, never
 *     queued.
 *
 * The wire's send function is injected by `daemon-wire.ts` at install
 * time so this module stays free of transport state.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { SYNC_AWARENESS_PRESENCE_TYPE, SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import type { MutationEnvelope, StateVector } from '@openheaders/core/sync';
import type { OracleAwarenessBroadcast, OracleSyncBroadcastEvent, PendingOutQueue } from '@openheaders/oracle/sync';
import { evaluateOutboundEnvelope, prunePendingOutByPeerVector } from '@openheaders/oracle/sync';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';

const SCOPE = 'WireOutbound';

type WireSender = (frame: Record<string, unknown>) => boolean;

let sendOverWire: WireSender = () => false;
let pendingQueue: PendingOutQueue | null = null;
let inflightFlush: Promise<void> | null = null;

/** Install the wire's send function. Called once by the wire install. */
export function setWireSender(sender: WireSender): void {
  sendOverWire = sender;
}

/** Install the pending-out queue. Called once by host boot wiring. */
export function setWirePendingOutQueue(queue: PendingOutQueue | null): void {
  pendingQueue = queue;
}

function envelopeToFrame(envelope: MutationEnvelope): SyncMutationMessage {
  return {
    type: SYNC_MUTATION_TYPE,
    workspaceId: envelope.workspaceId,
    envelope,
  };
}

/** Forward one locally-committed envelope up the wire (or queue it). */
export function forwardMutationOverWire(event: OracleSyncBroadcastEvent): void {
  // Peer-sourced content (live delta via the bridge, snapshot bootstrap
  // re-seed) must never bounce back to the daemon — only local edits go
  // up. The gate's echo layer stays for the pending-out flush path.
  if (event.applyOrigin === 'inbound') return;
  const verdict = evaluateOutboundEnvelope(event.envelope);
  if (!verdict.allow) {
    if (verdict.layer !== 'echo') {
      logger.debug(SCOPE, `outbound envelope withheld (${verdict.layer}): ${verdict.reason ?? ''}`);
    }
    return;
  }
  // Single wire: the envelope's Org must be the daemon's joined Org. A
  // miss means the binding raced a refresh — drop; the daemon-side
  // filters would refuse it anyway.
  if (getOrgBackendBindings().get(event.envelope.orgId) !== WEB_DAEMON_BACKEND_ID) {
    logger.debug(SCOPE, `outbound envelope for Org ${event.envelope.orgId} has no wire binding — dropped`);
    return;
  }
  if (sendOverWire(envelopeToFrame(event.envelope) as unknown as Record<string, unknown>)) return;

  if (!pendingQueue) {
    logger.info(SCOPE, 'no pending-out queue installed; outbound envelope dropped');
    return;
  }
  void pendingQueue.enqueue(WEB_DAEMON_BACKEND_ID, event.envelope).catch((err: unknown) => {
    logger.warn(SCOPE, 'enqueue to pending-out queue failed', err);
  });
}

/**
 * Drain the pending-out cursor in HLC order and re-send. Acks per
 * successful send so a wire death mid-flush keeps the remainder for
 * the next flush; concurrent calls coalesce onto one in-flight drain.
 */
export function flushPendingOut(): Promise<void> {
  if (inflightFlush) return inflightFlush;
  const flush = (async () => {
    try {
      if (!pendingQueue) return;
      const acked: string[] = [];
      for await (const env of pendingQueue.drain(WEB_DAEMON_BACKEND_ID)) {
        const verdict = evaluateOutboundEnvelope(env);
        if (!verdict.allow) {
          // Withheld now (echo / no-longer-consumed / revoked) — ack to
          // drop rather than re-flushing forever.
          acked.push(env.mutationId);
          continue;
        }
        if (getOrgBackendBindings().get(env.orgId) !== WEB_DAEMON_BACKEND_ID) {
          acked.push(env.mutationId);
          continue;
        }
        if (!sendOverWire(envelopeToFrame(env) as unknown as Record<string, unknown>)) break;
        acked.push(env.mutationId);
      }
      if (acked.length > 0) {
        await pendingQueue.ackAll(WEB_DAEMON_BACKEND_ID, acked);
        logger.info(SCOPE, `flushed ${acked.length} pending envelope(s) to the daemon`);
      }
    } catch (err) {
      logger.warn(SCOPE, 'pending-out flush failed mid-drain', err);
    } finally {
      inflightFlush = null;
    }
  })();
  inflightFlush = flush;
  return flush;
}

/**
 * Fold the daemon's post-catch-up state vector into the pending-out
 * cursor so the flush skips envelopes the daemon already has.
 */
export async function applyPeerVectorToPendingOut(peerVector: StateVector): Promise<void> {
  if (!pendingQueue) return;
  await prunePendingOutByPeerVector(pendingQueue, WEB_DAEMON_BACKEND_ID, peerVector);
}

/**
 * Forward an awareness presence emission up the wire. Only this tab's
 * own surfaces go up (`appId === 'web'`) so peer-received states never
 * loop; an all-peer emission is not overwritten with our absence.
 */
export function forwardAwarenessOverWire(event: OracleAwarenessBroadcast): void {
  const localOnly = event.presence.filter((s) => s.identity.appId === 'web');
  if (localOnly.length === 0 && event.presence.length > 0) return;
  const orgId = getWorkspace(event.workspaceId)?.orgId;
  if (!orgId || getOrgBackendBindings().get(orgId) !== WEB_DAEMON_BACKEND_ID) return;
  sendOverWire({
    type: SYNC_AWARENESS_PRESENCE_TYPE,
    workspaceId: event.workspaceId,
    presence: localOnly,
  });
}
