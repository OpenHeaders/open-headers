/**
 * Wire-capture e2e — the live gate for the executor's webRequest join
 * (`request-executor/wire-capture.ts`): the extension-traffic channel
 * observes the SW's own fetch, the heuristic join attributes the chain,
 * and the snapshot's `wire` field carries what `fetch()` withholds —
 * raw `Set-Cookie` lines and the remote IP.
 *
 * Assertions stay on the snapshot shape (RPC-level): `wire` present with
 * the right facts, honest absence semantics (`setCookieHeaders` absent
 * when the server set none), and cross-hop aggregation on a redirect
 * (`/api/redirect` answers a `Set-Cookie` on the 302 hop; the terminal
 * `/api/echo` sets none — the hop cookie proves the chain aggregated).
 * One UI leg confirms the Cookies tab renders from the captured wire.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REDIRECT_URL = 'http://127.0.0.1:3000/api/redirect';
const SET_COOKIE_URL = 'http://127.0.0.1:3000/api/set-cookie';

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  const page: Page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // The wire-capture plane (webRequest → extension-traffic channel)
  // comes up async after SW boot; until then snapshots carry no `wire`
  // field — the documented degradation. Warm it up so the shape suite
  // asserts the steady state (same gate as request-executor-errors).
  await expect
    .poll(
      async () => {
        const res = await workbench.rpc<{ success: boolean; snapshot?: ExecSnapshot }>('executeRequest', {
          draft: draft({}),
        });
        return res.snapshot?.wire !== undefined;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

test.afterAll(async () => {
  await context.close();
});

interface WireField {
  ip?: string;
  setCookieHeaders?: string[];
  credentialsMode: 'omit' | 'include';
}

interface ExecSnapshot {
  status: number;
  body: string;
  headers: Array<{ key: string; value: string }>;
  wire?: WireField;
  error?: string | null;
}

let nextUid = 0;
function draft(over: Record<string, unknown>): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-wire-${nextUid}`,
    path: `requests/wire-e2e/req-${nextUid}`,
    name: 'wire e2e',
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
  const res = await workbench.rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
    draft: d,
  });
  expect(res.success, res.error).toBe(true);
  return res.snapshot!;
}

test.describe('Request executor — wire capture (snapshot shape)', () => {
  test('a Set-Cookie response surfaces raw lines + remote IP in wire', async () => {
    const snapshot = await exec(draft({ url: SET_COOKIE_URL }));
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);

    expect(snapshot.wire, 'wire capture joined').toBeDefined();
    expect(snapshot.wire!.credentialsMode).toBe('omit');
    expect(snapshot.wire!.ip).toBe('127.0.0.1');
    expect(snapshot.wire!.setCookieHeaders).toEqual(['oh_cred=present; Path=/; SameSite=None; Secure']);

    // fetch() filters Set-Cookie from its Headers view — the wire field
    // is the ONLY channel that carries it.
    const fetchVisible = snapshot.headers.map((h) => h.key.toLowerCase());
    expect(fetchVisible).not.toContain('set-cookie');
  });

  test('a redirect chain aggregates the hop cookie into the final snapshot', async () => {
    const snapshot = await exec(draft({ url: REDIRECT_URL }));
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);
    const echo = JSON.parse(snapshot.body) as { query: Record<string, string | string[]> };
    expect(echo.query.redirected).toBe('1');

    // The Set-Cookie rides the 302 hop only; the terminal /api/echo sets
    // none. Its presence proves the chain aggregated across hops.
    expect(snapshot.wire, 'wire capture joined across the redirect').toBeDefined();
    expect(snapshot.wire!.ip).toBe('127.0.0.1');
    expect(snapshot.wire!.setCookieHeaders).toEqual(['oh_hop=1; Path=/; SameSite=None; Secure']);
  });

  test('a cookieless response yields wire with IP and NO setCookieHeaders', async () => {
    const snapshot = await exec(draft({}));
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);

    expect(snapshot.wire, 'wire capture joined').toBeDefined();
    expect(snapshot.wire!.credentialsMode).toBe('omit');
    expect(snapshot.wire!.ip).toBe('127.0.0.1');
    expect(snapshot.wire!.setCookieHeaders).toBeUndefined();
  });

  test("credentialsMode 'include' is reported as the send's policy", async () => {
    const snapshot = await exec(draft({ url: SET_COOKIE_URL, credentialsMode: 'include' }));
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.wire).toBeDefined();
    expect(snapshot.wire!.credentialsMode).toBe('include');
  });
});

test.describe('Request editor — Cookies tab renders the captured wire', () => {
  test('sending to a Set-Cookie endpoint shows the Cookies tab with the parsed row', async () => {
    const uid = await workbench.seedRequest({
      name: 'wire-ui-cookie',
      method: 'GET',
      url: SET_COOKIE_URL,
      auth: { type: 'none' },
      body: { type: 'none' },
    });
    await workbench.reload();
    await workbench.showRequestsView();
    await workbench.collapseRightSidebar();
    await workbench.openRequest(uid);
    await workbench.send();
    expect(await workbench.responseStatusText()).toContain('200');

    await workbench.openResponseTab(/Cookies \(1\)/);
    const region = workbench.responseRegion();
    await expect(region.getByText('oh_cred', { exact: true })).toBeVisible();
    await expect(region.getByText('present', { exact: true })).toBeVisible();
    // The honest persistence note for the default 'omit' send.
    await expect(region.getByText(/credentials omitted/)).toBeVisible();
  });
});
