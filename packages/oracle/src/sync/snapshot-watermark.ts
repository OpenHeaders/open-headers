/**
 * The snapshot watermark — the receiver's half of the C5 bootstrap that
 * `snapshot-applier.ts` left open ("HLC watermark coherence").
 *
 * Applying a snapshot re-materializes the sender's post-state as fresh
 * local commits under this host's node, so the fold of this host's
 * rows never covers the sender's nodes. Left there, every later
 * catch-up counts the sender's whole history as missing, and past the
 * snapshot threshold the sender answers with a snapshot again — the
 * whole workspace re-minted on every join. Recording the snapshot's
 * `takenAtHlc` as one host-local row (`snapshot-watermark`) in the
 * workspace's own log closes the loop: `computeStateVectorFromLog`
 * unions the watermark with the fold, the next STATE_VECTOR covers the
 * sender up to the snapshot, and the sender streams only the delta
 * above it (with their original ids, absorbed by the durable dedup on
 * a redelivery). The log stays the one source of truth: the vector is
 * read from rows, a purge drops the watermark with the workspace, a
 * re-joined peer is cold again and bootstraps afresh.
 *
 * Only the wire bootstrap records a watermark. The same applier serves
 * `duplicateWorkspace`, whose snapshot is a fresh authorship event in a
 * new scope with no peer behind it — a watermark there would carry the
 * source scope's node clocks into a scope they never wrote.
 */
import type { WorkspaceSnapshot } from '@openheaders/core/protocol';
import { recordSnapshotWatermark } from '@openheaders/core/sync';

import { applySyncRequest } from './service';
import type { ApplySnapshotOptions } from './snapshot-applier';

/**
 * Record the vector `snapshot` covered as this host's watermark for
 * `snapshot.workspaceId`. Applied like the snapshot's own seeds — an
 * inbound-origin commit the outbound plane never forwards, and
 * host-local besides. An empty vector covers nothing and records
 * nothing.
 */
export async function recordWorkspaceSnapshotWatermark(
  snapshot: Pick<WorkspaceSnapshot, 'workspaceId' | 'takenAtHlc'>,
  options: ApplySnapshotOptions,
): Promise<void> {
  if (Object.keys(snapshot.takenAtHlc).length === 0) return;
  const { batch } = recordSnapshotWatermark(options.makeContext(), { vector: snapshot.takenAtHlc });
  await applySyncRequest({ type: 'oh.sync.apply', batch, applyOrigin: 'inbound' });
}
