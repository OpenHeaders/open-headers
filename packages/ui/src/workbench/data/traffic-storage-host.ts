/**
 * Workbench-side storage host — binds the shared Storage tool window to
 * the daemon's storage relay (the observability plan Phase 3).
 *
 * Every `StorageInspectorHost` method becomes one
 * `oh.daemon.telemetry.storage.call` (the extension executes the verb —
 * the actuator model; the desktop never touches browser APIs), and the
 * invalidation subscription rides the qualified storage lifeline
 * (`oh-storage:<tabId>@<nodeId>`) — per-consumer at the relay, the
 * telemetry plane's law.
 *
 * Browser tab ids collide across browsers, so the workbench NEVER
 * threads raw ones through the shared components. It mints an opaque
 * LOCAL HANDLE per `(nodeId, tabId)` pair ({@link trafficStorageHandle},
 * provided via `InspectedTabContext`), and this host translates the
 * handle back on every call — an open storage-document editor tab stays
 * correctly bound to its peer while the rail selection moves elsewhere.
 *
 * The cookie-jar seams are URL-keyed (no tab identity on the seam), so
 * they route to the LAST-SET cookie target — the rail selection
 * ({@link setTrafficStorageCookieTarget}, which also drops the URL-keyed
 * jar cache so one peer's jar never renders under another's scope). The
 * cookie EDITOR tab is the one surface that inherits this binding
 * rather than a frozen handle.
 */

import { lifelineTransport } from '@openheaders/core/awareness';
import { hostBridge } from '@openheaders/core/bridge';
import { qualifiedStoragePortName, type TelemetryStorageMethod } from '@openheaders/core/protocol';
import type {
  CookieWriteResult,
  JarCookie,
  JarCookieEdit,
  JarCookieKey,
  SiteJarCookie,
} from '../../panel/host-cookie-jar';
import {
  invalidateJarCache,
  setCookieJarFetcher,
  setCookieJarWriter,
  setSiteCookieJarFetcher,
} from '../../panel/host-cookie-jar';
import type {
  CacheEntriesPage,
  CacheEntryDocument,
  CacheSummary,
  DomStorageArea,
  DomStorageFullValue,
  DomStorageRenameResult,
  DomStorageSnapshot,
  IdbDatabase,
  IdbRecordDocument,
  IdbRecordsPage,
  IdbRecordWriteResult,
  SiteDataType,
  StorageInvalidationKind,
  StorageQuota,
  StorageScope,
} from '../../panel/host-storage-inspector';
import { setStorageInspectorHost } from '../../panel/host-storage-inspector';

interface StorageTarget {
  readonly nodeId: string;
  readonly tabId: number;
}

const handleByTarget = new Map<string, number>();
const targetByHandle = new Map<number, StorageTarget>();
let handleSeq = 0;

/**
 * The stable local handle for a watched `(peer, tab)` pair — what the
 * workbench provides as the "inspected tab" to every shared storage
 * surface it mounts. Stable for the renderer's lifetime, so editor tabs
 * and pane remounts of the same pair share one handle.
 */
export function trafficStorageHandle(nodeId: string, tabId: number): number {
  const key = `${tabId}@${nodeId}`;
  const existing = handleByTarget.get(key);
  if (existing !== undefined) return existing;
  const handle = ++handleSeq;
  handleByTarget.set(key, handle);
  targetByHandle.set(handle, { nodeId, tabId });
  return handle;
}

function targetOf(handle: number): StorageTarget | null {
  return targetByHandle.get(handle) ?? null;
}

/**
 * One relayed storage verb. `params` carries the verb's own wire shape
 * with the REAL browser tab id; the reply payload is the verb's wire
 * response, narrowed by the caller at this wire boundary.
 */
async function relayCall<T>(nodeId: string, method: TelemetryStorageMethod, params: unknown): Promise<T | null> {
  try {
    const res = await hostBridge.call('oh.daemon.telemetry.storage.call', { nodeId, method, params });
    if (!res.ok) return null;
    return (res.payload ?? null) as T | null;
  } catch {
    return null;
  }
}

// ── Cookie target (URL-keyed seams have no tab identity) ─────────────

let cookieTarget: string | null = null;

/** Bind the cookie-jar seams to one peer (the rail selection); `null`
 *  unbinds. A change drops the URL-keyed jar cache — one browser's jar
 *  must never render under another's scope. */
export function setTrafficStorageCookieTarget(nodeId: string | null): void {
  if (cookieTarget === nodeId) return;
  cookieTarget = nodeId;
  invalidateJarCache();
}

// ── Invalidation lifeline (per watched pair, listener-refcounted) ────

interface InvalidationChannel {
  listeners: Set<{ kind: StorageInvalidationKind; listener: () => void }>;
  disconnect: (() => void) | null;
  closed: boolean;
}

const RECONNECT_DELAY_MS = 250;

const channels = new Map<number, InvalidationChannel>();

function openChannel(handle: number, target: StorageTarget, channel: InvalidationChannel): void {
  if (channel.closed) return;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleReconnect = (): void => {
    if (channel.closed || reconnectTimer !== null) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openChannel(handle, target, channel);
    }, RECONNECT_DELAY_MS);
  };
  try {
    const port = lifelineTransport.connect(qualifiedStoragePortName(target.tabId, target.nodeId));
    port.onMessage<{ tabId: number; kind: StorageInvalidationKind }>((message) => {
      if (typeof message?.kind !== 'string') return;
      for (const entry of channel.listeners) {
        if (entry.kind === message.kind) entry.listener();
      }
    });
    port.onDisconnect(() => {
      channel.disconnect = null;
      scheduleReconnect();
    });
    channel.disconnect = () => port.disconnect();
  } catch {
    scheduleReconnect();
  }
}

function subscribeInvalidations(handle: number, kind: StorageInvalidationKind, listener: () => void): () => void {
  const target = targetOf(handle);
  if (target === null) return () => {};
  let channel = channels.get(handle);
  if (!channel) {
    channel = { listeners: new Set(), disconnect: null, closed: false };
    channels.set(handle, channel);
    openChannel(handle, target, channel);
  }
  const entry = { kind, listener };
  channel.listeners.add(entry);
  return () => {
    const live = channels.get(handle);
    if (!live) return;
    live.listeners.delete(entry);
    if (live.listeners.size === 0) {
      live.closed = true;
      live.disconnect?.();
      channels.delete(handle);
    }
  };
}

// ── Seam installation ────────────────────────────────────────────────

let installed = false;

/** Install the workbench's storage + cookie seams once (idempotent);
 *  called by the Traffic Monitor before it mounts a storage surface. */
export function installTrafficStorageHost(): void {
  if (installed) return;
  installed = true;

  setStorageInspectorHost({
    async listScopes(handle: number): Promise<ReadonlyArray<StorageScope> | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ scopes: ReadonlyArray<StorageScope> | null }>(target.nodeId, 'listStorageScopes', {
        tabId: target.tabId,
      });
      return res?.scopes ?? null;
    },
    async readDomStorage(handle: number, frameId: number, area: DomStorageArea): Promise<DomStorageSnapshot | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{
        entries: ReadonlyArray<DomStorageSnapshot['entries'][number]> | null;
        truncated?: boolean;
      }>(target.nodeId, 'getDomStorageEntries', { tabId: target.tabId, frameId, area });
      if (!res?.entries) return null;
      return { entries: res.entries, truncated: res.truncated ?? false };
    },
    async readDomStorageValue(
      handle: number,
      frameId: number,
      area: DomStorageArea,
      key: string,
    ): Promise<DomStorageFullValue | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ value: string | null; tooLarge?: boolean }>(target.nodeId, 'getDomStorageValue', {
        tabId: target.tabId,
        frameId,
        area,
        key,
      });
      if (!res) return null;
      return { value: res.value, tooLarge: res.tooLarge ?? false };
    },
    async writeDomStorage(
      handle: number,
      frameId: number,
      area: DomStorageArea,
      key: string,
      value: string,
    ): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'setDomStorageItem', {
        tabId: target.tabId,
        frameId,
        area,
        key,
        value,
      });
      return res?.ok === true;
    },
    async renameDomStorage(
      handle: number,
      frameId: number,
      area: DomStorageArea,
      key: string,
      newKey: string,
      value: string,
    ): Promise<DomStorageRenameResult> {
      const target = targetOf(handle);
      if (!target) return { ok: false };
      const res = await relayCall<DomStorageRenameResult>(target.nodeId, 'renameDomStorageItem', {
        tabId: target.tabId,
        frameId,
        area,
        key,
        newKey,
        value,
      });
      if (!res) return { ok: false };
      return res.ok === true ? { ok: true } : { ok: false, ...(res.reason ? { reason: res.reason } : {}) };
    },
    async removeDomStorage(handle: number, frameId: number, area: DomStorageArea, key: string): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'removeDomStorageItem', {
        tabId: target.tabId,
        frameId,
        area,
        key,
      });
      return res?.ok === true;
    },
    async clearDomStorage(handle: number, frameId: number, area: DomStorageArea): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'clearDomStorage', {
        tabId: target.tabId,
        frameId,
        area,
      });
      return res?.ok === true;
    },
    async listIndexedDb(handle: number, frameId: number): Promise<ReadonlyArray<IdbDatabase> | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ databases: ReadonlyArray<IdbDatabase> | null }>(
        target.nodeId,
        'listIndexedDbDatabases',
        { tabId: target.tabId, frameId },
      );
      return res?.databases ?? null;
    },
    async readIndexedDbRecords(
      handle: number,
      frameId: number,
      database: string,
      store: string,
      page: number,
      pageSize: number,
      index?: string,
    ): Promise<IdbRecordsPage | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ records: IdbRecordsPage['records'] | null; truncated?: boolean }>(
        target.nodeId,
        'getIndexedDbRecords',
        { tabId: target.tabId, frameId, database, store, page, pageSize, index },
      );
      if (!res?.records) return null;
      return { records: res.records, truncated: res.truncated ?? false };
    },
    async readIndexedDbRecordDocument(
      handle: number,
      frameId: number,
      database: string,
      store: string,
      primaryKeyWire: string,
    ): Promise<IdbRecordDocument | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ document: IdbRecordDocument | null }>(target.nodeId, 'getIndexedDbRecordDocument', {
        tabId: target.tabId,
        frameId,
        database,
        store,
        primaryKeyWire,
      });
      return res?.document ?? null;
    },
    async writeIndexedDbRecord(
      handle: number,
      frameId: number,
      database: string,
      store: string,
      primaryKeyWire: string,
      valueText: string,
    ): Promise<IdbRecordWriteResult> {
      const target = targetOf(handle);
      if (!target) return { ok: false };
      const res = await relayCall<IdbRecordWriteResult>(target.nodeId, 'putIndexedDbRecord', {
        tabId: target.tabId,
        frameId,
        database,
        store,
        primaryKeyWire,
        valueText,
      });
      if (!res) return { ok: false };
      return res.ok === true ? { ok: true } : { ok: false, ...(res.reason ? { reason: res.reason } : {}) };
    },
    async deleteIndexedDbRecord(
      handle: number,
      frameId: number,
      database: string,
      store: string,
      primaryKeyWire: string,
    ): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'deleteIndexedDbRecord', {
        tabId: target.tabId,
        frameId,
        database,
        store,
        primaryKeyWire,
      });
      return res?.ok === true;
    },
    async clearIndexedDbStore(handle: number, frameId: number, database: string, store: string): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'clearIndexedDbStore', {
        tabId: target.tabId,
        frameId,
        database,
        store,
      });
      return res?.ok === true;
    },
    async deleteIndexedDbDatabase(handle: number, frameId: number, database: string): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'deleteIndexedDbDatabase', {
        tabId: target.tabId,
        frameId,
        database,
      });
      return res?.ok === true;
    },
    async listCaches(handle: number, frameId: number): Promise<ReadonlyArray<CacheSummary> | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ caches: ReadonlyArray<CacheSummary> | null }>(
        target.nodeId,
        'listCacheStorageCaches',
        { tabId: target.tabId, frameId },
      );
      return res?.caches ?? null;
    },
    async readCacheEntries(
      handle: number,
      frameId: number,
      cache: string,
      page: number,
      pageSize: number,
    ): Promise<CacheEntriesPage | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ entries: CacheEntriesPage['entries'] | null; truncated?: boolean }>(
        target.nodeId,
        'getCacheStorageEntries',
        { tabId: target.tabId, frameId, cache, page, pageSize },
      );
      if (!res?.entries) return null;
      return { entries: res.entries, truncated: res.truncated ?? false };
    },
    async readCacheEntryDocument(
      handle: number,
      frameId: number,
      cache: string,
      url: string,
      method: string,
    ): Promise<CacheEntryDocument | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ document: CacheEntryDocument | null }>(
        target.nodeId,
        'getCacheStorageEntryDocument',
        { tabId: target.tabId, frameId, cache, url, method },
      );
      return res?.document ?? null;
    },
    async readQuota(handle: number, frameId: number): Promise<StorageQuota | null> {
      const target = targetOf(handle);
      if (!target) return null;
      const res = await relayCall<{ quota: StorageQuota | null }>(target.nodeId, 'getStorageQuota', {
        tabId: target.tabId,
        frameId,
      });
      return res?.quota ?? null;
    },
    async clearSiteData(handle: number, frameId: number, types?: ReadonlyArray<SiteDataType>): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'clearSiteData', {
        tabId: target.tabId,
        frameId,
        ...(types ? { types } : {}),
      });
      return res?.ok === true;
    },
    async setQuotaOverride(handle: number, frameId: number, quotaBytes: number | null): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'setStorageQuotaOverride', {
        tabId: target.tabId,
        frameId,
        ...(quotaBytes === null ? {} : { quotaBytes }),
      });
      return res?.ok === true;
    },
    async deleteCache(handle: number, frameId: number, cache: string): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'deleteCacheStorageCache', {
        tabId: target.tabId,
        frameId,
        cache,
      });
      return res?.ok === true;
    },
    async deleteCacheEntry(
      handle: number,
      frameId: number,
      cache: string,
      url: string,
      method: string,
    ): Promise<boolean> {
      const target = targetOf(handle);
      if (!target) return false;
      const res = await relayCall<{ ok: boolean }>(target.nodeId, 'deleteCacheStorageEntry', {
        tabId: target.tabId,
        frameId,
        cache,
        url,
        method,
      });
      return res?.ok === true;
    },
    subscribeStorageInvalidations(handle: number, kind: StorageInvalidationKind, listener: () => void): () => void {
      return subscribeInvalidations(handle, kind, listener);
    },
  });

  setCookieJarFetcher(async (url: string): Promise<readonly JarCookie[] | null> => {
    if (cookieTarget === null) return null;
    const res = await relayCall<{ cookies: readonly JarCookie[] | null }>(cookieTarget, 'fetchCookieJarForUrl', {
      url,
    });
    return res?.cookies ?? null;
  });

  setSiteCookieJarFetcher(async (url: string): Promise<readonly SiteJarCookie[] | null> => {
    if (cookieTarget === null) return null;
    const res = await relayCall<{ cookies: readonly SiteJarCookie[] | null }>(cookieTarget, 'fetchCookieJarForSite', {
      url,
    });
    return res?.cookies ?? null;
  });

  setCookieJarWriter({
    async set(edit: JarCookieEdit): Promise<CookieWriteResult> {
      if (cookieTarget === null) return { cookie: null };
      const res = await relayCall<{ cookie: JarCookie | null; error?: string }>(cookieTarget, 'setCookieForUrl', {
        cookie: edit,
      });
      if (res?.cookie) return { cookie: res.cookie };
      return { cookie: null, ...(res?.error ? { error: res.error } : {}) };
    },
    async remove(key: JarCookieKey): Promise<boolean> {
      if (cookieTarget === null) return false;
      const res = await relayCall<{ ok: boolean }>(cookieTarget, 'removeCookieForUrl', { ...key });
      return res?.ok === true;
    },
    async clearSite(url: string): Promise<boolean> {
      if (cookieTarget === null) return false;
      const res = await relayCall<{ ok: boolean }>(cookieTarget, 'clearCookiesForSite', { url });
      return res?.ok === true;
    },
  });
}
