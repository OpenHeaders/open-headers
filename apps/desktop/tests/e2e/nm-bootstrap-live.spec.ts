/**
 * NM identity bootstrap — live E2E (OBSERVABILITY_PLAN.md §4 + §8
 * Phase 7) against the real dual-app stack: the bun-compiled
 * `oh-nm-host` binary, the desktop daemon's `/nm/bootstrap` route with
 * its OS-truth verification chain, and the extension's handoff module.
 *
 *   1. Desktop boot auto-registers/repairs the NM manifest for
 *      installed browsers (the boot log names the per-target outcome).
 *   2. Host-direct ride: the test spawns the REAL binary, frames one
 *      bootstrap request, and the daemon walks the REAL chain — lsof
 *      socket owner, host executable realpath, parent signer — and
 *      refuses at the browser-signer boundary (the parent here is the
 *      test runner, not a signed browser). The wire answer stays
 *      coarse (`refused`); the specific link lands in the daemon log.
 *   3. Loopback pin: a non-loopback backend URL is refused by the host
 *      itself (`bad-request`) without ever dialing out.
 *   4. Framing fail-closed: an oversize frame kills the host with no
 *      answer written.
 *   5. Browser ride: Chromium spawns the host per a NativeMessagingHosts
 *      manifest and the extension's SW-boot attempt carries the whole
 *      handoff — manifest lookup, host spawn, daemon dial. Playwright's
 *      Chromium is ad-hoc signed, so the ratified design REQUIRES the
 *      `browser-unverified` refusal here and no minted token; a signed
 *      allowlisted browser would mint instead, and the leg asserts
 *      whichever outcome the OS chain actually proves.
 *
 * Deliberately NOT covered (manual live-pass items): the signed-Chrome
 * happy-path mint + revoke/re-mint rotation (needs a browser carrying
 * an allowlisted team id — automation browsers are ad-hoc signed by
 * construction), and the inert-posture log without the packed binary
 * (this suite requires the binary).
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build`, the
 * extension `dist/chrome`, and `pnpm --filter @openheaders/nm-host run
 * pack:bun` (the dev-tree binary is the identity anchor).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
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
const NM_HOST_BINARY = path.resolve(APP_ROOT, '../nm-host/dist-bun/oh-nm-host');
// Port etiquette: fresh port off every prior suite (ledger through 19941).
const DAEMON_PORT = 19942;
const NM_HOST_NAME = 'io.openheaders.nm_bootstrap';
const CHROME_EXTENSION_ID = 'ablaikadpbfblkmhpmbbnbbfjoibeejb';
// Playwright's browser reads user-level manifests off the profile's
// user-data dir; the Application Support fallbacks cover builds that
// resolve a browser-branded path instead (Playwright ships Chrome for
// Testing; plain Chromium kept for older bundles).
const FALLBACK_MANIFEST_DIRS = [
  path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome for Testing', 'NativeMessagingHosts'),
  path.join(os.homedir(), 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
];

interface DaemonTokenRow {
  id: string;
  label: string;
  kind: string;
  expiresAt: number | null;
  revokedAt: number | null;
}

let electronApp: ElectronApplication;
let workbench: Page;
let extensionContext: BrowserContext | undefined;
const fallbackManifestsCreated: string[] = [];

/** Everything the desktop process writes — the daemon log is the
 *  refusal chain's only detailed witness. */
const daemonOutput: string[] = [];

function daemonLog(): string {
  return daemonOutput.join('');
}

/** Invoke a daemon admin channel through the Workbench bridge. */
async function bridgeInvoke<T>(message: Record<string, unknown>): Promise<T> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as never;
  }, message) as Promise<T>;
}

async function listTokens(): Promise<DaemonTokenRow[]> {
  const { tokens } = await bridgeInvoke<{ tokens: DaemonTokenRow[] }>({ type: 'oh.daemon.tokens.list' });
  return tokens;
}

function nmSessionTokens(tokens: readonly DaemonTokenRow[]): DaemonTokenRow[] {
  return tokens.filter((token) => token.kind === 'nmSession');
}

/** Chrome NM wire framing: uint32LE length + UTF-8 JSON. */
function encodeNmFrame(value: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(value), 'utf-8');
  const frame = Buffer.allocUnsafe(4 + json.length);
  frame.writeUInt32LE(json.length, 0);
  json.copy(frame, 4);
  return frame;
}

function decodeNmFrame(buffer: Buffer): unknown | null {
  if (buffer.length < 4) return null;
  const length = buffer.readUInt32LE(0);
  if (buffer.length < 4 + length) return null;
  try {
    return JSON.parse(buffer.subarray(4, 4 + length).toString('utf-8'));
  } catch {
    return null;
  }
}

/** Spawn the real binary, write `stdinBytes`, collect its one answer. */
function runHostOnce(stdinBytes: Buffer): Promise<{ exitCode: number | null; answer: unknown | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(NM_HOST_BINARY, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, answer: decodeNmFrame(Buffer.concat(chunks)) });
    });
    child.stdin.write(stdinBytes);
  });
}

/** The manifest document Chromium reads to spawn the host. */
function nmManifestContent(): string {
  const manifest = {
    name: NM_HOST_NAME,
    description: 'Open Headers native-messaging bootstrap (token handoff only)',
    path: NM_HOST_BINARY,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${CHROME_EXTENSION_ID}/`],
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * (Re-)seed the peer's backend registry record — same encrypted blob
 * format and page-context posture as the live-network suite. An EMPTY
 * authToken is the fresh-install shape the bootstrap module targets.
 */
async function seedBackend(page: Page, seed: { backendUrl: string; authToken: string }): Promise<void> {
  await page.evaluate(async ({ backendUrl, authToken }) => {
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
      id: 'nm-bootstrap-e2e-backend',
      label: 'nm-bootstrap e2e desktop',
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
}

test.describe.configure({ mode: 'serial' });

function step(message: string): void {
  console.log(`[nm-bootstrap ${new Date().toISOString()}] ${message}`);
}

test.beforeAll(async () => {
  expect(existsSync(NM_HOST_BINARY), `run pack:bun first — no binary at ${NM_HOST_BINARY}`).toBe(true);

  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-nm-bootstrap-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  const child = electronApp.process();
  child.stdout?.on('data', (chunk: Buffer) => daemonOutput.push(chunk.toString('utf-8')));
  child.stderr?.on('data', (chunk: Buffer) => daemonOutput.push(chunk.toString('utf-8')));
  workbench = await electronApp.firstWindow();

  // The daemon's WS/HTTP port answers once up.
  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/mcp`, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .not.toBe(0);
});

test.afterAll(async () => {
  await extensionContext?.close();
  await electronApp?.close();
  for (const created of fallbackManifestsCreated) {
    await rm(created, { force: true });
  }
});

// ── Leg 1: boot-time manifest auto-register ─────────────────────────

test('desktop boot registers/repairs the NM manifest for installed browsers', async () => {
  // The boot log names every target's outcome; an installed Chrome must
  // never be `skipped` (repair keeps an existing manifest converged).
  await expect
    .poll(() => /NM manifest (registered|repaired|unchanged)/.test(daemonLog()), { timeout: 20000 })
    .toBe(true);
  expect(daemonLog()).not.toContain('identity bootstrap stays inert');
});

// ── Leg 2: host-direct ride to the refusal boundary ─────────────────

test('the real host dials the real daemon and the OS chain refuses an unsigned caller', async () => {
  const { exitCode, answer } = await runHostOnce(
    encodeNmFrame({ kind: 'bootstrap', url: `ws://127.0.0.1:${DAEMON_PORT}`, installId: 'nm-e2e-host-direct' }),
  );
  expect(exitCode).toBe(0);
  // Coarse on the wire: the host relays the daemon's bare refusal.
  expect(answer).toEqual({ ok: false, reason: 'refused' });

  // The daemon log holds the specific broken link: the chain resolved
  // the socket owner to the REAL binary (no host-mismatch), walked to
  // the parent — this test runner, not a signed browser — and refused
  // at the signer boundary.
  expect(daemonLog()).toContain('bootstrap refused (browser-unverified)');
  expect(daemonLog()).not.toContain('bootstrap refused (host-mismatch)');
  expect(daemonLog()).not.toContain('bootstrap refused (owner-not-found)');

  // Refused means refused: no nmSession row exists.
  expect(nmSessionTokens(await listTokens())).toHaveLength(0);
});

// ── Leg 3: the loopback pin ─────────────────────────────────────────

test('the host refuses a non-loopback backend URL without dialing out', async () => {
  const { exitCode, answer } = await runHostOnce(encodeNmFrame({ kind: 'bootstrap', url: 'ws://192.168.0.10:59210' }));
  expect(exitCode).toBe(0);
  expect(answer).toEqual({ ok: false, reason: 'bad-request' });
});

// ── Leg 4: framing fail-closed ──────────────────────────────────────

test('an oversize frame kills the host with no answer', async () => {
  const oversize = Buffer.allocUnsafe(4);
  oversize.writeUInt32LE(10 * 1024 * 1024, 0);
  const { exitCode, answer } = await runHostOnce(oversize);
  expect(exitCode).toBe(1);
  expect(answer).toBeNull();
});

// ── Leg 5: the browser ride ─────────────────────────────────────────

test('Chromium spawns the host from the manifest and the SW-boot attempt rides the whole chain', async () => {
  test.setTimeout(120000);
  const logMark = daemonLog().length;

  // Register the manifest where THIS browser looks — the profile's
  // user-data dir, plus the Application Support fallback.
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'oh-nm-bootstrap-profile-'));
  await mkdir(path.join(profileDir, 'NativeMessagingHosts'), { recursive: true });
  await writeFile(path.join(profileDir, 'NativeMessagingHosts', `${NM_HOST_NAME}.json`), nmManifestContent());
  for (const fallbackDir of FALLBACK_MANIFEST_DIRS) {
    const fallbackManifestPath = path.join(fallbackDir, `${NM_HOST_NAME}.json`);
    if (existsSync(fallbackManifestPath)) continue;
    await mkdir(fallbackDir, { recursive: true });
    await writeFile(fallbackManifestPath, nmManifestContent());
    fallbackManifestsCreated.push(fallbackManifestPath);
  }

  const launchArgs = [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
  ];
  const seedContext = await chromium.launchPersistentContext(profileDir, { headless: false, args: launchArgs });
  step('browser launched');
  const bootWorker = seedContext.serviceWorkers()[0] ?? (await seedContext.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];
  expect(extensionId).toBe(CHROME_EXTENSION_ID);
  step(`extension SW up (${extensionId})`);

  // Seed the fresh-install shape (enabled loopback backend, EMPTY
  // token), then relaunch the browser on the SAME profile — the next
  // SW cold boot is the module's fresh-profile trigger, exactly the
  // proof-ladder shape. (`chrome.runtime.reload()` is no path here: it
  // DISABLES an unpacked `--load-extension` extension pending the
  // profile's developer-mode consent.)
  const seedPage = await seedContext.newPage();
  await seedPage.goto(`chrome-extension://${extensionId}/merge-showcase.html`);
  await seedPage.waitForLoadState('load');
  await seedBackend(seedPage, { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: '' });
  step('backend seeded (empty token)');
  await seedContext.close();

  extensionContext = await chromium.launchPersistentContext(profileDir, { headless: false, args: launchArgs });
  await (extensionContext.serviceWorkers()[0] ?? extensionContext.waitForEvent('serviceworker'));
  step('browser relaunched — SW boot attempt in flight');

  // The handoff lands on the daemon either way — what the OS chain
  // proves decides the outcome. Playwright's Chromium is ad-hoc
  // signed, so the ratified boundary answers the refusal; a signed
  // allowlisted browser would mint.
  await expect
    .poll(() => /bootstrap refused \(browser-unverified\)|nmSession minted/.test(daemonLog().slice(logMark)), {
      timeout: 60000,
    })
    .toBe(true);

  const minted = nmSessionTokens(await listTokens());
  if (daemonLog().slice(logMark).includes('nmSession minted')) {
    step(`outcome: minted (${minted[0]?.label ?? 'no row'})`);
    expect(minted.length).toBeGreaterThan(0);
    expect(minted[0].label.startsWith('NM: ')).toBe(true);
    expect(minted[0].expiresAt).not.toBeNull();
  } else {
    step('outcome: refused at the browser-signer boundary (ad-hoc automation browser)');
    // Refusal leaves no token AND names the spawning browser — the
    // proof the host was spawned BY Chromium, not found missing.
    expect(minted).toHaveLength(0);
    expect(daemonLog().slice(logMark)).toMatch(/browser-unverified.*(chromium|chrome)/i);
  }
});

// ── Manual-inspection hold ──────────────────────────────────────────

test('hold the stack open for manual inspection', async () => {
  test.skip(process.env.OH_E2E_HOLD !== '1', 'set OH_E2E_HOLD=1 to keep the stack open after the run');
  test.setTimeout(0);
  console.log('[nm-bootstrap] holding the desktop + extension open — stop the runner to tear down');
  await new Promise(() => {});
});
