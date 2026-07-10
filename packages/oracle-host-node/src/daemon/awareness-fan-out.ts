/**
 * Same-user awareness fan-out (Phase 5 slice 2 —
 * DATA_PLANE_TOPOLOGIES.md §9: presence is same-user only).
 *
 * The hub's canonical presence set for a workspace mixes states from
 * every connected surface — the operator's own windows plus each
 * directory user's devices. Fanning that set wholesale would hand every
 * peer every user's live edit patterns, so this module tailors the
 * frame PER RECIPIENT:
 *
 *   - a state reaches a peer only when its stamped `identity.userId`
 *     matches the peer's authenticated user (a peer without a userId is
 *     the `requireAuth`-off test seam and sees everything, preserving
 *     ungated rigs);
 *   - a state never bounces back to the device that published it —
 *     `identity.deviceId` carries the origin's per-device token id
 *     (stamped at ingest), and the recipient's own tokenId is excluded
 *     so a stale relayed copy can't clobber the device's fresher local
 *     row;
 *   - the workspace read gate still applies per peer, same as the
 *     mutation plane's read filter.
 *
 * This is also what makes the hub a presence RELAY: one user's devices
 * see each other's surfaces through the daemon, which the previous
 * own-surfaces-only forward never did. Sends are serialized on a
 * promise chain like the mutation plane's filtered broadcast — frames
 * leave in emission order.
 *
 * An EMPTY original emission ("no presence left in this workspace")
 * still reaches every read-admitted peer so mirrors age rows out
 * proactively; a per-peer subset that merely filters down to empty is
 * not absence and is skipped, mirroring the client forwarder's
 * don't-overwrite-with-absence rule.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type { AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import type { OracleWsServer, PeerSummary } from '../host-runtime/ws-server';
import { makeWorkspaceReadFilter } from './peer-read-filter';

const SCOPE = 'awareness-fan-out';

export interface AwarenessPeerFanOut {
  /**
   * Queue one canonical presence emission for per-peer tailored
   * fan-out. `presence` must already carry ingest/host stamps — this
   * module routes by them, it never mints them.
   */
  enqueue(workspaceId: string, presence: readonly AwarenessState[]): void;
}

/** The subset of `presence` the §9 law lets `peer` see. */
function statesVisibleToPeer(presence: readonly AwarenessState[], peer: PeerSummary): AwarenessState[] {
  return presence.filter((state) => {
    if (state.identity.deviceId !== undefined && state.identity.deviceId === peer.tokenId) return false;
    if (peer.userId === null) return true;
    return state.identity.userId === peer.userId;
  });
}

/**
 * Serialized same-user awareness fan-out against a late-bound WS
 * server. `getServer` is consulted at send time so the bind
 * supervisor's server swaps flow through, matching the mutation plane.
 */
export function createAwarenessPeerFanOut(getServer: () => OracleWsServer | null): AwarenessPeerFanOut {
  let queue: Promise<void> = Promise.resolve();
  return {
    enqueue(workspaceId, presence) {
      queue = queue
        .then(async () => {
          const server = getServer();
          if (!server) return;
          const peers = server.listConnectedPeers();
          if (peers.length === 0) return;
          const readFilter = await makeWorkspaceReadFilter(workspaceId, peers);
          for (const peer of peers) {
            if (!readFilter(peer)) continue;
            const subset = statesVisibleToPeer(presence, peer);
            if (subset.length === 0 && presence.length > 0) continue;
            server.broadcastFrame(
              { type: SYNC_AWARENESS_PRESENCE_TYPE, workspaceId, presence: subset },
              { filterPeer: (p) => p.peerId === peer.peerId },
            );
          }
        })
        .catch((err: unknown) => {
          logger.warn(SCOPE, 'awareness fan-out failed', err);
        });
    },
  };
}
