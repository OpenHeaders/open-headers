/**
 * Live Cache Store — per-workspace cache of workflow-run extractions
 * (see `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * One blob per workspace at `oh.ws.<id>.liveCache`, shaped as:
 *
 *   {
 *     schemaVersion: 5,
 *     version: number,                       // monotonic blob-write counter
 *     runs: Record<string, WorkflowRunCache> // keyed by `${workflowUid}:${envKey}`
 *   }
 *
 * where `envKey = environmentId ?? '__none__'` — the cache is keyed by
 * the active environment at extraction time so switching envs exposes
 * independent cached values per env without a migration.
 *
 * Writes serialize through `withLock(entityLockName(ws, 'live-cache',
 * 'singleton'))` — a single writer per workspace, no lost updates
 * when two tabs fire a manual refresh concurrently. Reads are lock-
 * free; `chrome.storage.local` gives atomic snapshot semantics.
 *
 * Storage semantics:
 *   - `putWorkflowRunCache` on successful refresh writes the new
 *     captures + clears any accumulated failure state.
 *   - `recordRefreshError` on failure increments the consecutive-
 *     failure counter, sets `lastErrorAt/Message/StepId`, and
 *     preserves the previous captures verbatim (atomic-refresh
 *     discipline — a broken refresh never downgrades the last-good
 *     cache).
 *   - `clearWorkflowRunCache` wipes every env-keyed entry for a
 *     workflow. Called when the workflow definition is deleted.
 *   - `markWorkflowDefinitionallyStale` flags every env-keyed entry
 *     for a workflow as wrong-recipe (a material edit landed) without
 *     re-extracting. Used for manual-trigger workflows, which must not
 *     auto-run; a later successful `putWorkflowRunCache` clears it.
 *
 * This store does NOT perform the refresh itself. The chain runner
 * (Phase D) calls the store's write methods after executing a
 * workflow's steps; the scheduler (Phase C) reads the cache to
 * decide when to fire.
 */

export type { WorkflowRunCache } from '@openheaders/core/types';

/** Exported for tests + callers that need to build `runKey` themselves. */
export { envKey, NO_ENV_KEY, runKey } from './blob';
export {
  markExclusiveDegradedForRun,
  markProbeStartForRun,
  recordManualBypassFailureForRun,
  resetCircuitForRun,
} from './circuit-ops';
export {
  type ClearWorkflowRunCacheOptions,
  clearWorkflowRunCache,
  clearWorkflowRunCacheForEnvironment,
  markRunDefinitionallyStale,
  markWorkflowDefinitionallyStale,
} from './invalidation';
export { onLiveCacheStoreChange } from './listeners';
export {
  applySyncedLiveValues,
  type LiveValuePropagator,
  type LiveValueRemover,
  setLiveValuePropagator,
  setLiveValueRemover,
} from './propagation';
export { listAllWorkspaceCaches, purgeLiveCacheForWorkspace, type WorkspaceCacheEntry } from './purge-snapshot';
export { getWorkflowRunCache, listCachesForWorkflow, listWorkflowRunCaches } from './reads';
export {
  putWorkflowRunCache,
  type RefreshErrorInput,
  recordRefreshError,
  type SuccessfulRunInput,
} from './refresh-writes';
