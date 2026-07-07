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

/** One record, preview-serialized in-page — never the value itself. */
export interface IdbRecord {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
}

/** `truncated` means more records exist past this page. */
export interface IdbRecordsPage {
  records: ReadonlyArray<IdbRecord>;
  truncated: boolean;
}

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
  /** Cursor-paged, preview-serialized read of one object store. */
  readIndexedDbRecords(
    tabId: number,
    frameId: number,
    database: string,
    store: string,
    page: number,
    pageSize: number,
  ): Promise<IdbRecordsPage | null>;
}

let host: StorageInspectorHost | null = null;

export function setStorageInspectorHost(next: StorageInspectorHost): void {
  host = next;
}

export function getStorageInspectorHost(): StorageInspectorHost | null {
  return host;
}
