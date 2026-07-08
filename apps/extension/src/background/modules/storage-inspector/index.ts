/**
 * SW-side application-storage inspector for the DevTools panel's Storage
 * tool window. Scope discovery in `scopes.ts`; DOM storage reads and
 * writes via injection in `standard-plane.ts`; IndexedDB paged reads in
 * `standard-plane-idb.ts`; Cache Storage paged reads in
 * `standard-plane-caches.ts`. CDP-backed invalidation tracking in
 * `cdp-tier.ts`.
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
export { getCacheStorageEntries, listCacheStorageCaches } from './standard-plane-caches';
export {
  clearIndexedDbStore,
  deleteIndexedDbDatabase,
  deleteIndexedDbRecord,
  getIndexedDbRecords,
  listIndexedDbDatabases,
} from './standard-plane-idb';
