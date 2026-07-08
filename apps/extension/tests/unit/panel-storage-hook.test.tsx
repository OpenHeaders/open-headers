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
import { useIdbBrowser } from '@openheaders/ui/panel/data/storage/use-idb-browser';
import { type StorageSection, useStorageInspector } from '@openheaders/ui/panel/data/storage/use-storage-inspector';
import type { IdbDatabase, IdbRecordsPage, StorageInspectorHost } from '@openheaders/ui/panel/host-storage-inspector';
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

function installHost() {
  // Fresh arrays + fresh objects on every call — exactly what the wire
  // produces; the hooks own deduplication.
  const listScopes = vi.fn(() => Promise.resolve([{ ...SCOPE }]));
  const readDomStorage = vi.fn(() =>
    Promise.resolve({ entries: [{ key: 'theme', value: 'dark', valueLength: 4 }], truncated: false }),
  );
  const listIndexedDb = vi.fn(() => Promise.resolve([structuredClone(IDB_DB)]));
  const readIndexedDbRecords = vi.fn(() => Promise.resolve(structuredClone(IDB_PAGE)));
  const deleteIndexedDbRecord = vi.fn(() => Promise.resolve(true));
  const clearIndexedDbStore = vi.fn(() => Promise.resolve(true));
  const deleteIndexedDbDatabase = vi.fn(() => Promise.resolve(true));
  const idbInvalidationListeners = new Set<() => void>();
  const host: StorageInspectorHost = {
    listScopes,
    readDomStorage,
    readDomStorageValue: vi.fn(() => Promise.resolve(null)),
    writeDomStorage: vi.fn(() => Promise.resolve(true)),
    removeDomStorage: vi.fn(() => Promise.resolve(true)),
    clearDomStorage: vi.fn(() => Promise.resolve(true)),
    listIndexedDb,
    readIndexedDbRecords,
    deleteIndexedDbRecord,
    clearIndexedDbStore,
    deleteIndexedDbDatabase,
    subscribeIdbInvalidations: (_tabId: number, listener: () => void) => {
      idbInvalidationListeners.add(listener);
      return () => {
        idbInvalidationListeners.delete(listener);
      };
    },
  };
  setStorageInspectorHost(host);
  return {
    listScopes,
    readDomStorage,
    listIndexedDb,
    readIndexedDbRecords,
    deleteIndexedDbRecord,
    clearIndexedDbStore,
    deleteIndexedDbDatabase,
    pushIdbInvalidation: () => {
      for (const listener of idbInvalidationListeners) listener();
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
    const { listIndexedDb, readIndexedDbRecords, pushIdbInvalidation } = installHost();
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
      pushIdbInvalidation();
      pushIdbInvalidation();
      pushIdbInvalidation();
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
