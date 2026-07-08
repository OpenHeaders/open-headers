/**
 * Cookies plane e2e (STORAGE_PANEL_PLAN.md §5, slice 3) — drives the
 * jar RPCs (`fetchCookieJarForUrl` / `setCookieForUrl` /
 * `removeCookieForUrl`) end-to-end over the real bridge against a real
 * browser jar. HttpOnly is the point of the plane: the playground's
 * storage page seeds one via a server `Set-Cookie`, invisible to
 * `document.cookie` but read/written through `chrome.cookies` — both
 * directions are asserted against page-side ground truth.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { STORAGE_PAGE_URL } from './pages/storage-matrix-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

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

interface JarCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  session: boolean;
  storeId?: string;
}

async function fetchJar(url: string): Promise<JarCookie[]> {
  const { cookies } = await rpc<{ cookies: JarCookie[] | null }>('fetchCookieJarForUrl', { url });
  expect(cookies).not.toBeNull();
  return cookies ?? [];
}

test('cookie jar reads and writes ride the plane end-to-end, HttpOnly included', async () => {
  test.setTimeout(60_000);
  const page = await context.newPage();
  await page.goto(STORAGE_PAGE_URL);

  await page.evaluate(async () => {
    await window.ohStorage.reset();
    await window.ohStorage.seedCookies();
  });

  // ── Jar read sees the document cookie AND the server-set ones ──────
  const jar = await fetchJar(STORAGE_PAGE_URL);
  const byName = new Map(jar.map((c) => [c.name, c]));

  const js = byName.get('oh_store_js');
  expect(js?.value).toBe('doc-cookie');
  expect(js?.httpOnly).toBe(false);
  expect(js?.session).toBe(true);
  expect(js?.hostOnly).toBe(true);

  const httpOnly = byName.get('oh_store_http');
  expect(httpOnly?.value).toBe('jar-only');
  expect(httpOnly?.httpOnly).toBe(true);
  // Ground truth: the page's own JS cannot see it.
  expect(await page.evaluate(() => document.cookie)).not.toContain('oh_store_http');

  const scoped = byName.get('oh_store_scoped');
  expect(scoped?.path).toBe('/src/storage/');

  // The path-scoped cookie must NOT be considered sendable on '/'.
  const rootJar = await fetchJar('http://127.0.0.1:3000/');
  expect(rootJar.some((c) => c.name === 'oh_store_scoped')).toBe(false);
  expect(rootJar.some((c) => c.name === 'oh_store_http')).toBe(true);

  // ── Jar write: an HttpOnly cookie the page's JS could never set ────
  const written = await rpc<{ cookie: JarCookie | null }>('setCookieForUrl', {
    cookie: {
      name: 'oh_jar_write',
      value: 'from-jar',
      domain: '127.0.0.1',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: false,
    },
  });
  expect(written.cookie?.name).toBe('oh_jar_write');
  expect(written.cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('oh_jar_write');
  expect((await fetchJar(STORAGE_PAGE_URL)).some((c) => c.name === 'oh_jar_write' && c.value === 'from-jar')).toBe(
    true,
  );

  // ── Edit overwrites the value in place ─────────────────────────────
  const edited = await rpc<{ cookie: JarCookie | null }>('setCookieForUrl', {
    cookie: {
      name: 'oh_store_js',
      value: 'edited-by-jar',
      domain: '127.0.0.1',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false,
    },
  });
  expect(edited.cookie?.value).toBe('edited-by-jar');
  // Non-HttpOnly, so the page itself observes the edit.
  expect(await page.evaluate(() => document.cookie)).toContain('oh_store_js=edited-by-jar');

  // ── Expiring write: expirationDate makes it non-session ────────────
  const expiring = await rpc<{ cookie: JarCookie | null }>('setCookieForUrl', {
    cookie: {
      name: 'oh_jar_expiring',
      value: 'lasts',
      domain: '127.0.0.1',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false,
      expirationDate: Math.floor(Date.now() / 1000) + 3600,
    },
  });
  expect(expiring.cookie?.session).toBe(false);
  expect(expiring.cookie?.expirationDate).toBeGreaterThan(Date.now() / 1000);

  // ── Remove deletes exactly its cookie ──────────────────────────────
  const target = (await fetchJar(STORAGE_PAGE_URL)).find((c) => c.name === 'oh_jar_write');
  expect(target).toBeDefined();
  const removed = await rpc<{ ok: boolean }>('removeCookieForUrl', {
    name: target?.name,
    domain: target?.domain,
    path: target?.path,
    secure: target?.secure,
    ...(target?.storeId ? { storeId: target.storeId } : {}),
  });
  expect(removed.ok).toBe(true);

  const finalJar = await fetchJar(STORAGE_PAGE_URL);
  expect(finalJar.some((c) => c.name === 'oh_jar_write')).toBe(false);
  expect(finalJar.some((c) => c.name === 'oh_store_http')).toBe(true);

  await page.evaluate(() => window.ohStorage.reset());
  await page.close();
});
