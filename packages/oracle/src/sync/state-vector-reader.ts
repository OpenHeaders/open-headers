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
 * Composed from three pieces:
 *
 * - {@link MutationLog.readSince} — streams every envelope ever
 *   applied (the log is append-only; compaction drops only the
 *   pre-watermark tail and snapshot bootstrap covers the rest).
 * - {@link filterEnvelopesByOrgAsync} — transport-boundary org filter
 *   (UNIFIED_ORACLE_MODEL.md §6.1, §8.2). Envelopes whose `orgId` is
 *   not in the host's authorized Org set are skipped. With the
 *   denormalized `(workspaceId, orgId)` index this is the cheap
 *   "WHERE org_id IN (authorized set)" predicate the doc calls for;
 *   we apply it here instead of in the storage backend so the rule
 *   lives in one place (core, host-neutral) for both IDB and SQLite.
 * - {@link foldStateVector} in core/sync — pure fold over the
 *   filtered stream.
 *
 * The fold is O(N) in mutation count but I/O-bound by the IDB cursor
 * (or SQLite cursor on the desktop side). Handshake is rare (connect +
 * reconnect only) so a streaming fold is cheaper than carrying a
 * cached vector — caches go stale, the log does not. If profiling
 * later shows cold-start latency, the natural optimization is a
 * maintained `Record<nodeId, HLC>` updated on every `append` via
 * {@link advanceStateVector}, not a heavier read path.
 *
 * Pre-bootstrap / null identity snapshot → empty authorized set →
 * empty state vector. Matches §6.5.3 step 4 ("new team peers see
 * snapshot-bootstrap, not history-replay").
 */
import { authorizedOrgIds, getIdentitySnapshot } from '@openheaders/core/identity';
import { filterEnvelopesByOrgAsync, foldStateVector, type StateVector } from '@openheaders/core/sync';

import type { MutationLog } from './mutation-log';
import { acquireScopeLog } from './scope-log-accessor';

export async function computeStateVectorFromLog(log: MutationLog): Promise<StateVector> {
  const authorized = authorizedOrgIds(getIdentitySnapshot());
  const envelopes = [];
  for await (const env of filterEnvelopesByOrgAsync(log.readSince(null), authorized)) {
    envelopes.push(env);
  }
  return foldStateVector(envelopes);
}

/**
 * Acquire the scope's log (per-workspace or the `__global__`
 * workspace-list scope), await hydration, fold into a state vector,
 * and release. Safe to call from any host that has booted the sync
 * engine.
 *
 * Mirrors the acquire/release contract used by `applySyncRequest`:
 * the refcount bump survives until the read completes, so a
 * concurrent release from another caller can't tear the service down
 * mid-fold.
 */
export async function readWorkspaceStateVector(workspaceId: string): Promise<StateVector> {
  const handle = acquireScopeLog(workspaceId);
  try {
    await handle.hydrated;
    return await computeStateVectorFromLog(handle.log);
  } finally {
    handle.release();
  }
}
