/**
 * SW-side application-storage inspector for the DevTools panel's Storage
 * tool window. Scope discovery in `scopes.ts`; DOM storage reads and
 * writes via injection in `standard-plane.ts`; IndexedDB paged reads in
 * `standard-plane-idb.ts`; Cache Storage arbitrated in `caches.ts` over
 * the injected (`standard-plane-caches.ts`) and CDP
 * (`cdp-plane-caches.ts`) transports; quota arbitrated the same way in
 * `quota.ts`. CDP-backed storage-key stamping + invalidation tracking in
 * `cdp-tier.ts`.
 */

export {
  deleteCacheStorageCache,
  deleteCacheStorageEntry,
  getCacheStorageEntries,
  listCacheStorageCaches,
} from './caches';
export { armStorageTracking, registerStorageCdpAccess, type StorageCdpAccess } from './cdp-tier';
export { clearSiteData, getStorageQuota } from './quota';
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
