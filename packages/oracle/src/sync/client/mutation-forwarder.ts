/**
 * Outbound mutation forwarder — Phase C C7 / C15, generalized to the
 * N-backend connection plane (the multi-backend plan §3).
 *
 * The N-backend install of the shared outbound mutation plane
 * ({@link createOutboundMutationPlane}): every envelope the local
 * oracle commits flows through the plane's gate → route → send/queue
 * skeleton, with the port bound to the connection manager — targets
 * resolve from the Org-binding map and frames go out on the resolved
 * backend's managed wire. The oracle's `broadcastSyncEvent` host hook
 * calls {@link forwardMutationToBackend} per committed envelope; the
 * per-wire handshake's post-SYNCED hook drives
 * {@link applyPeerStateVectorToPendingOut} + {@link flushPendingOutToBackend}.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import type { StateVector } from '@openheaders/core/sync';
import type { OracleSyncBroadcastEvent } from '../host-hooks';
import type { PendingOutQueue } from '../pending-out-queue';
import { isBackendConnected, sendToBackend } from './backend-connection-manager';
import { createOutboundMutationPlane } from './mutation-outbound-plane';

const plane = createOutboundMutationPlane({
  resolveBackendId: (orgId) => getOrgBackendBindings().get(orgId) ?? null,
  send: (backendId, frame) => sendToBackend(backendId, frame),
  isConnected: (backendId) => isBackendConnected(backendId),
});

/**
 * Install the pending-out queue. Called once during boot wiring
 * after the persistence provider has been chosen (default IDB on
 * the extension SW). Without this, the forwarder falls back to
 * count-only drop telemetry.
 */
export function setPendingOutQueue(queue: PendingOutQueue | null): void {
  plane.setPendingOutQueue(queue);
}

/**
 * Observe genuine outbound failures (failed pending-out enqueue, flush
 * died mid-drain) — see {@link OutboundMutationPlane.setFailureObserver}.
 * The host boot wires its failure observability here.
 */
export function setOutboundSyncFailureObserver(fn: ((kind: 'enqueue' | 'flush') => void) | null): void {
  plane.setFailureObserver(fn);
}

/** Forward one locally-committed envelope to its Org's backend (or queue it). */
export function forwardMutationToBackend(event: OracleSyncBroadcastEvent): void {
  plane.forward(event);
}

/**
 * Drain one backend's pending-out cursor in HLC order and re-send each
 * envelope on its wire. Safe to call repeatedly; concurrent calls for
 * the same backend coalesce onto one in-flight promise, while different
 * backends flush independently (invariant 3 — offline edits to backend
 * A's workspace flush to A on A's reconnect, regardless of B's state).
 */
export function flushPendingOutToBackend(backendId: string): Promise<void> {
  return plane.flush(backendId);
}

/**
 * Apply a peer's state vector to its backend's pending-out cursor
 * (Phase C C16): envelopes the peer already has are dropped so the
 * subsequent flush doesn't re-send them. Called by the per-wire
 * handshake's post-SYNCED hook. No-op when no queue is installed.
 */
export async function applyPeerStateVectorToPendingOut(backendId: string, peerVector: StateVector): Promise<void> {
  await plane.applyPeerVector(backendId, peerVector);
}

/** Test-only — counts envelopes dropped because no queue was installed. */
export function __getDroppedNoQueueCount(): number {
  return plane.__getDroppedNoQueueCount();
}

/** Test-only — reset internal counters between cases. */
export function __resetMutationForwarderForTests(): void {
  plane.__reset();
}
