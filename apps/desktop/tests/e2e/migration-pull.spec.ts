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
 *      EmptyState first-run offer → the ladder modal → "Scan this
 *      computer" (consent click 1) → API key + "Start background
 *      import" (consent click 2) → fully unattended.
 *   3. The pull drains the stub — every call carries the key as
 *      X-Api-Key, item pulls address the uid forms, the month budget
 *      folds off the response headers.
 *   4. The corner task settles into "Import finished — view report";
 *      its click-through lands in the "Imported from Postman" landing
 *      workspace with the ONE aggregated report.
 *   5. A browser extension joins the desktop's daemon socket as the
 *      operator (unbound minted token) and mirrors the finished run in
 *      its own corner via the operator-gated getState peer plane; its
 *      click-through lands on the synced landing workspace.
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
  await workbench.getByRole('button', { name: /Migrate from another tool/ }).click();
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await expect(modal.getByRole('button', { name: 'Scan this computer' })).toBeVisible();
});

test('consent click 1 — the scan reveals the account pull entry', async () => {
  await workbench.getByRole('button', { name: 'Scan this computer' }).click();
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await expect(modal.getByText('Pull everything from your Postman account')).toBeVisible({ timeout: 15000 });
  await expect(modal.getByLabel('Postman API key')).toBeVisible();
});

test('consent click 2 — the key starts the unattended background pull', async () => {
  const modal = workbench.getByRole('dialog').filter({ hasText: 'Migrate from another tool' });
  await modal.getByLabel('Postman API key').fill(API_KEY);
  await modal.getByRole('button', { name: 'Start background import' }).click();
  // Two clicks of consent, then unattended — the modal closes on start.
  await expect(workbench.getByText('Pull everything from your Postman account')).toHaveCount(0);
});

test('the pull drains the stub — key on every call, uid item forms, nothing else', async () => {
  await expect.poll(() => stubCalls.length, { timeout: 30000 }).toBe(4);
  expect(stubCalls.map((call) => call.path)).toEqual([
    '/workspaces',
    '/workspaces/ws-team',
    '/collections/e2eowner-c1',
    '/environments/e2eowner-e1',
  ]);
  expect(stubCalls.every((call) => call.apiKey === API_KEY)).toBe(true);
});

test('the corner task settles into the report flip with the folded month budget', async () => {
  await expect(workbench.getByText('Import finished — view report')).toBeVisible({ timeout: 30000 });

  // The month budget folded off the stub's headers into the run state.
  const state = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.migration.postmanPull.getState' })) as {
      phase: string;
      budget: { limitMonth?: number; remainingMonth?: number };
      imported: { collections: number; environments: number; requests: number; workspaceName: string } | null;
    };
  });
  expect(state.phase).toBe('done');
  expect(state.budget.limitMonth).toBe(10000);
  expect(state.imported).toMatchObject({
    collections: 1,
    environments: 1,
    requests: 2,
    workspaceName: 'Imported from Postman',
  });
});

test('the click-through lands in the landing workspace with the aggregated report', async () => {
  await workbench.getByText('Import finished — view report').first().click();
  const report = workbench.getByRole('dialog').filter({ hasText: 'Postman import report' });
  await expect(report).toBeVisible({ timeout: 15000 });
  await expect(report).toContainText('Imported from Postman');
  await expect(report).toContainText('Everything imported cleanly');
  await report.getByRole('button', { name: 'Close' }).click();
  await expect(report).toHaveCount(0);

  // The switch landed — this window now edits the landing workspace.
  await expect(workbench.getByLabel(/editing workspace: Imported from Postman/)).toBeVisible();
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
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const serviceWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));

  // Join the desktop's daemon socket — the `oh.backends` record is a
  // sensitive slot, seeded with the SW's own at-rest key (same rig as
  // mcp.spec).
  await serviceWorker.evaluate(
    async ({ backendUrl, authToken }) => {
      const key = await new Promise<CryptoKey>((resolve, reject) => {
        const open = indexedDB.open('oh-secret-cipher', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as CryptoKey);
        };
      });
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

  // The landing workspace syncs down before the mirror is asserted so
  // the click-through test below has somewhere to land.
  await expect
    .poll(
      async () =>
        serviceWorker.evaluate(
          async () =>
            new Promise<boolean>((resolve) => {
              chrome.storage.local.get(null, (items) => {
                resolve(JSON.stringify(items).includes('Imported from Postman'));
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
});

test('the extension click-through lands on the synced landing workspace', async () => {
  const page = extensionWorkbench;
  expect(page).toBeTruthy();
  if (!page) return;

  await page.getByText('Import finished — view report').first().click();
  const report = page.getByRole('dialog').filter({ hasText: 'Postman import report' });
  await expect(report).toBeVisible({ timeout: 15000 });
  // The summary rides the mirrored run state; the report ring itself is
  // host-local to the desktop.
  await expect(report).toContainText('Imported from Postman');
  await report.getByRole('button', { name: 'Close' }).click();

  // The switch landed — this surface now edits the synced landing workspace.
  await expect(page.getByLabel(/editing workspace: Imported from Postman/)).toBeVisible({ timeout: 15000 });
});
