/**
 * Host seam for the Storage tool window's data plane.
 *
 * Hosts install a `StorageInspectorHost` once at boot (the extension
 * routes each method to an SW RPC — `install-storage-inspector.ts`);
 * without one, every read resolves `null` and the panel renders its
 * "unavailable on this host" empty state. Same lifecycle as the
 * cookie-jar fetcher seam (`cookie-jar-cache.ts`).
 *
 * Shapes are host-neutral mirrors of the wire types in
 * `@openheaders/core/bridge` — kept separate so this package carries no
 * dependency on any specific transport.
 */

export type DomStorageArea = 'local' | 'session';

/** One inspectable origin of the inspected tab (main frame first). */
export interface StorageScope {
  frameId: number;
  origin: string;
  url: string;
  isMainFrame: boolean;
  /** Serialized storage key — present only while the host's CDP tier can
   *  observe it (attached tab). Display-only partition evidence. */
  storageKey?: string;
}

/** One DOM storage entry; `clipped` marks a preview-capped value. */
export interface DomStorageEntry {
  key: string;
  value: string;
  valueLength: number;
  clipped?: boolean;
}

export interface DomStorageSnapshot {
  entries: ReadonlyArray<DomStorageEntry>;
  truncated: boolean;
}

/**
 * A clipped entry's full value, fetched lazily before an edit.
 * `value: null` with `tooLarge` means the value is past the host's
 * sanity ceiling and can't be edited; `null` without it means the key
 * is gone or the frame can't be read.
 */
export interface DomStorageFullValue {
  value: string | null;
  tooLarge: boolean;
}

/** One object store's shape; `keyPath` is a display string (composite
 *  paths comma-joined), absent for out-of-line keys. */
export interface IdbObjectStore {
  name: string;
  keyPath?: string;
  autoIncrement: boolean;
  indexNames: ReadonlyArray<string>;
}

export interface IdbDatabase {
  name: string;
  version: number;
  objectStores: ReadonlyArray<IdbObjectStore>;
}

/**
 * One record, preview-serialized in-page — never the value itself.
 * `primaryKeyWire` is the host's opaque lossless key encoding, present
 * for every practical primary key; the rare record without one can't
 * be deleted.
 */
export interface IdbRecord {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
  primaryKeyWire?: string;
}

/** `truncated` means more records exist past this page. */
export interface IdbRecordsPage {
  records: ReadonlyArray<IdbRecord>;
  truncated: boolean;
}

/** One entry of a preview container — `key` is the full display prefix
 *  (`"name": `, `0: `, `"a" => `), rendered host-side. */
export interface IdbRecordPreviewEntry {
  key: string;
  node: IdbRecordPreviewNode;
}

/**
 * Bounded, type-tagged preview tree of a non-JSON record value — what
 * the editor's Preview mode expands. `atom` leaves are real JSON
 * scalars (`type` picks the syntax color) or console vocabulary
 * (`tag`); `container` nodes carry a summary label plus entries,
 * already capped host-side.
 */
export type IdbRecordPreviewNode =
  | { kind: 'atom'; type: 'string' | 'number' | 'boolean' | 'null' | 'tag'; text: string }
  | { kind: 'container'; label: string; entries: ReadonlyArray<IdbRecordPreviewEntry> };

/**
 * One record's value as a full text document, serialized host-side (the
 * value itself never crosses the seam). `editable: true` means the text
 * is exact JSON that round-trips through `JSON.parse`; `false` marks a
 * readable JSON-ish rendering of non-JSON structured-clone content,
 * accompanied by `preview` — the bounded tree Preview mode expands.
 * `truncated` marks a document cut at the host's size cap.
 */
export interface IdbRecordDocument {
  text: string;
  editable: boolean;
  truncated?: boolean;
  preview?: IdbRecordPreviewNode;
}

/**
 * Why a record write was rejected: `parse` — the edited text isn't
 * valid JSON; `key-changed` — the store keeps its key inside the value
 * and the edit moved it (saving would create a new record);
 * `gone` — the database/store/record can't be reached; `write` — the
 * put transaction itself failed (quota, constraint).
 */
export type IdbRecordWriteFailure = 'parse' | 'key-changed' | 'gone' | 'write';

/** Outcome of a record write; `reason` explains a failure when the
 *  host can tell (absent ⇒ generic failure). */
export interface IdbRecordWriteResult {
  ok: boolean;
  reason?: IdbRecordWriteFailure;
}

/** One named cache of the scope's Cache Storage. */
export interface CacheSummary {
  name: string;
}

/**
 * One Cache Storage entry — request metadata plus two response-metadata
 * columns (the list never touches stored response bodies).
 * `headersPreview` is a bounded join of the request headers, absent when
 * the request carries none; `contentLength` mirrors the stored
 * response's `content-length` header, absent when the header is;
 * `responseTimeMs` is the response's storage wall time, present only
 * when the host's CDP tier answered.
 */
export interface CacheEntry {
  url: string;
  method: string;
  headersPreview?: string;
  contentLength?: number;
  responseTimeMs?: number;
}

/** `truncated` means more entries exist past this page. */
export interface CacheEntriesPage {
  entries: ReadonlyArray<CacheEntry>;
  truncated: boolean;
}

/**
 * One cache entry's stored response, preview-serialized host-side —
 * status line, a bounded response-headers join, and a byte-capped body
 * slice (`bodyBase64` marks a binary body shipped base64;
 * `bodyTruncated` marks a preview that stopped at the cap while
 * `bodyLength` carries the full byte size).
 */
export interface CacheEntryResponsePreview {
  status: number;
  statusText: string;
  headersPreview?: string;
  bodyPreview: string;
  bodyBase64?: boolean;
  bodyLength: number;
  bodyTruncated?: boolean;
}

/** One per-type row of a storage usage breakdown (attached tabs only). */
export interface StorageQuotaBreakdownRow {
  storageType: string;
  usage: number;
}

/**
 * A scope's storage usage against its origin quota, in bytes.
 * `breakdown` is present only when the host's CDP tier answered — the
 * standard plane reports totals only. `overrideActive` marks a
 * simulated quota (attached tabs only, see `setQuotaOverride`).
 */
export interface StorageQuota {
  usage: number;
  quota: number;
  breakdown?: ReadonlyArray<StorageQuotaBreakdownRow>;
  overrideActive?: boolean;
}

/** The origin-scoped site-data types the clear gesture can remove. */
export type SiteDataType = 'cacheStorage' | 'cookies' | 'indexedDB' | 'localStorage' | 'serviceWorkers';

/** Which storage type a host-pushed invalidation says went stale. */
export type StorageInvalidationKind = 'indexeddb' | 'cachestorage';

export interface StorageInspectorHost {
  listScopes(tabId: number): Promise<ReadonlyArray<StorageScope> | null>;
  readDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<DomStorageSnapshot | null>;
  readDomStorageValue(
    tabId: number,
    frameId: number,
    area: DomStorageArea,
    key: string,
  ): Promise<DomStorageFullValue | null>;
  /** Add or overwrite one entry; resolves `false` on failure (quota, frame gone). */
  writeDomStorage(tabId: number, frameId: number, area: DomStorageArea, key: string, value: string): Promise<boolean>;
  removeDomStorage(tabId: number, frameId: number, area: DomStorageArea, key: string): Promise<boolean>;
  clearDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<boolean>;
  /** Enumerate the scope's IndexedDB databases; `null` when unreadable. */
  listIndexedDb(tabId: number, frameId: number): Promise<ReadonlyArray<IdbDatabase> | null>;
  /** Cursor-paged, preview-serialized read of one object store;
   *  `index` scopes the read to one of the store's indexes (the key
   *  column becomes the index key, record identity stays the primary
   *  key). */
  readIndexedDbRecords(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    page: number,
    pageSize: number,
    index?: string,
  ): Promise<IdbRecordsPage | null>;
  /** Lazy one-shot fetch of one record's value as a full text document;
   *  `null` when the record is gone or the frame can't be read. */
  readIndexedDbRecordDocument(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    primaryKeyWire: string,
  ): Promise<IdbRecordDocument | null>;
  /** Write one record's value back from its edited document text —
   *  same-key only, exact-JSON documents only (see the wire contract). */
  writeIndexedDbRecord(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    primaryKeyWire: string,
    valueText: string,
  ): Promise<IdbRecordWriteResult>;
  /** Delete one record by its opaque wire key; `false` on any failure. */
  deleteIndexedDbRecord(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    primaryKeyWire: string,
  ): Promise<boolean>;
  clearIndexedDbStore(tabId: number, frameId: number, database: string, store: string): Promise<boolean>;
  /** `false` covers errors AND a blocked delete (page holds connections). */
  deleteIndexedDbDatabase(tabId: number, frameId: number, database: string): Promise<boolean>;
  /** Enumerate the scope's Cache Storage caches; `null` when unreadable
   *  (including a non-secure context, where the API doesn't exist). */
  listCaches(tabId: number, frameId: number): Promise<ReadonlyArray<CacheSummary> | null>;
  /** Paged read of one cache's entries — request metadata only. */
  readCacheEntries(
    tabId: number,
    frameId: number,
    cache: string,
    page: number,
    pageSize: number,
  ): Promise<CacheEntriesPage | null>;
  /** Lazy one-shot fetch of one cache entry's stored-response preview;
   *  `null` when the entry is gone or the frame can't be read. */
  readCacheEntryResponse(
    tabId: number,
    frameId: number,
    cache: string,
    url: string,
    method: string,
  ): Promise<CacheEntryResponsePreview | null>;
  /** Read the scope's storage usage against its origin quota; `null`
   *  when neither transport can answer (non-secure context, frame gone). */
  readQuota(tabId: number, frameId: number): Promise<StorageQuota | null>;
  /** Clear the scope origin's site data (cookies, DOM storage,
   *  IndexedDB, Cache Storage, service workers); `types` narrows the
   *  clear to a subset, absent means all five. `false` on any failure. */
  clearSiteData(tabId: number, frameId: number, types?: ReadonlyArray<SiteDataType>): Promise<boolean>;
  /** Simulate a custom storage quota for the scope's origin (attached
   *  tabs only); `null` clears the simulation. `false` on any failure —
   *  including a detached tab, which has no override control. */
  setQuotaOverride(tabId: number, frameId: number, quotaBytes: number | null): Promise<boolean>;
  /** Delete a whole named cache; `false` on any failure. */
  deleteCache(tabId: number, frameId: number, cache: string): Promise<boolean>;
  /** Delete one cache entry by its request URL (+ method, see the read shape). */
  deleteCacheEntry(tabId: number, frameId: number, cache: string, url: string, method: string): Promise<boolean>;
  /**
   * Subscribe to host-pushed storage invalidations of one kind for the
   * tab (fired while the host's CDP tier tracks it; never fired on a
   * fetcher-less or detached host — the poll stays the fallback). The
   * note carries no data: the consumer refetches through the read
   * methods above. Returns an unsubscribe function.
   */
  subscribeStorageInvalidations(tabId: number, kind: StorageInvalidationKind, listener: () => void): () => void;
}

let host: StorageInspectorHost | null = null;

export function setStorageInspectorHost(next: StorageInspectorHost): void {
  host = next;
}

export function getStorageInspectorHost(): StorageInspectorHost | null {
  return host;
}
