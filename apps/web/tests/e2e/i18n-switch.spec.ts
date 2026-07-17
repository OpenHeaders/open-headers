/**
 * i18n locale-switch e2e (Phase H) — the web tab against its serving
 * daemon:
 *
 *   1. the login gate and boot beats render ENGLISH even under a
 *      non-English browser locale BY DESIGN (S44): English is the only
 *      real locale shipped, `auto` never resolves to the synthetic
 *      pseudo locale, and the pre-provider beats resolve from
 *      `navigator.languages` the same way;
 *   2. after the token join, switching to pseudo through the real
 *      settings picker re-renders the mounted workbench in place — a
 *      window stamp proves no navigation happened;
 *   3. the technical plane stays raw under pseudo: locale registry
 *      names ('English') and `<html lang>` (pseudo announces itself
 *      as `en`);
 *   4. the choice persists across a reload (the web app's restart):
 *      the tab rejoins past the gate and paints pseudoized from boot,
 *      while a FRESH profile on the same origin still gates in English
 *      (the setting is origin-profile-scoped, not daemon-global).
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`
 * and `pnpm turbo build --filter=@openheaders/web`. The daemon runs
 * under the repo's electron binary with ELECTRON_RUN_AS_NODE (the
 * monorepo's better-sqlite3 is compiled for Electron's ABI).
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const WEB_DIST = path.join(REPO_ROOT, 'apps/web/dist');

const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: off every prior suite's ports (18337–18339, 18443,
// 18537, 18637, 18737, 18747, 18937, 19037/19039).
const DAEMON_PORT = 19137;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;

const TOKEN_INPUT = 'input[data-testid=login-gate-token], [data-testid=login-gate-token] input';
const PSEUDO_NATIVE_NAME = '⟦Þšéûðö⟧';

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let dataDir: string;
let token: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;
const daemonLog: string[] = [];

async function waitForWorkbench(target: Page): Promise<void> {
  await target.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
  await expect(target.getByRole('button', { name: 'Settings menu' })).toBeVisible({ timeout: 30_000 });
}

/** The language picker row inside the settings surface. */
function languageRow(target: Page) {
  return target.locator('[data-setting-key="general.language"]');
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-i18n-web-switch-'));

  // Offline admin bootstrap: a known secret, its hash on the ledger.
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.daemonAuthTokens': [
          {
            id: 'i18n-switch-bootstrap-token',
            tokenHash,
            label: 'i18n-switch e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );

  daemon = spawn(
    electronBinary,
    [
      DAEMON_MAIN,
      '--data-dir',
      dataDir,
      '--bind-address',
      '127.0.0.1',
      '--bind-port',
      String(DAEMON_PORT),
      '--web-root',
      WEB_DIST,
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  daemonExited = new Promise((resolve) => daemon.once('exit', (code) => resolve(code)));

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
      { timeout: 30_000 },
    )
    .toBe(200);

  browser = await chromium.launch();
  // A non-English browser locale — the gate/boot beats must ignore it
  // in favor of the shipped-English resolution.
  context = await browser.newContext({ locale: 'fr-FR' });
  page = await context.newPage();
});

test.afterAll(async () => {
  await browser?.close();
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
  await rm(dataDir, { recursive: true, force: true });
});

test('the gate renders English under a non-English browser locale', async () => {
  await page.goto(`${ORIGIN}/`);
  await page.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });

  const gate = page.locator('[data-testid=login-gate]');
  await expect(gate).toContainText('Pair with this daemon');
  await expect(gate).not.toContainText('⟦');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});

test('the joined workbench switches to pseudo in place', async () => {
  await page.fill(TOKEN_INPUT, token);
  await page.click('[data-testid=login-gate-submit]');
  await waitForWorkbench(page);

  // A navigation or reload would wipe the stamp — its survival proves
  // the re-render happened in place.
  await page.evaluate(() => {
    (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe = true;
  });

  await page.getByRole('button', { name: 'Settings menu' }).click();
  await page.getByRole('button', { name: 'Settings…' }).click();
  await page.locator('.settings-category-nav').getByText('General', { exact: true }).click();
  const row = languageRow(page);
  await expect(row).toBeVisible();
  await row.getByText(PSEUDO_NATIVE_NAME).click();

  await expect(row).toContainText('⟦');
  const stamp = await page.evaluate(
    () => (window as Window & { __ohI18nSwitchProbe?: boolean }).__ohI18nSwitchProbe === true,
  );
  expect(stamp).toBe(true);
});

test('technical plane vocabulary stays raw under pseudo', async () => {
  const row = languageRow(page);
  await expect(row.getByText('English', { exact: true })).toBeVisible();
  await expect(row.getByText(PSEUDO_NATIVE_NAME)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
});

test('the choice persists across reload; a fresh profile still gates in English', async () => {
  // The settings store debounces persistence (150ms) — wait for the
  // choice to land in the origin IDB before tearing the page down, or
  // the reload can race the flush.
  await expect
    .poll(async () => {
      const dict = (await readHostSlot(page, 'oh.settings.user')) as Record<string, unknown> | null;
      return dict?.['general.language'] ?? null;
    })
    .toBe('pseudo');

  // The web app's restart: the token skips the gate and the persisted
  // locale paints from boot. The workbench chrome is pseudoized now,
  // so the wait keys on the delimiters, not English accessible names.
  await page.reload();
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
  await expect(page.locator('#root')).toContainText('⟦', { timeout: 30_000 });

  // A fresh profile on the same origin: no stored setting, no stored
  // token — the gate renders English again (the pseudo choice is
  // origin-profile-scoped, not daemon-global).
  const freshContext = await browser.newContext({ locale: 'fr-FR' });
  const freshPage = await freshContext.newPage();
  await freshPage.goto(`${ORIGIN}/`);
  await freshPage.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  const gate = freshPage.locator('[data-testid=login-gate]');
  await expect(gate).toContainText('Pair with this daemon');
  await expect(gate).not.toContainText('⟦');
  await freshContext.close();
});
