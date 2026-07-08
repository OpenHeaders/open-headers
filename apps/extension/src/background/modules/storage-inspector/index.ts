/**
 * SW-side application-storage inspector for the DevTools panel's Storage
 * tool window. Scope discovery in `scopes.ts`; DOM storage reads and
 * writes via injection in `standard-plane.ts`; IndexedDB paged reads in
 * `standard-plane-idb.ts`. Later slices add Cache Storage readers and
 * CDP-backed invalidation tracking.
 */

export { armIdbTracking, registerStorageCdpAccess, type StorageCdpAccess } from './cdp-tier';
export { listStorageScopes } from './scopes';
export {
  clearDomStorage,
  getDomStorageEntries,
  getDomStorageValue,
  removeDomStorageItem,
  setDomStorageItem,
} from './standard-plane';
export {
  clearIndexedDbStore,
  deleteIndexedDbDatabase,
  deleteIndexedDbRecord,
  getIndexedDbRecords,
  listIndexedDbDatabases,
} from './standard-plane-idb';
