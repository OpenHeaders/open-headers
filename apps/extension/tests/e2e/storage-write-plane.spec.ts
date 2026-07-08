/**
 * DOM-storage write plane e2e (STORAGE_PANEL_PLAN.md §5, slice 2) —
 * drives the SW storage-inspector handlers end-to-end over the real
 * bridge (an extension page RPCs `chrome.runtime.sendMessage`, the SW
 * injects into the playground tab) and asserts the PAGE-SIDE state
 * moved. The panel UI itself is jsdom-tested; this leg pins the plane:
 * scope discovery, reads, set/remove/clear, and the clipped-value →
 * lazy full-value contract.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_ORIGIN = 'http://127.0.0.1:3000';

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
  url: string;
  isMainFrame: boolean;
}

interface EntryWire {
  key: string;
  value: string;
  valueLength: number;
  clipped?: boolean;
}

test('DOM storage writes ride the injection plane end-to-end', async () => {
  test.setTimeout(60_000);
  const page = await context.newPage();
  await page.goto(PLAYGROUND_URL);

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('oh-e2e-seed', 'seeded');
    sessionStorage.setItem('oh-e2e-session-seed', 'seeded');
  });

  const tabId = await rpcPage.evaluate(async (url) => {
    const [tab] = await chrome.tabs.query({ url: `${url}*` });
    return tab?.id ?? null;
  }, PLAYGROUND_URL);
  expect(tabId).not.toBeNull();

  // ── Scope discovery → the main-frame injection target ────────────
  const { scopes } = await rpc<{ scopes: ScopeWire[] | null }>('listStorageScopes', { tabId });
  expect(scopes).not.toBeNull();
  const scope = scopes?.find((s) => s.isMainFrame);
  expect(scope?.origin).toBe(PLAYGROUND_ORIGIN);
  const base = { tabId, frameId: scope?.frameId, area: 'local' as const };

  // ── Read sees the page-side seed ──────────────────────────────────
  const read = await rpc<{ entries: EntryWire[] | null }>('getDomStorageEntries', base);
  expect(read.entries?.some((e) => e.key === 'oh-e2e-seed' && e.value === 'seeded')).toBe(true);

  // ── Write lands page-side (add, then overwrite) ───────────────────
  const wrote = await rpc<{ ok: boolean }>('setDomStorageItem', { ...base, key: 'oh-e2e-write', value: 'v1' });
  expect(wrote.ok).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-write'))).toBe('v1');

  const overwrote = await rpc<{ ok: boolean }>('setDomStorageItem', { ...base, key: 'oh-e2e-write', value: 'v2' });
  expect(overwrote.ok).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-write'))).toBe('v2');

  // ── Remove deletes exactly its key ────────────────────────────────
  const removed = await rpc<{ ok: boolean }>('removeDomStorageItem', { ...base, key: 'oh-e2e-write' });
  expect(removed.ok).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-write'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-seed'))).toBe('seeded');

  // ── Clipped read → lazy full-value fetch round-trips intact ───────
  await page.evaluate(() => {
    localStorage.setItem('oh-e2e-big', 'x'.repeat(20_000));
  });
  const bigRead = await rpc<{ entries: EntryWire[] | null }>('getDomStorageEntries', base);
  const bigEntry = bigRead.entries?.find((e) => e.key === 'oh-e2e-big');
  expect(bigEntry?.clipped).toBe(true);
  expect(bigEntry?.valueLength).toBe(20_000);
  expect(bigEntry?.value.length).toBeLessThan(20_000);

  const full = await rpc<{ value: string | null; tooLarge?: boolean }>('getDomStorageValue', {
    ...base,
    key: 'oh-e2e-big',
  });
  expect(full.tooLarge).toBeFalsy();
  expect(full.value?.length).toBe(20_000);

  // ── Rename moves the entry in one leg: old key gone, new key carries
  //    the (possibly edited) value ─────────────────────────────────────
  await page.evaluate(() => {
    localStorage.setItem('oh-e2e-rename', 'original');
  });
  const renamed = await rpc<{ ok: boolean; reason?: string }>('renameDomStorageItem', {
    ...base,
    key: 'oh-e2e-rename',
    newKey: 'oh-e2e-renamed',
    value: 'edited',
  });
  expect(renamed).toEqual({ ok: true });
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-rename'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-renamed'))).toBe('edited');

  // ── Rename onto an existing key is an honest rejection — both intact ─
  await page.evaluate(() => {
    localStorage.setItem('oh-e2e-target', 'keep');
  });
  const collided = await rpc<{ ok: boolean; reason?: string }>('renameDomStorageItem', {
    ...base,
    key: 'oh-e2e-renamed',
    newKey: 'oh-e2e-target',
    value: 'stomp',
  });
  expect(collided).toEqual({ ok: false, reason: 'collision' });
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-renamed'))).toBe('edited');
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-target'))).toBe('keep');

  // ── Renaming a vanished key reports gone ──────────────────────────
  const vanished = await rpc<{ ok: boolean; reason?: string }>('renameDomStorageItem', {
    ...base,
    key: 'oh-e2e-never-existed',
    newKey: 'oh-e2e-any',
    value: 'v',
  });
  expect(vanished).toEqual({ ok: false, reason: 'gone' });

  // ── Clear empties ONLY the addressed area ─────────────────────────
  const cleared = await rpc<{ ok: boolean }>('clearDomStorage', { ...base, area: 'session' });
  expect(cleared.ok).toBe(true);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('oh-e2e-seed'))).toBe('seeded');

  await page.close();
});
