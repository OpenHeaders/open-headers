/**
 * Public installation seam for the DevTools panel's storage inspector.
 *
 * Hosts (extension, web app, electron) call `setStorageInspectorHost(h)`
 * once at boot to register their platform path for enumerating the
 * inspected tab's storage scopes and reading DOM storage. Without an
 * installed host the Storage tool window renders its unavailable state.
 *
 * Mirrors `host-cookie-jar.ts` — same shape, same lifecycle.
 */

export type {
  CacheEntriesPage,
  CacheEntry,
  CacheEntryDocument,
  CacheEntryHeader,
  CacheSummary,
  DomStorageArea,
  DomStorageEntry,
  DomStorageFullValue,
  DomStorageRenameFailure,
  DomStorageRenameResult,
  DomStorageSnapshot,
  IdbDatabase,
  IdbObjectStore,
  IdbRecord,
  IdbRecordDocument,
  IdbRecordPreviewEntry,
  IdbRecordPreviewNode,
  IdbRecordsPage,
  IdbRecordWriteFailure,
  IdbRecordWriteResult,
  SiteDataType,
  StorageInspectorHost,
  StorageInvalidationKind,
  StorageQuota,
  StorageQuotaBreakdownRow,
  StorageScope,
} from './data/storage/storage-inspector-host';
export { getStorageInspectorHost, setStorageInspectorHost } from './data/storage/storage-inspector-host';
