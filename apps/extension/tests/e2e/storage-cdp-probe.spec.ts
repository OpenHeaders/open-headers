/**
 * Slice-0 probe for the Storage panel epic (docs/STORAGE_PANEL_PLAN.md §2.3):
 * does `chrome.debugger` actually dispatch the storage-inspection CDP
 * domains, despite the reference doc's stale "available domains" prose?
 *
 * One command per domain against a playground tab seeded with real data:
 *   - DOMStorage.getDOMStorageItems  (+ live domStorageItem* event check)
 *   - IndexedDB.requestDatabaseNames
 *   - CacheStorage.requestCacheNames
 *   - Storage.getUsageAndQuota / Storage.getStorageKey
 *
 * The whole probe runs inside the extension service worker — the exact
 * production context the storage-inspector CDP plane will use. Verdicts
 * land in docs/STORAGE_PANEL_STATUS.md; this spec stays as the permanent
 * gate that the CDP tier's substrate exists.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_ORIGIN = 'http://127.0.0.1:3000';

interface ProbeVerdict {
  ok: boolean;
  error?: string;
  detail?: unknown;
}

interface ProbeReport {
  storageKey: ProbeVerdict;
  domStorageRead: ProbeVerdict;
  domStorageEvents: ProbeVerdict;
  domStorageWrite: ProbeVerdict;
  indexedDb: ProbeVerdict;
  cacheStorage: ProbeVerdict;
  usageAndQuota: ProbeVerdict;
  idbTrackingEvents: ProbeVerdict;
  cacheTrackingEvents: ProbeVerdict;
}

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      // Keep the probe about protocol dispatch, not infobar layout shifts.
      '--silent-debugger-extension-api',
    ],
  });
});

test.afterAll(async () => {
  await context.close();
});

test('storage CDP domains dispatch over chrome.debugger', async () => {
  test.setTimeout(60_000);
  const serviceWorker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));

  const page = await context.newPage();
  await page.goto(PLAYGROUND_URL);

  // Seed every storage type from the page itself (127.0.0.1 is a secure
  // context, so caches/IDB are available).
  await page.evaluate(async () => {
    localStorage.setItem('oh-probe-local', 'v1');
    sessionStorage.setItem('oh-probe-session', 'v1');
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('oh-probe-db', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('probe-store');
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const cache = await caches.open('oh-probe-cache');
    await cache.put(new Request('/oh-probe-entry'), new Response('probe'));
  });

  const report = await serviceWorker.evaluate(
    async ({ origin, url }): Promise<ProbeReport> => {
      const [tab] = await chrome.tabs.query({ url: `${url}*` });
      if (!tab?.id) throw new Error('playground tab not found');
      const target = { tabId: tab.id };

      const send = (method: string, params?: Record<string, unknown>) =>
        chrome.debugger.sendCommand(target, method, params) as Promise<Record<string, unknown> | undefined>;

      const probe = async (run: () => Promise<unknown>): Promise<{ ok: boolean; error?: string; detail?: unknown }> => {
        try {
          return { ok: true, detail: await run() };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      };

      await chrome.debugger.attach(target, '1.3');
      try {
        // Storage.getStorageKey needs the main frame id → Page.getFrameTree.
        const storageKey = await probe(async () => {
          const tree = (await send('Page.getFrameTree')) as {
            frameTree: { frame: { id: string } };
          };
          const res = (await send('Storage.getStorageKey', { frameId: tree.frameTree.frame.id })) as {
            storageKey: string;
          };
          if (!res.storageKey) throw new Error('empty storage key');
          return res.storageKey;
        });

        const storageId = { securityOrigin: origin, isLocalStorage: true };

        const domStorageRead = await probe(async () => {
          await send('DOMStorage.enable');
          const res = (await send('DOMStorage.getDOMStorageItems', { storageId })) as { entries: string[][] };
          if (!res.entries.some(([k, v]) => k === 'oh-probe-local' && v === 'v1')) {
            throw new Error(`seeded item missing: ${JSON.stringify(res.entries)}`);
          }
          return res.entries.length;
        });

        // Live event check: a page-side write must surface as a
        // domStorageItemAdded/Updated event — the whole point of the CDP tier.
        const domStorageEvents = await probe(
          () =>
            new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                chrome.debugger.onEvent.removeListener(listener);
                reject(new Error('no domStorageItem* event within 5s'));
              }, 5000);
              const listener = (src: chrome.debugger.Debuggee, method: string, params?: object) => {
                if (src.tabId !== tab.id) return;
                if (method === 'DOMStorage.domStorageItemAdded' || method === 'DOMStorage.domStorageItemUpdated') {
                  clearTimeout(timer);
                  chrome.debugger.onEvent.removeListener(listener);
                  resolve({ method, params });
                }
              };
              chrome.debugger.onEvent.addListener(listener);
              void chrome.scripting.executeScript({
                target: { tabId: tab.id as number },
                func: () => localStorage.setItem('oh-probe-event', 'fired'),
              });
            }),
        );

        const domStorageWrite = await probe(async () => {
          await send('DOMStorage.setDOMStorageItem', { storageId, key: 'oh-probe-cdp-write', value: 'w1' });
          const res = (await send('DOMStorage.getDOMStorageItems', { storageId })) as { entries: string[][] };
          if (!res.entries.some(([k, v]) => k === 'oh-probe-cdp-write' && v === 'w1')) {
            throw new Error('CDP-written item not readable back');
          }
          await send('DOMStorage.removeDOMStorageItem', { storageId, key: 'oh-probe-cdp-write' });
          return true;
        });

        const indexedDb = await probe(async () => {
          const res = (await send('IndexedDB.requestDatabaseNames', { securityOrigin: origin })) as {
            databaseNames: string[];
          };
          if (!res.databaseNames.includes('oh-probe-db')) {
            throw new Error(`seeded db missing: ${JSON.stringify(res.databaseNames)}`);
          }
          return res.databaseNames;
        });

        const cacheStorage = await probe(async () => {
          const res = (await send('CacheStorage.requestCacheNames', { securityOrigin: origin })) as {
            caches: Array<{ cacheName: string }>;
          };
          if (!res.caches.some((c) => c.cacheName === 'oh-probe-cache')) {
            throw new Error(`seeded cache missing: ${JSON.stringify(res.caches)}`);
          }
          return res.caches.map((c) => c.cacheName);
        });

        const usageAndQuota = await probe(async () => {
          const res = (await send('Storage.getUsageAndQuota', { origin })) as {
            usage: number;
            quota: number;
            usageBreakdown: Array<{ storageType: string; usage: number }>;
          };
          if (!(res.quota > 0)) throw new Error(`no quota: ${JSON.stringify(res)}`);
          return { usage: res.usage, quota: res.quota, breakdown: res.usageBreakdown };
        });

        // Hybrid check: the Storage domain (allowed) owns the tracking
        // events for IndexedDB / CacheStorage. If these fire, CDP mode can
        // deliver live invalidations even where the read domains are blocked.
        const key = typeof storageKey.detail === 'string' ? storageKey.detail : origin;

        const awaitTrackedEvent = (methods: string[], mutate: () => void) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              chrome.debugger.onEvent.removeListener(listener);
              reject(new Error(`no ${methods.join('/')} event within 5s`));
            }, 5000);
            const listener = (src: chrome.debugger.Debuggee, method: string, params?: object) => {
              if (src.tabId !== tab.id) return;
              if (methods.includes(method)) {
                clearTimeout(timer);
                chrome.debugger.onEvent.removeListener(listener);
                resolve({ method, params });
              }
            };
            chrome.debugger.onEvent.addListener(listener);
            mutate();
          });

        const idbTrackingEvents = await probe(async () => {
          await send('Storage.trackIndexedDBForStorageKey', { storageKey: key });
          return awaitTrackedEvent(['Storage.indexedDBContentUpdated', 'Storage.indexedDBListUpdated'], () => {
            void chrome.scripting.executeScript({
              target: { tabId: tab.id as number },
              func: () => {
                const req = indexedDB.open('oh-probe-db', 1);
                req.onsuccess = () => {
                  const db = req.result;
                  db.transaction('probe-store', 'readwrite').objectStore('probe-store').put('v', 'oh-probe-key');
                  db.close();
                };
              },
            });
          });
        });

        const cacheTrackingEvents = await probe(async () => {
          await send('Storage.trackCacheStorageForStorageKey', { storageKey: key });
          return awaitTrackedEvent(['Storage.cacheStorageContentUpdated', 'Storage.cacheStorageListUpdated'], () => {
            void chrome.scripting.executeScript({
              target: { tabId: tab.id as number },
              func: () => {
                void caches
                  .open('oh-probe-cache')
                  .then((c) => c.put(new Request('/oh-probe-entry-2'), new Response('probe2')));
              },
            });
          });
        });

        return {
          storageKey,
          domStorageRead,
          domStorageEvents,
          domStorageWrite,
          indexedDb,
          cacheStorage,
          usageAndQuota,
          idbTrackingEvents,
          cacheTrackingEvents,
        };
      } finally {
        await chrome.debugger.detach(target).catch(() => {});
      }
    },
    { origin: PLAYGROUND_ORIGIN, url: PLAYGROUND_URL },
  );

  // Soft assertion per domain: one run yields the complete verdict table
  // (a blocked domain must not mask the others' results).
  //
  // The assertions pin the OBSERVED contract (slice-0 verdict, recorded in
  // docs/STORAGE_PANEL_STATUS.md): chrome.debugger enforces the reference
  // doc's domain list, so DOMStorage / IndexedDB reads are blocked (-32601)
  // while Storage / CacheStorage — including the Storage-domain tracking
  // events for IDB and caches — work. If Chrome ever unblocks the read
  // domains, the `ok: false` pins below fail and the CDP plane can upgrade.
  console.log(`storage-cdp-probe report: ${JSON.stringify(report, null, 2)}`);
  expect.soft(report.storageKey, JSON.stringify(report.storageKey)).toMatchObject({ ok: true });
  expect.soft(report.usageAndQuota, JSON.stringify(report.usageAndQuota)).toMatchObject({ ok: true });
  expect.soft(report.cacheStorage, JSON.stringify(report.cacheStorage)).toMatchObject({ ok: true });
  expect.soft(report.idbTrackingEvents, JSON.stringify(report.idbTrackingEvents)).toMatchObject({ ok: true });
  expect.soft(report.cacheTrackingEvents, JSON.stringify(report.cacheTrackingEvents)).toMatchObject({ ok: true });
  expect.soft(report.domStorageRead, JSON.stringify(report.domStorageRead)).toMatchObject({ ok: false });
  expect.soft(report.domStorageEvents, JSON.stringify(report.domStorageEvents)).toMatchObject({ ok: false });
  expect.soft(report.domStorageWrite, JSON.stringify(report.domStorageWrite)).toMatchObject({ ok: false });
  expect.soft(report.indexedDb, JSON.stringify(report.indexedDb)).toMatchObject({ ok: false });
});
