/**
 * Revoke-time workspace retraction — the inverse twin of the grant-time
 * offer (`grant-workspace-offer.ts`; the access-foundation plan §8 F2,
 * S5c).
 *
 * Dropping a WRA row stops the server SERVING a workspace at once (the
 * live plane and catch-up both re-judge `workspace.read` per frame),
 * but nothing removes what the revoked user's open tabs already hold —
 * the replica stays visible until reload. This module closes that gap:
 * when a revoke lands (manual admin RPC, the IdP claims reconcile's
 * revoke leg, or a user leaving a workspace), an
 * `oh.sync.workspaceRetract` frame is pushed to that user's connected
 * sockets and the receiving client evicts the workspace locally.
 *
 * NOT a synced delete, by law (`workspace-eviction.ts`'s header): a
 * remove mutation's tombstone carries a fresh HLC that outranks the
 * server's workspace state for every peer forever, and its retained
 * log rows poison the re-join STATE_VECTOR — a later re-grant could
 * never sync the workspace back. The frame is a per-user control push
 * no other peer can observe; the eviction it triggers is state
 * surgery, minting no mutation anywhere.
 *
 * The revocation is re-judged against a fresh per-call identity
 * snapshot — the inverse of the offer's re-judge: a workspace the user
 * can STILL read (a racing re-grant) is not retracted. Best-effort by
 * design: a failed retraction logs and the revoke stands — the tab
 * converges on its next reload-and-re-gate, exactly today's behavior.
 */

import { hasCapability, resolveDaemonPeerIdentitySnapshot } from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { SYNC_WORKSPACE_RETRACT_TYPE, type SyncWorkspaceRetractMessage } from '@openheaders/core/protocol';
import type { OracleWsServer } from '../host-runtime/ws-server';

const SCOPE = 'grant-workspace-retract';

/**
 * Push `oh.sync.workspaceRetract` frames for `workspaceIds` to the
 * connected sockets of `userId`, re-judging each id against the user's
 * fresh snapshot first (a workspace the user still reads — a racing
 * re-grant — retracts nothing). Returns the number of frames sent.
 */
export async function retractWorkspaceRowsFromUserPeers(
  userId: string,
  workspaceIds: readonly string[],
  getWsServer: () => OracleWsServer | null,
): Promise<number> {
  try {
    const server = getWsServer();
    if (!server || workspaceIds.length === 0) return 0;
    if (!server.listConnectedPeers().some((peer) => peer.userId === userId)) return 0;

    const snapshot = await resolveDaemonPeerIdentitySnapshot(userId);
    const retracted = workspaceIds.filter(
      (workspaceId) => !hasCapability(snapshot, 'workspace.read', { workspaceId }).allow,
    );

    let sent = 0;
    for (const workspaceId of retracted) {
      const frame: SyncWorkspaceRetractMessage = { type: SYNC_WORKSPACE_RETRACT_TYPE, workspaceId };
      server.broadcastFrame(frame as unknown as Record<string, unknown>, {
        filterPeer: (peer) => peer.userId === userId,
      });
      sent++;
    }
    if (sent > 0) {
      logger.info(SCOPE, `retracted ${sent} workspace(s) from connected sockets of user=${userId}`);
    }
    return sent;
  } catch (err) {
    logger.warn(SCOPE, `workspace retraction failed for user=${userId}; tabs converge on reload`, err);
    return 0;
  }
}
