/**
 * Pending-out queue ↔ handshake state-vector integration (Phase C C16).
 *
 * After the C1 STATE_VECTOR exchange, both peers know exactly which
 * envelopes the other already has. Envelopes sitting in the local
 * pending-out queue whose HLC is covered by the peer's vector are
 * REDUNDANT — the peer would dedup them via the C11 receive-side
 * seen-set, costing bandwidth without doing useful work. This
 * helper prunes them in one pass.
 *
 * After {@link prunePendingOutByPeerVector} returns, the surviving
 * queue entries are exactly the envelopes the peer is missing from
 * the writer-nodes the queue covers. The reconnect-flush (C15) then
 * sends just those.
 *
 * Pure-ish: the queue does I/O, but the cover-check is a single
 * lex-compare against {@link hlcToString}. O(N) in queue size.
 */
import { hlcToString, type StateVector } from '@openheaders/core/sync';

import type { PendingOutQueue } from './pending-out-queue';

export interface PrunePendingOutResult {
  /** Number of queued envelopes acked because the peer already has them. */
  pruned: number;
  /** Number of queued envelopes that survived (peer is missing them). */
  survived: number;
}

export async function prunePendingOutByPeerVector(
  queue: PendingOutQueue,
  remoteId: string,
  peerVector: StateVector,
): Promise<PrunePendingOutResult> {
  const toAck: string[] = [];
  let survived = 0;
  for await (const env of queue.drain(remoteId)) {
    const peerHlc = peerVector[env.hlc.nodeId];
    if (peerHlc && hlcToString(env.hlc) <= hlcToString(peerHlc)) {
      toAck.push(env.mutationId);
    } else {
      survived++;
    }
  }
  if (toAck.length > 0) await queue.ackAll(remoteId, toAck);
  return { pruned: toAck.length, survived };
}
