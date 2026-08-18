/**
 * Cache Storage + quota + clear-site-data e2e (the storage-panel plan §5,
 * slices 5–7) — drives the SW storage-inspector handlers end-to-end over
 * the real bridge against a detached tab (injected transport; the CDP
 * tier's contract is pinned by storage-cdp-probe.spec.ts) and asserts
 * the PAGE-SIDE state moved. 127.0.0.1 is a potentially-trustworthy
 * origin, so the secure-context `caches` / `navigator.storage` planes
 * are reachable on the playground.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';

let context: BrowserContext;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;

  rpcPage = await context.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await rpcPage.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
});

test.afterAll(async () => {
  await context.close();
});

async function rpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return rpcPage.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  ) as Promise<T>;
}

interface ScopeWire {
  frameId: number;
  origin: string;
  isMainFrame: boolean;
}

interface CacheEntryWireShape {
  url: string;
  method: string;
  headersPreview?: string;
  contentLength?: number;
  responseTimeMs?: number;
}

interface DocumentWireShape {
  status: number;
  statusText: string;
  headers: Array<{ name: string; value: string }>;
  body: string;
  bodyBase64?: boolean;
  bodyLength: number;
  bodyTruncated?: boolean;
}

test('Cache Storage reads, entry document, deletes, quota and clear ride the plane end-to-end', async () => {
  test.setTimeout(90_000);
  const page = await context.newPage();
  await page.goto(PLAYGROUND_URL);

  // ── Seed page-side: two caches, one with a stored JSON response ────
  await page.evaluate(async () => {
    for (const name of await caches.keys()) await caches.delete(name);
    localStorage.clear();
    localStorage.setItem('oh-e2e-clear-probe', 'present');
    const api = await caches.open('oh-e2e-api');
    await api.put(
      new Request('http://127.0.0.1:3000/api/data'),
      new Response('{"a":1}', {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json', 'content-length': '7' },
      }),
    );
    await api.put(new Request('http://127.0.0.1:3000/api/other'), new Response('plain', { status: 200 }));
    await caches.open('oh-e2e-assets');
  });

  const tabId = await rpcPage.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` });
    return tab?.id ?? null;
  }, PLAYGROUND_URL);
  expect(tabId).not.toBeNull();

  const { scopes } = await rpc<{ scopes: ScopeWire[] | null }>('listStorageScopes', { tabId });
  const scope = scopes?.find((s) => s.isMainFrame);
  expect(scope).toBeDefined();
  const base = { tabId, frameId: scope?.frameId };

  // ── Cache enumeration sees the page-side seed ──────────────────────
  const listed = await rpc<{ caches: Array<{ name: string }> | null }>('listCacheStorageCaches', base);
  const names = (listed.caches ?? []).map((c) => c.name);
  expect(names).toContain('oh-e2e-api');
  expect(names).toContain('oh-e2e-assets');

  // ── Paged entry read — request metadata only ───────────────────────
  const entries = await rpc<{ entries: CacheEntryWireShape[] | null; truncated?: boolean }>('getCacheStorageEntries', {
    ...base,
    cache: 'oh-e2e-api',
    page: 0,
    pageSize: 50,
  });
  expect(entries.entries?.some((e) => e.url === 'http://127.0.0.1:3000/api/data' && e.method === 'GET')).toBe(true);
  expect(entries.truncated).toBeFalsy();

  // Size column rides the stored content-length header (headers-only
  // match); the time column has no injected leg — absent while detached.
  const dataEntry = entries.entries?.find((e) => e.url === 'http://127.0.0.1:3000/api/data');
  expect(dataEntry?.contentLength).toBe(7);
  expect(dataEntry?.responseTimeMs).toBeUndefined();
  const otherEntry = entries.entries?.find((e) => e.url === 'http://127.0.0.1:3000/api/other');
  expect(otherEntry?.contentLength).toBeUndefined();

  // ── Lazy stored-response document (the editor tab's separate RPC) ──
  const opened = await rpc<{ document: DocumentWireShape | null }>('getCacheStorageEntryDocument', {
    ...base,
    cache: 'oh-e2e-api',
    url: 'http://127.0.0.1:3000/api/data',
    method: 'GET',
  });
  expect(opened.document?.status).toBe(200);
  expect(opened.document?.body).toBe('{"a":1}');
  expect(opened.document?.bodyLength).toBe(7);
  expect(opened.document?.bodyBase64).toBeFalsy();
  expect(opened.document?.headers.some((h) => h.name === 'content-type' && h.value === 'application/json')).toBe(true);

  const missing = await rpc<{ document: DocumentWireShape | null }>('getCacheStorageEntryDocument', {
    ...base,
    cache: 'oh-e2e-api',
    url: 'http://127.0.0.1:3000/api/gone',
    method: 'GET',
  });
  expect(missing.document).toBeNull();

  // ── Entry delete moves the page-side cache ─────────────────────────
  const entryDeleted = await rpc<{ ok: boolean }>('deleteCacheStorageEntry', {
    ...base,
    cache: 'oh-e2e-api',
    url: 'http://127.0.0.1:3000/api/other',
    method: 'GET',
  });
  expect(entryDeleted.ok).toBe(true);
  expect(
    await page.evaluate(async () => {
      const api = await caches.open('oh-e2e-api');
      return (await api.keys()).map((r) => r.url);
    }),
  ).toEqual(['http://127.0.0.1:3000/api/data']);

  // ── Whole-cache delete ─────────────────────────────────────────────
  const cacheDeleted = await rpc<{ ok: boolean }>('deleteCacheStorageCache', { ...base, cache: 'oh-e2e-assets' });
  expect(cacheDeleted.ok).toBe(true);
  expect(await page.evaluate(() => caches.has('oh-e2e-assets'))).toBe(false);

  // ── Quota totals (detached ⇒ injected estimate, breakdown absent) ──
  const quota = await rpc<{ quota: { usage: number; quota: number; breakdown?: unknown[] } | null }>(
    'getStorageQuota',
    base,
  );
  expect(quota.quota).not.toBeNull();
  expect(quota.quota!.quota).toBeGreaterThan(0);
  expect(quota.quota!.usage).toBeGreaterThanOrEqual(0);
  expect(quota.quota!.breakdown).toBeUndefined();

  // ── Per-type clear honors the subset: the unticked type survives ───
  const subsetCleared = await rpc<{ ok: boolean }>('clearSiteData', { ...base, types: ['cacheStorage'] });
  expect(subsetCleared.ok).toBe(true);
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-clear-probe'))).toBe('present');

  // ── Full clear (types absent) wipes DOM storage too ────────────────
  const cleared = await rpc<{ ok: boolean }>('clearSiteData', base);
  expect(cleared.ok).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-clear-probe'))).toBeNull();

  await page.close();
});
