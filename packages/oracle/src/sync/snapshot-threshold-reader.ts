/**
 * Compute the {@link SnapshotThresholdInputs} for a workspace by
 * walking its mutation log once and counting the envelopes the peer
 * is currently missing (per the same delta-stream filter C4 uses).
 *
 * Lives next to the delta-stream + state-vector readers because all
 * three are "walk-the-log-and-fold-against-the-peer" reads — keeping
 * them together means the eventual handshake handler picks them up
 * from one barrel.
 *
 * The byte estimate is opt-in: pass `withByteEstimate: true` to also
 * JSON-stringify each missing envelope and sum the lengths. Off by
 * default — the count threshold is sufficient for v1 and the
 * stringify cost is non-trivial on cold-start large workspaces.
 */
import { authorizedOrgIds, getIdentitySnapshot } from '@openheaders/core/identity';
import {
  filterEnvelopesAgainstPeerAsync,
  filterEnvelopesByOrgAsync,
  type SnapshotThresholdInputs,
  type StateVector,
} from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';
import { acquireScopeLog } from './scope-log-accessor';

export interface ComputeSnapshotThresholdInputsOptions {
  withByteEstimate?: boolean;
}

export async function computeSnapshotThresholdInputsFromLog(
  log: MutationLog,
  peerVector: StateVector,
  options: ComputeSnapshotThresholdInputsOptions = {},
): Promise<SnapshotThresholdInputs> {
  const authorized = authorizedOrgIds(getIdentitySnapshot());
  let count = 0;
  let bytes = 0;
  for await (const env of filterEnvelopesAgainstPeerAsync(
    filterEnvelopesByOrgAsync(log.readSince(null), authorized),
    peerVector,
  )) {
    count++;
    if (options.withByteEstimate) bytes += JSON.stringify(env).length;
  }
  return options.withByteEstimate
    ? { peerVector, estimatedDeltaCount: count, estimatedDeltaBytes: bytes }
    : { peerVector, estimatedDeltaCount: count };
}

export async function computeSnapshotThresholdInputsForWorkspace(
  workspaceId: string,
  peerVector: StateVector,
  options: ComputeSnapshotThresholdInputsOptions = {},
): Promise<SnapshotThresholdInputs> {
  const handle = acquireScopeLog(workspaceId);
  try {
    await handle.hydrated;
    return await computeSnapshotThresholdInputsFromLog(handle.log, peerVector, options);
  } finally {
    handle.release();
  }
}
