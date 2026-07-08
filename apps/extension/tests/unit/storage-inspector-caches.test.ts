/**
 * Cache Storage standard read plane (STORAGE_PANEL_PLAN.md §5, slice 5)
 * — the injected enumeration/paging funcs run against a Map-backed
 * `caches` stub (Node's real `Request`/`Headers` globals), plus the SW
 * wrappers' clamps and wire mapping over the mocked `chrome.scripting`
 * transport.
 */

import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest';
import {
  CACHE_PAGE_SIZE_DEFAULT,
  CACHE_PAGE_SIZE_MAX,
  getCacheStorageEntries,
  listCacheStorageCaches,
  listCachesInPage,
  readCacheEntriesInPage,
} from '@/background/modules/storage-inspector/standard-plane-caches';

const executeScriptSpy = (): ReturnType<typeof vi.fn> =>
  chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>;

/** Minimal secure-context CacheStorage: named caches holding Request keys. */
function installCachesStub(seed: Record<string, Request[]>): Map<string, Request[]> {
  const store = new Map<string, Request[]>(Object.entries(seed));
  const stub = {
    keys: () => Promise.resolve([...store.keys()]),
    has: (name: string) => Promise.resolve(store.has(name)),
    open: (name: string) => {
      // Mirrors the platform: open() CREATES a missing cache.
      if (!store.has(name)) store.set(name, []);
      const requests = store.get(name) as Request[];
      return Promise.resolve({ keys: () => Promise.resolve([...requests]) });
    },
  };
  Object.defineProperty(globalThis, 'caches', { value: stub, configurable: true, writable: true });
  return store;
}

function removeCachesGlobal(): void {
  Reflect.deleteProperty(globalThis, 'caches');
}

beforeEach(() => {
  executeScriptSpy().mockReset();
});

afterEach(() => {
  removeCachesGlobal();
});

describe('listCachesInPage', () => {
  it('enumerates cache names in storage order', async () => {
    installCachesStub({ 'oh-assets-v1': [], 'oh-api-v2': [] });
    const { caches } = await listCachesInPage(100);
    expect(caches).toEqual([{ name: 'oh-assets-v1' }, { name: 'oh-api-v2' }]);
  });

  it('caps the enumeration at maxCaches', async () => {
    installCachesStub({ one: [], two: [], three: [] });
    const { caches } = await listCachesInPage(2);
    expect(caches).toHaveLength(2);
  });

  it('reads null without a caches global (non-secure context)', async () => {
    removeCachesGlobal();
    expect((await listCachesInPage(100)).caches).toBeNull();
  });
});

describe('readCacheEntriesInPage', () => {
  it('pages through the Request keys and flags truncation with the one-past probe', async () => {
    installCachesStub({
      'oh-assets-v1': Array.from({ length: 7 }, (_, i) => new Request(`https://openheaders.io/asset-${i}.js`)),
    });

    const first = await readCacheEntriesInPage('oh-assets-v1', 0, 3, 512);
    expect(first.entries).toHaveLength(3);
    expect(first.truncated).toBe(true);
    expect(first.entries?.[0]).toMatchObject({ url: 'https://openheaders.io/asset-0.js', method: 'GET' });

    const last = await readCacheEntriesInPage('oh-assets-v1', 2, 3, 512);
    expect(last.entries).toHaveLength(1);
    expect(last.truncated).toBe(false);
    expect(last.entries?.[0]?.url).toBe('https://openheaders.io/asset-6.js');
  });

  it('derives a bounded request-headers preview and omits it when empty', async () => {
    installCachesStub({
      'oh-api-v2': [
        new Request('https://openheaders.io/api/data', { headers: { accept: 'application/json', 'x-oh': '1' } }),
        new Request('https://openheaders.io/api/plain'),
      ],
    });

    const { entries } = await readCacheEntriesInPage('oh-api-v2', 0, 50, 512);
    expect(entries?.[0]?.headersPreview).toBe('accept: application/json, x-oh: 1');
    expect(entries?.[1]?.headersPreview).toBeUndefined();

    const clipped = await readCacheEntriesInPage('oh-api-v2', 0, 50, 10);
    expect(clipped.entries?.[0]?.headersPreview).toBe('accept: ap…');
  });

  it('reports a missing cache as unreadable and never creates a ghost', async () => {
    const store = installCachesStub({ 'oh-assets-v1': [] });
    const result = await readCacheEntriesInPage('oh-gone', 0, 50, 512);
    expect(result.entries).toBeNull();
    expect([...store.keys()]).toEqual(['oh-assets-v1']);
  });

  it('reads null without a caches global (non-secure context)', async () => {
    removeCachesGlobal();
    expect((await readCacheEntriesInPage('any', 0, 50, 512)).entries).toBeNull();
  });
});

describe('SW wrappers over the injection transport', () => {
  it('clamps page and pageSize before injecting', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { entries: [], truncated: false } }]);
    await getCacheStorageEntries(1, 0, 'oh-assets-v1', -5, 99_999);
    const [{ args }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args[1]).toBe(0);
    expect(args[2]).toBe(CACHE_PAGE_SIZE_MAX);

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { entries: [], truncated: false } }]);
    await getCacheStorageEntries(1, 0, 'oh-assets-v1', 2, 0);
    const [{ args: args2 }] = executeScriptSpy().mock.calls[0] as [{ args: unknown[] }];
    expect(args2[1]).toBe(2);
    expect(args2[2]).toBe(CACHE_PAGE_SIZE_DEFAULT);
  });

  it('maps the injected results to the wire shapes', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { caches: [{ name: 'oh-assets-v1' }] } }]);
    expect((await listCacheStorageCaches(1, 0)).caches).toEqual([{ name: 'oh-assets-v1' }]);

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([
      { result: { entries: [{ url: 'https://openheaders.io/a.js', method: 'GET' }], truncated: true } },
    ]);
    const page = await getCacheStorageEntries(1, 0, 'oh-assets-v1', 0, 50);
    expect(page.entries).toEqual([{ url: 'https://openheaders.io/a.js', method: 'GET' }]);
    expect(page.truncated).toBe(true);
  });

  it('reports injection failure as null and bad args without injecting', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await listCacheStorageCaches(1, 0)).caches).toBeNull();
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await getCacheStorageEntries(1, 0, 'oh-assets-v1', 0, 50)).entries).toBeNull();

    executeScriptSpy().mockClear();
    expect((await getCacheStorageEntries(1, 0, undefined as unknown as string, 0, 50)).entries).toBeNull();
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });
});
