/**
 * Per-peer read authorization for hub fan-out (Phase 5 slice 2).
 *
 * The WS transport fans every committed mutation and awareness frame to
 * all connected peers; with directory users in play that would hand a
 * no-grant peer live data the catch-up gate already refuses. The
 * broadcast callers classify each frame here — one grant resolution per
 * frame, shared across every connected peer of the same user — and pass
 * the verdict down as `broadcastFrame`'s `filterPeer`.
 *
 * The resolution is deliberately per-frame (no cache): grants live in a
 * memory-backed storage slot, so the read is cheap, and a revocation
 * bites the very next frame instead of the next reconnect.
 *
 * Because the resolution is async while the oracle's broadcast hooks are
 * synchronous, {@link createFilteredPeerBroadcast} serializes sends on a
 * promise chain — frames leave in commit order, never reordered by two
 * resolutions racing.
 */

import { hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  type MutationEnvelope,
  workspaceListRowIdForMutation,
} from '@openheaders/core/sync';
import type { OracleWsServer, PeerSummary } from '../host-runtime/ws-server';

const SCOPE = 'peer-read-filter';

/**
 * The workspace id a `__global__` mutation frame's row op governs, or
 * `null` for non-row global frames (the `activeId` pointer, awareness).
 * The frame was minted in-process as a `SyncMutationMessage`; the guard
 * only covers non-mutation frame shapes riding the same queue.
 */
function workspaceListRowIdForFrame(frame: Record<string, unknown>): string | null {
  const envelope = frame.envelope;
  if (!envelope || typeof envelope !== 'object' || !('body' in envelope)) return null;
  return workspaceListRowIdForMutation(envelope as MutationEnvelope);
}

/**
 * Resolve which of the connected peers may read frames for
 * `workspaceId`. The `__global__` scope carries workspace-list metadata
 * (`workspace.list` — any admitted user); real scopes resolve each
 * distinct peer user's `workspace.read`. A `null` userId is the
 * `requireAuth`-off test seam and passes, preserving ungated rigs.
 */
export async function makeWorkspaceReadFilter(
  workspaceId: string,
  peers: readonly PeerSummary[],
): Promise<(peer: PeerSummary) => boolean> {
  if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
    return () => true;
  }
  const decisions = new Map<string, boolean>();
  const userIds = new Set<string>();
  for (const peer of peers) {
    if (peer.userId !== null) userIds.add(peer.userId);
  }
  for (const userId of userIds) {
    const snapshot = await resolveDaemonPeerIdentitySnapshot(userId);
    decisions.set(userId, hasCapability(snapshot, 'workspace.read', { workspaceId }).allow);
  }
  return (peer) => (peer.userId === null ? true : (decisions.get(peer.userId) ?? false));
}

export interface FilteredPeerBroadcast {
  /**
   * Queue one frame for read-filtered fan-out. Sends run strictly in
   * enqueue order; a missing server at send time (mid-rebind, disposed)
   * drops the frame — live peers re-converge via their next catch-up.
   */
  enqueue(
    frame: Record<string, unknown>,
    workspaceId: string,
    opts?: { loopbackOnly?: boolean; excludeNodeId?: string },
  ): void;
}

/**
 * Serialized, read-filtered broadcast front for a late-bound WS server.
 * `getServer` is consulted at send time so the bind supervisor's server
 * swaps flow through without re-wiring.
 */
export function createFilteredPeerBroadcast(getServer: () => OracleWsServer | null): FilteredPeerBroadcast {
  let queue: Promise<void> = Promise.resolve();
  return {
    enqueue(frame, workspaceId, opts) {
      queue = queue
        .then(async () => {
          const server = getServer();
          if (!server) return;
          // Per-row grant gate on the workspace-list scope (Phase 5
          // slice 2): a `__global__` frame carrying a workspace-list
          // row op is read-gated against THAT workspace, so the live
          // delta plane hides exactly the rows catch-up hides. Non-row
          // global frames keep the scope's any-admitted-user posture.
          const rowWorkspaceId =
            workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE ? workspaceListRowIdForFrame(frame) : null;
          const filterPeer = await makeWorkspaceReadFilter(rowWorkspaceId ?? workspaceId, server.listConnectedPeers());
          server.broadcastFrame(frame, { ...opts, filterPeer });
        })
        .catch((err: unknown) => {
          logger.warn(SCOPE, 'filtered broadcast failed', err);
        });
    },
  };
}
