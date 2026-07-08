/**
 * Storage CDP tier e2e (STORAGE_PANEL_PLAN.md §2.3 / §3) — exercises
 * the PRODUCTION attach path end-to-end, which the probe spec (raw
 * protocol contract) and the injected-plane specs deliberately don't:
 * pinning the tab drives the attach reconciler, and the assertions pin
 * what only the CDP tier provides — storage-key stamping on scope
 * listings, the per-type quota breakdown, cache reads/deletes riding
 * the CDP domain, tracking-armed page-side writes pushing
 * `storageInvalidated` broadcasts — plus the degrade-freely rule:
 * unpinning falls back to the injected plane without errors.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { STORAGE_PAGE_URL } from './pages/storage-matrix-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Opt-in demo pacing: OH_E2E_SLOWMO=<ms> delays every RPC and page op. */
const slowMo = Number(process.env.OH_E2E_SLOWMO ?? '0') || 0;
const pagePace = slowMo > 0 ? `?pace=${slowMo}` : '';

let context: BrowserContext;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      // Suppress the debugging infobar so attach commits without layout shifts.
      '--silent-debugger-extension-api',
    ],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;

  rpcPage = await context.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/workbench.html`);
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
  if (slowMo > 0) await new Promise((resolve) => setTimeout(resolve, slowMo));
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
  storageKey?: string;
}

interface CacheEntryWireShape {
  url: string;
  method: string;
  headersPreview?: string;
  contentLength?: number;
  responseTimeMs?: number;
}

interface PreviewWireShape {
  status: number;
  statusText: string;
  headersPreview?: string;
  bodyPreview: string;
  bodyBase64?: boolean;
  bodyLength: number;
  bodyTruncated?: boolean;
}

interface QuotaWireShape {
  usage: number;
  quota: number;
  breakdown?: Array<{ storageType: string; usage: number }>;
}

interface InvalidationMessage {
  type: string;
  tabId: number;
  kind: string;
}

/** Re-list scopes until the main-frame scope satisfies `until`. */
async function pollMainScope(tabId: number, until: (scope: ScopeWire) => boolean, label: string): Promise<ScopeWire> {
  for (let i = 0; i < 40; i++) {
    const { scopes } = await rpc<{ scopes: ScopeWire[] | null }>('listStorageScopes', { tabId });
    const scope = scopes?.find((s) => s.isMainFrame);
    if (scope && until(scope)) return scope;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`main scope never reached: ${label}`);
}

test('CDP tier: stamping, breakdown, CDP cache ops, invalidation pushes, detach degrade', async () => {
  test.setTimeout(slowMo > 0 ? 600_000 : 120_000);
  const page = await context.newPage();
  await page.goto(`${STORAGE_PAGE_URL}${pagePace}`);

  await page.evaluate(async () => {
    await window.ohStorage.reset();
    await window.ohStorage.seedIdb();
    await window.ohStorage.seedCaches();
  });

  const tabId = (await rpcPage.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` });
    return tab?.id ?? null;
  }, STORAGE_PAGE_URL)) as number | null;
  expect(tabId).not.toBeNull();

  // Collect `storageInvalidated` broadcasts — they ride the same
  // runtime.sendMessage fan every extension page hears.
  await rpcPage.evaluate(() => {
    const bucket: unknown[] = [];
    (window as unknown as { __ohInvalidations: unknown[] }).__ohInvalidations = bucket;
    chrome.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type === 'storageInvalidated') bucket.push(message);
    });
  });

  // ── Detached baseline: no storage key, no breakdown ────────────────
  const detachedScope = await pollMainScope(tabId as number, () => true, 'baseline listing');
  expect(detachedScope.storageKey).toBeUndefined();
  const base = { tabId, frameId: detachedScope.frameId };
  const detachedQuota = await rpc<{ quota: QuotaWireShape | null }>('getStorageQuota', base);
  expect(detachedQuota.quota?.breakdown).toBeUndefined();

  // ── Pin → the production reconciler attaches → stamping appears ────
  await rpc('setCdpTabPin', { tabId, pinned: true });
  const attachedScope = await pollMainScope(
    tabId as number,
    (scope) => typeof scope.storageKey === 'string',
    'storage-key stamping after pin',
  );
  expect(attachedScope.storageKey).toContain('http://127.0.0.1:3000');

  // ── Quota rides CDP: the per-type breakdown exists only there ──────
  const attachedQuota = await rpc<{ quota: QuotaWireShape | null }>('getStorageQuota', base);
  expect(attachedQuota.quota?.breakdown).toBeDefined();
  const breakdownTypes = (attachedQuota.quota?.breakdown ?? []).map((row) => row.storageType);
  expect(breakdownTypes).toContain('indexeddb');

  // ── Cache reads ride CDP transparently ─────────────────────────────
  const listed = await rpc<{ caches: Array<{ name: string }> | null }>('listCacheStorageCaches', base);
  const names = (listed.caches ?? []).map((c) => c.name);
  expect(names).toContain('oh-cache-api');
  expect(names).toContain('oh-cache-assets');

  const entries = await rpc<{ entries: CacheEntryWireShape[] | null }>('getCacheStorageEntries', {
    ...base,
    cache: 'oh-cache-api',
    page: 0,
    pageSize: 50,
  });
  const echoUrl = 'http://127.0.0.1:3000/api/echo?seed=one&kind=json';
  expect(entries.entries?.some((e) => e.url === echoUrl && e.method === 'GET')).toBe(true);

  // Response-metadata columns ride the CDP entry list: size from the
  // fetched response's content-length header, time from the cache's own
  // storage wall clock (epoch ms, sane recency).
  const echoEntry = entries.entries?.find((e) => e.url === echoUrl);
  expect(echoEntry?.contentLength).toBeGreaterThan(0);
  expect(echoEntry?.responseTimeMs).toBeGreaterThan(Date.now() - 60 * 60 * 1000);
  expect(echoEntry?.responseTimeMs).toBeLessThan(Date.now() + 60 * 1000);

  // Textual preview via requestCachedResponse, re-capped SW-side.
  const echoPreview = await rpc<{ preview: PreviewWireShape | null }>('getCacheStorageEntryResponse', {
    ...base,
    cache: 'oh-cache-api',
    url: echoUrl,
    method: 'GET',
  });
  expect(echoPreview.preview?.status).toBe(200);
  expect(echoPreview.preview?.bodyBase64).toBeFalsy();
  expect(echoPreview.preview?.bodyPreview).toContain('"seed": "one"');
  expect(echoPreview.preview?.headersPreview?.toLowerCase()).toContain('content-type: application/json');

  // Binary body ships base64.
  const gifPreview = await rpc<{ preview: PreviewWireShape | null }>('getCacheStorageEntryResponse', {
    ...base,
    cache: 'oh-cache-api',
    url: 'http://127.0.0.1:3000/probe/image?seed=gif',
    method: 'GET',
  });
  expect(gifPreview.preview?.bodyBase64).toBe(true);
  expect(gifPreview.preview?.bodyLength).toBeGreaterThan(0);

  // Oversized body arrives truncated to the preview cap.
  const bigPreview = await rpc<{ preview: PreviewWireShape | null }>('getCacheStorageEntryResponse', {
    ...base,
    cache: 'oh-cache-assets',
    url: 'http://127.0.0.1:3000/storage/big-body',
    method: 'GET',
  });
  expect(bigPreview.preview?.bodyLength).toBe(20_000);
  expect(bigPreview.preview?.bodyTruncated).toBe(true);
  expect(bigPreview.preview?.bodyPreview.length).toBe(16 * 1024);

  // ── Tracking armed: page-side writes push invalidation broadcasts ──
  await page.evaluate(async () => {
    await window.ohStorage.writeIdb('live-key', 'live-value');
    await window.ohStorage.putCache('oh-cache-api', '/api/echo?live=push');
  });
  await rpcPage.waitForFunction(
    () => {
      const bucket = (window as unknown as { __ohInvalidations: Array<{ kind: string }> }).__ohInvalidations;
      const kinds = new Set(bucket.map((m) => m.kind));
      return kinds.has('indexeddb') && kinds.has('cachestorage');
    },
    { timeout: 15000 },
  );
  const pushes = (await rpcPage.evaluate(
    () => (window as unknown as { __ohInvalidations: unknown[] }).__ohInvalidations,
  )) as InvalidationMessage[];
  expect(pushes.every((m) => m.tabId === tabId)).toBe(true);

  // ── CDP delete moves the page-side cache ───────────────────────────
  const deleted = await rpc<{ ok: boolean }>('deleteCacheStorageEntry', {
    ...base,
    cache: 'oh-cache-api',
    url: 'http://127.0.0.1:3000/probe/image?seed=gif',
    method: 'GET',
  });
  expect(deleted.ok).toBe(true);
  expect(
    await page.evaluate(async () => {
      const api = await caches.open('oh-cache-api');
      return (await api.keys()).map((r) => r.url);
    }),
  ).not.toContain('http://127.0.0.1:3000/probe/image?seed=gif');

  // ── Unpin → detach → everything degrades to the injected plane ─────
  await rpc('setCdpTabPin', { tabId, pinned: false });
  await pollMainScope(tabId as number, (scope) => scope.storageKey === undefined, 'stamp gone after unpin');

  const degradedQuota = await rpc<{ quota: QuotaWireShape | null }>('getStorageQuota', base);
  expect(degradedQuota.quota).not.toBeNull();
  expect(degradedQuota.quota?.breakdown).toBeUndefined();

  const degradedEntries = await rpc<{ entries: CacheEntryWireShape[] | null }>('getCacheStorageEntries', {
    ...base,
    cache: 'oh-cache-api',
    page: 0,
    pageSize: 50,
  });
  expect(degradedEntries.entries?.some((e) => e.url === echoUrl)).toBe(true);
  // The injected leg keeps the size column (headers-only match) but the
  // Cache API has no storage wall clock — the time column degrades away.
  const degradedEcho = degradedEntries.entries?.find((e) => e.url === echoUrl);
  expect(degradedEcho?.contentLength).toBeGreaterThan(0);
  expect(degradedEcho?.responseTimeMs).toBeUndefined();

  await page.evaluate(() => window.ohStorage.reset());
  await page.close();
});
