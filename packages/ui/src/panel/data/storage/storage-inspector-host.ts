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

export interface StorageInspectorHost {
  listScopes(tabId: number): Promise<ReadonlyArray<StorageScope> | null>;
  readDomStorage(tabId: number, frameId: number, area: DomStorageArea): Promise<DomStorageSnapshot | null>;
}

let host: StorageInspectorHost | null = null;

export function setStorageInspectorHost(next: StorageInspectorHost): void {
  host = next;
}

export function getStorageInspectorHost(): StorageInspectorHost | null {
  return host;
}
