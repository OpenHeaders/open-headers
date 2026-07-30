/**
 * HTTP-version knob UI e2e — the pixels-to-wire loop the engine-level
 * legs (`request-settings-live.spec.ts`) deliberately bypass: seeded
 * requests are opened in the built app's real workbench, Sent with the
 * toolbar button, and the negotiated protocol is read back off the
 * response meta strip's Network popover; then the Settings tab's HTTP
 * version select is flipped through the real dropdown and the SAME
 * request is re-Sent, asserting the wire-truth label changed — knob →
 * draft → engine → snapshot → meta strip, round trip through the UI.
 * Honest-failure pins render the classified error in the response
 * panel instead of a silent downgrade.
 *
 * Requests are seeded through the real MCP `requests_save` write tool
 * (the response-media idiom) with `sslVerification: false` baked in
 * where the rig is self-signed, so the only knob the spec drives is
 * the one under test.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 * The QUIC leg needs a `caddy` binary on PATH and real UDP — it skips
 * without caddy, and a sandboxed run kills QUIC silently.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import {
  mintLocalhostCert,
  type Rig,
  startH2cEcho,
  startH2Echo,
  startH3Rig,
  startHttpsEcho,
} from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337).
const DAEMON_PORT = 19437;

const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-http-version-ui-client', version: '0.0.0' },
};

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let scratchDir: string;

let h2Echo: Rig;
let h2cEcho: Rig;
let httpsEcho: Rig;
let h3Rig: Rig | null;

let h2AutoUid: string;
let h1OnlyUid: string;
let h2cUid: string;
let h3Uid = '';

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

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

/** Seed one saved request desktop-side via the real MCP write tool. */
async function seedRequest(request: Record<string, unknown>): Promise<string> {
  const { status, json } = await rpc('tools/call', { name: 'requests_save', arguments: { request } });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  const payload = JSON.parse(result.content[0]?.text ?? '{}') as { request?: { uid: string } };
  const uid = payload.request?.uid ?? '';
  expect(uid).toBeTruthy();
  return uid;
}

// ── Workbench DOM helpers (the shared UI's selectors) ────────────────

/** Activate the API Requests tool window and expand the REQUESTS section. */
async function showRequestsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

/** Collapse the Docs dock panel so the requests pane fills the window. */
async function collapseDocsPanel(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected')) === 'true') {
    await docsTab.click();
  }
}

/** Click a seeded request row, expanding its collection first if hidden. */
async function openRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collections = workbench.locator('[data-item-id^="req-col-"]').filter({ visible: true });
    const count = await collections.count();
    for (let i = 0; i < count; i += 1) {
      if (await row.isVisible().catch(() => false)) break;
      await collections.nth(i).click();
      await row.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
    }
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

/** Pick a value in the Settings tab's HTTP version select — the real
 *  dropdown, matched by the option's full title so "HTTP/2" never
 *  hits "HTTP/2 (prior knowledge)". */
async function setHttpVersion(optionTitle: string): Promise<void> {
  await workbench.getByRole('tab', { name: 'Settings' }).filter({ visible: true }).first().click();
  const select = workbench.getByTestId('oh-http-version-select').filter({ visible: true }).first();
  await select.waitFor({ state: 'visible', timeout: 10_000 });
  await select.click();
  const option = workbench.locator(`.ant-select-item-option[title="${optionTitle}"]`).filter({ visible: true }).first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

/** Click Send in the active request editor. */
async function clickSend(): Promise<void> {
  await workbench.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
}

/** The negotiated-protocol fact off the meta strip's Network popover —
 *  hover the globe, read the HTTP Version row, dismiss. Throws while
 *  no response (or an error state) is on the pane; poll callers catch. */
async function versionFact(): Promise<string> {
  const globe = workbench.getByTestId('oh-response-network').filter({ visible: true }).first();
  await globe.hover();
  const fact = workbench.getByTestId('oh-response-http-version').filter({ visible: true }).first();
  await fact.waitFor({ state: 'visible', timeout: 5_000 });
  const text = (await fact.textContent())?.trim() ?? '';
  await workbench.keyboard.press('Escape');
  await workbench.mouse.move(0, 0);
  return text;
}

/** Send, then poll the popover fact until the EXPECTED protocol shows —
 *  every leg expects a label different from the pane's prior state, so
 *  a stale read can never satisfy the poll. */
async function sendAndExpectVersion(expected: string): Promise<void> {
  await clickSend();
  await expect.poll(() => versionFact().catch(() => ''), { timeout: 45_000 }).toBe(expected);
  const tag = workbench.getByTestId('oh-response-status').filter({ visible: true });
  expect((await tag.textContent())?.trim()).toContain('200');
}

/** Send, then poll the response panel's error state for the classified
 *  message — the honest-failure legs. */
async function sendAndExpectError(pattern: RegExp): Promise<void> {
  await clickSend();
  await expect
    .poll(
      async () =>
        (await workbench
          .getByTestId('oh-response-error')
          .filter({ visible: true })
          .first()
          .textContent()
          .catch(() => '')) ?? '',
      { timeout: 45_000 },
    )
    .toMatch(pattern);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  scratchDir = await mkdtemp(path.join(tmpdir(), 'oh-httpver-e2e-'));
  const material = await mintLocalhostCert(scratchDir);
  [h2Echo, h2cEcho, httpsEcho, h3Rig] = await Promise.all([
    startH2Echo(material),
    startH2cEcho(),
    startHttpsEcho(material),
    startH3Rig(scratchDir),
  ]);

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-httpver-app-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true, 'backend.bindPort': DAEMON_PORT },
      },
      secrets: {},
    }),
  );
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: the pre-engine rpc queue answers once the spine
  // is up, so one bridge round-trip is the readiness probe.
  await expect
    .poll(
      async () => {
        try {
          const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
          return typeof res.activeWorkspaceId === 'string';
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(true);
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${ORIGIN}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(200);
  const minted = await invoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'http-version-ui-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  const base = { headers: [], params: [], auth: { type: 'none' }, body: { type: 'none' } };
  h2AutoUid = await seedRequest({
    ...base,
    name: 'GET h2 echo',
    method: 'GET',
    url: `https://localhost:${h2Echo.port}/`,
    sslVerification: false,
  });
  h1OnlyUid = await seedRequest({
    ...base,
    name: 'GET h1-only echo',
    method: 'GET',
    url: `https://localhost:${httpsEcho.port}/`,
    sslVerification: false,
  });
  h2cUid = await seedRequest({
    ...base,
    name: 'GET h2c echo',
    method: 'GET',
    url: `http://127.0.0.1:${h2cEcho.port}/`,
  });
  if (h3Rig !== null) {
    h3Uid = await seedRequest({
      ...base,
      name: 'GET h3 rig',
      method: 'GET',
      url: `https://127.0.0.1:${h3Rig.port}/`,
      sslVerification: false,
    });
  }

  await showRequestsView();
  await collapseDocsPanel();
  await expect
    .poll(
      async () => {
        await openRequest(h2AutoUid).catch(() => {});
        return workbench
          .locator(`[data-item-id="request-${h2AutoUid}"]`)
          .isVisible()
          .catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});

test.afterAll(async () => {
  await electronApp?.close();
  const rigs = [h2Echo, h2cEcho, httpsEcho, h3Rig];
  await Promise.all(rigs.flatMap((rig) => (rig ? [rig.close()] : [])));
  await rm(scratchDir, { recursive: true, force: true });
});

test.describe('HTTP version — knob to wire through the workbench UI', () => {
  test('the auto default negotiates h2 and the meta strip reports it from the wire', async () => {
    await openRequest(h2AutoUid);
    await sendAndExpectVersion('HTTP/2');
  });

  test("flipping the knob to '1.1' re-sends the SAME request over HTTP/1.1", async () => {
    await openRequest(h2AutoUid);
    await setHttpVersion('HTTP/1.1');
    await sendAndExpectVersion('HTTP/1.1');
  });

  test("flipping the knob to '2' pins h2 again on the next send", async () => {
    await openRequest(h2AutoUid);
    await setHttpVersion('HTTP/2');
    await sendAndExpectVersion('HTTP/2');
  });

  test("a '2' pin against an h1-only server renders the classified failure, never a downgrade", async () => {
    await openRequest(h1OnlyUid);
    await setHttpVersion('HTTP/2');
    await sendAndExpectError(/HTTP\/2/);
  });

  test('prior knowledge speaks h2 to a cleartext server through the same knob', async () => {
    await openRequest(h2cUid);
    await setHttpVersion('HTTP/2 (prior knowledge)');
    await sendAndExpectVersion('HTTP/2');
  });

  test("switching the pin from prior knowledge to '2' fails honestly, naming the route back", async () => {
    await openRequest(h2cUid);
    await setHttpVersion('HTTP/2');
    await sendAndExpectError(/cannot negotiate HTTP\/2[\s\S]*prior knowledge/);
  });

  test("the '3' pin rides real QUIC and the strip reports h3 — after auto picked h2 over TCP", async () => {
    test.skip(h3Rig === null, 'caddy not on PATH — no local QUIC target');
    await openRequest(h3Uid);
    await sendAndExpectVersion('HTTP/2');
    await setHttpVersion('HTTP/3');
    await sendAndExpectVersion('HTTP/3');
  });
});

// ── Remote playground tier (env-gated) ───────────────────────────────
// A PRIVATE deployment of the playground behind a real wildcard
// certificate — real DNS, real Let's Encrypt trust, real QUIC over the
// public internet. The hostname is deliberately secret: these legs read
// it from OH_REMOTE_PLAYGROUND and skip cleanly when unset. The local
// rigs above remain the hermetic CI law; this tier is extra coverage
// the loopback rigs cannot give — certificate verification left ON and
// the helper's default webpki trust path exercised against a publicly
// trusted chain.

const REMOTE_HOST = process.env.OH_REMOTE_PLAYGROUND ?? '';
const REMOTE_SKIP = 'OH_REMOTE_PLAYGROUND not set — no remote playground tier';

let remoteUid = '';

test.describe('HTTP version — remote playground over real trust', () => {
  test('auto negotiates h2 against the remote front with verification ON — no self-signed escape hatch', async () => {
    test.skip(REMOTE_HOST === '', REMOTE_SKIP);
    remoteUid = await seedRequest({
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      name: 'GET remote playground',
      method: 'GET',
      url: `https://${REMOTE_HOST}/echo/remote`,
    });
    await openRequest(remoteUid);
    await sendAndExpectVersion('HTTP/2');
  });

  test("the '3' pin rides QUIC across the real internet on the helper's default webpki trust", async () => {
    test.skip(REMOTE_HOST === '', REMOTE_SKIP);
    await openRequest(remoteUid);
    await setHttpVersion('HTTP/3');
    await sendAndExpectVersion('HTTP/3');
  });

  test("pinning '1.1' downshifts the same request to HTTP/1.1 on the wire", async () => {
    test.skip(REMOTE_HOST === '', REMOTE_SKIP);
    await openRequest(remoteUid);
    await setHttpVersion('HTTP/1.1');
    await sendAndExpectVersion('HTTP/1.1');
  });
});
