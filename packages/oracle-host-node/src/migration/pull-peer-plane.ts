/**
 * Migration pull — the WS-peer face (the migration status log S5 addendum:
 * progress auto-syncs to every connected surface).
 *
 * Two seams, both operator-scoped: the run is started by the host
 * operator and its events carry the operator's collection, environment,
 * and workspace names, so only peers authenticated AS the operator
 * (the extension on this device, another of the operator's devices)
 * ever see them — the same same-user law the awareness fan-out holds.
 *
 *   - `broadcastMigrationPullToPeers` — the runner's broadcast seam
 *     composed host-shell-side beside the local renderer fan-out: every
 *     `migrationPullEvent` goes to operator peers as the SAME
 *     `{ type, payload }` frame shape `OracleWsServer.broadcast` mints,
 *     so a client's inbound frame handler reads one vocabulary.
 *   - `createMigrationPeerRpc` — a {@link WsPeerRpcHooks} plane owning
 *     `oh.migration.postmanPull.getState` for late-joiner hydration
 *     over the wire. Identity-gated (operator only), like the
 *     opt-in tier of the peer requests plane it refuses before any
 *     capability resolution, so no audit row — no capability decision
 *     was made.
 *
 * The server handle comes from the shared `ws-peer-slot`, re-read at
 * send time so bind-supervisor swaps flow through. No server, no
 * identity snapshot, or no operator peers → the frame goes nowhere,
 * never an error.
 */

import { getIdentitySnapshot } from '@openheaders/core/identity';
import type { MigrationPullRunState } from '@openheaders/core/import';
import { getWsPeerServer } from '../daemon/ws-peer-slot';
import type { PeerSummary, WsPeerRpcHooks } from '../host-runtime/ws-server';

const GET_STATE_CHANNEL = 'oh.migration.postmanPull.getState';

/** Honest refusal for a non-operator peer — public-contract channel. */
export const MIGRATION_STATE_OPERATOR_ONLY_MESSAGE =
  'permission denied: migration pull state is only available to the host operator';

function operatorUserId(): string | undefined {
  return getIdentitySnapshot()?.user.id;
}

function isOperatorPeer(peer: PeerSummary): boolean {
  const operator = operatorUserId();
  return operator !== undefined && peer.userId === operator;
}

/**
 * Fan one migration broadcast to the operator's connected WS peers.
 * Shaped as the runner's `broadcast` seam so the host shell composes it
 * verbatim beside its local fan-out.
 */
export function broadcastMigrationPullToPeers(type: string, payload: unknown): void {
  const server = getWsPeerServer();
  if (!server) return;
  server.broadcastFrame({ type, payload }, { filterPeer: isOperatorPeer });
}

export interface MigrationPeerRpcOptions {
  getState(): MigrationPullRunState;
}

/** Peer-plane hydration for the migration pull — operator-gated. */
export function createMigrationPeerRpc(options: MigrationPeerRpcOptions): WsPeerRpcHooks {
  return {
    owns(type: string): boolean {
      return type === GET_STATE_CHANNEL;
    },
    dispatch(_message: Record<string, unknown>, peer): Promise<unknown> {
      const operator = operatorUserId();
      if (operator === undefined || peer.userId !== operator) {
        return Promise.reject(new Error(MIGRATION_STATE_OPERATOR_ONLY_MESSAGE));
      }
      return Promise.resolve(options.getState());
    },
  };
}
