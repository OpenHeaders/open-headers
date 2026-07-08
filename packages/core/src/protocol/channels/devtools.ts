/**
 * DevTools-panel bridge RPCs — SW-routed lookups the panel page can't
 * make itself because its CSP / permission surface is narrower than a
 * background context's.
 */

/**
 * Host-neutral cookie shape carried over the bridge — a superset of the
 * fields the four supported MV3 cookie APIs report. Mirrors the panel's
 * `JarCookie` so non-Chromium hosts can implement the same contract
 * without a type-only dependency on the chrome namespace.
 */
export interface JarCookieWire {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  session: boolean;
  partitionKey?: string;
  storeId?: string;
}

/**
 * Editable cookie fields the panel sends when adding or updating a
 * cookie. `session` is derived (no `expirationDate` ⇒ session) and
 * `hostOnly` is honoured by the writer (omit the Domain attribute), so
 * neither is a separate input.
 */
export interface JarCookieEditWire {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  partitionKey?: string;
  storeId?: string;
}

/** Identity fields the writer needs to delete a single jar cookie. */
export interface JarCookieKeyWire {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  partitionKey?: string;
  storeId?: string;
}

/** Which DOM storage area a storage-inspector read targets. */
export type DomStorageAreaWire = 'local' | 'session';

/**
 * One inspectable storage scope of the inspected tab — a frame whose
 * http(s) origin owns DOM storage. Same-origin frames collapse to one
 * scope (they share both storage areas within a tab); `frameId` is the
 * topmost frame carrying that origin, used as the injection target.
 */
export interface StorageScopeWire {
  frameId: number;
  origin: string;
  url: string;
  isMainFrame: boolean;
  /**
   * The scope's serialized storage key (`Storage.getStorageKey`), stamped
   * only while the tab is CDP-attached — the standard plane can't observe
   * partitioning. Display-only: reads and writes stay keyed by frame.
   */
  storageKey?: string;
}

/**
 * One DOM storage entry. `value` is clipped to the wire preview cap
 * (`clipped: true`, `valueLength` carries the full length) so a single
 * multi-megabyte value can't swamp the bridge.
 */
export interface DomStorageEntryWire {
  key: string;
  value: string;
  valueLength: number;
  clipped?: boolean;
}

/** One object store of an IndexedDB database. A composite keyPath is
 *  serialized as a comma-joined display string; absent ⇒ out-of-line keys. */
export interface IdbObjectStoreWire {
  name: string;
  keyPath?: string;
  autoIncrement: boolean;
  indexNames: ReadonlyArray<string>;
}

export interface IdbDatabaseWire {
  name: string;
  version: number;
  objectStores: ReadonlyArray<IdbObjectStoreWire>;
}

/**
 * One IndexedDB record, PREVIEW-SERIALIZED in-page (type-tagged,
 * depth- and length-capped strings) — IDB values are structured-clone
 * types, not JSON, and must never ride the bridge whole.
 *
 * `primaryKeyWire` is a LOSSLESS encoding of the record's primary key
 * (JSON of tagged nodes: `{s}` string / `{n}` finite number / `{d}` ISO
 * Date / `{a}` array), present only when the key is exactly encodable —
 * binary keys and non-finite numbers omit it, which marks the record
 * undeletable. Opaque to the panel: encoded in-page on read, passed
 * back verbatim on `deleteIndexedDbRecord`, decoded in-page again.
 */
export interface IdbRecordWire {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
  primaryKeyWire?: string;
}

/** One named cache of a scope's Cache Storage. */
export interface CacheStorageCacheWire {
  name: string;
}

/**
 * One Cache Storage entry, derived from the cache's `Request` keys only —
 * the entry list never touches the stored responses (a response preview
 * is a separate lazy fetch). `headersPreview` is a bounded `name: value`
 * join of the request headers, omitted when the request carries none.
 */
export interface CacheEntryWire {
  url: string;
  method: string;
  headersPreview?: string;
}

export interface DevToolsRpc {
  // ── DevTools panel: source-map resolution ──────────────────────
  /**
   * Fetch the source map associated with a JS URL — the DevTools panel
   * uses this for its Initiator-tab call-stack to substitute the
   * minified V8 function names with their original (pre-minify) names.
   *
   * Routed through the SW because the DevTools panel page runs under
   * `default-src 'self'` CSP, so direct cross-origin fetches from the
   * renderer are blocked. The SW carries the extension's full host
   * permissions and is unaffected.
   *
   * The SW takes the JS URL, fetches the file, discovers the
   * `sourceMappingURL` (HTTP header first, trailing `//# sourceMappingURL=`
   * comment fallback), resolves the map URL (including `data:` inline
   * maps), fetches the map, and returns the raw map text. The renderer
   * parses it via the pure helpers in `panel/data/source-map.ts`.
   *
   * `mapText` is `null` whenever any step fails — no map, 404, malformed
   * — so the renderer falls back to the raw V8 frame name.
   */
  fetchSourceMapText: {
    req: { jsUrl: string };
    res: { mapText: string | null };
  };

  // ── DevTools panel: cookie-jar lookup ──────────────────────────
  /**
   * Fetch the cookies the browser jar holds for a given URL — the
   * DevTools panel's Cookies tab uses this to join the sparse HAR
   * request-cookie data (name + value only) with the full attribute
   * set (Domain, Path, Expires, HttpOnly, Secure, SameSite, Partition).
   *
   * Routed through the SW because `chrome.cookies` is not exposed to
   * the panel page — only background contexts hold the `cookies`
   * permission's API surface. Caller passes the request URL; SW calls
   * `chrome.cookies.getAll({ url })` and returns a host-neutral
   * shape (`JarCookie[]`) so non-Chromium hosts can implement the
   * same contract.
   *
   * `cookies` is `null` when the lookup fails (permission denied,
   * extension context torn down) so the renderer can fall back to
   * the HAR-only view silently.
   */
  fetchCookieJarForUrl: {
    req: { url: string };
    res: { cookies: ReadonlyArray<JarCookieWire> | null };
  };

  // ── DevTools panel: cookie-jar writes ──────────────────────────
  /**
   * Add or update a cookie in the browser jar — the panel's Cookies tab
   * uses this to edit cookies the page's own JS can't touch (HttpOnly is
   * the developer value here: `document.cookie` can't set it, the
   * extension's `cookies` permission can).
   *
   * Routed through the SW for the same reason as the read path —
   * `chrome.cookies` is a background-only API. The SW reconstructs the
   * request URL from the cookie's own domain/path/secure (a host-only
   * domain drops the leading dot), calls `chrome.cookies.set`, and
   * returns the resulting jar cookie (`null` on failure — bad domain,
   * permission denied).
   */
  setCookieForUrl: {
    req: { cookie: JarCookieEditWire };
    res: { cookie: JarCookieWire | null };
  };

  /**
   * Delete a cookie from the browser jar by identity. The SW
   * reconstructs the URL the same way and calls `chrome.cookies.remove`;
   * `ok` is `false` when no matching cookie was removed.
   */
  removeCookieForUrl: {
    req: JarCookieKeyWire;
    res: { ok: boolean };
  };

  // ── DevTools panel: application-storage inspector ───────────────
  /**
   * Enumerate the inspected tab's storage scopes — the distinct http(s)
   * origins its frame tree holds, main frame first.
   *
   * Routed through the SW because frame enumeration
   * (`chrome.webNavigation.getAllFrames`) is a background-only API.
   * `scopes` is `null` when the tab can't be enumerated (closed,
   * browser-internal page) so the panel renders its empty state.
   */
  listStorageScopes: {
    req: { tabId: number };
    res: { scopes: ReadonlyArray<StorageScopeWire> | null };
  };

  /**
   * Read one scope's localStorage or sessionStorage. The SW injects a
   * reader into the scope's frame (`chrome.scripting`, isolated world —
   * DOM storage is shared per origin, so the isolated world sees the
   * page's data); there is no extension API for DOM storage and the
   * CDP `DOMStorage` domain is not dispatched for extension debugger
   * clients (see docs/STORAGE_PANEL_PLAN.md §2.3).
   *
   * `entries` is `null` when injection fails (frame gone, page not
   * injectable). `truncated` marks an entry-count cap hit; per-value
   * clipping is flagged on the entry itself.
   */
  getDomStorageEntries: {
    req: { tabId: number; frameId: number; area: DomStorageAreaWire };
    res: { entries: ReadonlyArray<DomStorageEntryWire> | null; truncated?: boolean };
  };

  /**
   * Fetch one entry's FULL value, past the preview clip — the panel needs
   * it before editing a clipped entry (saving a clipped preview back would
   * corrupt the value). Still bounded: a value past the sanity ceiling
   * returns `value: null` with `tooLarge: true` and the panel blocks the
   * edit instead. `value` is also `null` when the key is gone or the
   * injection failed (`tooLarge` absent).
   */
  getDomStorageValue: {
    req: { tabId: number; frameId: number; area: DomStorageAreaWire; key: string };
    res: { value: string | null; tooLarge?: boolean };
  };

  /**
   * Write one DOM storage entry (add or overwrite — Storage has no
   * distinction). Same injection transport as the reads: the isolated
   * world shares the page origin's storage, and the CDP `DOMStorage`
   * domain is blocked for extension debugger clients, so injection is
   * the only write path in BOTH inspection modes. `ok` is `false` when
   * the injection failed or the write threw (quota exceeded).
   */
  setDomStorageItem: {
    req: { tabId: number; frameId: number; area: DomStorageAreaWire; key: string; value: string };
    res: { ok: boolean };
  };

  /** Remove one DOM storage entry by key. */
  removeDomStorageItem: {
    req: { tabId: number; frameId: number; area: DomStorageAreaWire; key: string };
    res: { ok: boolean };
  };

  /** Clear the whole area for the scope's origin. */
  clearDomStorage: {
    req: { tabId: number; frameId: number; area: DomStorageAreaWire };
    res: { ok: boolean };
  };

  /**
   * Enumerate one scope's IndexedDB databases with their object-store
   * shapes. Injection-only, like DOM storage — the CDP `IndexedDB`
   * domain is not dispatched for extension debugger clients
   * (docs/STORAGE_PANEL_PLAN.md §2.3); the reader rides
   * `indexedDB.databases()` plus a versionless open per database.
   * `databases` is `null` when injection fails or the page has no
   * IndexedDB reach (opaque origin, API unavailable).
   */
  listIndexedDbDatabases: {
    req: { tabId: number; frameId: number };
    res: { databases: ReadonlyArray<IdbDatabaseWire> | null };
  };

  /**
   * Cursor-paged read of one object store. `page` is zero-based;
   * `pageSize` is clamped SW-side. Records arrive preview-serialized
   * (see {@link IdbRecordWire}); `truncated` means more records exist
   * past this page. `records` is `null` when injection fails or the
   * database/store is gone.
   */
  getIndexedDbRecords: {
    req: { tabId: number; frameId: number; database: string; store: string; page: number; pageSize: number };
    res: { records: ReadonlyArray<IdbRecordWire> | null; truncated?: boolean };
  };

  /**
   * Delete one record by its exact primary key. `primaryKeyWire` is the
   * lossless key encoding the read RPC returned (see {@link IdbRecordWire});
   * a record without one can't be deleted. `ok: false` covers injection
   * failure, a gone database/store, and an undecodable key.
   */
  deleteIndexedDbRecord: {
    req: { tabId: number; frameId: number; database: string; store: string; primaryKeyWire: string };
    res: { ok: boolean };
  };

  /** Clear every record of one object store. */
  clearIndexedDbStore: {
    req: { tabId: number; frameId: number; database: string; store: string };
    res: { ok: boolean };
  };

  /**
   * Delete a whole database. `ok: false` when the request reports an
   * error OR blocks — a page holding open connections blocks the delete
   * indefinitely, so the panel surfaces failure rather than spinning.
   */
  deleteIndexedDbDatabase: {
    req: { tabId: number; frameId: number; database: string };
    res: { ok: boolean };
  };

  /**
   * Enumerate one scope's Cache Storage caches. `caches` is `null` when
   * injection fails or the frame has no `caches` reach — the API exists
   * in secure contexts only, so an http: scope always reads `null` (the
   * panel renders an explanatory empty state, not an error).
   */
  listCacheStorageCaches: {
    req: { tabId: number; frameId: number };
    res: { caches: ReadonlyArray<CacheStorageCacheWire> | null };
  };

  /**
   * Paged read of one cache's entries via `cache.keys()`. `page` is
   * zero-based; `pageSize` is clamped SW-side. Entries carry request
   * metadata only (see {@link CacheEntryWire}); `truncated` means more
   * entries exist past this page. `entries` is `null` when injection
   * fails or the cache is gone.
   */
  getCacheStorageEntries: {
    req: { tabId: number; frameId: number; cache: string; page: number; pageSize: number };
    res: { entries: ReadonlyArray<CacheEntryWire> | null; truncated?: boolean };
  };
}
