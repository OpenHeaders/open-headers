/**
 * Migration pull E2E — the S5-addendum flow end-to-end against the real
 * two-host stack, with a local stand-in Data API:
 *
 *   1. A stub HTTP server serves the documented Data API shapes —
 *      workspace list, workspace detail (uid item forms), wrapped
 *      collection/environment payloads, month-budget headers — and
 *      records every call it sees. `OH_POSTMAN_API_ORIGIN` points the
 *      desktop's puller at it.
 *   2. The desktop launches isolated on an empty workspace: the
 *      EmptyState first-run offer → the single-modal surface → "Detect
 *      and import data" (consent click 1) → Postman's Import → API key
 *      → workspace picker → "Import selected" (consent click 2) →
 *      fully unattended.
 *   3. The pull drains the stub — every call carries the key as
 *      X-Api-Key, item pulls address the uid forms, the month budget
 *      folds off the response headers.
 *   4. The corner task settles into "Import finished — view report";
 *      its click-through opens the per-workspace report IN PLACE
 *      (workspace parity: the counterpart carries the vendor
 *      workspace's exact name) and "Open workspace" jumps into it.
 *   5. A browser extension joins the desktop's daemon socket as the
 *      operator (unbound minted token) and mirrors the finished run in
 *      its own corner via the operator-gated getState peer plane; its
 *      click-through lands on the synced counterpart workspace.
 *   6. The selection preflight lists the account's workspaces with
 *      counts; a second pull narrowed to the selection refreshes the
 *      counterpart: exactly ONE collection remains in the requests nav
 *      and the report carries the replacement transform.
 *
 * Requires both builds: `pnpm --filter @openheaders/desktop build` and
 * the extension `dist/chrome` (built separately).
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  _electron,
  type BrowserContext,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: 19937/19938 are fresh (ledger through 19737/19738).
const STUB_PORT = 19937;
const DAEMON_PORT = 19938;
const STUB_ORIGIN = `http://127.0.0.1:${STUB_PORT}`;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const API_KEY = 'PMAK-e2e-openheaders-0123456789abcdef';

// OH_E2E_SLOWMO=<ms> paces the run so a human can watch each UI step.
// The chromium extension context takes it natively; Electron launches
// have no slowMo, so desktop interactions call pace() explicitly.
const SLOWMO_MS = Number(process.env.OH_E2E_SLOWMO ?? '0');

async function pace(page: Page): Promise<void> {
  if (SLOWMO_MS > 0) await page.waitForTimeout(SLOWMO_MS);
}

// ── Stand-in Data API ───────────────────────────────────────────────
//
// One workspace holding one collection (two requests) + one
// environment, addressed by uid item forms — the docs-derived wire
// shapes the puller interprets. Budget headers ride every response.

const WORKSPACE_LIST = {
  workspaces: [{ id: 'ws-team', name: 'OpenHeaders Team', type: 'team' }],
};

const WORKSPACE_DETAIL = {
  workspace: {
    id: 'ws-team',
    collections: [{ id: 'c1', uid: 'e2eowner-c1', name: 'Orders API' }],
    environments: [{ id: 'e1', uid: 'e2eowner-e1', name: 'Staging' }],
  },
};

const COLLECTION_PAYLOAD = {
  collection: {
    info: {
      name: 'Orders API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [
      { name: 'List orders', request: { method: 'GET', url: 'https://api.openheaders.io/orders' } },
      {
        name: 'Create order',
        request: {
          method: 'POST',
          url: 'https://api.openheaders.io/orders',
          header: [{ key: 'Content-Type', value: 'application/json' }],
          body: { mode: 'raw', raw: '{"sku":"oh-1"}' },
        },
      },
    ],
  },
};

const ENVIRONMENT_PAYLOAD = {
  environment: {
    id: 'e2eowner-e1',
    name: 'Staging',
    values: [{ key: 'baseUrl', value: 'https://staging.openheaders.io', enabled: true, type: 'default' }],
  },
};

interface StubCall {
  path: string;
  apiKey: string | undefined;
}

let stub: Server;
const stubCalls: StubCall[] = [];

function startStub(): Promise<void> {
  const routes = new Map<string, unknown>([
    ['/workspaces', WORKSPACE_LIST],
    ['/workspaces/ws-team', WORKSPACE_DETAIL],
    ['/collections/e2eowner-c1', COLLECTION_PAYLOAD],
    ['/environments/e2eowner-e1', ENVIRONMENT_PAYLOAD],
  ]);
  let remaining = 9999;
  stub = createServer((req, res) => {
    const url = req.url ?? '';
    const key = req.headers['x-api-key'];
    stubCalls.push({ path: url, apiKey: typeof key === 'string' ? key : undefined });
    const body = routes.get(url);
    res.setHeader('RateLimit-Limit-Month', '10000');
    res.setHeader('RateLimit-Remaining-Month', String(remaining--));
    res.setHeader('content-type', 'application/json');
    if (body === undefined) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { name: 'instanceNotFoundError', message: 'Not found' } }));
      return;
    }
    res.end(JSON.stringify(body));
  });
  return new Promise((resolve) => stub.listen(STUB_PORT, '127.0.0.1', resolve));
}

// ── Desktop + extension rigs ────────────────────────────────────────

let electronApp: ElectronApplication;
let workbench: Page;
let extensionContext: BrowserContext | undefined;
let extensionWorkbench: Page | undefined;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await startStub();

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-migration-e2e-'));
  // The MCP surface doubles as the engine-ready gate and mints the
  // extension's pair token — same rig as mcp.spec.
  await writeFile(
    path.join(userData, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
      OH_POSTMAN_API_ORIGIN: STUB_ORIGIN,
    },
  });
  workbench = await electronApp.firstWindow();

  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(MCP_URL, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .toBe(401);
});

test.afterAll(async () => {
  await extensionContext?.close();
  await electronApp?.close();
  await new Promise((resolve) => stub?.close(resolve));
});

// ── Desktop leg ─────────────────────────────────────────────────────

test('the first-run empty workspace offers the migration ladder', async () => {
  await pace(workbench);
  await workbench.getByRole('button', { name: /Migrate from another tool/ }).click();
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await expect(modal.getByRole('button', { name: 'Scan this computer' })).toBeVisible();
  await pace(workbench);
});

test('consent click 1 — detection fills in status-only vendor rows', async () => {
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await modal.getByRole('button', { name: 'Scan this computer' }).click();
  // Real per-OS probes run on this machine — assert statuses appear,
  // not which tools this host happens to have installed.
  await expect(modal.getByText(/Detected|Not found/).first()).toBeVisible({ timeout: 15000 });
  await pace(workbench);
});

test("Postman's Import reveals the inline stepper and the key lists the workspaces", async () => {
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await modal.getByRole('button', { name: 'Import from Postman account' }).click();
  await expect(modal.getByLabel('Postman API key')).toBeVisible();
  await modal.getByLabel('Postman API key').fill(API_KEY);
  await pace(workbench);
  await modal.getByRole('button', { name: 'List workspaces' }).click();
  // The enumeration-only preflight answers the picker, pre-selected.
  const picker = modal.getByRole('checkbox', { name: /OpenHeaders Team/ });
  await expect(picker).toBeVisible({ timeout: 15000 });
  await expect(picker).toBeChecked();
  await expect(modal.getByText('1 collections · 1 environments')).toBeVisible();
  expect(stubCalls.map((call) => call.path)).toEqual(['/workspaces', '/workspaces/ws-team']);
  await pace(workbench);
});

test('consent click 2 — Import selected starts the unattended background pull', async () => {
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await modal.getByRole('button', { name: 'Import selected' }).click();
  // Consent given, then unattended — the modal closes on start.
  await expect(workbench.getByLabel('Postman API key')).toHaveCount(0);
});

test('the pull drains the stub — key on every call, uid item forms, nothing else', async () => {
  // Preflight (list + detail) + the narrowed pull's four calls.
  await expect.poll(() => stubCalls.length, { timeout: 30000 }).toBe(6);
  expect(stubCalls.map((call) => call.path)).toEqual([
    '/workspaces',
    '/workspaces/ws-team',
    '/workspaces',
    '/workspaces/ws-team',
    '/collections/e2eowner-c1',
    '/environments/e2eowner-e1',
  ]);
  expect(stubCalls.every((call) => call.apiKey === API_KEY)).toBe(true);
});

test('the corner task settles into the report flip with the folded month budget', async () => {
  await expect(workbench.getByText('Import finished — view report')).toBeVisible({ timeout: 30000 });
  await pace(workbench);

  // The month budget folded off the stub's headers into the run state.
  const state = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.migration.postmanPull.getState' })) as {
      phase: string;
      budget: { limitMonth?: number; remainingMonth?: number };
      imported: {
        collections: number;
        environments: number;
        requests: number;
        workspaces: Array<{ workspaceName: string }>;
      } | null;
    };
  });
  expect(state.phase).toBe('done');
  expect(state.budget.limitMonth).toBe(10000);
  expect(state.imported).toMatchObject({
    collections: 1,
    environments: 1,
    requests: 2,
    workspaces: [{ workspaceName: 'OpenHeaders Team' }],
  });
});

test('the click-through opens the report in place, then Open workspace jumps into the counterpart', async () => {
  await workbench.getByText('Import finished — view report').first().click();
  const report = workbench.getByRole('dialog').filter({ hasText: 'Postman import report' });
  await expect(report).toBeVisible({ timeout: 15000 });
  // Workspace parity — the counterpart carries the vendor workspace's
  // exact name; viewing the report never switches the workspace.
  await expect(report).toContainText('OpenHeaders Team');
  await expect(report).toContainText('Everything imported cleanly');
  await pace(workbench);

  // Switching is the user's explicit choice.
  await report.getByRole('button', { name: 'Open workspace' }).first().click();
  await expect(report).toHaveCount(0);
  await expect(workbench.getByLabel(/editing workspace: OpenHeaders Team/)).toBeVisible({ timeout: 15000 });
  await pace(workbench);
});

// ── Extension mirror leg ────────────────────────────────────────────

test('a connected extension mirrors the finished run in its own corner', async () => {
  // Unbound minted tokens resolve to the daemon operator at HELLO — the
  // extension joins AS the operator, so the same-user migration gate
  // passes (pull-peer-plane).
  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'migration-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  const token = minted.secret ?? '';

  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: SLOWMO_MS,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test. Every storage evaluation below runs in THIS page —
  // the extension origin's chrome.storage and IndexedDB are shared with
  // the SW, and a page context survives the SW restarts that destroy
  // worker execution contexts mid-call.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Join the desktop's daemon socket — the `oh.backends` record is a
  // sensitive slot, seeded with the extension's own at-rest key (same
  // blob format as mcp.spec). The key is minted by the SW on first
  // boot, so the read polls until it exists.
  await popup.evaluate(
    async ({ backendUrl, authToken }) => {
      const readKey = (): Promise<CryptoKey | null> =>
        new Promise((resolve, reject) => {
          const open = indexedDB.open('oh-secret-cipher', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            if (!db.objectStoreNames.contains('keys')) {
              db.close();
              resolve(null);
              return;
            }
            const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
          };
        });
      let key: CryptoKey | null = null;
      for (let attempt = 0; attempt < 40 && key === null; attempt++) {
        key = await readKey().catch(() => null);
        if (key === null) await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (key === null) throw new Error('at-rest cipher key never appeared');
      const record = {
        id: 'e2e-desktop-backend',
        label: 'e2e desktop',
        url: backendUrl,
        authToken,
        autoConnect: true,
        enabled: true,
        addedAt: new Date().toISOString(),
        lastConnectedAt: null,
      };
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(JSON.stringify([record])),
      );
      const packed = new Uint8Array(iv.length + ciphertext.byteLength);
      packed.set(iv, 0);
      packed.set(new Uint8Array(ciphertext), iv.length);
      let binary = '';
      for (const byte of packed) binary += String.fromCharCode(byte);
      await new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true, 'oh.backends': `v1:${btoa(binary)}` }, () => resolve());
      });
    },
    { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token },
  );

  // The counterpart workspace syncs down before the mirror is asserted
  // so the click-through test below has somewhere to land.
  await expect
    .poll(
      async () =>
        popup.evaluate(
          async () =>
            new Promise<boolean>((resolve) => {
              chrome.storage.local.get(null, (items) => {
                resolve(JSON.stringify(items).includes('OpenHeaders Team'));
              });
            }),
        ),
      { timeout: 30000 },
    )
    .toBe(true);

  // A late-joining surface hydrates over the operator-gated getState
  // peer plane — the finished run appears with no live event ever seen.
  extensionWorkbench = await extensionContext.newPage();
  await extensionWorkbench.goto(`chrome-extension://${extensionId}/workbench.html`);
  await expect(extensionWorkbench.getByText('Import finished — view report')).toBeVisible({ timeout: 30000 });
  await pace(extensionWorkbench);
});

test('the extension click-through opens the mirrored report and jumps to the synced counterpart', async () => {
  const page = extensionWorkbench;
  expect(page).toBeTruthy();
  if (!page) return;

  await page.getByText('Import finished — view report').first().click();
  const report = page.getByRole('dialog').filter({ hasText: 'Postman import report' });
  await expect(report).toBeVisible({ timeout: 15000 });
  // The summary rides the mirrored run state; the report ring itself is
  // host-local to the desktop, so the section shows the counterpart's
  // name with no local report entry.
  await expect(report).toContainText('OpenHeaders Team');
  await pace(page);

  await report.getByRole('button', { name: 'Open workspace' }).first().click();
  await expect(report).toHaveCount(0);
  await expect(page.getByLabel(/editing workspace: OpenHeaders Team/)).toBeVisible({ timeout: 15000 });
  await pace(page);
});

// ── Selection preflight + re-pull refresh leg ───────────────────────

test('the selection preflight lists the account workspaces with item counts', async () => {
  const callsBefore = stubCalls.length;
  const result = await workbench.evaluate(async (key) => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke({ type: 'oh.migration.postmanPull.listWorkspaces', apiKey: key });
  }, API_KEY);
  expect(result).toMatchObject({
    ok: true,
    workspaces: [{ id: 'ws-team', name: 'OpenHeaders Team', collections: 1, environments: 1 }],
  });
  // Enumeration-only: list + one detail, nothing pulled.
  expect(stubCalls.slice(callsBefore).map((call) => call.path)).toEqual(['/workspaces', '/workspaces/ws-team']);
});

test('a complete re-pull refreshes the counterpart workspace instead of duplicating it', async () => {
  const callsBefore = stubCalls.length;
  const started = await workbench.evaluate(async (key) => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({
      type: 'oh.migration.postmanPull.start',
      apiKey: key,
      workspaceIds: ['ws-team'],
    })) as {
      started: boolean;
      runId?: string;
    };
  }, API_KEY);
  expect(started.started).toBe(true);

  // The second run drains the stub exactly like the first.
  await expect.poll(() => stubCalls.length, { timeout: 30000 }).toBe(callsBefore + 4);
  await expect
    .poll(
      async () =>
        workbench.evaluate(async () => {
          const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
          const state = (await bridge.invoke({ type: 'oh.migration.postmanPull.getState' })) as {
            runId: string | null;
            phase: string;
          };
          return `${state.runId}:${state.phase}`;
        }),
      { timeout: 30000 },
    )
    .toBe(`${started.runId}:done`);

  // ONE copy of the collection in the requests nav — the refresh
  // tombstoned the previous import before landing this pull. The nav
  // lives in the API Requests tool window, which starts unselected.
  const navTab = workbench.getByRole('tab', { name: 'API Requests' }).first();
  if ((await navTab.getAttribute('aria-selected')) !== 'true') await navTab.click();
  const section = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await section.waitFor({ state: 'visible', timeout: 10000 });
  await pace(workbench);
  if ((await section.getAttribute('aria-expanded')) !== 'true') await section.click();
  await expect(workbench.locator('[data-item-id^="req-col-"]').filter({ visible: true })).toHaveCount(1);
  await pace(workbench);
});

test('the re-pull report records the replacement transform', async () => {
  await workbench.getByText('Import finished — view report').first().click();
  const report = workbench.getByRole('dialog').filter({ hasText: 'Postman import report' });
  await expect(report).toBeVisible({ timeout: 15000 });
  await expect(report).toContainText('replaced by this pull');
  await pace(workbench);
  await report.getByRole('button', { name: 'Close' }).last().click();
  await expect(report).toHaveCount(0);
});
