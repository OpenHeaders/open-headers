/**
 * Grant-time workspace offer — the live half of the zero-grant landing
 * (Phase 2 slice 3).
 *
 * Workspace fan-out to a peer happens once, at handshake: the
 * `__global__` catch-up streams the workspace-list rows the peer's user
 * may read, and the live delta plane only relays rows when they MUTATE.
 * A grant mutates no row — it changes who may read one — so a workspace
 * granted while the user's socket is up would stay invisible until the
 * next reconnect. This module closes that gap: when a grant lands
 * (manual admin RPC or the IdP claims reconcile), the granted
 * workspace's list-row envelopes are replayed from the `__global__` log
 * to that user's connected sockets as ordinary live mutation frames.
 *
 * The read authorization is the handshake's own resolution — a fresh
 * per-call identity snapshot judged by `workspace.read`, exactly like
 * the catch-up row filter and the live-plane peer filter — never a
 * parallel computation. Envelopes the peer already holds are absorbed
 * by its `mutationId` dedup, the same contract that covers the
 * row-filtered catch-up's forced replay. Best-effort by design: a
 * failed offer logs and the grant stands — the peer converges on its
 * next reconnect.
 */

import { hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { SYNC_MUTATION_TYPE, type SyncMutationMessage } from '@openheaders/core/protocol';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  isHostLocalMutation,
  isSameDeviceOnlyMutation,
  workspaceListRowIdForMutation,
} from '@openheaders/core/sync';
import { readWorkspaceDeltaStream } from '@openheaders/oracle/sync';
import type { OracleWsServer } from '../host-runtime/ws-server';

const SCOPE = 'grant-workspace-offer';

/**
 * Replay the `__global__` workspace-list rows for `workspaceIds` to the
 * connected sockets of `userId`, re-judging each id against the user's
 * fresh snapshot first (a racing revoke or deactivation offers
 * nothing). Returns the number of frames sent.
 */
export async function offerWorkspaceRowsToUserPeers(
  userId: string,
  workspaceIds: readonly string[],
  getWsServer: () => OracleWsServer | null,
): Promise<number> {
  try {
    const server = getWsServer();
    if (!server || workspaceIds.length === 0) return 0;
    if (!server.listConnectedPeers().some((peer) => peer.userId === userId)) return 0;

    const snapshot = await resolveDaemonPeerIdentitySnapshot(userId);
    const admitted = new Set(
      workspaceIds.filter((workspaceId) => hasCapability(snapshot, 'workspace.read', { workspaceId }).allow),
    );
    if (admitted.size === 0) return 0;

    let sent = 0;
    for await (const envelope of readWorkspaceDeltaStream(EXTENSION_WORKSPACE_GLOBAL_SCOPE, {})) {
      if (isHostLocalMutation(envelope)) continue;
      // The target sockets may be off-device — hold the same-device-only
      // floor even though workspace metadata never carries one today.
      if (isSameDeviceOnlyMutation(envelope)) continue;
      const rowWorkspaceId = workspaceListRowIdForMutation(envelope);
      if (rowWorkspaceId === null || !admitted.has(rowWorkspaceId)) continue;
      const frame: SyncMutationMessage = {
        type: SYNC_MUTATION_TYPE,
        workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
        envelope,
      };
      server.broadcastFrame(frame as unknown as Record<string, unknown>, {
        filterPeer: (peer) => peer.userId === userId,
      });
      sent++;
    }
    if (sent > 0) {
      logger.info(SCOPE, `offered ${sent} workspace-list row(s) to connected sockets of user=${userId}`);
    }
    return sent;
  } catch (err) {
    logger.warn(SCOPE, `workspace offer failed for user=${userId}; peers converge on reconnect`, err);
    return 0;
  }
}
