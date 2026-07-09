/**
 * Outbound side of the web tab's single wire — the single-wire install
 * of the shared outbound mutation plane
 * (`@openheaders/oracle/sync/client/mutation-outbound-plane`), so the
 * gate → route → send/queue → HLC-order flush skeleton is the exact
 * code every other host runs. The port pins the whole plane to the
 * serving daemon: Orgs resolve to {@link WEB_DAEMON_BACKEND_ID} only
 * when bound to it (consume-only join falls out of the tenancy layer —
 * the tab's home-Org data is withheld structurally), and every send
 * goes down the one injected wire sender.
 *
 * Awareness is ephemeral: forwarded when the wire is open, never
 * queued. The wire's send function is injected by `daemon-wire.ts` at
 * install time so this module stays free of transport state.
 */

import { getOrgBackendBindings } from '@openheaders/core/identity';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import type { StateVector } from '@openheaders/core/sync';
import type { OracleAwarenessBroadcast, OracleSyncBroadcastEvent, PendingOutQueue } from '@openheaders/oracle/sync';
import { createOutboundMutationPlane } from '@openheaders/oracle/sync/client/mutation-outbound-plane';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';

type WireSender = (frame: Record<string, unknown>) => boolean;

let sendOverWire: WireSender = () => false;

/** Install the wire's send function. Called once by the wire install. */
export function setWireSender(sender: WireSender): void {
  sendOverWire = sender;
}

const plane = createOutboundMutationPlane({
  // Single wire: an Org routes here only when bound to the serving
  // daemon; anything else resolves nowhere and drops (a stale binding
  // raced a refresh — the daemon-side filters would refuse it anyway).
  resolveBackendId: (orgId) =>
    getOrgBackendBindings().get(orgId) === WEB_DAEMON_BACKEND_ID ? WEB_DAEMON_BACKEND_ID : null,
  send: (_backendId, frame) => sendOverWire(frame),
  // The sender reports falsy when the socket is down, which breaks the
  // drain — no separate connected probe exists for the fixed wire.
  isConnected: () => true,
});

/** Install the pending-out queue. Called once by host boot wiring. */
export function setWirePendingOutQueue(queue: PendingOutQueue | null): void {
  plane.setPendingOutQueue(queue);
}

/** Forward one locally-committed envelope up the wire (or queue it). */
export function forwardMutationOverWire(event: OracleSyncBroadcastEvent): void {
  plane.forward(event);
}

/**
 * Drain the pending-out cursor in HLC order and re-send. Acks per
 * successful send so a wire death mid-flush keeps the remainder for
 * the next flush; concurrent calls coalesce onto one in-flight drain.
 */
export function flushPendingOut(): Promise<void> {
  return plane.flush(WEB_DAEMON_BACKEND_ID);
}

/**
 * Fold the daemon's post-catch-up state vector into the pending-out
 * cursor so the flush skips envelopes the daemon already has.
 */
export async function applyPeerVectorToPendingOut(peerVector: StateVector): Promise<void> {
  await plane.applyPeerVector(WEB_DAEMON_BACKEND_ID, peerVector);
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
