/**
 * State + fetch loop for the Storage tool window's Cache Storage
 * section: cache enumeration and paged entry reads over the host seam.
 * Mounted alongside `useStorageInspector` and gated by `active` (hooks
 * can't be conditional); inactive means no fetches and no polling.
 *
 * Reads are read-only in this slice; the CDP tier (live invalidations,
 * deletes) rides the same seam later. Standard-plane reads have no
 * change events, so this polls while active — same poll-loop discipline
 * as the IDB browser: token-guarded fetches, structural dedupe before
 * every `setState` (RPCs return fresh identities), callbacks keyed on
 * primitives.
 */

import { hostNavigation } from '@openheaders/core/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CacheEntriesPage, CacheSummary } from './storage-inspector-host';
import { getStorageInspectorHost } from './storage-inspector-host';

const CACHE_POLL_MS = 5000;
const CACHE_PAGE_SIZE = 50;

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
}

export function useCacheBrowser(active: boolean, frameId: number | null): CacheBrowserState {
  const host = getStorageInspectorHost();
  const tabId = hostNavigation.inspectedTabId();

  const [caches, setCaches] = useState<ReadonlyArray<CacheSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCache, setSelectedCache] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [entriesPage, setEntriesPage] = useState<CacheEntriesPage | null>(null);
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
  };
}
