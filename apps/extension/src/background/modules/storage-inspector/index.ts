/**
 * SW-side application-storage inspector for the DevTools panel's Storage
 * tool window. Scope discovery in `scopes.ts`; DOM storage reads via
 * injection in `standard-plane.ts`. Later slices add writes, IndexedDB /
 * Cache Storage readers, and CDP-backed invalidation tracking.
 */

export { listStorageScopes } from './scopes';
export { getDomStorageEntries } from './standard-plane';
