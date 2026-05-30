/**
 * Desktop main outbound mutation forwarder — Phase C C10.
 *
 * Mirror of the extension SW's outbound path. Every envelope the
 * local oracle commits flows through here; the forwarder writes it
 * to every connected WS peer (extension, future daemon clients) as a
 * top-level `oh.sync.mutation` frame.
 *
 * Two reasons this lives in `apps/desktop/` and not the oracle:
 *
 * 1. The forwarder needs the WS server handle, which is owned by
 *    the desktop's boot wiring. Each host that has WS peers will
 *    have its own forwarder (extension SW already does; future
 *    daemon will too) with the same shape but different transport
 *    glue.
 * 2. The IPC fan-out to renderers stays on the legacy `syncBroadcast`
 *    channel; only the cross-host wire gets the new `oh.sync.mutation`
 *    framing. Splitting routes here keeps that mapping explicit.
 *
 * **Echo prevention.** The forwarder consults
 * {@link hasRecentlyApplied} (from the shared mutation-stream bridge
 * the receive path populates) so an envelope that arrived from a
 * peer and was applied locally does not bounce back to that peer's
 * neighbors as a fresh broadcast. The seen-set is host-process-wide,
 * shared between receive + forward sides.
 */

import { SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import { isSameDeviceOnlyMutation } from '@openheaders/core/sync';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import { hasRecentlyApplied } from '@openheaders/oracle/sync';
import type { OracleWsServer } from '@openheaders/oracle-host-node/host-runtime/ws-server';

let wsServer: OracleWsServer | null = null;

/** Called once during boot wiring after `startOracleWsServer` resolves. */
export function setMutationForwarderWsServer(server: OracleWsServer | null): void {
  wsServer = server;
}

export function forwardMutationToWsPeers(event: OracleSyncBroadcastEvent): void {
  if (!wsServer) return;
  if (hasRecentlyApplied(event.envelope.mutationId)) return;
  const frame: SyncMutationMessage = {
    type: SYNC_MUTATION_TYPE,
    workspaceId: event.envelope.workspaceId,
    envelope: event.envelope,
  };
  // WS-B reach gate: a vault mutation carries a root secret (TOTP seed)
  // in its payload and must reach same-device (loopback) peers only.
  // Classify here (we hold the typed envelope); the transport enforces
  // the per-socket reach.
  const loopbackOnly = isSameDeviceOnlyMutation(event.envelope);
  wsServer.broadcastFrame(frame as unknown as Record<string, unknown>, { loopbackOnly });
}
