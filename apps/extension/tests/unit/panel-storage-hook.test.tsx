// @vitest-environment jsdom
/**
 * useStorageInspector poll-loop stability. Every scope re-list returns a
 * FRESH array from the RPC; the hook must compare it structurally and
 * keep the previous state object when nothing changed. Regression guard
 * for the live bug where each re-list minted new scope identities, which
 * minted a new read callback, which re-fired the grid-reset and
 * poll-restart effects — an infinite "entries ↔ Loading…" flash with the
 * poll interval never reaching its scope tick.
 */

import type { HostNavigation } from '@openheaders/core/navigation';
import { setHostNavigation } from '@openheaders/core/navigation';
import {
  __resetCookieJarCacheForTests,
  __seedCookieJarForTests,
  getJarCookiesForUrl,
} from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import { subscribeDomStorageWrites } from '@openheaders/ui/panel/data/storage/dom-storage-write-notifier';
import { useCacheBrowser } from '@openheaders/ui/panel/data/storage/use-cache-browser';
import { useIdbBrowser } from '@openheaders/ui/panel/data/storage/use-idb-browser';
import { type StorageSection, useStorageInspector } from '@openheaders/ui/panel/data/storage/use-storage-inspector';
import { useStorageQuota } from '@openheaders/ui/panel/data/storage/use-storage-quota';
import type {
  CacheEntriesPage,
  CacheEntryResponsePreview,
  IdbDatabase,
  IdbRecordDocument,
  IdbRecordsPage,
  StorageInspectorHost,
  StorageQuota,
} from '@openheaders/ui/panel/host-storage-inspector';
import { setStorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const NAV: HostNavigation = {
  switchViewMode: () => Promise.resolve({ opened: false }),
  currentWindowId: () => Promise.resolve(undefined),
  activeTabUrl: () => Promise.resolve(undefined),
  openUrl: () => {},
  openShortcutSettings: () => {},
  getActiveTab: () => Promise.resolve(null),
  observeActiveTabContext: () => () => {},
  inspectedTabId: () => 42,
  reloadInspectedTab: () => {},
  getInspectedHar: () => Promise.resolve(null),
  openResource: () => {},
};

const SCOPE = { frameId: 0, origin: 'https://openheaders.io', url: 'https://openheaders.io/', isMainFrame: true };

const IDB_DB: IdbDatabase = {
  name: 'oh-app',
  version: 1,
  objectStores: [{ name: 'kv', keyPath: 'id', autoIncrement: false, indexNames: [] }],
};

const IDB_PAGE: IdbRecordsPage = {
  records: [{ keyPreview: '1', primaryKeyPreview: '1', valuePreview: '{id: 1}' }],
  truncated: false,
};

const CACHE_LIST = [{ name: 'oh-assets-v1' }];

const CACHE_PAGE: CacheEntriesPage = {
  entries: [
    { url: 'https://openheaders.io/asset-0.js', method: 'GET', contentLength: 128, responseTimeMs: 1_770_000_000_500 },
  ],
  truncated: false,
};

const QUOTA: StorageQuota = {
  usage: 4096,
  quota: 120_000_000,
  breakdown: [{ storageType: 'indexeddb', usage: 4096 }],
};

const RESPONSE_PREVIEW: CacheEntryResponsePreview = {
  status: 200,
  statusText: 'OK',
  bodyPreview: '{"a":1}',
  bodyLength: 7,
};

function installHost() {
  // Fresh arrays + fresh objects on every call — exactly what the wire
  // produces; the hooks own deduplication.
  const listScopes = vi.fn(() => Promise.resolve([{ ...SCOPE }]));
  const readDomStorage = vi.fn(() =>
    Promise.resolve({ entries: [{ key: 'theme', value: 'dark', valueLength: 4 }], truncated: false }),
  );
  const listIndexedDb = vi.fn(() => Promise.resolve([structuredClone(IDB_DB)]));
  const readIndexedDbRecords = vi.fn(() => Promise.resolve(structuredClone(IDB_PAGE)));
  const readIndexedDbRecordDocument = vi.fn(
    (): Promise<IdbRecordDocument | null> => Promise.resolve({ text: '{\n  "id": 1\n}', editable: true }),
  );
  const deleteIndexedDbRecord = vi.fn(() => Promise.resolve(true));
  const clearIndexedDbStore = vi.fn(() => Promise.resolve(true));
  const deleteIndexedDbDatabase = vi.fn(() => Promise.resolve(true));
  const listCaches = vi.fn((): Promise<Array<{ name: string }> | null> => Promise.resolve(structuredClone(CACHE_LIST)));
  const readCacheEntries = vi.fn(() => Promise.resolve(structuredClone(CACHE_PAGE)));
  const readCacheEntryResponse = vi.fn(
    (): Promise<CacheEntryResponsePreview | null> => Promise.resolve(structuredClone(RESPONSE_PREVIEW)),
  );
  const deleteCache = vi.fn(() => Promise.resolve(true));
  const deleteCacheEntry = vi.fn(() => Promise.resolve(true));
  const readQuota = vi.fn((): Promise<StorageQuota | null> => Promise.resolve(structuredClone(QUOTA)));
  const clearSiteData = vi.fn(() => Promise.resolve(true));
  const setQuotaOverride = vi.fn(() => Promise.resolve(true));
  const invalidationListeners = { indexeddb: new Set<() => void>(), cachestorage: new Set<() => void>() };
  const host: StorageInspectorHost = {
    listScopes,
    readDomStorage,
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(true)),
    renameDomStorage: vi.fn(() => Promise.resolve({ ok: true })),
    removeDomStorage: vi.fn(() => Promise.resolve(true)),
    clearDomStorage: vi.fn(() => Promise.resolve(true)),
    listIndexedDb,
    readIndexedDbRecords,
    readIndexedDbRecordDocument,
    writeIndexedDbRecord: vi.fn(() => Promise.resolve({ ok: true })),
    deleteIndexedDbRecord,
    clearIndexedDbStore,
    deleteIndexedDbDatabase,
    listCaches,
    readCacheEntries,
    readCacheEntryResponse,
    readCacheEntryDocument: vi.fn(() => Promise.resolve(null)),
    readQuota,
    clearSiteData,
    setQuotaOverride,
    deleteCache,
    deleteCacheEntry,
    subscribeStorageInvalidations: (_tabId: number, kind: 'indexeddb' | 'cachestorage', listener: () => void) => {
      invalidationListeners[kind].add(listener);
      return () => {
        invalidationListeners[kind].delete(listener);
      };
    },
  };
  setStorageInspectorHost(host);
  return {
    listScopes,
    readDomStorage,
    listIndexedDb,
    readIndexedDbRecords,
    readIndexedDbRecordDocument,
    deleteIndexedDbRecord,
    clearIndexedDbStore,
    deleteIndexedDbDatabase,
    listCaches,
    readCacheEntries,
    readCacheEntryResponse,
    readQuota,
    clearSiteData,
    setQuotaOverride,
    deleteCache,
    deleteCacheEntry,
    pushInvalidation: (kind: 'indexeddb' | 'cachestorage') => {
      for (const listener of invalidationListeners[kind]) listener();
    },
  };
}

async function flush(ms = 1): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setHostNavigation(NAV);
  __resetCookieJarCacheForTests();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  __resetCookieJarCacheForTests();
});

describe('useStorageInspector poll stability', () => {
  it('settles after mount instead of re-listing scopes in a loop', async () => {
    const { listScopes } = installHost();
    const { result } = renderHook(() => useStorageInspector('local'));

    await flush();
    await flush();
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.loading).toBe(false);

    // Let effect/microtask cycles play out well past mount — an identity
    // loop re-lists on every cycle; a settled hook re-lists exactly once
    // more (the poll restarts when the first selection lands) and then
    // waits for the interval.
    await flush(500);
    expect(listScopes).toHaveBeenCalledTimes(2);
  });

  it('keeps the snapshot rendered across an unchanged scope re-list', async () => {
    const { listScopes, readDomStorage } = installHost();
    const { result } = renderHook(() => useStorageInspector('local'));

    await flush();
    await flush();
    const readsBefore = readDomStorage.mock.calls.length;

    // Five entry ticks = one scope re-list tick (2s × 5), on top of the
    // two settled mount calls.
    await flush(10_000);

    expect(listScopes).toHaveBeenCalledTimes(3);
    // One read per tick — not the storm the reset loop produced.
    expect(readDomStorage.mock.calls.length).toBe(readsBefore + 5);
    expect(result.current.loading).toBe(false);
    expect(result.current.snapshot?.entries).toEqual([{ key: 'theme', value: 'dark', valueLength: 4 }]);
  });

  it('taps the write notifier on every DOM write path so open documents catch up', async () => {
    installHost();
    const { result } = renderHook(() => useStorageInspector('local'));
    await flush();
    await flush();

    const notified = vi.fn();
    const unsubscribe = subscribeDomStorageWrites(notified);
    await act(async () => {
      await result.current.applyEdit(null, 'theme', 'light');
    });
    expect(notified).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.removeEntry('theme');
    });
    expect(notified).toHaveBeenCalledTimes(2);
    await act(async () => {
      await result.current.clearArea();
    });
    expect(notified).toHaveBeenCalledTimes(3);
    unsubscribe();
  });
});

describe('useStorageInspector cookies section', () => {
  const COOKIE = {
    name: 'sid',
    value: 'abc',
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: false,
    secure: true,
    session: true,
  };

  it('parks the DOM plane — no entry reads while cookies is the active section', async () => {
    const { listScopes, readDomStorage } = installHost();
    renderHook(() => useStorageInspector('cookies'));

    await flush();
    await flush();
    await flush(10_000);

    expect(listScopes).toHaveBeenCalled();
    expect(readDomStorage).not.toHaveBeenCalled();
  });

  it('invalidates the jar cache for the selected scope URL on each poll tick', async () => {
    installHost();
    renderHook(() => useStorageInspector('cookies'));

    await flush();
    await flush();
    __seedCookieJarForTests(SCOPE.url, [COOKIE]);
    expect(getJarCookiesForUrl(SCOPE.url)).toEqual([COOKIE]);

    // One entry tick — the cookies section's tick clears the jar entry so
    // the next lookup refetches (invalidation, not a data push).
    await flush(2000);
    expect(getJarCookiesForUrl(SCOPE.url)).toBeNull();
  });

  it('does not blank or storm when switching between DOM and cookies sections', async () => {
    const { readDomStorage } = installHost();
    const { result, rerender } = renderHook(
      ({ section }: { section: StorageSection }) => useStorageInspector(section),
      {
        initialProps: { section: 'local' as StorageSection },
      },
    );

    await flush();
    await flush();
    expect(result.current.snapshot).not.toBeNull();
    const readsBefore = readDomStorage.mock.calls.length;

    rerender({ section: 'cookies' });
    await flush(4000);
    expect(readDomStorage.mock.calls.length).toBe(readsBefore);

    rerender({ section: 'local' });
    await flush();
    await flush();
    expect(result.current.snapshot?.entries).toEqual([{ key: 'theme', value: 'dark', valueLength: 4 }]);
    expect(result.current.loading).toBe(false);
  });
});

describe('useIdbBrowser poll stability', () => {
  it('does nothing while inactive', async () => {
    const { listIndexedDb, readIndexedDbRecords } = installHost();
    renderHook(() => useIdbBrowser(false, 0));

    await flush(15_000);
    expect(listIndexedDb).not.toHaveBeenCalled();
    expect(readIndexedDbRecords).not.toHaveBeenCalled();
  });

  it('keeps state identities across unchanged re-lists and re-reads', async () => {
    const { listIndexedDb, readIndexedDbRecords } = installHost();
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    await flush();
    const databases = result.current.databases;
    expect(databases).not.toBeNull();

    act(() => {
      result.current.selectStore('oh-app', 'kv');
    });
    await flush();
    const page = result.current.recordsPage;
    expect(page).not.toBeNull();

    // Two poll ticks (5s each) return fresh-but-equal data — identities
    // must hold, and reads must be one per tick, not a reset storm.
    const listsBefore = listIndexedDb.mock.calls.length;
    const readsBefore = readIndexedDbRecords.mock.calls.length;
    await flush(10_000);
    expect(result.current.databases).toBe(databases);
    expect(result.current.recordsPage).toBe(page);
    expect(listIndexedDb.mock.calls.length).toBe(listsBefore + 2);
    expect(readIndexedDbRecords.mock.calls.length).toBe(readsBefore + 2);
  });

  it('coalesces a host invalidation burst into one refetch pass with stable identities', async () => {
    const { listIndexedDb, readIndexedDbRecords, pushInvalidation } = installHost();
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectStore('oh-app', 'kv');
    });
    await flush();
    const databases = result.current.databases;
    const page = result.current.recordsPage;
    expect(page).not.toBeNull();

    const listsBefore = listIndexedDb.mock.calls.length;
    const readsBefore = readIndexedDbRecords.mock.calls.length;
    act(() => {
      pushInvalidation('indexeddb');
      pushInvalidation('indexeddb');
      pushInvalidation('indexeddb');
    });
    await flush(300);
    expect(listIndexedDb.mock.calls.length).toBe(listsBefore + 1);
    expect(readIndexedDbRecords.mock.calls.length).toBe(readsBefore + 1);
    // Fresh-but-equal payloads must keep their identities (no storm).
    expect(result.current.databases).toBe(databases);
    expect(result.current.recordsPage).toBe(page);
  });

  it('routes deletes through the host and refetches via the same read path', async () => {
    const { readIndexedDbRecords, deleteIndexedDbRecord, clearIndexedDbStore } = installHost();
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectStore('oh-app', 'kv');
    });
    await flush();
    expect(result.current.recordsPage).not.toBeNull();

    const readsBefore = readIndexedDbRecords.mock.calls.length;
    act(() => {
      result.current.deleteRecord('{"n":1}');
    });
    await flush();
    expect(deleteIndexedDbRecord).toHaveBeenCalledWith(42, 0, 'oh-app', 'kv', '{"n":1}');
    expect(readIndexedDbRecords.mock.calls.length).toBe(readsBefore + 1);
    expect(result.current.mutationFailed).toBe(false);

    act(() => {
      result.current.clearStore('oh-app', 'kv');
    });
    await flush();
    expect(clearIndexedDbStore).toHaveBeenCalledWith(42, 0, 'oh-app', 'kv');
    expect(readIndexedDbRecords.mock.calls.length).toBe(readsBefore + 2);
  });

  it('scopes reads to a selected index and prunes it when the schema drops it', async () => {
    const { listIndexedDb, readIndexedDbRecords } = installHost();
    listIndexedDb.mockImplementation(() =>
      Promise.resolve([
        {
          name: 'oh-app',
          version: 1,
          objectStores: [{ name: 'orders', keyPath: 'id', autoIncrement: false, indexNames: ['by-user'] }],
        },
      ]),
    );
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectStore('oh-app', 'orders');
    });
    await flush();
    act(() => {
      result.current.setPage(1);
    });
    await flush();
    act(() => {
      result.current.setIndex('by-user');
    });
    await flush();
    // The index change resets the page and the read carries the index.
    expect(result.current.index).toBe('by-user');
    expect(result.current.page).toBe(0);
    expect(readIndexedDbRecords.mock.calls.at(-1)).toEqual([42, 0, 'oh-app', 'orders', 0, 50, 'by-user']);

    // A re-list that drops the index falls back to the primary cursor.
    listIndexedDb.mockImplementation(() =>
      Promise.resolve([
        {
          name: 'oh-app',
          version: 2,
          objectStores: [{ name: 'orders', keyPath: 'id', autoIncrement: false, indexNames: [] }],
        },
      ]),
    );
    await flush(5_000);
    await flush();
    expect(result.current.index).toBeNull();
    expect(readIndexedDbRecords.mock.calls.at(-1)).toEqual([42, 0, 'oh-app', 'orders', 0, 50, undefined]);
  });

  it('flags a failed delete and re-lists after a database delete', async () => {
    const { listIndexedDb, deleteIndexedDbRecord, deleteIndexedDbDatabase } = installHost();
    deleteIndexedDbRecord.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectStore('oh-app', 'kv');
    });
    await flush();

    act(() => {
      result.current.deleteRecord('{"n":1}');
    });
    await flush();
    expect(result.current.mutationFailed).toBe(true);

    const listsBefore = listIndexedDb.mock.calls.length;
    act(() => {
      result.current.deleteDatabase('oh-app');
    });
    await flush();
    expect(deleteIndexedDbDatabase).toHaveBeenCalledWith(42, 0, 'oh-app');
    expect(listIndexedDb.mock.calls.length).toBe(listsBefore + 1);
    expect(result.current.mutationFailed).toBe(false);
  });

  it('drops the selection when a re-list no longer has the store', async () => {
    const { listIndexedDb } = installHost();
    const { result } = renderHook(() => useIdbBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectStore('oh-app', 'kv');
    });
    await flush();
    expect(result.current.selection).toEqual({ database: 'oh-app', store: 'kv' });

    listIndexedDb.mockImplementation(() => Promise.resolve([]));
    await flush(5000);
    expect(result.current.selection).toBeNull();
  });
});

describe('useCacheBrowser poll stability', () => {
  it('does nothing while inactive', async () => {
    const { listCaches, readCacheEntries } = installHost();
    renderHook(() => useCacheBrowser(false, 0));

    await flush(15_000);
    expect(listCaches).not.toHaveBeenCalled();
    expect(readCacheEntries).not.toHaveBeenCalled();
  });

  it('keeps state identities across unchanged re-lists and re-reads', async () => {
    const { listCaches, readCacheEntries } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    await flush();
    const caches = result.current.caches;
    expect(caches).toEqual([{ name: 'oh-assets-v1' }]);

    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    const page = result.current.entriesPage;
    expect(page).not.toBeNull();

    // Two poll ticks (5s each) return fresh-but-equal data — identities
    // must hold, and reads must be one per tick, not a reset storm.
    const listsBefore = listCaches.mock.calls.length;
    const readsBefore = readCacheEntries.mock.calls.length;
    await flush(10_000);
    expect(result.current.caches).toBe(caches);
    expect(result.current.entriesPage).toBe(page);
    expect(listCaches.mock.calls.length).toBe(listsBefore + 2);
    expect(readCacheEntries.mock.calls.length).toBe(readsBefore + 2);
  });

  it('adopts a re-read whose only change is a response-metadata column', async () => {
    const { readCacheEntries } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    const page = result.current.entriesPage;
    expect(page?.entries[0]?.contentLength).toBe(128);

    const grown = structuredClone(CACHE_PAGE);
    grown.entries = [{ ...grown.entries[0], contentLength: 256 }];
    readCacheEntries.mockImplementation(() => Promise.resolve(structuredClone(grown)));
    await flush(5000);
    expect(result.current.entriesPage).not.toBe(page);
    expect(result.current.entriesPage?.entries[0]?.contentLength).toBe(256);
  });

  it('renders unreadable (null) as terminal once loading settles, keeping the last list on later failures', async () => {
    const { listCaches } = installHost();
    listCaches.mockImplementation(() => Promise.resolve(null));
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    await flush();
    expect(result.current.caches).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('drops the selection when a re-list no longer has the cache', async () => {
    const { listCaches, readCacheEntries } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    expect(readCacheEntries).toHaveBeenCalledWith(42, 0, 'oh-assets-v1', 0, 50);
    expect(result.current.selectedCache).toBe('oh-assets-v1');

    listCaches.mockImplementation(() => Promise.resolve([]));
    await flush(5000);
    expect(result.current.selectedCache).toBeNull();
    expect(result.current.page).toBe(0);
  });

  it('coalesces a cache invalidation burst into one refetch pass, ignoring the idb kind', async () => {
    const { listCaches, readCacheEntries, pushInvalidation } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    const caches = result.current.caches;
    const page = result.current.entriesPage;
    expect(page).not.toBeNull();

    const listsBefore = listCaches.mock.calls.length;
    const readsBefore = readCacheEntries.mock.calls.length;
    act(() => {
      pushInvalidation('cachestorage');
      pushInvalidation('cachestorage');
      pushInvalidation('indexeddb');
    });
    await flush(300);
    expect(listCaches.mock.calls.length).toBe(listsBefore + 1);
    expect(readCacheEntries.mock.calls.length).toBe(readsBefore + 1);
    expect(result.current.caches).toBe(caches);
    expect(result.current.entriesPage).toBe(page);
  });

  it('routes the one-shot response preview through the host for the OPENED cache', async () => {
    const { readCacheEntryResponse } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    // No cache opened yet — resolves null without touching the host.
    expect(await result.current.readEntryResponse('https://openheaders.io/asset-0.js', 'GET')).toBeNull();
    expect(readCacheEntryResponse).not.toHaveBeenCalled();

    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    const preview = await result.current.readEntryResponse('https://openheaders.io/asset-0.js', 'GET');
    expect(preview).toEqual(RESPONSE_PREVIEW);
    expect(readCacheEntryResponse).toHaveBeenCalledWith(
      42,
      0,
      'oh-assets-v1',
      'https://openheaders.io/asset-0.js',
      'GET',
    );
  });

  it('routes deletes through the host and refetches via the same read path', async () => {
    const { listCaches, readCacheEntries, deleteCache, deleteCacheEntry } = installHost();
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();
    expect(result.current.entriesPage).not.toBeNull();

    const readsBefore = readCacheEntries.mock.calls.length;
    act(() => {
      result.current.deleteEntry('https://openheaders.io/asset-0.js', 'GET');
    });
    await flush();
    expect(deleteCacheEntry).toHaveBeenCalledWith(42, 0, 'oh-assets-v1', 'https://openheaders.io/asset-0.js', 'GET');
    expect(readCacheEntries.mock.calls.length).toBe(readsBefore + 1);
    expect(result.current.mutationFailed).toBe(false);

    const listsBefore = listCaches.mock.calls.length;
    act(() => {
      result.current.deleteCache('oh-assets-v1');
    });
    await flush();
    expect(deleteCache).toHaveBeenCalledWith(42, 0, 'oh-assets-v1');
    expect(listCaches.mock.calls.length).toBe(listsBefore + 1);
  });

  it('flags a failed delete', async () => {
    const { deleteCacheEntry } = installHost();
    deleteCacheEntry.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useCacheBrowser(true, 0));

    await flush();
    act(() => {
      result.current.selectCache('oh-assets-v1');
    });
    await flush();

    act(() => {
      result.current.deleteEntry('https://openheaders.io/asset-0.js', 'GET');
    });
    await flush();
    expect(result.current.mutationFailed).toBe(true);
  });
});

describe('useStorageQuota poll stability', () => {
  it('does nothing while inactive', async () => {
    const { readQuota } = installHost();
    renderHook(() => useStorageQuota(false, 0));

    await flush(30_000);
    expect(readQuota).not.toHaveBeenCalled();
  });

  it('keeps the snapshot identity across fresh-but-equal polls', async () => {
    const { readQuota } = installHost();
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    await flush();
    const snapshot = result.current.quota;
    expect(snapshot).toEqual(QUOTA);
    expect(result.current.loading).toBe(false);

    // Two poll ticks (10s each) return fresh-but-equal data — the
    // identity must hold and reads must be one per tick.
    const readsBefore = readQuota.mock.calls.length;
    await flush(20_000);
    expect(result.current.quota).toBe(snapshot);
    expect(readQuota.mock.calls.length).toBe(readsBefore + 2);
  });

  it('adopts a poll whose only change is the override flag', async () => {
    const { readQuota } = installHost();
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    await flush();
    const snapshot = result.current.quota;
    expect(snapshot).not.toBeNull();

    readQuota.mockImplementation(() => Promise.resolve({ ...structuredClone(QUOTA), overrideActive: true }));
    await flush(10_000);
    expect(result.current.quota).not.toBe(snapshot);
    expect(result.current.quota?.overrideActive).toBe(true);
  });

  it('renders unreadable (null) as terminal once loading settles, keeping the last snapshot on later failures', async () => {
    const { readQuota } = installHost();
    readQuota.mockImplementation(() => Promise.resolve(null));
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    await flush();
    expect(result.current.quota).toBeNull();
    expect(result.current.loading).toBe(false);

    readQuota.mockImplementation(() => Promise.resolve(structuredClone(QUOTA)));
    await flush(10_000);
    expect(result.current.quota).toEqual(QUOTA);

    readQuota.mockImplementation(() => Promise.resolve(null));
    await flush(10_000);
    expect(result.current.quota).toEqual(QUOTA);
  });

  it('routes the clear through the host and refetches via the same read path', async () => {
    const { readQuota, clearSiteData } = installHost();
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    await flush();
    expect(result.current.quota).toEqual(QUOTA);

    const readsBefore = readQuota.mock.calls.length;
    act(() => {
      result.current.clearSiteData();
    });
    await flush();
    expect(clearSiteData).toHaveBeenCalledWith(42, 0, undefined);
    expect(readQuota.mock.calls.length).toBe(readsBefore + 1);
    expect(result.current.clearFailed).toBe(false);

    // A types subset threads through the seam untouched.
    act(() => {
      result.current.clearSiteData(['cacheStorage', 'cookies']);
    });
    await flush();
    expect(clearSiteData).toHaveBeenCalledWith(42, 0, ['cacheStorage', 'cookies']);
  });

  it('flags a failed clear', async () => {
    const { clearSiteData } = installHost();
    clearSiteData.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    act(() => {
      result.current.clearSiteData();
    });
    await flush();
    expect(result.current.clearFailed).toBe(true);
  });

  it('routes the quota override through the host and refetches via the same read path', async () => {
    const { readQuota, setQuotaOverride } = installHost();
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    await flush();
    const readsBefore = readQuota.mock.calls.length;
    act(() => {
      result.current.setQuotaOverride(20_000_000);
    });
    await flush();
    expect(setQuotaOverride).toHaveBeenCalledWith(42, 0, 20_000_000);
    expect(readQuota.mock.calls.length).toBe(readsBefore + 1);
    expect(result.current.overrideFailed).toBe(false);

    act(() => {
      result.current.setQuotaOverride(null);
    });
    await flush();
    expect(setQuotaOverride).toHaveBeenCalledWith(42, 0, null);
  });

  it('flags a failed override (detached tabs have no simulation control)', async () => {
    const { setQuotaOverride } = installHost();
    setQuotaOverride.mockImplementation(() => Promise.resolve(false));
    const { result } = renderHook(() => useStorageQuota(true, 0));

    await flush();
    act(() => {
      result.current.setQuotaOverride(20_000_000);
    });
    await flush();
    expect(result.current.overrideFailed).toBe(true);
  });

  it('drops the old scope snapshot when the frame changes', async () => {
    installHost();
    const { result, rerender } = renderHook(({ frameId }: { frameId: number }) => useStorageQuota(true, frameId), {
      initialProps: { frameId: 0 },
    });

    await flush();
    await flush();
    expect(result.current.quota).toEqual(QUOTA);

    rerender({ frameId: 7 });
    expect(result.current.quota).toBeNull();
    expect(result.current.loading).toBe(true);

    await flush();
    await flush();
    expect(result.current.quota).toEqual(QUOTA);
  });
});
