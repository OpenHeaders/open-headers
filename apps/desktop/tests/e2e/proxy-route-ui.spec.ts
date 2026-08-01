/**
 * Proxy-route UI e2e — the H15 two-plane proxy architecture driven
 * through real pixels (the `http-version-ui.spec.ts` chassis): seeded
 * requests are opened in the built app's workbench and Sent with the
 * toolbar button, while the proxy decision is steered from the two
 * real surfaces — the request Settings tab's tri-state Proxy row
 * (request plane) and the Settings sheet's system-proxy pane
 * (system plane: Manual / PAC / Off, live apply, resolution
 * preview). Every routed leg asserts BOTH truths: the meta strip's
 * `proxyRoute` attribution tag (rendered from the record, never a live
 * settings read) and the local proxy rig's server-side arrival log —
 * a CONNECT tunnel or SOCKS5 target recorded for the leg's send.
 *
 * Quiet-direct legs (`Off`, the explicit per-request Direct opt-out
 * under an answering environment) assert the tag's ABSENCE plus an
 * unchanged rig log — plain direct is the baseline, never a badge.
 *
 * PAC-mode wire truth: desktop PAC resolution rides Chromium's
 * dedicated resolver session, and Chromium's IMPLICIT proxy bypass
 * answers DIRECT for loopback hosts without consulting the script —
 * a `localhost` target can never prove a PAC tunnel. The PAC wire leg
 * therefore rides an echo bound on this machine's LAN address and
 * skips cleanly on a machine with no non-loopback interface; the
 * resolution-preview leg proves the script's PROXY answer without
 * sending at all.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 * The env-gated remote legs (OH_REMOTE_PLAYGROUND) additionally prove
 * PAC fetch + per-URL branching over real internet trust via the
 * pane's resolution preview — the playground's /pac/per-url.pac.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { networkInterfaces, tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import {
  mintLocalhostCert,
  type ProxyRig,
  type Rig,
  type Socks5Rig,
  startConnectProxy,
  startHttpsEcho,
  startPacServer,
  startSocks5Proxy,
} from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (ledger through 19939).
const DAEMON_PORT = 20037;

const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-proxy-route-ui-client', version: '0.0.0' },
};

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let scratchDir: string;

let httpsEcho: Rig;
let connectProxy: ProxyRig;
let socks5Proxy: Socks5Rig;
let pacServer: Rig;
let lanEcho: Rig | null = null;

let requestPlaneUid: string;
let socksUid: string;
let environmentUid: string;
let pacUid = '';

/** This machine's first non-internal IPv4 address — the PAC wire leg's
 *  escape from Chromium's implicit loopback bypass. */
function lanAddress(): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

const LAN_IP = lanAddress();

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

/** Pick a value in the request Settings tab's Proxy mode select. */
async function setRequestProxyMode(optionTitle: string): Promise<void> {
  await workbench.getByRole('tab', { name: 'Settings' }).filter({ visible: true }).first().click();
  const select = workbench.getByTestId('oh-proxy-mode-select').filter({ visible: true }).first();
  await select.waitFor({ state: 'visible', timeout: 10_000 });
  await select.click();
  const option = workbench.locator(`.ant-select-item-option[title="${optionTitle}"]`).filter({ visible: true }).first();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

/** Type the request-plane proxy URL into the Settings tab's URL row. */
async function setRequestProxyUrl(url: string): Promise<void> {
  const input = workbench.getByTestId('oh-proxy-url-input').filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.fill(url);
}

/** Reset the Proxy row back to Inherit (undefined — the H11 reset law)
 *  via the row's own undo affordance. */
async function resetRequestProxyRow(): Promise<void> {
  await workbench.getByRole('tab', { name: 'Settings' }).filter({ visible: true }).first().click();
  const reset = workbench.getByRole('button', { name: 'Reset Proxy to default' }).filter({ visible: true }).first();
  await reset.waitFor({ state: 'visible', timeout: 10_000 });
  await reset.click();
}

/** Open the Settings sheet on the Proxy · Outbound category. The Proxy
 *  group row lands on a link page; the Outbound link mounts the pane. */
async function openProxySettings(): Promise<void> {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench.locator('.settings-category-nav').getByText('Proxy', { exact: true }).click();
  await workbench.getByRole('button', { name: 'Outbound Requests', exact: true }).click();
  await workbench.getByTestId('oh-sysproxy-mode').waitFor({ state: 'visible', timeout: 10_000 });
}

/** Close the Settings sheet (edits applied live — closing loses nothing). */
async function closeSettings(): Promise<void> {
  await workbench.keyboard.press('Escape');
  await workbench
    .getByTestId('oh-sysproxy-mode')
    .waitFor({ state: 'hidden', timeout: 10_000 })
    .catch(() => {});
}

/** Flip the system-proxy mode radio in the open settings pane. */
async function setEnvironmentMode(mode: 'system' | 'manual' | 'pac' | 'off'): Promise<void> {
  await workbench.getByTestId(`oh-sysproxy-mode-${mode}`).click();
}

/** Commit a value into one of the pane's blur-committed inputs. */
async function fillEnvironmentField(testId: string, value: string): Promise<void> {
  const input = workbench.getByTestId(testId).filter({ visible: true }).first();
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.fill(value);
  await input.press('Enter');
}

/** Click Send in the active request editor. */
async function clickSend(): Promise<void> {
  await workbench.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
}

const proxyTag = () => workbench.getByTestId('oh-response-proxy-route').filter({ visible: true });

/** Send, then poll until the rig log grew past `before` — server-side
 *  arrival is the wire truth; the 200 and the tag are asserted after. */
async function sendAndExpectArrival(log: string[], before: number): Promise<void> {
  await clickSend();
  await expect.poll(() => log.length, { timeout: 45_000 }).toBeGreaterThan(before);
  await expect
    .poll(
      async () =>
        (await workbench.getByTestId('oh-response-status').filter({ visible: true }).textContent())?.trim() ?? '',
      {
        timeout: 45_000,
      },
    )
    .toContain('200');
  await expect(proxyTag().first()).toBeVisible({ timeout: 15_000 });
}

/** Send a leg that must stay quiet-direct: 200 arrives, the rig logs
 *  never grow, and no proxy tag is on the pane. */
async function sendAndExpectQuietDirect(): Promise<void> {
  const tunnelsBefore = connectProxy.tunnels.length;
  const socksBefore = socks5Proxy.targets.length;
  await clickSend();
  await expect
    .poll(
      async () =>
        (await workbench.getByTestId('oh-response-status').filter({ visible: true }).textContent())?.trim() ?? '',
      {
        timeout: 45_000,
      },
    )
    .toContain('200');
  await expect.poll(() => proxyTag().count(), { timeout: 15_000 }).toBe(0);
  expect(connectProxy.tunnels.length).toBe(tunnelsBefore);
  expect(socks5Proxy.targets.length).toBe(socksBefore);
}

/** The attribution popover's source fact — hover the tag, read, dismiss. */
async function proxySourceFact(): Promise<string> {
  await proxyTag().first().hover();
  const popover = workbench.locator('.ant-popover:visible').first();
  await popover.waitFor({ state: 'visible', timeout: 5_000 });
  const text = (await popover.textContent()) ?? '';
  await workbench.keyboard.press('Escape');
  await workbench.mouse.move(0, 0);
  return text;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  scratchDir = await mkdtemp(path.join(tmpdir(), 'oh-proxyroute-e2e-'));
  const material = await mintLocalhostCert(scratchDir);
  [httpsEcho, connectProxy, socks5Proxy] = await Promise.all([
    startHttpsEcho(material),
    startConnectProxy(),
    startSocks5Proxy(),
  ]);
  pacServer = await startPacServer(
    `function FindProxyForURL(url, host) {\n  return "PROXY 127.0.0.1:${connectProxy.port}";\n}\n`,
  );
  if (LAN_IP !== null) {
    lanEcho = await startHttpsEcho(material, '0.0.0.0');
  }

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-proxyroute-app-'));
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
    label: 'proxy-route-ui-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  const base = { headers: [], params: [], auth: { type: 'none' }, body: { type: 'none' } };
  requestPlaneUid = await seedRequest({
    ...base,
    name: 'GET https echo (request plane)',
    method: 'GET',
    url: `https://localhost:${httpsEcho.port}/`,
    sslVerification: false,
  });
  socksUid = await seedRequest({
    ...base,
    name: 'GET https echo (socks5)',
    method: 'GET',
    url: `https://localhost:${httpsEcho.port}/socks`,
    sslVerification: false,
  });
  environmentUid = await seedRequest({
    ...base,
    name: 'GET https echo (environment)',
    method: 'GET',
    url: `https://localhost:${httpsEcho.port}/environment`,
    sslVerification: false,
  });
  if (LAN_IP !== null && lanEcho !== null) {
    pacUid = await seedRequest({
      ...base,
      name: 'GET https echo (pac)',
      method: 'GET',
      url: `https://${LAN_IP}:${lanEcho.port}/pac`,
      sslVerification: false,
    });
  }

  await showRequestsView();
  await collapseDocsPanel();
  await expect
    .poll(
      async () => {
        await openRequest(requestPlaneUid).catch(() => {});
        return workbench
          .locator(`[data-item-id="request-${requestPlaneUid}"]`)
          .isVisible()
          .catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});

test.afterAll(async () => {
  await electronApp?.close();
  await Promise.all([httpsEcho, connectProxy, socks5Proxy, pacServer, lanEcho].map((rig) => rig?.close()));
  await rm(scratchDir, { recursive: true, force: true });
});

// ── Request plane: the tri-state Proxy row ──────────────────────────

test.describe('request plane — the Settings tab Proxy row to the wire', () => {
  test('a Custom URL rides the CONNECT proxy and the tag attributes the request plane', async () => {
    await openRequest(requestPlaneUid);
    await setRequestProxyMode('Custom URL');
    await setRequestProxyUrl(`http://127.0.0.1:${connectProxy.port}`);
    await sendAndExpectArrival(connectProxy.tunnels, connectProxy.tunnels.length);
    expect(connectProxy.tunnels.at(-1)).toBe(`localhost:${httpsEcho.port}`);
    expect(await proxySourceFact()).toContain('Request settings');
  });

  test('a socks5:// URL dials through the SOCKS5 listener', async () => {
    await openRequest(socksUid);
    await setRequestProxyMode('Custom URL');
    await setRequestProxyUrl(`socks5://127.0.0.1:${socks5Proxy.port}`);
    await sendAndExpectArrival(socks5Proxy.targets, socks5Proxy.targets.length);
    expect(socks5Proxy.targets.at(-1)).toBe(`localhost:${httpsEcho.port}`);
  });
});

// ── System plane: the settings pane, live apply ────────────────

test.describe('system plane — the settings pane to the wire', () => {
  test('Manual mode proxies an inherit-mode request and the tag names the manual source', async () => {
    await openProxySettings();
    await setEnvironmentMode('manual');
    await fillEnvironmentField('oh-sysproxy-manual-url', `http://127.0.0.1:${connectProxy.port}`);
    await closeSettings();

    await openRequest(environmentUid);
    await sendAndExpectArrival(connectProxy.tunnels, connectProxy.tunnels.length);
    expect(connectProxy.tunnels.at(-1)).toBe(`localhost:${httpsEcho.port}`);
    expect(await proxySourceFact()).toContain('Manual proxy configuration');
  });

  test('the resolution preview answers with the manual chain — the honesty primitive on pixels', async () => {
    await openProxySettings();
    await fillEnvironmentField('oh-sysproxy-preview-url', `https://localhost:${httpsEcho.port}/`);
    await workbench.getByTestId('oh-sysproxy-preview-run').click();
    await expect(workbench.getByTestId('oh-sysproxy-preview-result')).toContainText(
      `PROXY 127.0.0.1:${connectProxy.port}`,
      { timeout: 10_000 },
    );
    await closeSettings();
  });

  test('Manual affordances: capability row, live URL validation, vault footer', async () => {
    await openProxySettings();
    await setEnvironmentMode('manual');
    await expect(workbench.getByTestId('oh-sysproxy-manual-supported')).toContainText('SOCKS5');
    await expect(workbench.getByTestId('oh-sysproxy-manual-url-hint')).toContainText('e.g.');

    // Live validation: a host no resolver can dial flags before any
    // blur, and the error line names the unsupported SOCKS4 family.
    const url = workbench.getByTestId('oh-sysproxy-manual-url').filter({ visible: true }).first();
    await url.fill("proxy;'=-example");
    await expect(workbench.getByTestId('oh-sysproxy-manual-url-hint')).toContainText('SOCKS4');
    await url.fill(`http://127.0.0.1:${connectProxy.port}`);
    await expect(workbench.getByTestId('oh-sysproxy-manual-url-hint')).toContainText('e.g.');
    await url.press('Enter');

    // The credentials popup carries the sticky manage-in-vault footer.
    await workbench.getByTestId('oh-sysproxy-manual-credential').filter({ visible: true }).first().click();
    await expect(workbench.getByTestId('oh-sysproxy-credentials-manage')).toBeVisible();
    await workbench.keyboard.press('Escape');
    // Defocus the select before closing — its search input consumes
    // the next Escape, which would strand the settings sheet open and
    // hang whichever test follows.
    await workbench.getByTestId('oh-sysproxy-manual-supported').click();
    await closeSettings();
    await workbench.getByTestId('oh-sysproxy-mode').waitFor({ state: 'hidden', timeout: 10_000 });
  });

  test('an explicit per-request Direct opt-out beats the answering environment — quiet direct', async () => {
    await openRequest(environmentUid);
    await setRequestProxyMode('Direct — no proxy');
    await sendAndExpectQuietDirect();
  });

  test("PAC mode fetches the script and the preview answers its PROXY — Chromium's loopback bypass stays honest", async () => {
    await openProxySettings();
    await setEnvironmentMode('pac');
    await fillEnvironmentField('oh-sysproxy-pac-source', `http://127.0.0.1:${pacServer.port}/proxy.pac`);

    // Resolution only — no send: a non-loopback URL consults the script.
    await fillEnvironmentField('oh-sysproxy-preview-url', 'https://openheaders.io/');
    await workbench.getByTestId('oh-sysproxy-preview-run').click();
    await expect(workbench.getByTestId('oh-sysproxy-preview-result')).toContainText(
      `PROXY 127.0.0.1:${connectProxy.port}`,
      { timeout: 10_000 },
    );

    // Chromium's implicit bypass: a loopback URL never reaches the PAC.
    await fillEnvironmentField('oh-sysproxy-preview-url', `https://localhost:${httpsEcho.port}/`);
    await workbench.getByTestId('oh-sysproxy-preview-run').click();
    await expect(workbench.getByTestId('oh-sysproxy-preview-result')).toContainText('DIRECT', { timeout: 10_000 });
    await closeSettings();
  });

  test('a PAC-routed send tunnels through the scripted proxy and the tag names the PAC source', async () => {
    test.skip(LAN_IP === null, 'no non-loopback interface — the PAC wire leg cannot escape the implicit bypass');
    await openRequest(pacUid);
    await sendAndExpectArrival(connectProxy.tunnels, connectProxy.tunnels.length);
    expect(connectProxy.tunnels.at(-1)).toBe(`${LAN_IP}:${lanEcho?.port}`);
    expect(await proxySourceFact()).toContain('PAC script');
  });

  test('Off restores quiet direct, and the reset row rides back to Inherit', async () => {
    await openProxySettings();
    await setEnvironmentMode('off');
    await closeSettings();

    await openRequest(requestPlaneUid);
    await resetRequestProxyRow();
    await sendAndExpectQuietDirect();
  });
});

// ── Remote playground tier (env-gated) ──────────────────────────────
// The remote front's PAC endpoints answer per-URL over real DNS and a
// real Let's Encrypt chain; its proxy listeners stay loopback-bound on
// the VM, so these legs prove PAC FETCH + per-URL branching through
// the resolution preview — no tunnel is (or can be) opened from here.

const REMOTE_HOST = process.env.OH_REMOTE_PLAYGROUND ?? '';
const REMOTE_SKIP = 'OH_REMOTE_PLAYGROUND not set — no remote playground tier';

test.describe('system plane — remote PAC over real trust', () => {
  test('the remote per-URL PAC branches: playground host → PROXY, anything else → DIRECT', async () => {
    test.skip(REMOTE_HOST === '', REMOTE_SKIP);
    await openProxySettings();
    await setEnvironmentMode('pac');
    await fillEnvironmentField('oh-sysproxy-pac-source', `https://${REMOTE_HOST}/pac/per-url.pac`);

    await fillEnvironmentField('oh-sysproxy-preview-url', `https://${REMOTE_HOST}/echo/preview`);
    await workbench.getByTestId('oh-sysproxy-preview-run').click();
    await expect(workbench.getByTestId('oh-sysproxy-preview-result')).toContainText(`PROXY ${REMOTE_HOST}:`, {
      timeout: 20_000,
    });

    await fillEnvironmentField('oh-sysproxy-preview-url', 'https://openheaders.io/');
    await workbench.getByTestId('oh-sysproxy-preview-run').click();
    await expect(workbench.getByTestId('oh-sysproxy-preview-result')).toContainText('DIRECT', { timeout: 20_000 });

    await setEnvironmentMode('off');
    await closeSettings();
  });
});
