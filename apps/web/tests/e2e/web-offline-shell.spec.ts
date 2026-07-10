/**
 * Phase 6 PWA offline shell acceptance:
 *
 *   1. Spawn the built daemon serving the built web bundle (same rig
 *      idiom as the web-join gate). The tab registers the service
 *      worker on load, the worker precaches the bundle under the
 *      build-stamp cache, and takes control (skipWaiting + claim).
 *   2. The PWA surfaces are served right: `/manifest.webmanifest` with
 *      its MIME and `/sw.js` revalidating (a cached worker would pin
 *      old builds).
 *   3. Daemon-owned routes stay un-intercepted: `/healthz` answers 200
 *      while the daemon lives and FAILS once it is gone — the login
 *      gate's boot probe must read a dead daemon honestly.
 *   4. The offline law itself: SIGTERM the daemon (a REAL unreachable
 *      backend, not a synthetic network switch) and reload — the
 *      cached shell serves the document, the boot probe fails, and the
 *      Workbench mounts offline-first on the tab's local IDB oracle.
 *   5. The same law behind a reverse proxy: a proxy fronting the dead
 *      daemon resolves the navigation with 502 instead of a network
 *      error — the worker must still answer with the cached shell.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`
 * and `pnpm turbo build --filter=@openheaders/web`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
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
// 18537, 18637, 18737, 18747, 18937, 19037, 19039).
const DAEMON_PORT = 19137;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let dataDir: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;
const daemonLog: string[] = [];

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-offline-shell-'));

  // A minted token on the ledger so the daemon boots with a coherent
  // storage envelope; this suite never joins — the offline law is
  // about the UNPAIRED boot path.
  const token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.daemonAuthTokens': [
          {
            id: 'offline-shell-bootstrap-token',
            tokenHash,
            label: 'offline-shell e2e',
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
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-port', String(DAEMON_PORT), '--web-root', WEB_DIST],
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
  context = await browser.newContext();
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
});

test('the daemon serves the PWA surfaces with the right headers', async () => {
  const manifest = await fetch(`${ORIGIN}/manifest.webmanifest`);
  expect(manifest.status).toBe(200);
  expect(manifest.headers.get('content-type')).toBe('application/manifest+json');

  const sw = await fetch(`${ORIGIN}/sw.js`);
  expect(sw.status).toBe(200);
  expect(sw.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  expect(sw.headers.get('cache-control')).toBe('no-cache');
});

test('the tab registers the worker, precaches the build, and is controlled', async () => {
  await page.goto(`${ORIGIN}/`);
  // The unpaired boot gates (daemon reachable, no token) — fine; the
  // worker registers regardless of the gate.
  await page.waitForSelector('[data-testid=login-gate]', { timeout: 30_000 });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 })
    .toBe(true);

  const cacheKeys = await page.evaluate(() => caches.keys());
  expect(cacheKeys.filter((key) => key.startsWith('oh-web-'))).toHaveLength(1);

  // The precache is complete enough to boot: the entry document plus a
  // hashed script module are cache hits.
  const cachedShell = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys()).find((key) => key.startsWith('oh-web-')) ?? '');
    const shell = await cache.match('/');
    const requests = await cache.keys();
    return {
      shellOk: shell !== undefined,
      hasHashedAsset: requests.some((req) => new URL(req.url).pathname.startsWith('/assets/')),
      hasThemeInit: requests.some((req) => new URL(req.url).pathname === '/js/theme-init.js'),
    };
  });
  expect(cachedShell).toEqual({ shellOk: true, hasHashedAsset: true, hasThemeInit: true });
});

test('healthz is never answered from cache', async () => {
  // While the daemon lives the probe passes THROUGH the worker.
  const alive = await page.evaluate(async () => (await fetch('/healthz')).status);
  expect(alive).toBe(200);

  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);

  // Dead daemon ⇒ the probe must FAIL, not serve a cached 200 — the
  // login gate's offline-first decision depends on this.
  const deadProbeFails = await page.evaluate(async () => {
    try {
      await fetch('/healthz');
      return false;
    } catch {
      return true;
    }
  });
  expect(deadProbeFails).toBe(true);
});

test('a reload with the daemon gone serves the cached shell and mounts offline-first', async () => {
  await page.reload();
  // No gate (the probe failed), no insecure notice — the Workbench
  // mounts on local data alone, served entirely from the worker cache.
  await expect(page.getByRole('button', { name: 'Create rule', exact: false }).first()).toBeVisible({
    timeout: 30_000,
  });
  expect(await page.$('[data-testid=login-gate]')).toBeNull();
});

test('a reload behind a proxy answering 502 for the dead daemon serves the cached shell too', async () => {
  // A fronted daemon never fails with a network error: the proxy keeps
  // resolving fetches with a gateway status. Stand one in on the
  // daemon's port and reload — the worker must read 502 as "daemon
  // unreachable" and answer with the cached shell.
  const proxy = createServer((_req, res) => {
    res.writeHead(502, { 'content-type': 'text/html' });
    res.end('<html><body>502 Bad Gateway</body></html>');
  });
  await new Promise<void>((resolve) => proxy.listen(DAEMON_PORT, '127.0.0.1', resolve));
  try {
    await page.reload();
    await expect(page.getByRole('button', { name: 'Create rule', exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    expect(await page.$('[data-testid=login-gate]')).toBeNull();
  } finally {
    await new Promise<void>((resolve, reject) => proxy.close((error) => (error ? reject(error) : resolve())));
  }
});
