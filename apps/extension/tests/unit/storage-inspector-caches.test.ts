/**
 * Cache Storage data plane (STORAGE_PANEL_PLAN.md §5, slice 5) — the
 * injected read/delete funcs run against a Map-backed `caches` stub
 * (Node's real `Request`/`Headers` globals); the arbitrated RPC surface
 * is exercised over both transports: injected via the mocked
 * `chrome.scripting`, CDP via a fake cdp-tier access seam (the one
 * storage type with a working CDP read domain).
 */

import { afterEach, beforeEach, describe, expect, it, type vi } from 'vitest';
import {
  deleteCacheStorageCache,
  deleteCacheStorageEntry,
  getCacheStorageEntries,
  getCacheStorageEntryDocument,
  listCacheStorageCaches,
} from '@/background/modules/storage-inspector/caches';
import {
  __resetStorageCdpAccessForTests,
  registerStorageCdpAccess,
  type StorageCdpAccess,
} from '@/background/modules/storage-inspector/cdp-tier';
import {
  CACHE_BODY_DOCUMENT_MAX,
  CACHE_PAGE_SIZE_DEFAULT,
  CACHE_PAGE_SIZE_MAX,
  deleteCacheEntryInPage,
  deleteCacheInPage,
  listCachesInPage,
  readCacheEntriesInPage,
  readCacheEntryDocumentInPage,
} from '@/background/modules/storage-inspector/standard-plane-caches';

const executeScriptSpy = (): ReturnType<typeof vi.fn> =>
  chrome.scripting.executeScript as unknown as ReturnType<typeof vi.fn>;
const getFrameSpy = (): ReturnType<typeof vi.fn> =>
  chrome.webNavigation.getFrame as unknown as ReturnType<typeof vi.fn>;

/** Minimal secure-context CacheStorage: named caches holding Request
 *  keys, with optional per-Request stored Responses for the match leg. */
function installCachesStub(
  seed: Record<string, Request[]>,
  responses?: Map<Request, Response>,
): Map<string, Request[]> {
  const store = new Map<string, Request[]>(Object.entries(seed));
  const stub = {
    keys: () => Promise.resolve([...store.keys()]),
    has: (name: string) => Promise.resolve(store.has(name)),
    delete: (name: string) => Promise.resolve(store.delete(name)),
    open: (name: string) => {
      // Mirrors the platform: open() CREATES a missing cache.
      if (!store.has(name)) store.set(name, []);
      const requests = store.get(name) as Request[];
      return Promise.resolve({
        keys: () => Promise.resolve([...requests]),
        match: (query: Request | string, options?: { ignoreMethod?: boolean }) => {
          const url = typeof query === 'string' ? query : query.url;
          const found = requests.find(
            (request) => request.url === url && (options?.ignoreMethod || request.method === 'GET'),
          );
          return Promise.resolve(found ? responses?.get(found) : undefined);
        },
        delete: (url: string, options?: { ignoreMethod?: boolean }) => {
          const before = requests.length;
          for (let i = requests.length - 1; i >= 0; i--) {
            const matches = requests[i].url === url && (options?.ignoreMethod || requests[i].method === 'GET');
            if (matches) requests.splice(i, 1);
          }
          return Promise.resolve(requests.length < before);
        },
      });
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
  getFrameSpy().mockReset();
  getFrameSpy().mockResolvedValue(null);
});

afterEach(() => {
  removeCachesGlobal();
  __resetStorageCdpAccessForTests();
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

  it('derives the size column from the stored response content-length header, absent otherwise', async () => {
    const sized = new Request('https://openheaders.io/api/data');
    const headerless = new Request('https://openheaders.io/api/plain');
    const unmatched = new Request('https://openheaders.io/api/orphan', { method: 'POST' });
    const posted = new Request('https://openheaders.io/api/submit', { method: 'POST' });
    const responses = new Map([
      [sized, new Response('{"a":1}', { status: 200, headers: { 'content-length': '7' } })],
      [headerless, new Response('plain', { status: 200 })],
      [posted, new Response('ok', { status: 201, headers: { 'content-length': '2' } })],
    ]);
    installCachesStub({ 'oh-api-v2': [sized, headerless, unmatched, posted] }, responses);

    const { entries } = await readCacheEntriesInPage('oh-api-v2', 0, 50, 512);
    expect(entries?.[0]?.contentLength).toBe(7);
    expect(entries?.[1]?.contentLength).toBeUndefined();
    expect(entries?.[2]?.contentLength).toBeUndefined();
    // The non-GET row needs the method check relaxed to match at all.
    expect(entries?.[3]?.contentLength).toBe(2);
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

describe('readCacheEntryDocumentInPage', () => {
  it('matches a non-GET entry with the method check relaxed', async () => {
    const request = new Request('https://openheaders.io/api/submit', { method: 'POST' });
    const responses = new Map([
      [request, new Response('ok', { status: 201, headers: { 'content-type': 'text/plain' } })],
    ]);
    installCachesStub({ 'oh-api-v2': [request] }, responses);

    const { document } = await readCacheEntryDocumentInPage(
      'oh-api-v2',
      'https://openheaders.io/api/submit',
      'POST',
      1024,
    );
    expect(document?.status).toBe(201);
  });
  it('ships structured header pairs and the full text body at the document cap', async () => {
    const request = new Request('https://openheaders.io/api/data');
    const responses = new Map([
      [
        request,
        new Response('{"a":1}', {
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json', 'x-oh': '1' },
        }),
      ],
    ]);
    installCachesStub({ 'oh-api-v2': [request] }, responses);

    const { document } = await readCacheEntryDocumentInPage(
      'oh-api-v2',
      'https://openheaders.io/api/data',
      'GET',
      1024,
    );
    expect(document).toMatchObject({
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'content-type', value: 'application/json' },
        { name: 'x-oh', value: '1' },
      ],
      body: '{"a":1}',
      bodyLength: 7,
    });
    expect(document?.bodyBase64).toBeUndefined();
    expect(document?.bodyTruncated).toBeUndefined();
  });

  it('ships a binary body base64 and truncates at the byte cap', async () => {
    const binary = new Request('https://openheaders.io/img.png');
    const long = new Request('https://openheaders.io/long.txt');
    const responses = new Map([
      [binary, new Response(new Uint8Array([0, 1, 2]), { status: 200, headers: { 'content-type': 'image/png' } })],
      [long, new Response('abcdefgh', { status: 200, headers: { 'content-type': 'text/plain' } })],
    ]);
    installCachesStub({ 'oh-assets-v1': [binary, long] }, responses);

    const bin = await readCacheEntryDocumentInPage('oh-assets-v1', 'https://openheaders.io/img.png', 'GET', 1024);
    expect(bin.document).toMatchObject({ body: 'AAEC', bodyBase64: true, bodyLength: 3 });

    const capped = await readCacheEntryDocumentInPage('oh-assets-v1', 'https://openheaders.io/long.txt', 'GET', 4);
    expect(capped.document).toMatchObject({ body: 'abcd', bodyLength: 8, bodyTruncated: true });
  });

  it('reads null for a missing entry, a missing cache (no ghost), and no caches global', async () => {
    const store = installCachesStub({ 'oh-assets-v1': [] });
    expect(
      (await readCacheEntryDocumentInPage('oh-assets-v1', 'https://openheaders.io/x', 'GET', 1024)).document,
    ).toBeNull();
    expect(
      (await readCacheEntryDocumentInPage('oh-gone', 'https://openheaders.io/x', 'GET', 1024)).document,
    ).toBeNull();
    expect([...store.keys()]).toEqual(['oh-assets-v1']);

    removeCachesGlobal();
    expect((await readCacheEntryDocumentInPage('any', 'https://openheaders.io/x', 'GET', 1024)).document).toBeNull();
  });
});

describe('injected delete plane', () => {
  it('deletes a whole cache and reports a missing one as failure', async () => {
    const store = installCachesStub({ 'oh-assets-v1': [], 'oh-keep': [] });
    expect(await deleteCacheInPage('oh-assets-v1')).toEqual({ ok: true });
    expect([...store.keys()]).toEqual(['oh-keep']);
    expect(await deleteCacheInPage('oh-gone')).toEqual({ ok: false });
  });

  it('deletes a GET entry by URL and a non-GET entry with the method check relaxed', async () => {
    const store = installCachesStub({
      'oh-api-v2': [
        new Request('https://openheaders.io/api/data'),
        new Request('https://openheaders.io/api/submit', { method: 'POST' }),
      ],
    });

    expect(await deleteCacheEntryInPage('oh-api-v2', 'https://openheaders.io/api/data', 'GET')).toEqual({ ok: true });
    expect(await deleteCacheEntryInPage('oh-api-v2', 'https://openheaders.io/api/submit', 'POST')).toEqual({
      ok: true,
    });
    expect(store.get('oh-api-v2')).toHaveLength(0);
  });

  it('reports a missing cache or entry as failure and never creates a ghost', async () => {
    const store = installCachesStub({ 'oh-assets-v1': [] });
    expect(await deleteCacheEntryInPage('oh-gone', 'https://openheaders.io/x', 'GET')).toEqual({ ok: false });
    expect(await deleteCacheEntryInPage('oh-assets-v1', 'https://openheaders.io/x', 'GET')).toEqual({ ok: false });
    expect([...store.keys()]).toEqual(['oh-assets-v1']);
  });
});

describe('arbitrated RPC surface — injected transport (detached)', () => {
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

  it('routes the document read through injection with the document cap', async () => {
    const document = {
      status: 200,
      statusText: 'OK',
      headers: [{ name: 'content-type', value: 'text/plain' }],
      body: 'hi',
      bodyLength: 2,
    };
    executeScriptSpy().mockResolvedValue([{ result: { document } }]);
    expect(
      (await getCacheStorageEntryDocument(1, 0, 'oh-assets-v1', 'https://openheaders.io/a.js', 'GET')).document,
    ).toEqual(document);
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual([
      'oh-assets-v1',
      'https://openheaders.io/a.js',
      'GET',
      CACHE_BODY_DOCUMENT_MAX,
    ]);

    executeScriptSpy().mockClear();
    expect((await getCacheStorageEntryDocument(1, 0, 'c', undefined as unknown as string, 'GET')).document).toBeNull();
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('routes deletes through injection and forwards their args', async () => {
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await deleteCacheStorageCache(1, 0, 'oh-assets-v1')).toEqual({ ok: true });
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['oh-assets-v1']);

    executeScriptSpy().mockClear();
    executeScriptSpy().mockResolvedValue([{ result: { ok: true } }]);
    expect(await deleteCacheStorageEntry(1, 0, 'oh-assets-v1', 'https://openheaders.io/a.js', 'GET')).toEqual({
      ok: true,
    });
    expect(executeScriptSpy().mock.calls[0][0].args).toEqual(['oh-assets-v1', 'https://openheaders.io/a.js', 'GET']);
  });

  it('reports injection failure as null and bad args without injecting', async () => {
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await listCacheStorageCaches(1, 0)).caches).toBeNull();
    executeScriptSpy().mockRejectedValue(new Error('No frame with id'));
    expect((await getCacheStorageEntries(1, 0, 'oh-assets-v1', 0, 50)).entries).toBeNull();

    executeScriptSpy().mockClear();
    expect((await getCacheStorageEntries(1, 0, undefined as unknown as string, 0, 50)).entries).toBeNull();
    expect((await deleteCacheStorageCache(1, 0, undefined as unknown as string)).ok).toBe(false);
    expect((await deleteCacheStorageEntry(1, 0, 'c', undefined as unknown as string, 'GET')).ok).toBe(false);
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });
});

describe('arbitrated RPC surface — CDP transport (attached)', () => {
  const ORIGIN = 'https://openheaders.io';
  const RAW_CACHES = [{ cacheId: 'id-assets', cacheName: 'oh-assets-v1' }];

  function installCdp(send: StorageCdpAccess['send'], attached = true): Array<{ method: string; params: unknown }> {
    const calls: Array<{ method: string; params: unknown }> = [];
    registerStorageCdpAccess({
      isAttached: () => attached,
      send: (tabId, method, params) => {
        calls.push({ method, params });
        return send(tabId, method, params);
      },
      subscribeStorageUpdated: () => () => {},
      onDetach: () => () => {},
    });
    return calls;
  }

  beforeEach(() => {
    getFrameSpy().mockResolvedValue({ url: `${ORIGIN}/app` });
  });

  it('lists caches through CacheStorage.requestCacheNames without injecting', async () => {
    installCdp((_tabId, method) => {
      if (method === 'CacheStorage.requestCacheNames') return Promise.resolve({ caches: RAW_CACHES });
      return Promise.reject(new Error(`unexpected ${method}`));
    });

    expect((await listCacheStorageCaches(1, 0)).caches).toEqual([{ name: 'oh-assets-v1' }]);
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('reads entries through requestEntries with native paging, truncation and response-metadata columns', async () => {
    const calls = installCdp((_tabId, method) => {
      if (method === 'CacheStorage.requestCacheNames') return Promise.resolve({ caches: RAW_CACHES });
      if (method === 'CacheStorage.requestEntries') {
        return Promise.resolve({
          cacheDataEntries: [
            {
              requestURL: 'https://openheaders.io/a.js',
              requestMethod: 'GET',
              requestHeaders: [{ name: 'accept', value: '*/*' }],
              responseTime: 1_770_000_000.5,
              responseHeaders: [{ name: 'Content-Length', value: '128' }],
            },
            {
              requestURL: 'https://openheaders.io/bare.js',
              requestMethod: 'GET',
            },
          ],
          returnCount: 7,
        });
      }
      return Promise.reject(new Error(`unexpected ${method}`));
    });

    const page = await getCacheStorageEntries(1, 0, 'oh-assets-v1', 2, 1);
    expect(page.entries).toEqual([
      {
        url: 'https://openheaders.io/a.js',
        method: 'GET',
        headersPreview: 'accept: */*',
        contentLength: 128,
        responseTimeMs: 1_770_000_000_500,
      },
      { url: 'https://openheaders.io/bare.js', method: 'GET' },
    ]);
    expect(page.truncated).toBe(true);
    expect(calls.find((c) => c.method === 'CacheStorage.requestEntries')?.params).toEqual({
      cacheId: 'id-assets',
      skipCount: 2,
      pageSize: 1,
    });
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('reads the document through requestEntries + requestCachedResponse with structured headers', async () => {
    const calls = installCdp((_tabId, method) => {
      if (method === 'CacheStorage.requestCacheNames') return Promise.resolve({ caches: RAW_CACHES });
      if (method === 'CacheStorage.requestEntries') {
        return Promise.resolve({
          cacheDataEntries: [
            {
              requestURL: 'https://openheaders.io/a.js',
              requestMethod: 'GET',
              requestHeaders: [{ name: 'accept', value: '*/*' }],
              responseStatus: 200,
              responseStatusText: 'OK',
              responseHeaders: [
                { name: 'content-type', value: 'text/javascript' },
                { name: 'date', value: 'Tue, 01 Jul 2026 00:00:00 GMT' },
              ],
            },
          ],
          returnCount: 1,
        });
      }
      if (method === 'CacheStorage.requestCachedResponse') {
        return Promise.resolve({ response: { body: btoa('hello') } });
      }
      return Promise.reject(new Error(`unexpected ${method}`));
    });

    const { document } = await getCacheStorageEntryDocument(1, 0, 'oh-assets-v1', 'https://openheaders.io/a.js', 'GET');
    expect(document).toEqual({
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'content-type', value: 'text/javascript' },
        { name: 'date', value: 'Tue, 01 Jul 2026 00:00:00 GMT' },
      ],
      body: 'hello',
      bodyLength: 5,
    });
    expect(calls.find((c) => c.method === 'CacheStorage.requestEntries')?.params).toMatchObject({
      cacheId: 'id-assets',
      pathFilter: 'https://openheaders.io/a.js',
    });
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('degrades the document read to injection when the CDP entry is missing', async () => {
    installCdp((_tabId, method) => {
      if (method === 'CacheStorage.requestCacheNames') return Promise.resolve({ caches: RAW_CACHES });
      if (method === 'CacheStorage.requestEntries') return Promise.resolve({ cacheDataEntries: [], returnCount: 0 });
      return Promise.reject(new Error(`unexpected ${method}`));
    });
    executeScriptSpy().mockResolvedValue([{ result: { document: null } }]);

    expect(
      (await getCacheStorageEntryDocument(1, 0, 'oh-assets-v1', 'https://openheaders.io/gone.js', 'GET')).document,
    ).toBeNull();
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  it('deletes through the CDP domain by resolved cacheId', async () => {
    const calls = installCdp((_tabId, method) => {
      if (method === 'CacheStorage.requestCacheNames') return Promise.resolve({ caches: RAW_CACHES });
      if (method === 'CacheStorage.deleteCache' || method === 'CacheStorage.deleteEntry') return Promise.resolve({});
      return Promise.reject(new Error(`unexpected ${method}`));
    });

    expect(await deleteCacheStorageCache(1, 0, 'oh-assets-v1')).toEqual({ ok: true });
    expect(calls.find((c) => c.method === 'CacheStorage.deleteCache')?.params).toEqual({ cacheId: 'id-assets' });

    expect(await deleteCacheStorageEntry(1, 0, 'oh-assets-v1', 'https://openheaders.io/a.js', 'GET')).toEqual({
      ok: true,
    });
    expect(calls.find((c) => c.method === 'CacheStorage.deleteEntry')?.params).toEqual({
      cacheId: 'id-assets',
      request: 'https://openheaders.io/a.js',
    });
    expect(executeScriptSpy()).not.toHaveBeenCalled();
  });

  it('degrades to injection when a CDP op fails or the cache is unknown', async () => {
    installCdp(() => Promise.reject(new Error('detached mid-flight')));
    executeScriptSpy().mockResolvedValue([{ result: { caches: [{ name: 'oh-assets-v1' }] } }]);

    expect((await listCacheStorageCaches(1, 0)).caches).toEqual([{ name: 'oh-assets-v1' }]);
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  it('uses injection when the tab is not attached', async () => {
    installCdp(() => Promise.reject(new Error('must not be called')), false);
    executeScriptSpy().mockResolvedValue([{ result: { caches: [] } }]);

    expect((await listCacheStorageCaches(1, 0)).caches).toEqual([]);
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });

  it('uses injection when the frame origin cannot be derived', async () => {
    getFrameSpy().mockResolvedValue(null);
    installCdp(() => Promise.reject(new Error('must not be called')));
    executeScriptSpy().mockResolvedValue([{ result: { caches: [] } }]);

    expect((await listCacheStorageCaches(1, 0)).caches).toEqual([]);
    expect(executeScriptSpy()).toHaveBeenCalledTimes(1);
  });
});
