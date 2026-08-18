/**
 * `@openheaders/core/backends` — the back-end connection registry
 * (the multi-backend plan). Persisted list under `OH.backends`, mirrored
 * in memory for synchronous reads by connection modules and UI alike.
 */

export {
  __clearBackendsForTests,
  type BackendConnectionPatch,
  type CreateBackendInput,
  createBackend,
  getBackend,
  getBackends,
  getPrimaryBackend,
  isLoopbackBackendUrl,
  refreshBackendsFromHostStorage,
  removeBackend,
  subscribeBackends,
  updateBackend,
  updatePrimaryBackend,
  watchBackendsInHostStorage,
} from './registry';
export { resetBackendReach, setBackendReach, widestBackendReach } from './reach';
export {
  clearBackendOrgConflict,
  pruneBackendOrgConflictsForBackend,
  type RecordBackendOrgConflictInput,
  recordBackendOrgConflict,
} from './org-conflicts';
