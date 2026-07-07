/**
 * SW-side application-storage inspector for the DevTools panel's Storage
 * tool window. Scope discovery in `scopes.ts`; DOM storage reads and
 * writes via injection in `standard-plane.ts`. Later slices add
 * IndexedDB / Cache Storage readers and CDP-backed invalidation
 * tracking.
 */

export { registerStorageCdpAccess, type StorageCdpAccess } from './cdp-tier';
export { listStorageScopes } from './scopes';
export {
  clearDomStorage,
  getDomStorageEntries,
  getDomStorageValue,
  removeDomStorageItem,
  setDomStorageItem,
} from './standard-plane';
