/**
 * Standard-plane IndexedDB READS — `chrome.scripting` injection into the
 * scope's frame, same transport rationale as DOM storage: there is no
 * extension API and the CDP `IndexedDB` domain is not dispatched for
 * extension debugger clients (STORAGE_PANEL_PLAN.md §2.3). Reads only in
 * this slice; deletes and CDP `trackIndexedDBForStorageKey` invalidation
 * wiring trail it, and record editing is out of v1 entirely.
 *
 * Payload discipline: cursor-paged reads with a clamped page size, and
 * every key/value PREVIEW-SERIALIZED in-page — IDB values are
 * structured-clone types (Dates, ArrayBuffers, Blobs, Maps, cycles…),
 * so a type-tagged, depth- and length-capped string is what rides the
 * bridge, never the value itself.
 */

import type { IdbDatabaseWire, IdbRecordWire } from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/** Database-count cap per enumeration (an origin rarely has more). */
export const IDB_MAX_DATABASES = 100;
/** Page-size clamp for record reads. */
export const IDB_PAGE_SIZE_MAX = 200;
export const IDB_PAGE_SIZE_DEFAULT = 50;
/** Per-record preview cap (chars), applied to key and value previews. */
export const IDB_VALUE_PREVIEW_MAX = 1024;

interface InjectedDatabase {
  name: string;
  version: number;
  objectStores: Array<{ name: string; keyPath: string | null; autoIncrement: boolean; indexNames: string[] }>;
}

/**
 * The injected funcs run INSIDE the target frame and are serialized by
 * `chrome.scripting` — self-contained by necessity (helpers live as
 * inner functions; caps arrive as args). Exported so tests can exercise
 * enumeration, paging and preview rules directly against a fake
 * IndexedDB implementation.
 */
export async function listIdbDatabasesInPage(maxDatabases: number): Promise<{ databases: InjectedDatabase[] | null }> {
  if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return { databases: null };
  try {
    const infos = await indexedDB.databases();
    const databases: InjectedDatabase[] = [];
    for (const info of infos.slice(0, maxDatabases)) {
      if (!info.name) continue;
      // Versionless open — never upgrades an existing database.
      const db = await new Promise<IDBDatabase | null>((resolve) => {
        const req = indexedDB.open(info.name as string);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      });
      if (!db) continue;
      const objectStores: InjectedDatabase['objectStores'] = [];
      const storeNames = Array.from(db.objectStoreNames);
      if (storeNames.length > 0) {
        try {
          const tx = db.transaction(storeNames, 'readonly');
          for (const name of storeNames) {
            const store = tx.objectStore(name);
            const keyPath =
              typeof store.keyPath === 'string'
                ? store.keyPath
                : Array.isArray(store.keyPath)
                  ? store.keyPath.join(', ')
                  : null;
            objectStores.push({
              name,
              keyPath,
              autoIncrement: store.autoIncrement,
              indexNames: Array.from(store.indexNames),
            });
          }
          tx.abort();
        } catch {
          for (const name of storeNames) {
            if (!objectStores.some((s) => s.name === name)) {
              objectStores.push({ name, keyPath: null, autoIncrement: false, indexNames: [] });
            }
          }
        }
      }
      databases.push({ name: db.name, version: db.version, objectStores });
      db.close();
    }
    return { databases };
  } catch {
    return { databases: null };
  }
}

export async function readIdbRecordsInPage(
  database: string,
  store: string,
  page: number,
  pageSize: number,
  previewMax: number,
): Promise<{
  records: Array<{ keyPreview: string; primaryKeyPreview: string; valuePreview: string }> | null;
  truncated: boolean;
}> {
  if (typeof indexedDB === 'undefined') return { records: null, truncated: false };

  // Type-tagged, depth- and length-capped preview of a structured-clone
  // value. Never throws — an unserializable corner renders as its tag.
  function preview(v: unknown, depth: number): string {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t === 'string') return JSON.stringify(v);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
    if (v instanceof Date) return `Date(${Number.isNaN(v.getTime()) ? 'invalid' : v.toISOString()})`;
    if (v instanceof ArrayBuffer) return `ArrayBuffer(${v.byteLength} B)`;
    if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${(v as ArrayBufferView).byteLength} B)`;
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      const name = typeof File !== 'undefined' && v instanceof File ? `${JSON.stringify(v.name)}, ` : '';
      return `${v.constructor.name}(${name}${v.size} B${v.type ? `, ${v.type}` : ''})`;
    }
    if (v instanceof RegExp) return String(v);
    if (Array.isArray(v)) {
      if (depth <= 0) return `Array(${v.length})`;
      const head = v.slice(0, 10).map((item) => preview(item, depth - 1));
      return `[${head.join(', ')}${v.length > 10 ? `, … +${v.length - 10} more` : ''}]`;
    }
    if (v instanceof Map) {
      if (depth <= 0) return `Map(${v.size})`;
      const head = Array.from(v.entries())
        .slice(0, 10)
        .map(([k, val]) => `${preview(k, depth - 1)} => ${preview(val, depth - 1)}`);
      return `Map(${v.size}) {${head.join(', ')}}`;
    }
    if (v instanceof Set) {
      if (depth <= 0) return `Set(${v.size})`;
      const head = Array.from(v.values())
        .slice(0, 10)
        .map((item) => preview(item, depth - 1));
      return `Set(${v.size}) {${head.join(', ')}}`;
    }
    if (t === 'object') {
      const keys = Object.keys(v as object);
      if (depth <= 0) return `{…${keys.length}}`;
      const head = keys.slice(0, 10).map((k) => `${k}: ${preview((v as Record<string, unknown>)[k], depth - 1)}`);
      return `{${head.join(', ')}${keys.length > 10 ? `, … +${keys.length - 10} more` : ''}}`;
    }
    return Object.prototype.toString.call(v);
  }

  function clip(s: string): string {
    return s.length > previewMax ? `${s.slice(0, previewMax)}…` : s;
  }

  try {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(database);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      // The database was deleted since enumeration — a versionless open
      // would CREATE it; abort instead and report unreadable.
      req.onupgradeneeded = () => {
        req.transaction?.abort();
        resolve(null);
      };
    });
    if (!db) return { records: null, truncated: false };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { records: null, truncated: false };
    }

    const result = await new Promise<{
      records: Array<{ keyPreview: string; primaryKeyPreview: string; valuePreview: string }> | null;
      truncated: boolean;
    }>((resolve) => {
      const records: Array<{ keyPreview: string; primaryKeyPreview: string; valuePreview: string }> = [];
      let advanced = page <= 0;
      try {
        const tx = db.transaction(store, 'readonly');
        const cursorReq = tx.objectStore(store).openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) {
            resolve({ records, truncated: false });
            return;
          }
          if (!advanced) {
            advanced = true;
            cursor.advance(page * pageSize);
            return;
          }
          if (records.length >= pageSize) {
            // One record past the page ⇒ more exist.
            resolve({ records, truncated: true });
            return;
          }
          records.push({
            keyPreview: clip(preview(cursor.key, 3)),
            primaryKeyPreview: clip(preview(cursor.primaryKey, 3)),
            valuePreview: clip(preview(cursor.value, 3)),
          });
          cursor.continue();
        };
        cursorReq.onerror = () => resolve({ records: null, truncated: false });
      } catch {
        resolve({ records: null, truncated: false });
      }
    });
    db.close();
    return result;
  } catch {
    return { records: null, truncated: false };
  }
}

export async function listIndexedDbDatabases(
  tabId: number,
  frameId: number,
): Promise<{ databases: IdbDatabaseWire[] | null }> {
  const result = await runInFrame(tabId, frameId, listIdbDatabasesInPage, [IDB_MAX_DATABASES]);
  if (!result || !Array.isArray(result.databases)) return { databases: null };
  return {
    databases: result.databases.map((db) => ({
      name: db.name,
      version: db.version,
      objectStores: db.objectStores.map((s) => ({
        name: s.name,
        ...(s.keyPath !== null ? { keyPath: s.keyPath } : {}),
        autoIncrement: s.autoIncrement,
        indexNames: s.indexNames,
      })),
    })),
  };
}

export async function getIndexedDbRecords(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
  page: number,
  pageSize: number,
): Promise<{ records: IdbRecordWire[] | null; truncated?: boolean }> {
  if (typeof database !== 'string' || typeof store !== 'string') return { records: null };
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, IDB_PAGE_SIZE_MAX) : IDB_PAGE_SIZE_DEFAULT;
  const result = await runInFrame(tabId, frameId, readIdbRecordsInPage, [
    database,
    store,
    safePage,
    safePageSize,
    IDB_VALUE_PREVIEW_MAX,
  ]);
  if (!result || !Array.isArray(result.records)) return { records: null };
  return { records: result.records, ...(result.truncated ? { truncated: true } : {}) };
}
