/**
 * Standard-plane IndexedDB READS and DELETES — `chrome.scripting`
 * injection into the scope's frame, same transport rationale as DOM
 * storage: there is no extension API and the CDP `IndexedDB` domain is
 * not dispatched for extension debugger clients (STORAGE_PANEL_PLAN.md
 * §2.3). Record EDITING stays out of v1 entirely.
 *
 * Payload discipline: cursor-paged reads with a clamped page size, and
 * every key/value PREVIEW-SERIALIZED in-page — IDB values are
 * structured-clone types (Dates, ArrayBuffers, Blobs, Maps, cycles…),
 * so a type-tagged, depth- and length-capped string is what rides the
 * bridge, never the value itself. A row expansion pays for more with a
 * lazy one-shot value read that ships a bounded, type-tagged TREE —
 * still serialized in-page, still capped (depth, per-node children,
 * string length, total nodes).
 *
 * Record identity for deletes: previews are lossy, so each record also
 * carries `primaryKeyWire`, a LOSSLESS tagged-JSON encoding of its
 * primary key — total over the practical IDB key space (string / number
 * including ±Infinity / Date / binary as base64 / arrays of those). The
 * string is opaque outside this file: encoded in-page on read, decoded
 * in-page on delete (the key must be rebuilt in the page realm —
 * injection args are JSON-only).
 */

import type { IdbDatabaseWire, IdbRecordWire, IdbValueNodeWire } from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/** Database-count cap per enumeration (an origin rarely has more). */
export const IDB_MAX_DATABASES = 100;
/** Page-size clamp for record reads. */
export const IDB_PAGE_SIZE_MAX = 200;
export const IDB_PAGE_SIZE_DEFAULT = 50;
/** Per-record preview cap (chars), applied to key and value previews. */
export const IDB_VALUE_PREVIEW_MAX = 1024;
/** Value-tree caps: nesting depth and children kept per node. */
export const IDB_TREE_DEPTH_MAX = 6;
export const IDB_TREE_CHILDREN_MAX = 50;

interface InjectedDatabase {
  name: string;
  version: number;
  objectStores: Array<{ name: string; keyPath: string | null; autoIncrement: boolean; indexNames: string[] }>;
}

interface InjectedIdbRecord {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
  primaryKeyWire?: string;
}

interface InjectedIdbValueNode {
  kind: string;
  preview: string;
  label?: string;
  children?: InjectedIdbValueNode[];
  dropped?: number;
}

/** Tagged node of the lossless primary-key wire encoding. */
type IdbKeyWireNode =
  | { s: string }
  | { n: number }
  | { d: string }
  | { b: string }
  | { inf: 1 | -1 }
  | { a: IdbKeyWireNode[] };

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
  index: string | null = null,
): Promise<{
  records: InjectedIdbRecord[] | null;
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

  // Lossless tagged encoding of a primary key — total over the
  // practical IDB key space: strings, numbers (±Infinity as a tagged
  // sign), Dates, binary keys (base64 of the bytes — IDB compares them
  // by bytes), and arrays of those. `undefined` marks the rare corner
  // the codec can't encode; the record renders undeletable.
  function encodeKeyNode(k: unknown): IdbKeyWireNode | undefined {
    function bytesToBase64(bytes: Uint8Array): string {
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] as number);
      return btoa(bin);
    }
    if (typeof k === 'string') return { s: k };
    if (typeof k === 'number') {
      if (Number.isFinite(k)) return { n: k };
      if (k === Number.POSITIVE_INFINITY) return { inf: 1 };
      if (k === Number.NEGATIVE_INFINITY) return { inf: -1 };
      return undefined;
    }
    if (k instanceof Date) return Number.isNaN(k.getTime()) ? undefined : { d: k.toISOString() };
    // toString-tag check instead of instanceof: a binary key can be a
    // cross-realm ArrayBuffer, whose identity instanceof can't see.
    if (Object.prototype.toString.call(k) === '[object ArrayBuffer]') {
      return { b: bytesToBase64(new Uint8Array(k as ArrayBuffer)) };
    }
    if (ArrayBuffer.isView(k)) {
      const view = k as ArrayBufferView;
      return { b: bytesToBase64(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)) };
    }
    if (Array.isArray(k)) {
      const items: IdbKeyWireNode[] = [];
      for (const item of k) {
        const node = encodeKeyNode(item);
        if (node === undefined) return undefined;
        items.push(node);
      }
      return { a: items };
    }
    return undefined;
  }

  function encodeKey(k: unknown): string | undefined {
    const node = encodeKeyNode(k);
    return node === undefined ? undefined : JSON.stringify(node);
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
      records: InjectedIdbRecord[] | null;
      truncated: boolean;
    }>((resolve) => {
      const records: InjectedIdbRecord[] = [];
      let advanced = page <= 0;
      try {
        const tx = db.transaction(store, 'readonly');
        // An index-scoped read walks the index's cursor: `cursor.key` is
        // the index key, `cursor.primaryKey` stays the record identity
        // (deletes keep working from an index view). A gone index throws
        // here and reports unreadable.
        const source = index === null ? tx.objectStore(store) : tx.objectStore(store).index(index);
        const cursorReq = source.openCursor();
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
          const primaryKeyWire = encodeKey(cursor.primaryKey);
          records.push({
            keyPreview: clip(preview(cursor.key, 3)),
            primaryKeyPreview: clip(preview(cursor.primaryKey, 3)),
            valuePreview: clip(preview(cursor.value, 3)),
            ...(primaryKeyWire !== undefined ? { primaryKeyWire } : {}),
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

export async function readIdbRecordValueInPage(
  database: string,
  store: string,
  primaryKeyWire: string,
  depthMax: number,
  childrenMax: number,
  previewMax: number,
): Promise<{ value: InjectedIdbValueNode | null }> {
  if (typeof indexedDB === 'undefined') return { value: null };

  // Total-node backstop under the per-node caps — a wide, deep value
  // can't ship an unbounded tree.
  const NODE_BUDGET = 2000;
  const budget = { nodes: 0 };

  function decodeKeyNode(node: unknown): { key: IDBValidKey } | null {
    if (!node || typeof node !== 'object') return null;
    const tagged = node as { s?: unknown; n?: unknown; d?: unknown; b?: unknown; inf?: unknown; a?: unknown };
    if (typeof tagged.s === 'string') return { key: tagged.s };
    if (typeof tagged.n === 'number' && Number.isFinite(tagged.n)) return { key: tagged.n };
    if (typeof tagged.d === 'string') {
      const date = new Date(tagged.d);
      return Number.isNaN(date.getTime()) ? null : { key: date };
    }
    if (typeof tagged.b === 'string') {
      try {
        const bin = atob(tagged.b);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { key: bytes.buffer };
      } catch {
        return null;
      }
    }
    if (tagged.inf === 1) return { key: Number.POSITIVE_INFINITY };
    if (tagged.inf === -1) return { key: Number.NEGATIVE_INFINITY };
    if (Array.isArray(tagged.a)) {
      const items: IDBValidKey[] = [];
      for (const item of tagged.a) {
        const decoded = decodeKeyNode(item);
        if (decoded === null) return null;
        items.push(decoded.key);
      }
      return { key: items };
    }
    return null;
  }

  function clip(s: string): string {
    return s.length > previewMax ? `${s.slice(0, previewMax)}…` : s;
  }

  // One node's own kind + flat preview — the same tag vocabulary as the
  // list previews, containers as size stubs (children carry the rest).
  function describe(v: unknown): { kind: string; preview: string } {
    if (v === null) return { kind: 'null', preview: 'null' };
    if (v === undefined) return { kind: 'undefined', preview: 'undefined' };
    const t = typeof v;
    if (t === 'string') return { kind: 'string', preview: JSON.stringify(v) };
    if (t === 'number' || t === 'boolean' || t === 'bigint') return { kind: t, preview: String(v) };
    if (v instanceof Date) {
      return { kind: 'date', preview: `Date(${Number.isNaN(v.getTime()) ? 'invalid' : v.toISOString()})` };
    }
    if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') {
      return { kind: 'binary', preview: `ArrayBuffer(${(v as ArrayBuffer).byteLength} B)` };
    }
    if (ArrayBuffer.isView(v)) {
      return { kind: 'binary', preview: `${v.constructor.name}(${(v as ArrayBufferView).byteLength} B)` };
    }
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      const name = typeof File !== 'undefined' && v instanceof File ? `${JSON.stringify(v.name)}, ` : '';
      return { kind: 'blob', preview: `${v.constructor.name}(${name}${v.size} B${v.type ? `, ${v.type}` : ''})` };
    }
    if (v instanceof RegExp) return { kind: 'regexp', preview: String(v) };
    if (Array.isArray(v)) return { kind: 'array', preview: `Array(${v.length})` };
    if (v instanceof Map) return { kind: 'map', preview: `Map(${v.size})` };
    if (v instanceof Set) return { kind: 'set', preview: `Set(${v.size})` };
    if (t === 'object') return { kind: 'object', preview: `{…${Object.keys(v as object).length}}` };
    return { kind: 'other', preview: Object.prototype.toString.call(v) };
  }

  function entriesOf(v: unknown, kind: string): Array<[string, unknown]> | null {
    if (kind === 'array') return (v as unknown[]).map((item, i) => [String(i), item]);
    if (kind === 'map') {
      return Array.from((v as Map<unknown, unknown>).entries()).map(([k, val]) => [clip(describe(k).preview), val]);
    }
    if (kind === 'set') return Array.from((v as Set<unknown>).values()).map((item, i) => [String(i), item]);
    if (kind === 'object') {
      return Object.keys(v as object).map((k) => [k, (v as Record<string, unknown>)[k]]);
    }
    return null;
  }

  function toNode(label: string | undefined, v: unknown, depth: number): InjectedIdbValueNode {
    budget.nodes++;
    const { kind, preview } = describe(v);
    const node: InjectedIdbValueNode = { kind, preview: clip(preview) };
    if (label !== undefined) node.label = label;
    if (depth <= 0) return node;
    const entries = entriesOf(v, kind);
    if (!entries || entries.length === 0) return node;
    const children: InjectedIdbValueNode[] = [];
    let dropped = 0;
    for (const [entryLabel, entryValue] of entries) {
      if (children.length >= childrenMax || budget.nodes >= NODE_BUDGET) {
        dropped++;
        continue;
      }
      children.push(toNode(entryLabel, entryValue, depth - 1));
    }
    if (children.length > 0) node.children = children;
    if (dropped > 0) node.dropped = dropped;
    return node;
  }

  let decoded: { key: IDBValidKey } | null;
  try {
    decoded = decodeKeyNode(JSON.parse(primaryKeyWire));
  } catch {
    return { value: null };
  }
  if (decoded === null) return { value: null };
  const key = decoded.key;

  try {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(database);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      // Deleted since enumeration — abort instead of creating a ghost.
      req.onupgradeneeded = () => {
        req.transaction?.abort();
        resolve(null);
      };
    });
    if (!db) return { value: null };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { value: null };
    }
    const result = await new Promise<{ value: InjectedIdbValueNode | null }>((resolve) => {
      try {
        // A cursor instead of get(): a stored value of literal
        // `undefined` stays distinguishable from a gone record.
        const cursorReq = db.transaction(store, 'readonly').objectStore(store).openCursor(IDBKeyRange.only(key));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          resolve(cursor ? { value: toNode(undefined, cursor.value, depthMax) } : { value: null });
        };
        cursorReq.onerror = () => resolve({ value: null });
      } catch {
        resolve({ value: null });
      }
    });
    db.close();
    return result;
  } catch {
    return { value: null };
  }
}

export async function deleteIdbRecordInPage(
  database: string,
  store: string,
  primaryKeyWire: string,
): Promise<{ ok: boolean }> {
  if (typeof indexedDB === 'undefined') return { ok: false };

  // Decode the tagged wire key back into a real IDB key. Wrapped so a
  // valid falsy key (0, '') is distinguishable from failure.
  function decodeKeyNode(node: unknown): { key: IDBValidKey } | null {
    if (!node || typeof node !== 'object') return null;
    const tagged = node as { s?: unknown; n?: unknown; d?: unknown; b?: unknown; inf?: unknown; a?: unknown };
    if (typeof tagged.s === 'string') return { key: tagged.s };
    if (typeof tagged.n === 'number' && Number.isFinite(tagged.n)) return { key: tagged.n };
    if (typeof tagged.d === 'string') {
      const date = new Date(tagged.d);
      return Number.isNaN(date.getTime()) ? null : { key: date };
    }
    if (typeof tagged.b === 'string') {
      try {
        const bin = atob(tagged.b);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { key: bytes.buffer };
      } catch {
        return null;
      }
    }
    if (tagged.inf === 1) return { key: Number.POSITIVE_INFINITY };
    if (tagged.inf === -1) return { key: Number.NEGATIVE_INFINITY };
    if (Array.isArray(tagged.a)) {
      const items: IDBValidKey[] = [];
      for (const item of tagged.a) {
        const decoded = decodeKeyNode(item);
        if (decoded === null) return null;
        items.push(decoded.key);
      }
      return { key: items };
    }
    return null;
  }

  let decoded: { key: IDBValidKey } | null;
  try {
    decoded = decodeKeyNode(JSON.parse(primaryKeyWire));
  } catch {
    return { ok: false };
  }
  if (decoded === null) return { ok: false };
  const key = decoded.key;

  try {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(database);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      // Deleted since enumeration — abort instead of creating a ghost.
      req.onupgradeneeded = () => {
        req.transaction?.abort();
        resolve(null);
      };
    });
    if (!db) return { ok: false };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { ok: false };
    }
    return await new Promise<{ ok: boolean }>((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve({ ok: true });
        };
        tx.onerror = () => {
          db.close();
          resolve({ ok: false });
        };
        tx.onabort = () => {
          db.close();
          resolve({ ok: false });
        };
      } catch {
        db.close();
        resolve({ ok: false });
      }
    });
  } catch {
    return { ok: false };
  }
}

export async function clearIdbStoreInPage(database: string, store: string): Promise<{ ok: boolean }> {
  if (typeof indexedDB === 'undefined') return { ok: false };
  try {
    const db = await new Promise<IDBDatabase | null>((resolve) => {
      const req = indexedDB.open(database);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      req.onupgradeneeded = () => {
        req.transaction?.abort();
        resolve(null);
      };
    });
    if (!db) return { ok: false };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { ok: false };
    }
    return await new Promise<{ ok: boolean }>((resolve) => {
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => {
          db.close();
          resolve({ ok: true });
        };
        tx.onerror = () => {
          db.close();
          resolve({ ok: false });
        };
        tx.onabort = () => {
          db.close();
          resolve({ ok: false });
        };
      } catch {
        db.close();
        resolve({ ok: false });
      }
    });
  } catch {
    return { ok: false };
  }
}

export async function deleteIdbDatabaseInPage(database: string): Promise<{ ok: boolean }> {
  if (typeof indexedDB === 'undefined') return { ok: false };
  return new Promise<{ ok: boolean }>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(database);
      req.onsuccess = () => resolve({ ok: true });
      req.onerror = () => resolve({ ok: false });
      // The page holds open connections — the delete would hang until
      // they close; report failure instead of spinning.
      req.onblocked = () => resolve({ ok: false });
    } catch {
      resolve({ ok: false });
    }
  });
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
  index?: string,
): Promise<{ records: IdbRecordWire[] | null; truncated?: boolean }> {
  if (typeof database !== 'string' || typeof store !== 'string') return { records: null };
  if (index !== undefined && typeof index !== 'string') return { records: null };
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, IDB_PAGE_SIZE_MAX) : IDB_PAGE_SIZE_DEFAULT;
  const result = await runInFrame(tabId, frameId, readIdbRecordsInPage, [
    database,
    store,
    safePage,
    safePageSize,
    IDB_VALUE_PREVIEW_MAX,
    index ?? null,
  ]);
  if (!result || !Array.isArray(result.records)) return { records: null };
  return { records: result.records, ...(result.truncated ? { truncated: true } : {}) };
}

export async function getIndexedDbRecordValue(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
  primaryKeyWire: string,
): Promise<{ value: IdbValueNodeWire | null }> {
  if (typeof database !== 'string' || typeof store !== 'string' || typeof primaryKeyWire !== 'string') {
    return { value: null };
  }
  const result = await runInFrame(tabId, frameId, readIdbRecordValueInPage, [
    database,
    store,
    primaryKeyWire,
    IDB_TREE_DEPTH_MAX,
    IDB_TREE_CHILDREN_MAX,
    IDB_VALUE_PREVIEW_MAX,
  ]);
  return { value: result?.value ?? null };
}

export async function deleteIndexedDbRecord(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
  primaryKeyWire: string,
): Promise<{ ok: boolean }> {
  if (typeof database !== 'string' || typeof store !== 'string' || typeof primaryKeyWire !== 'string') {
    return { ok: false };
  }
  const result = await runInFrame(tabId, frameId, deleteIdbRecordInPage, [database, store, primaryKeyWire]);
  return { ok: result?.ok === true };
}

export async function clearIndexedDbStore(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
): Promise<{ ok: boolean }> {
  if (typeof database !== 'string' || typeof store !== 'string') return { ok: false };
  const result = await runInFrame(tabId, frameId, clearIdbStoreInPage, [database, store]);
  return { ok: result?.ok === true };
}

export async function deleteIndexedDbDatabase(
  tabId: number,
  frameId: number,
  database: string,
): Promise<{ ok: boolean }> {
  if (typeof database !== 'string') return { ok: false };
  const result = await runInFrame(tabId, frameId, deleteIdbDatabaseInPage, [database]);
  return { ok: result?.ok === true };
}
