/**
 * Host outbound mutation forwarder — Phase C C10.
 *
 * Mirror of the extension SW's outbound path. Every envelope the
 * local oracle commits flows through here; the forwarder writes it
 * to every connected WS peer (extension, future daemon clients) as a
 * top-level `oh.sync.mutation` frame.
 *
 * Two reasons this lives in the Node host layer and not the oracle:
 *
 * 1. The forwarder needs the WS server handle, which is owned by
 *    the boot spine's bind wiring. Each host that has WS peers has
 *    its own forwarder (the extension SW does) with the same shape
 *    but different transport glue.
 * 2. The IPC fan-out to renderers stays on the legacy `syncBroadcast`
 *    channel; only the cross-host wire gets the new `oh.sync.mutation`
 *    framing. Splitting routes here keeps that mapping explicit.
 *
 * **Hub relay semantics.** This host is the fan-out hub: an envelope
 * that arrived from one peer and was applied locally (`applyOrigin ===
 * 'inbound'`) IS relayed to the other connected peers — that's how a
 * mutation minted in one front-end reaches every other front-end live.
 * The originating peer is excluded by its HELLO `nodeId` (the envelope's
 * `hlc.nodeId` names the minting node), so nothing bounces straight
 * back to its sender. Client hosts hold the inverse policy: their
 * forwarders drop inbound-origin events, which is what terminates the
 * relay instead of a seen-set race.
 */

import { SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import { isHostLocalMutation, isSameDeviceOnlyMutation } from '@openheaders/core/sync';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';
import type { OracleWsServer } from '../host-runtime/ws-server';
import { createFilteredPeerBroadcast } from './peer-read-filter';
import { getWsPeerServer, setWsPeerServer } from './ws-peer-slot';

/**
 * Called once during boot wiring after `startOracleWsServer` resolves.
 * Feeds the shared `ws-peer-slot` so other host planes (e.g. the
 * migration pull forwarder) reach the same live server.
 */
export function setMutationForwarderWsServer(server: OracleWsServer | null): void {
  setWsPeerServer(server);
}

/**
 * RBAC read gate on the fan-out (Phase 5 slice 2): each frame resolves
 * which peer users hold `workspace.read` on its workspace before it
 * leaves; the queue keeps frames in commit order across the async
 * resolution. The server is re-read at send time so bind-supervisor
 * swaps flow through.
 */
const filteredBroadcast = createFilteredPeerBroadcast(getWsPeerServer);

export function forwardMutationToWsPeers(event: OracleSyncBroadcastEvent): void {
  if (!getWsPeerServer()) return;
  // Host-local UI state (layout) never rides the wire — same floor as
  // the client outbound gate and the catch-up responder.
  if (isHostLocalMutation(event.envelope)) return;
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
  // Hub relay: local mints go to every peer; inbound-applied envelopes
  // go to every peer EXCEPT the one that minted them (its HELLO nodeId
  // matches the envelope's hlc.nodeId). A local mint's nodeId is this
  // host's own, which never matches a peer, so passing it is a no-op.
  filteredBroadcast.enqueue(frame as unknown as Record<string, unknown>, event.envelope.workspaceId, {
    loopbackOnly,
    excludeNodeId: event.envelope.hlc.nodeId,
  });
}
