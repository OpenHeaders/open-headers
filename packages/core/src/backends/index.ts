/**
 * `@openheaders/core/backends` — the back-end connection registry
 * (MULTI_BACKEND_PLAN.md). Persisted list under `OH.backends`, mirrored
 * in memory for synchronous reads by connection modules and UI alike.
 */

export {
  __clearBackendsForTests,
  type BackendConnectionPatch,
  getBackends,
  getPrimaryBackend,
  isLoopbackBackendUrl,
  refreshBackendsFromHostStorage,
  subscribeBackends,
  updatePrimaryBackend,
  watchBackendsInHostStorage,
} from './registry';
