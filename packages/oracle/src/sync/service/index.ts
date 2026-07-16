/**
 * Sync service — per-workspace `WorkspaceServiceState` map.
 *
 * Foundation for MWPT-FULL: every resident workspace has its own
 * oracle, IDB log, broadcast bus, caches, HLC sequencer, and awareness
 * store. Services are created lazily on first reference, kept alive by
 * a refcount, and disposed after a grace period when refcount reaches
 * zero. `applySyncRequest` routes batches by `batch.workspaceId` so
 * cross-workspace concurrent writes stay structurally partitioned.
 *
 * One workspace at a time is the *Active* workspace — its broadcast
 * feeds the Active-bound DNR + resolver-invalidate runners, and
 * SW-internal consumers in `background/modules/` reach for its caches
 * through {@link getActiveCacheForRegistration}. Caches themselves are
 * owned by the workspace's {@link WorkspaceServiceState.caches} array
 * for the workspace's whole residency window, regardless of whether it
 * is currently Active.
 *
 * Lifecycle helpers (1a-scope):
 *   - `getOrCreateWorkspaceService(id)` — lazy + refcount++; returns slot.
 *   - `releaseWorkspaceService(id)` — refcount--; schedules disposal
 *     after `graceMs` if refcount reaches 0; cancellable on re-acquire.
 *   - `disposeWorkspace(id)` — forced disposal (workspace deletion).
 *
 * Refcount sources in 1a:
 *   - Active pointer holds one ref while pointing at the workspace.
 *   - In-flight `applySyncRequest` brackets a ref via `try/finally`.
 *   Lifeline-driven refs and per-workspace runners arrive in later
 *   foundation commits.
 *
 * Hydration gate. Each service exposes a `hydrated: Promise<void>` that
 * `applySyncRequest` awaits before calling `oracle.apply`. Today the
 * oracle is constructed synchronously, so the promise resolves
 * immediately; the contract is in place so a future async seed-from-
 * storage step can extend it without callers changing.
 */
export {
  getActiveCacheForRegistration,
  getCacheForWorkspace,
  getOracleForCurrentWorkspace,
  getOracleForWorkspace,
  nextSwMutatorContext,
  nextSwMutatorContextForWorkspace,
} from './accessors';
export {
  dispose,
  initSyncService,
  reinitForWorkspace,
  type SetActiveResult,
  setRuntimeActive,
} from './active';
export { applySyncRequest } from './apply';
export {
  getAwarenessStoreForCurrentWorkspace,
  getAwarenessStoreForWorkspace,
  publishAwareness,
  removeAwarenessByInstanceId,
  snapshotAwarenessPresence,
} from './awareness-api';
export {
  acquireResidentWorkspaceService,
  disposeWorkspace,
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
} from './lifecycle';
export {
  snapshotCollectionPostStates,
  snapshotEnvironmentPostStates,
  snapshotFilesPostStates,
  snapshotFolderPostStates,
  snapshotLayoutStatePostStates,
  snapshotLiveFallbackPriorityPostStates,
  snapshotLiveValuePostStates,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
  snapshotOAuthBundlePostStates,
  snapshotPauseMarkersPostStates,
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
  snapshotResponseExamplePostStates,
  snapshotRulePostStates,
  snapshotScriptPackagePostStates,
  snapshotSpecPostStates,
  snapshotTemplateCollectionPostStates,
  snapshotTemplateFolderPostStates,
  snapshotTemplatePostStates,
  snapshotVaultPostStates,
  snapshotWorkspaceVariablesPostStates,
} from './snapshots';
export {
  __initSyncServiceForTests,
  __setGracePeriodMsForTests,
  __setWireDepsFactoryForTests,
  type SyncServiceTestDeps,
} from './testing';
export type { WorkspaceServiceState } from './types';
