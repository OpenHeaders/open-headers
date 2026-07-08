/**
 * State + fetch loop for the Storage tool window's Cache Storage
 * section: cache enumeration and paged entry reads over the host seam.
 * Mounted alongside `useStorageInspector` and gated by `active` (hooks
 * can't be conditional); inactive means no fetches and no polling.
 *
 * The host arbitrates transports (CDP when attached, injection
 * otherwise) invisibly; on tracked tabs it also pushes invalidation
 * notes, which coalesce into a refetch through the SAME read callbacks
 * the poll uses. Polling stays the fallback tier. Same poll-loop
 * discipline as the IDB browser: token-guarded fetches, structural
 * dedupe before every `setState` (RPCs return fresh identities),
 * callbacks keyed on primitives. Mutations (cache delete, entry delete)
 * refetch through the read path — never trust the local outcome.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CacheEntriesPage, CacheEntryResponsePreview, CacheSummary } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const CACHE_POLL_MS = 5000;
const CACHE_PAGE_SIZE = 50;
/** Host invalidation notes can burst; coalesce the refetch. */
const CACHE_INVALIDATION_COALESCE_MS = 250;

function cachesEqual(a: ReadonlyArray<CacheSummary>, b: ReadonlyArray<CacheSummary>): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => c.name === b[i].name);
}

function cacheEntriesPageEqual(a: CacheEntriesPage, b: CacheEntriesPage): boolean {
  if (a.truncated !== b.truncated || a.entries.length !== b.entries.length) return false;
  return a.entries.every((e, i) => {
    const o = b.entries[i];
    return e.url === o.url && e.method === o.method && e.headersPreview === o.headersPreview;
  });
}

export interface CacheBrowserState {
  /** `null` until the first enumeration lands; with `loading` false it
   *  means the scope has no Cache Storage reach (non-secure context or
   *  the frame can't be read). */
  caches: ReadonlyArray<CacheSummary> | null;
  loading: boolean;
  /** The opened cache's name, `null` on the cache list. */
  selectedCache: string | null;
  selectCache: (cache: string) => void;
  closeCache: () => void;
  page: number;
  setPage: (page: number) => void;
  /** `null` while the opened cache's page is in flight. */
  entriesPage: CacheEntriesPage | null;
  refresh: () => void;
  /** Lazy one-shot fetch of one OPENED-cache entry's stored-response
   *  preview — component-held state, never polled; `null` when the entry
   *  is gone or unreadable. */
  readEntryResponse: (url: string, method: string) => Promise<CacheEntryResponsePreview | null>;
  /** Last delete failed — cleared by the next successful one. */
  mutationFailed: boolean;
  deleteCache: (cache: string) => void;
  /** Delete one entry of the OPENED cache by its request URL + method. */
  deleteEntry: (url: string, method: string) => void;
}

export function useCacheBrowser(active: boolean, frameId: number | null): CacheBrowserState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();

  const [caches, setCaches] = useState<ReadonlyArray<CacheSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCache, setSelectedCache] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [entriesPage, setEntriesPage] = useState<CacheEntriesPage | null>(null);
  const [mutationFailed, setMutationFailed] = useState(false);
  const tokenRef = useRef(0);

  // Scope or activation change → drop everything from the old scope.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope identity is the reset trigger
  useEffect(() => {
    tokenRef.current++;
    setCaches(null);
    setLoading(true);
    setSelectedCache(null);
    setPage(0);
    setEntriesPage(null);
    setMutationFailed(false);
  }, [active, frameId]);

  const listCaches = useCallback(async () => {
    if (!active || !host || tabId === null || frameId === null) return;
    const token = tokenRef.current;
    const next = await host.listCaches(tabId, frameId);
    if (token !== tokenRef.current) return;
    setLoading(false);
    if (next === null) return; // unreadable — keep the last list
    setCaches((prev) => (prev && cachesEqual(prev, next) ? prev : next));
  }, [active, host, tabId, frameId]);

  const readEntries = useCallback(async () => {
    if (!active || !host || tabId === null || frameId === null || selectedCache === null) return;
    const token = tokenRef.current;
    const result = await host.readCacheEntries(tabId, frameId, selectedCache, page, CACHE_PAGE_SIZE);
    if (token !== tokenRef.current) return;
    if (result === null) return; // transient failure — keep the last page
    setEntriesPage((prev) => (prev && cacheEntriesPageEqual(prev, result) ? prev : result));
  }, [active, host, tabId, frameId, selectedCache, page]);

  // Selection or page change → drop the stale grid, read immediately.
  useEffect(() => {
    setEntriesPage(null);
    void readEntries();
  }, [readEntries]);

  // A re-list can drop the opened cache (deleted page-side).
  useEffect(() => {
    if (selectedCache === null || !caches) return;
    if (!caches.some((c) => c.name === selectedCache)) {
      setSelectedCache(null);
      setPage(0);
    }
  }, [caches, selectedCache]);

  useEffect(() => {
    if (!active) return;
    void listCaches();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void listCaches();
      void readEntries();
    }, CACHE_POLL_MS);
    return () => clearInterval(timer);
  }, [active, listCaches, readEntries]);

  // Host-pushed invalidations (CDP tracking, attached tabs) — refetch
  // through the SAME read paths the poll uses, coalesced against event
  // bursts. Purely additive over the poll.
  useEffect(() => {
    if (!active || !host || tabId === null) return;
    let coalesce: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = host.subscribeStorageInvalidations(tabId, 'cachestorage', () => {
      if (coalesce !== null) return;
      coalesce = setTimeout(() => {
        coalesce = null;
        void listCaches();
        void readEntries();
      }, CACHE_INVALIDATION_COALESCE_MS);
    });
    return () => {
      unsubscribe();
      if (coalesce !== null) clearTimeout(coalesce);
    };
  }, [active, host, tabId, listCaches, readEntries]);

  const selectCache = useCallback((cache: string) => {
    setSelectedCache(cache);
    setPage(0);
  }, []);

  const closeCache = useCallback(() => {
    setSelectedCache(null);
    setPage(0);
  }, []);

  const refresh = useCallback(() => {
    void listCaches();
    void readEntries();
  }, [listCaches, readEntries]);

  const readEntryResponse = useCallback(
    async (url: string, method: string): Promise<CacheEntryResponsePreview | null> => {
      if (!host || tabId === null || frameId === null || selectedCache === null) return null;
      return host.readCacheEntryResponse(tabId, frameId, selectedCache, url, method);
    },
    [host, tabId, frameId, selectedCache],
  );

  // Mutations refetch through the same read path (invalidation
  // discipline) — the grid never trusts a delete's local outcome.
  const deleteCache = useCallback(
    (cache: string) => {
      if (!host || tabId === null || frameId === null) return;
      void host.deleteCache(tabId, frameId, cache).then((ok) => {
        setMutationFailed(!ok);
        // The stale-selection effect closes an entries view inside the
        // deleted cache once the re-list lands.
        void listCaches();
      });
    },
    [host, tabId, frameId, listCaches],
  );

  const deleteEntry = useCallback(
    (url: string, method: string) => {
      if (!host || tabId === null || frameId === null || selectedCache === null) return;
      void host.deleteCacheEntry(tabId, frameId, selectedCache, url, method).then((ok) => {
        setMutationFailed(!ok);
        void readEntries();
      });
    },
    [host, tabId, frameId, selectedCache, readEntries],
  );

  return {
    caches,
    loading,
    selectedCache,
    selectCache,
    closeCache,
    page,
    setPage,
    entriesPage,
    refresh,
    readEntryResponse,
    mutationFailed,
    deleteCache,
    deleteEntry,
  };
}
