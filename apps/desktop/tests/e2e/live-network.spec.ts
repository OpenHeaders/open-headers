/**
 * Live Network E2E — the observability Phase-1 stream against the real
 * dual-app stack (OBSERVABILITY_PLAN.md Phase 1):
 *
 *   1. Launch the built desktop app with an isolated userData dir
 *      (OPENHEADERS_USER_DATA_DIR) on a non-default daemon port; mint a
 *      daemon token through the Workbench bridge.
 *   2. Launch Chromium with the built browser extension, point its
 *      backend registry at the app's daemon socket (loopback, so the
 *      telemetry privacy gate admits the wire) and open a playground
 *      tab.
 *   3. The `oh.daemon.telemetry.tabs.list` inventory reports the peer's
 *      tabs — the relay's request/response round-trip over the
 *      telemetry channels.
 *   4. The Live Network tool window watches the playground tab: traffic
 *      generated AFTER the pick streams live into the workbench grid
 *      (subscription-gated ingestion — nothing was captured before the
 *      watch), and keeps streaming while watched.
 *   5. Closing and reopening the tool window rebuilds the view from the
 *      engine's replay — no fresh traffic needed.
 *   6. Row inspection opens a main editor tab that survives the tool
 *      window closing.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
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
// Port etiquette: fresh port off every prior suite (ledger through 19738).
const DAEMON_PORT = 19837;
// MCP is enabled purely as the engine-ready gate (the 401 poll below).
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';

interface TabsListResponse {
  peers?: Array<{ nodeId: string; agent: string; tabs: Array<{ tabId: number; url: string; title: string }> }>;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let extensionContext: BrowserContext | undefined;
let playground: Page;

/** The daemon-side tab inventory, read through the Workbench bridge. */
async function listTabs(): Promise<TabsListResponse> {
  return workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as {
      peers?: Array<{ nodeId: string; agent: string; tabs: Array<{ tabId: number; url: string; title: string }> }>;
    };
  });
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="live-network"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

/** Pick the playground tab in the panel's antd Select. */
async function pickPlaygroundTab(): Promise<void> {
  await workbench.locator('[data-testid="live-network-tab-picker"]').click();
  await workbench.locator('.ant-select-item-option').filter({ hasText: PLAYGROUND_TITLE }).first().click();
}

/** Rows currently rendered for the echo probes. */
function echoRows() {
  return workbench.locator('.dt-row').filter({ hasText: 'echo' });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-live-network-e2e-'));
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
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: the endpoint answers 401 (bound + enabled, token
  // missing) once the daemon bind is up.
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

  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'live-network-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  // Mark the onboarding tour completed BEFORE opening the popup — on a
  // fresh profile the tour's modal mask covers the whole popup.
  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Keep a client page attached so the MV3 service worker never idles
  // out mid-test.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Point the extension at the e2e app's daemon socket with the minted
  // token. The registry record is a sensitive slot, so the seed encrypts
  // with the SW's own at-rest key — same blob format as
  // `browser-secret-cipher`; the registry mirror's storage subscription
  // dials it live. The SW can restart between acquire and evaluate
  // ("execution context destroyed"), so re-acquire + retry.
  const seedBackend = async (seed: { backendUrl: string; authToken: string }): Promise<void> => {
    const worker = extensionContext?.serviceWorkers().at(-1) ?? (await extensionContext?.waitForEvent('serviceworker'));
    if (!worker) throw new Error('no extension service worker');
    await worker.evaluate(async ({ backendUrl, authToken }) => {
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
        id: 'live-network-e2e-backend',
        label: 'live-network e2e desktop',
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
    }, seed);
  };

  let seedError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await seedBackend({ backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token });
      seedError = undefined;
      break;
    } catch (err) {
      seedError = err;
      await popup.waitForTimeout(1000);
    }
  }
  expect(seedError, String(seedError)).toBeUndefined();

  playground = await extensionContext.newPage();
  await playground.goto(PLAYGROUND_URL);
});

test.afterAll(async () => {
  await extensionContext?.close();
  await electronApp?.close();
});

// ── Tab inventory over the telemetry channels ───────────────────────

test('the daemon inventories the connected browser tabs', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = await listTabs();
        return (peers ?? []).some((peer) => peer.tabs.some((tab) => tab.url.startsWith(PLAYGROUND_URL)));
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Watch + live stream ─────────────────────────────────────────────

test('the Live Network window streams a watched playground tab live', async () => {
  await setToolWindowOpen(true);
  await workbench.locator('[data-testid="live-network-refresh"]').click();
  await expect(workbench.locator('[data-testid="live-network-peers"]')).toHaveText('Connected browsers: 1');

  await pickPlaygroundTab();

  // Traffic generated AFTER the watch — nothing before it was ingested
  // (subscription gating at the source).
  await playground.evaluate(() => fetch('/api/echo?probe=live-1').then((r) => r.text()));
  await expect(echoRows()).toHaveCount(1, { timeout: 15000 });

  // The stream stays live while watched.
  await playground.evaluate(() => fetch('/api/echo?probe=live-2').then((r) => r.text()));
  await expect(echoRows()).toHaveCount(2, { timeout: 15000 });
});

// ── Replay on reopen ────────────────────────────────────────────────

test('reopening the window rebuilds the view from replay', async () => {
  await setToolWindowOpen(false);
  await expect(workbench.locator('[data-testid="live-network-tab-picker"]')).toHaveCount(0);

  await setToolWindowOpen(true);
  await pickPlaygroundTab();

  // No fresh traffic — both probes come back from the engine's replay.
  await expect(echoRows()).toHaveCount(2, { timeout: 15000 });
});

// ── Row inspection survives the tool window ─────────────────────────

test('row inspection opens an editor tab that outlives the tool window', async () => {
  await echoRows().first().click();
  await expect(workbench.getByText('GET echo').first()).toBeVisible();

  await setToolWindowOpen(false);
  await expect(workbench.getByText('GET echo').first()).toBeVisible();
});
