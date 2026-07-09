/**
 * Desktop-serves-web acceptance — the desktop-as-daemon hands out the
 * Workbench web bundle on its own bind (`backend.serveWebApp`) and a
 * plain browser tab pairs with it exactly like with the headless
 * daemon:
 *
 *   1. Launch the built desktop app with an isolated userData dir on a
 *      non-default port, `backend.serveWebApp` pre-seeded on; assert
 *      `/` serves the web bundle's entry document.
 *   2. Mint a daemon token through the real `oh.daemon.tokens.mint`
 *      RPC; seed a desktop-side rule via MCP.
 *   3. A Chromium tab loads the Workbench from the desktop's bind,
 *      gates, joins with the minted token; the desktop rule syncs DOWN
 *      and an MCP rename replicates live into the open tab.
 *   4. Join → adopt promoted the desktop's workspace; a rule created
 *      through the tab's real editor flow syncs UP (`rules_list`).
 *   5. Flip `backend.serveWebApp` off through the storage bridge — the
 *      static route stops serving on the very next request, no app
 *      restart; flip back on and it resumes. The already-joined tab's
 *      WS pipe rides through (the ws-upgrade posture is flag-independent).
 *   6. Zero console errors across every leg.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and
 * `pnpm turbo build --filter=@openheaders/web` (the dev-tree desktop
 * resolves the monorepo sibling `apps/web/dist`).
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  _electron,
  type Browser,
  type BrowserContext,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039).
const DAEMON_PORT = 19137;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-serve-web-client', version: '0.0.0' },
};

const TOKEN_INPUT = 'input[data-testid=login-gate-token], [data-testid=login-gate-token] input';

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;
const consoleErrors: string[] = [];

async function rpc(
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

/** Flip the `backend.serveWebApp` setting live through the desktop storage bridge. */
async function setServeWebApp(enabled: boolean): Promise<void> {
  await workbench.evaluate(async (value) => {
    const bridge = (
      window as unknown as {
        oh: {
          storage: {
            get(req: { key: string }): Promise<{ value: unknown }>;
            set(req: { key: string; value: unknown }): Promise<unknown>;
          };
        };
      }
    ).oh;
    const current = await bridge.storage.get({ key: 'oh.settings.user' });
    await bridge.storage.set({
      key: 'oh.settings.user',
      value: { ...((current.value as Record<string, unknown>) ?? {}), 'backend.serveWebApp': value },
    });
  }, enabled);
}

function watchConsole(target: Page, label: string): void {
  target.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  target.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
}

/** Read one `oh.host-storage` kv slot from the page's origin IDB. */
function readHostSlot(target: Page, key: string): Promise<unknown> {
  return target.evaluate(
    (k) =>
      new Promise((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').get(k);
          req.onsuccess = () => resolve(req.result?.value ?? null);
          req.onerror = () => resolve(null);
        };
        open.onerror = () => resolve(null);
      }),
    key,
  );
}

/** Whether any per-workspace rule slot in the page's origin IDB carries `name`. */
function ruleInTabIdb(target: Page, name: string): Promise<boolean> {
  return target.evaluate(
    (n) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').getAll();
          req.onsuccess = () =>
            resolve(
              JSON.stringify(
                (req.result as Array<{ key: string }>).filter((r) => /^oh\.ws\..*\.rules$/.test(r.key)),
              ).includes(n),
            );
          req.onerror = () => resolve(false);
        };
        open.onerror = () => resolve(false);
      }),
    name,
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-serve-web-e2e-'));
  await writeFile(
    path.join(userData, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'backend.bindPort': DAEMON_PORT,
          'backend.serveWebApp': true,
        },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`${ORIGIN}/healthz`);
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(200);

  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'serve-web-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
  await electronApp?.close();
});

// ── The desktop's bind is the web front door ────────────────────────

test('the desktop serves the web bundle entry document on its bind', async () => {
  const res = await fetch(`${ORIGIN}/`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
  expect(await res.text()).toContain('<div id="root">');
});

// ── Desktop-side seed (before any tab joins) ────────────────────────

let ruleUid: string;
let desktopWorkspaceIds: string[];

test('MCP seeds a desktop-side rule before any tab joins', async () => {
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  const payload = await callTool('rules_create', {
    rule: {
      name: 'Desktop web rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Desktop', value: 'serve-web' }],
        responseHeaders: [],
      },
    },
  });
  ruleUid = (payload.rule as { uid: string }).uid;
  expect(ruleUid).toBeTruthy();

  const workspaces = await callTool('workspaces_list', {});
  desktopWorkspaceIds = (workspaces.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  expect(desktopWorkspaceIds.length).toBeGreaterThan(0);
});

// ── Gate + join with the desktop-minted token ───────────────────────

test('a browser tab gates and joins with the desktop-minted token', async () => {
  context = await browser.newContext();
  page = await context.newPage();
  watchConsole(page, 'tab');
  await page.goto(`${ORIGIN}/`);

  await page.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  await page.fill(TOKEN_INPUT, token);
  await page.click('[data-testid=login-gate-submit]');
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });

  await expect.poll(() => readHostSlot(page, 'oh.webBackendToken')).toBe(token);
  const joined = (await readHostSlot(page, 'oh.joinedOrgs')) as Array<{ backendId: string }> | null;
  expect(joined?.map((row) => row.backendId)).toEqual(['web-serving-daemon']);
});

// ── Down-sync + live replication ────────────────────────────────────

test('the desktop rule synced down and an MCP rename replicates live', async () => {
  await expect.poll(() => ruleInTabIdb(page, 'Desktop web rule'), { timeout: 30_000 }).toBe(true);

  await callTool('rules_update', { uid: ruleUid, updates: { name: 'Desktop web rule v2' } });
  await expect.poll(() => ruleInTabIdb(page, 'Desktop web rule v2'), { timeout: 30_000 }).toBe(true);
});

// ── Join → adopt + upward sync through the real editor flow ─────────

test('join adopted the desktop workspace and a tab-created rule syncs up', async () => {
  await expect
    .poll(async () => {
      const active = await readHostSlot(page, 'oh.runtimeActive.active');
      return desktopWorkspaceIds.includes(active as string);
    })
    .toBe(true);

  await page.getByRole('button', { name: 'Create rule', exact: false }).first().click();
  await page.getByText('Block Requests', { exact: false }).first().click();
  await page.waitForSelector('input[value="New Block Rule"]', { timeout: 10_000 });
  await page
    .locator('button:visible')
    .filter({ hasText: /^Save$/ })
    .first()
    .click();

  // Save dialog: Save arms only once a target collection is chosen.
  await page.waitForSelector('.ant-modal', { timeout: 10_000 });
  const collectionOption = page.locator('.ant-modal [role=option]').first();
  if ((await collectionOption.count()) > 0) {
    await collectionOption.click();
  } else {
    await page.locator('.ant-modal').getByText('New collection', { exact: false }).first().click();
    const collectionInput = page.locator('.ant-modal input:visible').last();
    await collectionInput.fill('Serve Web');
    await collectionInput.press('Enter');
  }
  await page
    .locator('.ant-modal button:visible')
    .filter({ hasText: /^Save$/ })
    .last()
    .click();

  await expect
    .poll(
      async () => {
        const rules = await callTool('rules_list', {});
        return (rules.rules as Array<{ name: string }>).some((r) => r.name === 'New Block Rule');
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});

// ── Live toggle: no restart either way ──────────────────────────────

test('flipping backend.serveWebApp off stops serving on the next request; on resumes', async () => {
  await setServeWebApp(false);
  // Off: `/` reverts to the web-less `default` posture and falls through
  // to the daemon's 400 fallback — no HTML leaves the process.
  await expect.poll(async () => (await fetch(`${ORIGIN}/`)).status, { timeout: 10_000 }).toBe(400);
  // The joined tab's WS pipe is flag-independent — a rename still lands.
  await callTool('rules_update', { uid: ruleUid, updates: { name: 'Desktop web rule v3' } });
  await expect.poll(() => ruleInTabIdb(page, 'Desktop web rule v3'), { timeout: 30_000 }).toBe(true);

  await setServeWebApp(true);
  await expect.poll(async () => (await fetch(`${ORIGIN}/`)).status, { timeout: 10_000 }).toBe(200);
  expect(await (await fetch(`${ORIGIN}/`)).text()).toContain('<div id="root">');
});

// ── Hygiene ─────────────────────────────────────────────────────────

test('zero console errors across every leg', async () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await context.close();
});
