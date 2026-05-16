/**
 * Read the current `StateVector` for a workspace by walking its
 * append-only mutation log and folding HLCs per-`nodeId`.
 *
 * Two entry points:
 *
 * - {@link computeStateVectorFromLog} — low-level, takes a
 *   {@link MutationLog} directly. Used by tests + by callers that
 *   already hold a service handle.
 * - {@link readWorkspaceStateVector} — host-facing convenience that
 *   acquires the per-workspace service, reads its log, and releases
 *   in `finally`. Same shape on extension SW and desktop main, so the
 *   eventual handshake handler is host-agnostic.
 *
 * Composed from two pieces:
 *
 * - {@link MutationLog.readSince} — streams every envelope ever
 *   applied (the log is append-only; compaction drops only the
 *   pre-watermark tail and snapshot bootstrap covers the rest).
 * - {@link foldStateVector} in core/sync — pure fold; same function
 *   reused across hosts and tests.
 *
 * The fold is O(N) in mutation count but I/O-bound by the IDB cursor
 * (or SQLite cursor on the desktop side). Handshake is rare (connect +
 * reconnect only) so a streaming fold is cheaper than carrying a
 * cached vector — caches go stale, the log does not. If profiling
 * later shows cold-start latency, the natural optimization is a
 * maintained `Record<nodeId, HLC>` updated on every `append` via
 * {@link advanceStateVector}, not a heavier read path.
 */
import { foldStateVector, type StateVector } from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from './service';

export async function computeStateVectorFromLog(log: MutationLog): Promise<StateVector> {
  const envelopes = [];
  for await (const env of log.readSince(null)) envelopes.push(env);
  return foldStateVector(envelopes);
}

/**
 * Acquire the workspace service, await its hydration, fold its
 * mutation log into a state vector, and release. Safe to call from
 * any host that has booted the sync engine.
 *
 * Mirrors the acquire/release contract used by `applySyncRequest`:
 * the refcount bump survives until the read completes, so a
 * concurrent {@link releaseWorkspaceService} from another caller
 * can't tear the service down mid-fold.
 */
export async function readWorkspaceStateVector(workspaceId: string): Promise<StateVector> {
  const svc = getOrCreateWorkspaceService(workspaceId);
  try {
    await svc.hydrated;
    return await computeStateVectorFromLog(svc.log);
  } finally {
    releaseWorkspaceService(workspaceId);
  }
}
