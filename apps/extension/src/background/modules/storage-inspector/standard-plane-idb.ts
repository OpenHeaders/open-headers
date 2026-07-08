/**
 * Standard-plane IndexedDB READS, WRITES and DELETES —
 * `chrome.scripting` injection into the scope's frame, same transport
 * rationale as DOM storage: there is no extension API and the CDP
 * `IndexedDB` domain is not dispatched for extension debugger clients
 * (STORAGE_PANEL_PLAN.md §2.3).
 *
 * Payload discipline: cursor-paged reads with a clamped page size, and
 * every key/value PREVIEW-SERIALIZED in-page — IDB values are
 * structured-clone types (Dates, ArrayBuffers, Blobs, Maps, cycles…),
 * so a type-tagged, depth- and length-capped string is what rides the
 * bridge, never the value itself. Opening a record in the editor pays
 * for more with a lazy one-shot DOCUMENT read: a strictly JSON-safe
 * value ships as exact pretty JSON (`editable: true`); anything
 * carrying non-JSON types ships as a readable JSON-ish rendering,
 * honestly read-only. Both legs are serialized in-page and size-capped.
 * The write leg is the inverse, SAME-KEY ONLY: the edited text is
 * parsed in-page and put back; a store keeping its key inside the value
 * rejects an edit whose key drifted (`key-changed`) — never a silent
 * duplicate — while out-of-line keys put with the decoded wire key.
 *
 * Record identity for deletes: previews are lossy, so each record also
 * carries `primaryKeyWire`, a LOSSLESS tagged-JSON encoding of its
 * primary key — total over the practical IDB key space (string / number
 * including ±Infinity / Date / binary as base64 / arrays of those). The
 * string is opaque outside this file: encoded in-page on read, decoded
 * in-page on delete (the key must be rebuilt in the page realm —
 * injection args are JSON-only).
 */

import type {
  IdbDatabaseWire,
  IdbRecordDocumentWire,
  IdbRecordPreviewEntryWire,
  IdbRecordPreviewNodeWire,
  IdbRecordWire,
  IdbRecordWriteFailureWire,
} from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/** Database-count cap per enumeration (an origin rarely has more). */
export const IDB_MAX_DATABASES = 100;
/** Page-size clamp for record reads. */
export const IDB_PAGE_SIZE_MAX = 200;
export const IDB_PAGE_SIZE_DEFAULT = 50;
/** Per-record preview cap (chars), applied to key and value previews. */
export const IDB_VALUE_PREVIEW_MAX = 1024;
/** Full-document size cap (chars) — past it the text is cut and the
 *  document turns read-only. */
export const IDB_DOCUMENT_TEXT_MAX = 1_000_000;

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

interface InjectedIdbRecordDocument {
  text: string;
  editable: boolean;
  truncated?: boolean;
  preview?: IdbRecordPreviewNodeWire;
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

export async function readIdbRecordDocumentInPage(
  database: string,
  store: string,
  primaryKeyWire: string,
  textMax: number,
): Promise<{ document: InjectedIdbRecordDocument | null }> {
  if (typeof indexedDB === 'undefined') return { document: null };

  // Loose-path recursion backstop — past it a container renders as its
  // size stub instead of descending further.
  const LOOSE_DEPTH_MAX = 100;

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

  // Strict JSON-safety: true only when the value round-trips EXACTLY
  // through `JSON.parse(JSON.stringify(v))` — plain objects/arrays of
  // strings, finite numbers, booleans and null. Anything else (Date,
  // Map, Set, binary, Blob, RegExp, bigint, `undefined` — which
  // JSON.stringify silently drops or nulls — exotic prototypes, sparse
  // slots, cycles, shared references) disqualifies the editable path.
  function isJsonSafe(v: unknown, seen: Set<object>): boolean {
    if (v === null) return true;
    const t = typeof v;
    if (t === 'string' || t === 'boolean') return true;
    if (t === 'number') return Number.isFinite(v as number);
    if (t !== 'object') return false;
    const obj = v as object;
    if (seen.has(obj)) return false;
    seen.add(obj);
    if (Array.isArray(obj)) {
      const arr = obj as unknown[];
      for (let i = 0; i < arr.length; i++) {
        if (!(i in arr) || !isJsonSafe(arr[i], seen)) return false;
      }
      return true;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) return false;
    for (const key of Object.keys(obj)) {
      if (!isJsonSafe((obj as Record<string, unknown>)[key], seen)) return false;
    }
    return true;
  }

  // Readable JSON-ish rendering for values off the editable path: the
  // JSON-safe parts print as JSON, the structured-clone extras print in
  // console vocabulary (Date("…"), Map(2) { k => v }, ArrayBuffer(16 B)).
  function renderLoose(v: unknown, indent: string, depth: number, seen: Set<object>): string {
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    const t = typeof v;
    if (t === 'string') return JSON.stringify(v);
    if (t === 'number' || t === 'boolean') return String(v);
    if (t === 'bigint') return `${String(v)}n`;
    if (t !== 'object') return Object.prototype.toString.call(v);
    if (v instanceof Date) return `Date(${Number.isNaN(v.getTime()) ? 'invalid' : JSON.stringify(v.toISOString())})`;
    if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') {
      return `ArrayBuffer(${(v as ArrayBuffer).byteLength} B)`;
    }
    if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${(v as ArrayBufferView).byteLength} B)`;
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      const name = typeof File !== 'undefined' && v instanceof File ? `${JSON.stringify(v.name)}, ` : '';
      return `${v.constructor.name}(${name}${v.size} B${v.type ? `, ${v.type}` : ''})`;
    }
    if (v instanceof RegExp) return String(v);
    const obj = v as object;
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    const childIndent = `${indent}  `;
    try {
      if (Array.isArray(obj)) {
        const arr = obj as unknown[];
        if (arr.length === 0) return '[]';
        if (depth >= LOOSE_DEPTH_MAX) return `Array(${arr.length})`;
        const items = arr.map((item) => `${childIndent}${renderLoose(item, childIndent, depth + 1, seen)}`);
        return `[\n${items.join(',\n')}\n${indent}]`;
      }
      if (obj instanceof Map) {
        if (obj.size === 0) return 'Map(0) {}';
        if (depth >= LOOSE_DEPTH_MAX) return `Map(${obj.size})`;
        const items = Array.from(obj.entries()).map(
          ([k, val]) =>
            `${childIndent}${renderLoose(k, childIndent, depth + 1, seen)} => ${renderLoose(val, childIndent, depth + 1, seen)}`,
        );
        return `Map(${obj.size}) {\n${items.join(',\n')}\n${indent}}`;
      }
      if (obj instanceof Set) {
        if (obj.size === 0) return 'Set(0) {}';
        if (depth >= LOOSE_DEPTH_MAX) return `Set(${obj.size})`;
        const items = Array.from(obj.values()).map(
          (item) => `${childIndent}${renderLoose(item, childIndent, depth + 1, seen)}`,
        );
        return `Set(${obj.size}) {\n${items.join(',\n')}\n${indent}}`;
      }
      const keys = Object.keys(obj);
      const proto = Object.getPrototypeOf(obj);
      const ctorName =
        proto !== Object.prototype && proto !== null && proto?.constructor?.name && proto.constructor.name !== 'Object'
          ? `${proto.constructor.name} `
          : '';
      if (keys.length === 0) return `${ctorName}{}`;
      if (depth >= LOOSE_DEPTH_MAX) return `${ctorName}{…${keys.length}}`;
      const items = keys.map(
        (k) =>
          `${childIndent}${JSON.stringify(k)}: ${renderLoose((obj as Record<string, unknown>)[k], childIndent, depth + 1, seen)}`,
      );
      return `${ctorName}{\n${items.join(',\n')}\n${indent}}`;
    } finally {
      seen.delete(obj);
    }
  }

  // Preview-tree budgets: depth backstop, per-container entry cap, and
  // a global node budget — past any of them a container collapses to
  // its size stub so the payload stays bounded.
  const PREVIEW_DEPTH_MAX = 20;
  const PREVIEW_ENTRIES_MAX = 100;
  const PREVIEW_NODES_MAX = 5000;

  // One-line rendering of a Map key for its entry prefix.
  function previewKeyText(k: unknown): string {
    if (k === null) return 'null';
    if (k === undefined) return 'undefined';
    const t = typeof k;
    if (t === 'string') return JSON.stringify(k);
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(k);
    if (k instanceof Date) return `Date(${Number.isNaN(k.getTime()) ? 'invalid' : JSON.stringify(k.toISOString())})`;
    if (Array.isArray(k)) return `[…${k.length}]`;
    if (t === 'object') return '{…}';
    return Object.prototype.toString.call(k);
  }

  // Bounded, type-tagged tree of the value for the editor's Preview
  // mode — real JSON scalars keep their type, everything else ships as
  // console-vocabulary `tag` atoms (same vocabulary as `renderLoose`).
  function toPreview(v: unknown, depth: number, seen: Set<object>, budget: { left: number }): IdbRecordPreviewNodeWire {
    budget.left--;
    if (v === null) return { kind: 'atom', type: 'null', text: 'null' };
    if (v === undefined) return { kind: 'atom', type: 'tag', text: 'undefined' };
    const t = typeof v;
    if (t === 'string') return { kind: 'atom', type: 'string', text: v as string };
    if (t === 'number') return { kind: 'atom', type: 'number', text: String(v) };
    if (t === 'boolean') return { kind: 'atom', type: 'boolean', text: String(v) };
    if (t === 'bigint') return { kind: 'atom', type: 'tag', text: `${String(v)}n` };
    if (t !== 'object') return { kind: 'atom', type: 'tag', text: Object.prototype.toString.call(v) };
    if (v instanceof Date) {
      return {
        kind: 'atom',
        type: 'tag',
        text: `Date(${Number.isNaN(v.getTime()) ? 'invalid' : JSON.stringify(v.toISOString())})`,
      };
    }
    if (Object.prototype.toString.call(v) === '[object ArrayBuffer]') {
      return { kind: 'atom', type: 'tag', text: `ArrayBuffer(${(v as ArrayBuffer).byteLength} B)` };
    }
    if (ArrayBuffer.isView(v)) {
      return { kind: 'atom', type: 'tag', text: `${v.constructor.name}(${(v as ArrayBufferView).byteLength} B)` };
    }
    if (typeof Blob !== 'undefined' && v instanceof Blob) {
      const name = typeof File !== 'undefined' && v instanceof File ? `${JSON.stringify(v.name)}, ` : '';
      return {
        kind: 'atom',
        type: 'tag',
        text: `${v.constructor.name}(${name}${v.size} B${v.type ? `, ${v.type}` : ''})`,
      };
    }
    if (v instanceof RegExp) return { kind: 'atom', type: 'tag', text: String(v) };
    const obj = v as object;
    if (seen.has(obj)) return { kind: 'atom', type: 'tag', text: '[Circular]' };

    function containerEntries(
      size: number,
      label: string,
      build: (limit: number) => IdbRecordPreviewEntryWire[],
    ): IdbRecordPreviewNodeWire {
      if (depth >= PREVIEW_DEPTH_MAX || budget.left <= 0) return { kind: 'atom', type: 'tag', text: label };
      seen.add(obj);
      try {
        const entries = build(Math.min(size, PREVIEW_ENTRIES_MAX));
        if (size > PREVIEW_ENTRIES_MAX) {
          entries.push({ key: '', node: { kind: 'atom', type: 'tag', text: `… +${size - PREVIEW_ENTRIES_MAX} more` } });
        }
        return { kind: 'container', label, entries };
      } finally {
        seen.delete(obj);
      }
    }

    if (Array.isArray(obj)) {
      const arr = obj as unknown[];
      return containerEntries(arr.length, `Array(${arr.length})`, (limit) => {
        const entries: IdbRecordPreviewEntryWire[] = [];
        for (let i = 0; i < limit; i++)
          entries.push({ key: `${i}: `, node: toPreview(arr[i], depth + 1, seen, budget) });
        return entries;
      });
    }
    if (obj instanceof Map) {
      return containerEntries(obj.size, `Map(${obj.size})`, (limit) => {
        const entries: IdbRecordPreviewEntryWire[] = [];
        for (const [k, val] of obj.entries()) {
          if (entries.length >= limit) break;
          entries.push({ key: `${previewKeyText(k)} => `, node: toPreview(val, depth + 1, seen, budget) });
        }
        return entries;
      });
    }
    if (obj instanceof Set) {
      return containerEntries(obj.size, `Set(${obj.size})`, (limit) => {
        const entries: IdbRecordPreviewEntryWire[] = [];
        for (const item of obj.values()) {
          if (entries.length >= limit) break;
          entries.push({ key: '', node: toPreview(item, depth + 1, seen, budget) });
        }
        return entries;
      });
    }
    const keys = Object.keys(obj);
    const proto = Object.getPrototypeOf(obj);
    const ctorName =
      proto !== Object.prototype && proto !== null && proto?.constructor?.name && proto.constructor.name !== 'Object'
        ? `${proto.constructor.name} `
        : '';
    return containerEntries(keys.length, `${ctorName}{${keys.length}}`, (limit) => {
      const entries: IdbRecordPreviewEntryWire[] = [];
      for (let i = 0; i < limit; i++) {
        const k = keys[i];
        entries.push({
          key: `${JSON.stringify(k)}: `,
          node: toPreview((obj as Record<string, unknown>)[k], depth + 1, seen, budget),
        });
      }
      return entries;
    });
  }

  function toDocument(value: unknown): InjectedIdbRecordDocument {
    let text: string;
    let editable: boolean;
    if (isJsonSafe(value, new Set())) {
      text = JSON.stringify(value, null, 2);
      editable = true;
    } else {
      text = renderLoose(value, '', 0, new Set());
      editable = false;
    }
    if (text.length > textMax) {
      return {
        text: `${text.slice(0, textMax)}…`,
        editable: false,
        truncated: true,
        preview: toPreview(value, 0, new Set(), { left: PREVIEW_NODES_MAX }),
      };
    }
    if (editable) return { text, editable };
    // Read-only documents also ship the bounded preview tree — the
    // Source text stays the exact rendering, Preview stays explorable.
    return { text, editable, preview: toPreview(value, 0, new Set(), { left: PREVIEW_NODES_MAX }) };
  }

  let decoded: { key: IDBValidKey } | null;
  try {
    decoded = decodeKeyNode(JSON.parse(primaryKeyWire));
  } catch {
    return { document: null };
  }
  if (decoded === null) return { document: null };
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
    if (!db) return { document: null };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { document: null };
    }
    const result = await new Promise<{ document: InjectedIdbRecordDocument | null }>((resolve) => {
      try {
        // A cursor instead of get(): a stored value of literal
        // `undefined` stays distinguishable from a gone record.
        const cursorReq = db.transaction(store, 'readonly').objectStore(store).openCursor(IDBKeyRange.only(key));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          try {
            resolve(cursor ? { document: toDocument(cursor.value) } : { document: null });
          } catch {
            resolve({ document: null });
          }
        };
        cursorReq.onerror = () => resolve({ document: null });
      } catch {
        resolve({ document: null });
      }
    });
    db.close();
    return result;
  } catch {
    return { document: null };
  }
}

export async function putIdbRecordInPage(
  database: string,
  store: string,
  primaryKeyWire: string,
  valueText: string,
): Promise<{ ok: boolean; reason?: 'parse' | 'key-changed' | 'gone' | 'write' }> {
  if (typeof indexedDB === 'undefined') return { ok: false, reason: 'gone' };

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

  // A keyPath member walks dotted paths ("a.b") into the value.
  function extractByPath(v: unknown, path: string): unknown {
    let cur: unknown = v;
    for (const part of path.split('.')) {
      if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[part];
    }
    return cur;
  }

  // Parse failure never opens a transaction.
  let value: unknown;
  try {
    value = JSON.parse(valueText);
  } catch {
    return { ok: false, reason: 'parse' };
  }

  let decoded: { key: IDBValidKey } | null;
  try {
    decoded = decodeKeyNode(JSON.parse(primaryKeyWire));
  } catch {
    return { ok: false, reason: 'gone' };
  }
  if (decoded === null) return { ok: false, reason: 'gone' };
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
    if (!db) return { ok: false, reason: 'gone' };
    if (!Array.from(db.objectStoreNames).includes(store)) {
      db.close();
      return { ok: false, reason: 'gone' };
    }
    const result = await new Promise<{ ok: boolean; reason?: 'parse' | 'key-changed' | 'gone' | 'write' }>(
      (resolve) => {
        try {
          const tx = db.transaction(store, 'readwrite');
          const objectStore = tx.objectStore(store);
          tx.oncomplete = () => resolve({ ok: true });
          tx.onerror = () => resolve({ ok: false, reason: 'write' });
          tx.onabort = () => resolve({ ok: false, reason: 'write' });
          const keyPath = objectStore.keyPath;
          if (keyPath !== null) {
            // In-value key: the edited value must carry the SAME key —
            // composite paths compared element-wise via indexedDB.cmp; a
            // missing or invalid extracted key counts as changed too.
            const extracted = Array.isArray(keyPath)
              ? keyPath.map((p) => extractByPath(value, p))
              : extractByPath(value, keyPath);
            let sameKey = false;
            try {
              sameKey = indexedDB.cmp(extracted as IDBValidKey, key) === 0;
            } catch {
              sameKey = false;
            }
            if (!sameKey) {
              resolve({ ok: false, reason: 'key-changed' });
              tx.abort();
              return;
            }
            objectStore.put(value);
          } else {
            objectStore.put(value, key);
          }
        } catch {
          resolve({ ok: false, reason: 'write' });
        }
      },
    );
    db.close();
    return result;
  } catch {
    return { ok: false, reason: 'gone' };
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

export async function getIndexedDbRecordDocument(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
  primaryKeyWire: string,
): Promise<{ document: IdbRecordDocumentWire | null }> {
  if (typeof database !== 'string' || typeof store !== 'string' || typeof primaryKeyWire !== 'string') {
    return { document: null };
  }
  const result = await runInFrame(tabId, frameId, readIdbRecordDocumentInPage, [
    database,
    store,
    primaryKeyWire,
    IDB_DOCUMENT_TEXT_MAX,
  ]);
  return { document: result?.document ?? null };
}

export async function putIndexedDbRecord(
  tabId: number,
  frameId: number,
  database: string,
  store: string,
  primaryKeyWire: string,
  valueText: string,
): Promise<{ ok: boolean; reason?: IdbRecordWriteFailureWire }> {
  if (
    typeof database !== 'string' ||
    typeof store !== 'string' ||
    typeof primaryKeyWire !== 'string' ||
    typeof valueText !== 'string'
  ) {
    return { ok: false };
  }
  const result = await runInFrame(tabId, frameId, putIdbRecordInPage, [database, store, primaryKeyWire, valueText]);
  if (!result) return { ok: false, reason: 'gone' };
  if (result.ok === true) return { ok: true };
  return { ok: false, ...(result.reason ? { reason: result.reason } : {}) };
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
