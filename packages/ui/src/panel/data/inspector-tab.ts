import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { JarCookieKey } from './cookies/cookie-jar-cache';
import type { DomStorageArea } from './storage/storage-inspector-host';

export type DetailSection =
  | 'headers'
  | 'payload'
  | 'preview'
  | 'response'
  | 'initiator'
  | 'timing'
  | 'cookies'
  | 'messages'
  | 'eventstream'
  | 'rawdata';

export type TabSource = 'network' | 'rules';

/**
 * The editor hosts more than network requests: a tab is a discriminated
 * union, one arm per document kind. Every arm carries what its body
 * needs to render (and re-fetch) independently of the tool window it
 * was opened from.
 */
export type InspectorTab =
  | RequestInspectorTab
  | IdbRecordInspectorTab
  | DomStorageEntryInspectorTab
  | CookieInspectorTab
  | CacheEntryInspectorTab;

export interface RequestInspectorTab {
  kind: 'request';
  id: string;
  label: string;
  method: string;
  statusCode?: number;
  url: string;
  activeSection: DetailSection;
  requestId: string;
  timestamp: number;
  source: TabSource;
  displayId: number;
}

/** One IndexedDB record opened as a full-editor document. */
export interface IdbRecordInspectorTab {
  kind: 'idb-record';
  id: string;
  label: string;
  frameId: number;
  database: string;
  store: string;
  /** The record's lossless key encoding — the fetch identity. */
  primaryKeyWire: string;
  keyPreview: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One localStorage / sessionStorage entry opened as a full-editor document. */
export interface DomStorageEntryInspectorTab {
  kind: 'dom-storage-entry';
  id: string;
  label: string;
  frameId: number;
  area: DomStorageArea;
  /** The entry's storage key — the fetch identity. A committed rename
   *  patches it (and the id) in place via `entryKey`. */
  entryKey: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One browser-jar cookie opened as a full-editor document. */
export interface CookieInspectorTab {
  kind: 'cookie';
  id: string;
  label: string;
  /** The cookie's jar identity — the fetch key. A committed identity
   *  change (name / domain / path) patches it (and the id) in place via
   *  `cookieKey`. */
  cookieKey: JarCookieKey;
  /** Site-jar lookup URL captured at open time — the re-fetch scope. */
  scopeUrl: string;
  timestamp: number;
  /** Mirror of the editor body's unsaved-draft state — drives the tab
   *  pill's dirty dot and the close guard. Never persisted (drafts are
   *  component state and don't survive a reload). */
  dirty?: boolean;
}

/** One Cache Storage entry's stored response opened as a read-only
 *  editor document. No draft, no dirty — Cache Storage has no write
 *  seam; delete is the only mutation. */
export interface CacheEntryInspectorTab {
  kind: 'cache-entry';
  id: string;
  label: string;
  frameId: number;
  /** The entry's fetch identity: cache name + request URL + method. */
  cache: string;
  url: string;
  method: string;
  timestamp: number;
}

/** Per-tab view state callers patch in place. Each field applies to
 *  matching tab kinds only (`activeSection` → request, `dirty` →
 *  document kinds, `entryKey` → dom-storage-entry, `cookieKey` →
 *  cookie); the tree transform drops fields foreign to the tab's kind. */
export interface InspectorTabPatch {
  activeSection?: DetailSection;
  dirty?: boolean;
  /** Committed rename: rewrites the entry key AND the identity-derived
   *  id/label so re-opens and row highlights keep matching. */
  entryKey?: string;
  /** Committed cookie identity change — same identity-move semantics
   *  as `entryKey`, over the jar key. */
  cookieKey?: JarCookieKey;
}

/** Does this tab carry an unsaved editor draft? (Request tabs never do,
 *  and cache-entry documents are read-only.) */
export function tabIsDirty(tab: InspectorTab): boolean {
  return tab.kind !== 'request' && tab.kind !== 'cache-entry' && tab.dirty === true;
}

export interface ClosedTab {
  tab: InspectorTab;
  closedAt: number;
}

export interface BuildInspectorTabInput {
  lifecycle: RequestLifecycle;
  displayId: number;
}

export function buildInspectorTab(input: BuildInspectorTabInput, source: TabSource = 'network'): RequestInspectorTab {
  const lc = input.lifecycle;
  let hostname: string;
  let path: string;
  try {
    const parsed = new URL(lc.url);
    hostname = parsed.hostname;
    // Don't show trailing "/" for root URLs — matches the native Network tab.
    path = parsed.pathname === '/' ? '' : parsed.pathname;
  } catch {
    hostname = '';
    path = lc.url;
  }

  const domainPart = hostname.length > 20 ? `…${hostname.slice(-17)}` : hostname;
  const pathPart = path.length > 24 ? `…${path.slice(-21)}` : path;
  const label = `#${input.displayId} ${domainPart}${pathPart}`;

  return {
    kind: 'request',
    id: lc.requestId,
    label,
    method: lc.method,
    ...(lc.statusCode != null ? { statusCode: lc.statusCode } : {}),
    url: lc.url,
    activeSection: 'headers',
    requestId: lc.requestId,
    timestamp: lc.startedAtMs,
    source,
    displayId: input.displayId,
  };
}

export interface BuildIdbRecordTabInput {
  frameId: number;
  database: string;
  store: string;
  primaryKeyWire: string;
  keyPreview: string;
  timestamp: number;
}

/** Record identity IS the tab identity — shared with the Storage window
 *  so an open record's row can light up in the store's record list. */
export function idbRecordTabId(frameId: number, database: string, store: string, primaryKeyWire: string): string {
  return `idb:${frameId}:${database}:${store}:${primaryKeyWire}`;
}

export function buildIdbRecordTab(input: BuildIdbRecordTabInput): IdbRecordInspectorTab {
  return {
    kind: 'idb-record',
    // Re-opening the same record activates the existing tab instead of
    // spawning a duplicate.
    id: idbRecordTabId(input.frameId, input.database, input.store, input.primaryKeyWire),
    label: input.keyPreview,
    frameId: input.frameId,
    database: input.database,
    store: input.store,
    primaryKeyWire: input.primaryKeyWire,
    keyPreview: input.keyPreview,
    timestamp: input.timestamp,
  };
}

export interface BuildDomStorageEntryTabInput {
  frameId: number;
  area: DomStorageArea;
  entryKey: string;
  timestamp: number;
}

/** Entry identity IS the tab identity — shared with the Storage window
 *  so an open entry's row can light up in the grid. */
export function domStorageEntryTabId(frameId: number, area: DomStorageArea, entryKey: string): string {
  return `dom:${frameId}:${area}:${entryKey}`;
}

export function buildDomStorageEntryTab(input: BuildDomStorageEntryTabInput): DomStorageEntryInspectorTab {
  return {
    kind: 'dom-storage-entry',
    // Re-opening the same entry activates the existing tab instead of
    // spawning a duplicate.
    id: domStorageEntryTabId(input.frameId, input.area, input.entryKey),
    label: input.entryKey,
    frameId: input.frameId,
    area: input.area,
    entryKey: input.entryKey,
    timestamp: input.timestamp,
  };
}

export interface BuildCookieTabInput {
  cookieKey: JarCookieKey;
  scopeUrl: string;
  timestamp: number;
}

/** Cookie identity IS the tab identity — shared with the Storage window
 *  so an open cookie's row can light up in the Cookies section. */
export function cookieTabId(key: JarCookieKey): string {
  return `cookie:${key.name}:${key.domain}:${key.path}:${key.partitionKey ?? ''}`;
}

export function buildCookieTab(input: BuildCookieTabInput): CookieInspectorTab {
  return {
    kind: 'cookie',
    // Re-opening the same cookie activates the existing tab instead of
    // spawning a duplicate.
    id: cookieTabId(input.cookieKey),
    label: input.cookieKey.name,
    cookieKey: input.cookieKey,
    scopeUrl: input.scopeUrl,
    timestamp: input.timestamp,
  };
}

export interface BuildCacheEntryTabInput {
  frameId: number;
  cache: string;
  url: string;
  method: string;
  timestamp: number;
}

/** Entry identity IS the tab identity — shared with the Storage window
 *  so an open entry's row can light up in the cache's entry grid. */
export function cacheEntryTabId(frameId: number, cache: string, url: string, method: string): string {
  return `cacheentry:${frameId}:${cache}:${method}:${url}`;
}

/** The pill label for a cache entry — the URL's last path segment,
 *  falling back to the hostname for root URLs. */
export function cacheEntryLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    const last = segments[segments.length - 1];
    return last !== undefined ? `${last}${parsed.search}` : parsed.hostname;
  } catch {
    return url;
  }
}

export function buildCacheEntryTab(input: BuildCacheEntryTabInput): CacheEntryInspectorTab {
  return {
    kind: 'cache-entry',
    // Re-opening the same entry activates the existing tab instead of
    // spawning a duplicate.
    id: cacheEntryTabId(input.frameId, input.cache, input.url, input.method),
    label: cacheEntryLabel(input.url),
    frameId: input.frameId,
    cache: input.cache,
    url: input.url,
    method: input.method,
    timestamp: input.timestamp,
  };
}

/** The DOM storage area's display name (`localStorage` / `sessionStorage`). */
export function domStorageAreaName(area: DomStorageArea): string {
  return area === 'session' ? 'sessionStorage' : 'localStorage';
}

/** Full-detail hover title for a tab pill. */
export function tabTitle(tab: InspectorTab): string {
  if (tab.kind === 'request') return tab.url;
  if (tab.kind === 'idb-record') return `${tab.database} › ${tab.store} › ${tab.keyPreview}`;
  if (tab.kind === 'cookie') return `${tab.cookieKey.domain}${tab.cookieKey.path} › ${tab.cookieKey.name}`;
  if (tab.kind === 'cache-entry') return `${tab.cache} › ${tab.url}`;
  return `${domStorageAreaName(tab.area)} › ${tab.entryKey}`;
}

/** The pill's short label (request labels drop their method prefix). */
export function tabPillLabel(tab: InspectorTab): string {
  return tab.kind === 'request' ? tab.label.replace(/^[A-Z]+ /, '') : tab.label;
}

/** Haystack the tab-search dropdown matches against. */
export function tabSearchText(tab: InspectorTab): string {
  if (tab.kind === 'request') return tab.url;
  if (tab.kind === 'idb-record') return `${tab.database} ${tab.store} ${tab.keyPreview}`;
  if (tab.kind === 'cookie') return `${tab.cookieKey.name} ${tab.cookieKey.domain} ${tab.cookieKey.path}`;
  if (tab.kind === 'cache-entry') return `${tab.cache} ${tab.url} ${tab.method}`;
  return `${domStorageAreaName(tab.area)} ${tab.entryKey}`;
}
