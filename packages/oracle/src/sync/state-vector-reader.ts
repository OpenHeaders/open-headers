/**
 * Read the current `StateVector` for a workspace by walking its
 * append-only mutation log and folding HLCs per-`nodeId`.
 *
 * Composed from two pieces:
 *
 * - {@link MutationLog.readSince} — streams every envelope ever
 *   applied (the log is append-only; compaction drops only the
 *   pre-watermark tail and snapshot bootstrap covers the rest).
 * - {@link foldStateVector} in core/sync — pure fold; same function
 *   reused for desktop main (C3) and tests.
 *
 * The fold is O(N) in mutation count but I/O-bound by the IDB cursor.
 * Handshake is rare (connect + reconnect only) so a streaming fold is
 * cheaper than carrying a cached vector — caches go stale, the log
 * does not. If profiling later shows cold-start latency, the natural
 * optimization is a maintained `Record<nodeId, HLC>` updated on every
 * `append` via {@link advanceStateVector}, not a heavier read path.
 */
import { foldStateVector, type StateVector } from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';

export async function computeStateVectorFromLog(log: MutationLog): Promise<StateVector> {
  const envelopes = [];
  for await (const env of log.readSince(null)) envelopes.push(env);
  return foldStateVector(envelopes);
}
