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

/**
 * One cookie of a SITE-scoped jar lookup ({@link fetchCookieJarForSite}).
 * `sendable` is the browser's own decision — whether the jar would
 * attach this cookie to a request to the queried URL — so the panel can
 * badge rows the page never actually receives (path-scoped elsewhere,
 * Secure-only on an http scope, subdomain-scoped) without re-deriving
 * the matching rules itself.
 */
export interface SiteJarCookieWire extends JarCookieWire {
  sendable: boolean;
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
 * Date / `{b}` base64 binary / `{inf}` ±Infinity / `{a}` array) — total
 * over the practical IDB key space; the rare corner the codec can't
 * encode omits it, which marks the record undeletable. Opaque to the
 * panel: encoded in-page on read, passed back verbatim on
 * `deleteIndexedDbRecord`, decoded in-page again.
 */
export interface IdbRecordWire {
  keyPreview: string;
  primaryKeyPreview: string;
  valuePreview: string;
  primaryKeyWire?: string;
}

/**
 * One record's value as a full text document, serialized in-page.
 * A strictly JSON-safe value (the common case) ships as canonical
 * pretty-printed JSON with `editable: true` — the text round-trips
 * exactly through `JSON.parse`. A value carrying non-JSON
 * structured-clone types (Date, Map, Set, binary, Blob, `undefined`,
 * cycles…) ships as a readable JSON-ish rendering with
 * `editable: false` — never silently coerced into lossy JSON.
 * `truncated` marks a document cut at the size cap (always read-only).
 */
export interface IdbRecordDocumentWire {
  text: string;
  editable: boolean;
  truncated?: boolean;
}

/**
 * Why a record write was rejected: `parse` — the text isn't valid JSON
 * (checked before any transaction); `key-changed` — the store keeps its
 * key inside the value and the edited value's key no longer matches the
 * record's (saving would create a NEW record, never silently allowed);
 * `gone` — the database/store/record coordinates can't be reached
 * (deleted, undecodable key, frame unreadable); `write` — the put
 * transaction itself failed (quota, constraint).
 */
export type IdbRecordWriteFailureWire = 'parse' | 'key-changed' | 'gone' | 'write';

/** One named cache of a scope's Cache Storage. */
export interface CacheStorageCacheWire {
  name: string;
}

/**
 * One Cache Storage entry — request metadata plus two response-METADATA
 * columns (a response body preview stays the separate lazy fetch).
 * `headersPreview` is a bounded `name: value` join of the request
 * headers, omitted when the request carries none. `contentLength` is the
 * stored response's `content-length` header value, omitted when the
 * header is absent; `responseTimeMs` is the response's storage wall time
 * (epoch ms), present only on the CDP transport — the page-side Cache
 * API doesn't expose it.
 */
export interface CacheEntryWire {
  url: string;
  method: string;
  headersPreview?: string;
  contentLength?: number;
  responseTimeMs?: number;
}

/**
 * One cache entry's stored response, preview-serialized — the status
 * line, a bounded `name: value` join of the response headers, and a
 * byte-capped body slice. `bodyPreview` is UTF-8 text for textual
 * content types and base64 otherwise (`bodyBase64: true`);
 * `bodyLength` is the stored body's full byte size, `bodyTruncated`
 * marks a preview that stopped at the cap.
 */
export interface CacheEntryResponsePreviewWire {
  status: number;
  statusText: string;
  headersPreview?: string;
  bodyPreview: string;
  bodyBase64?: boolean;
  bodyLength: number;
  bodyTruncated?: boolean;
}

/** One per-type row of a storage usage breakdown (CDP tier only). */
export interface StorageQuotaBreakdownWire {
  storageType: string;
  usage: number;
}

/**
 * A scope's storage usage against its origin quota, in bytes.
 * `breakdown` is present only when the CDP tier answered — the standard
 * plane (`navigator.storage.estimate()`) reports totals only.
 * `overrideActive` marks a simulated quota (CDP tier only, see
 * `setStorageQuotaOverride`).
 */
export interface StorageQuotaWire {
  usage: number;
  quota: number;
  breakdown?: ReadonlyArray<StorageQuotaBreakdownWire>;
  overrideActive?: boolean;
}

/** The origin-scoped site-data types `clearSiteData` can remove. */
export type SiteDataTypeWire = 'cacheStorage' | 'cookies' | 'indexedDB' | 'localStorage' | 'serviceWorkers';

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

  /**
   * Fetch the SITE-wide jar for a URL — the browser's Application-panel
   * view: every cookie scoped to the URL's host or its subdomains, PLUS
   * the sendable set for the URL itself (parent-domain cookies live
   * there), deduped by identity. Each row carries `sendable` — the
   * browser's own would-it-be-attached verdict for the queried URL — so
   * the Storage tool window can list cookies the page never receives
   * and badge them. `cookies` is `null` on lookup failure.
   */
  fetchCookieJarForSite: {
    req: { url: string };
    res: { cookies: ReadonlyArray<SiteJarCookieWire> | null };
  };

  /**
   * Delete every cookie of the URL's site-wide jar (the same set
   * {@link fetchCookieJarForSite} enumerates) — the Cookies section's
   * "Clear all". `ok` is `false` when any single remove failed, so the
   * panel can surface a partial clear.
   */
  clearCookiesForSite: {
    req: { url: string };
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
   * `pageSize` is clamped SW-side. `index` scopes the read to one of the
   * store's indexes — the cursor walks the index, `keyPreview` becomes
   * the index key, and `primaryKeyWire` keeps carrying the record
   * identity so deletes work from an index view. Records arrive
   * preview-serialized (see {@link IdbRecordWire}); `truncated` means
   * more records exist past this page. `records` is `null` when
   * injection fails or the database/store/index is gone.
   */
  getIndexedDbRecords: {
    req: {
      tabId: number;
      frameId: number;
      database: string;
      store: string;
      page: number;
      pageSize: number;
      index?: string;
    };
    res: { records: ReadonlyArray<IdbRecordWire> | null; truncated?: boolean };
  };

  /**
   * Lazy one-shot fetch of one record's value as a full text document
   * (see {@link IdbRecordDocumentWire}) — the record-list previews stay
   * flat strings; this is what an editor-tab open pays for.
   * `primaryKeyWire` is the record identity the read RPC returned.
   * `document` is `null` when injection fails, the database/store/record
   * is gone, or the key can't be decoded.
   */
  getIndexedDbRecordDocument: {
    req: { tabId: number; frameId: number; database: string; store: string; primaryKeyWire: string };
    res: { document: IdbRecordDocumentWire | null };
  };

  /**
   * Write one record's value back from its edited document text —
   * same-key only. `valueText` must be exact JSON (only documents the
   * read RPC marked `editable: true` qualify; JSON-ish renderings never
   * gain a write path). The value is parsed and put in-page: a store
   * with an in-value keyPath rejects an edit whose key differs from the
   * record's (`key-changed`) instead of silently creating a duplicate;
   * out-of-line keys put with the decoded wire key. `reason` explains a
   * failure (see {@link IdbRecordWriteFailureWire}), absent on invalid
   * arguments.
   */
  putIndexedDbRecord: {
    req: { tabId: number; frameId: number; database: string; store: string; primaryKeyWire: string; valueText: string };
    res: { ok: boolean; reason?: IdbRecordWriteFailureWire };
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

  /**
   * Read one scope's storage usage against its origin quota. Arbitrated
   * like the Cache Storage reads: `Storage.getUsageAndQuota` (with the
   * per-type breakdown) when the tab is CDP-attached, degrading to an
   * injected `navigator.storage.estimate()` (totals only, secure
   * contexts) on any failure. `quota` is `null` when neither transport
   * can answer.
   */
  getStorageQuota: {
    req: { tabId: number; frameId: number };
    res: { quota: StorageQuotaWire | null };
  };

  /**
   * Clear the scope's site data — cookies, DOM storage, IndexedDB,
   * Cache Storage and service worker registrations for its origin. Rides
   * the browser's own origin-scoped clearing API (a background-only
   * surface), so it works in both inspection modes; `ok` is `false` when
   * the origin can't be derived or the API is unavailable/denied.
   * `types` narrows the clear to a subset; absent means all five.
   */
  clearSiteData: {
    req: { tabId: number; frameId: number; types?: ReadonlyArray<SiteDataTypeWire> };
    res: { ok: boolean };
  };

  /**
   * Simulate a custom storage quota for the scope's origin (CDP tier
   * only — the standard plane has no such control). `quotaBytes` sets
   * the override; omitting it clears the simulation. `ok` is `false`
   * when the tab isn't attached, the origin can't be derived, or the
   * value is malformed.
   */
  setStorageQuotaOverride: {
    req: { tabId: number; frameId: number; quotaBytes?: number };
    res: { ok: boolean };
  };

  /**
   * Fetch one cache entry's stored-response preview — a SEPARATE lazy
   * RPC so the entry list never touches responses. Arbitrated like the
   * other Cache Storage ops: the CDP tier resolves the entry and its
   * base64 body when the tab is attached, degrading to an injected
   * `cache.match` on any failure. Bounds live SW-side (see
   * {@link CacheEntryResponsePreviewWire}); `method` relaxes the match
   * for non-GET entries, as on delete. `preview` is `null` when the
   * entry is gone or neither transport can read it.
   */
  getCacheStorageEntryResponse: {
    req: { tabId: number; frameId: number; cache: string; url: string; method: string };
    res: { preview: CacheEntryResponsePreviewWire | null };
  };

  /** Delete a whole named cache. */
  deleteCacheStorageCache: {
    req: { tabId: number; frameId: number; cache: string };
    res: { ok: boolean };
  };

  /**
   * Delete one cache entry by its request URL. `method` is the entry's
   * request method as the read RPC returned it — a non-GET entry is
   * matched with the method check relaxed, since URL strings are the
   * only match key both transports share.
   */
  deleteCacheStorageEntry: {
    req: { tabId: number; frameId: number; cache: string; url: string; method: string };
    res: { ok: boolean };
  };
}
