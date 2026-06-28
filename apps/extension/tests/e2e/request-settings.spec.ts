/**
 * Request-executor Settings e2e — the wire-confirmation gate for the two
 * Settings-tab knobs that change `RequestInit`:
 *
 *   • `followRedirects` → `redirect: 'follow' | 'manual'`. Against
 *     `/api/redirect` (302 → `/api/echo?redirected=1`): following lands a
 *     200 on the target; manual surfaces the hop as an opaqueredirect
 *     (status 0).
 *   • `credentialsMode` → `credentials: 'omit' | 'include'`. A cookie is
 *     seeded with one credentialed send, then a later send reflects the
 *     `cookie` header only when credentials ride along.
 *
 * The executor's `RequestInit` mapping is unit-covered; this proves the
 * behavior on a real wire through the SW.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REDIRECT_URL = 'http://127.0.0.1:3000/api/redirect';
const SET_COOKIE_URL = 'http://127.0.0.1:3000/api/set-cookie';

let context: BrowserContext;
let extensionId: string;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

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

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

interface Echo {
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
}

let nextUid = 0;
function draft(over: Record<string, unknown>): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-settings-${nextUid}`,
    path: `requests/settings-e2e/req-${nextUid}`,
    name: 'settings e2e',
    method: 'GET',
    url: API_ECHO_URL,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...over,
  };
}

async function exec(d: Record<string, unknown>): Promise<ExecSnapshot> {
  const res = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft: d });
  expect(res.success, res.error).toBe(true);
  return res.snapshot!;
}

test.describe('Request executor — Settings: follow redirects', () => {
  test('follows a 3xx by default and lands on the redirect target', async () => {
    const snapshot = await exec(draft({ url: REDIRECT_URL }));
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);
    const echo = JSON.parse(snapshot.body) as Echo;
    expect(echo.query.redirected).toBe('1');
  });

  test('followRedirects:false surfaces the 3xx as an opaqueredirect (status 0)', async () => {
    const snapshot = await exec(draft({ url: REDIRECT_URL, followRedirects: false }));
    // Manual redirect resolves with an opaqueredirect response — the hop
    // happened but wasn't chased, so status is 0 with an empty body.
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(0);
  });
});

test.describe('Request executor — Settings: cookie jar (credentialsMode)', () => {
  test('include sends jar cookies; omit (default) does not', async () => {
    // Seed the jar with one credentialed send to /api/set-cookie.
    await exec(draft({ url: SET_COOKIE_URL, credentialsMode: 'include' }));

    const withCreds = JSON.parse((await exec(draft({ credentialsMode: 'include' }))).body) as Echo;
    const withoutCreds = JSON.parse((await exec(draft({ credentialsMode: 'omit' }))).body) as Echo;

    expect(String(withCreds.headers.cookie ?? '')).toContain('oh_cred=present');
    expect(String(withoutCreds.headers.cookie ?? '')).not.toContain('oh_cred=present');
  });
});
