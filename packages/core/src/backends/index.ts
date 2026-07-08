/**
 * `@openheaders/core/backends` — the back-end connection registry
 * (MULTI_BACKEND_PLAN.md). Persisted list under `OH.backends`, mirrored
 * in memory for synchronous reads by connection modules and UI alike.
 */

export {
  __clearBackendsForTests,
  type BackendConnectionPatch,
  getBackend,
  getBackends,
  getPrimaryBackend,
  isLoopbackBackendUrl,
  refreshBackendsFromHostStorage,
  subscribeBackends,
  updateBackend,
  updatePrimaryBackend,
  watchBackendsInHostStorage,
} from './registry';
