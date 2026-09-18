/**
 * Request-settings web-host live E2E — the scope-C leg of the S14 live
 * pass, now the Execution Place epic's web gate: the served tab is a
 * CONTEXT — `executeRequest` resolves in the tab, its scripts run in
 * the tab's sandboxed iframe, the cookie jar is the tab's own — and
 * the serving host only opens the socket (the delegated request and
 * socket families), driven through a REAL wire end to end. The built desktop app serves the web bundle
 * (`backend.serveWebApp`) on an off-default port; a Playwright Chromium
 * tab signs in at the front door's password card as a directory user
 * admitted with an editor grant over the desktop's admin plane (the
 * server front door: a browser never pastes a pairing token — the
 * desktop-minted token stays the MCP seed's operator plane) and clicks
 * Send in the served workbench, so the send travels renderer → `dispatchWebRpc` →
 * `wire-requests-rpc` (workspace/env stamp) → WS wire →
 * `peer-requests-rpc` (opt-in gate → capability → audit) →
 * `runStepRequest` → undici against the S14 HTTP rig.
 *
 * Both gate outcomes are asserted live. The Playwright tab dials
 * loopback, so it rides the LOCAL tier (`backend.allowLocalPeerExecute`,
 * default ON — pairing is the consent):
 *   • Seeded OFF: the daemon's honest refusal rides back as an error
 *     SNAPSHOT (`success: true` + `snapshot.error`) and renders as the
 *     host-aware peer-execute notice on the response panel, never a
 *     silent null.
 *   • Flipped ON through the desktop storage bridge (no restart — the
 *     gate reads the settings record fresh per frame): a real snapshot
 *     returns, and the jar loop works over the wire — capture on a
 *     login send, value-free summary count in the editor's jar row,
 *     attach on the next send, clear, empty on the wire.
 *
 * The capability-DENY legs (refused send / hidden jar row for a peer
 * without a workspace role) stay unit-covered in
 * `peer-requests-rpc.test.ts` — a denied peer gets no workspace sync,
 * so the served UI never reaches a request editor to assert on.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` and
 * `pnpm turbo build --filter=@openheaders/web` first (the dev-tree
 * desktop serves the monorepo sibling `apps/web/dist`).
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { parseWorkspaceExport, type WorkspaceExport } from '@openheaders/core/workspace-export';
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
import { type Rig, startHttpRig } from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137).
const DAEMON_PORT = 19237;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-settings-web-client', version: '0.0.0' },
};

const EMAIL_INPUT = 'input[data-testid=login-gate-email], [data-testid=login-gate-email] input';
const PASSWORD_INPUT = 'input[data-testid=login-gate-password], [data-testid=login-gate-password] input';
const USER_EMAIL = 'john.doe@openheaders.io';
const USER_PASSWORD = 'settings-web-e2e-pass';

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let browser: Browser;
let context: BrowserContext;
let page: Page;
let httpRig: Rig;
const consoleErrors: string[] = [];

let echoUid: string;
let loginUid: string;
let meUid: string;

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

/** Merge one key into the live `oh.settings.user` record through the
 *  desktop storage bridge — the peer gate reads it fresh per frame, so
 *  no restart is involved. */
async function setUserSetting(key: string, value: unknown): Promise<void> {
  await workbench.evaluate(
    async ({ key: k, value: v }) => {
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
        value: { ...((current.value as Record<string, unknown>) ?? {}), [k]: v },
      });
    },
    { key, value },
  );
}

/** The desktop's own bridge onto the daemon's admin plane — the same
 *  handle the settings console uses. */
async function invokeDesktop<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

/** Admit the directory user the tab signs in as: an editor grant on the
 *  desktop's active workspace (the forwarded Send needs the write
 *  capability) and a password — admission confers access, one act. */
async function admitTabUser(): Promise<void> {
  const active = await invokeDesktop<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(active.activeWorkspaceId).toBeTruthy();
  const created = await invokeDesktop<{ ok: boolean; userId?: string; error?: string }>({
    type: 'oh.daemon.users.create',
    displayName: 'John Doe',
    email: USER_EMAIL,
    grants: [{ workspaceId: active.activeWorkspaceId, role: 'editor' }],
  });
  expect(created.ok, created.error).toBe(true);
  const passworded = await invokeDesktop<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.users.setPassword',
    userId: created.userId,
    password: USER_PASSWORD,
  });
  expect(passworded.ok, passworded.error).toBe(true);
}

/** Seed one saved request desktop-side via the real MCP write tool; the
 *  entity syncs down into the joined tab. Returns its uid. */
async function seedRequest(request: Record<string, unknown>): Promise<string> {
  const payload = await callTool('requests_save', { request });
  const uid = (payload.request as { uid: string }).uid;
  expect(uid).toBeTruthy();
  return uid;
}

/** Drive the tab's own RPC dispatch through its `window.oh.invoke`
 *  handle — the web mirror of the desktop preload's handle. */
async function invokeTab<T>(message: Record<string, unknown>): Promise<T> {
  return (await page.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

function watchConsole(target: Page, label: string): void {
  target.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  target.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
}

// ── Served-workbench DOM helpers (the shared UI's selectors) ─────────

/** Activate the API Requests tool window and expand the REQUESTS section. */
async function showRequestsView(target: Page = page): Promise<void> {
  const viewTab = target.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = target
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

/** Click a synced request row, expanding its collection first if hidden. */
async function openRequest(uid: string, target: Page = page): Promise<void> {
  const row = target.locator(`[data-item-id="request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collections = target.locator('[data-item-id^="req-col-"]').filter({ visible: true });
    const count = await collections.count();
    for (let i = 0; i < count; i += 1) {
      if (await row.isVisible().catch(() => false)) break;
      await collections.nth(i).click();
      await row.waitFor({ state: 'visible', timeout: 1_000 }).catch(() => {});
    }
  }
  await row.waitFor({ state: 'visible', timeout: 3_000 });
  await row.scrollIntoViewIfNeeded();
  await row.click();
}

/** Click Send in the active request editor (anchored: "caret-right Send"). */
async function send(): Promise<void> {
  await page.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
}

/** Wait for the response status chip; return its text. */
async function responseStatusText(): Promise<string> {
  const tag = page.getByTestId('oh-response-status').filter({ visible: true });
  await tag.waitFor({ state: 'visible', timeout: 10_000 });
  return (await tag.textContent())?.trim() ?? '';
}

/** Read the verbatim wire body via the response Body tab's Raw view. */
async function responseRawBody(): Promise<string> {
  const picker = page.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
  await picker.waitFor({ state: 'visible', timeout: 10_000 });
  await picker.click();
  await page.locator('.ant-dropdown-menu-item').filter({ hasText: /Raw$/ }).filter({ visible: true }).first().click();
  const body = page.getByTestId('oh-response-body').filter({ visible: true });
  await body.waitFor({ state: 'visible', timeout: 5_000 });
  return (await body.textContent())?.trim() ?? '';
}

/** The editor Settings tab's cookie-jar inspection row. */
function jarRow() {
  return page.getByTestId('oh-cookie-jar-row').filter({ visible: true });
}

/** Open the active request editor's Settings tab and prove it took —
 *  a click that lands on the tab's box without selecting it names what
 *  covered the strip. */
async function openSettingsTab(target: Page = page): Promise<void> {
  const tab = target.getByRole('tab', { name: 'Settings', exact: true }).filter({ visible: true }).first();
  await tab.click();
  await expect
    .poll(
      async () => {
        const selected = await tab.getAttribute('aria-selected');
        if (selected === 'true') return 'selected';
        const box = await tab.boundingBox();
        if (box === null) return 'no box';
        return await target.evaluate(
          ([x, y]) => {
            const el = document.elementFromPoint(x, y);
            return `covered by <${el?.tagName.toLowerCase()} class="${el?.className}"> ${el?.textContent?.slice(0, 60)}`;
          },
          [box.x + box.width / 2, box.y + box.height / 2],
        );
      },
      { timeout: 3_000 },
    )
    .toBe('selected');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  httpRig = await startHttpRig();

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-settings-web-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'backend.bindPort': DAEMON_PORT,
          'backend.serveWebApp': true,
          // The loopback tier's opt-in seeded OFF — the default is ON
          // (pairing is the consent), so the refusal outcome under
          // test needs the explicit flip.
          'backend.allowLocalPeerExecute': false,
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

  const minted = await invokeDesktop<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'settings-web-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  // Seed BEFORE the tab joins — the entities ride the join's down-sync.
  const base = { headers: [], params: [], auth: { type: 'none' }, body: { type: 'none' } };
  echoUid = await seedRequest({
    ...base,
    name: 'web: echo',
    method: 'GET',
    url: `http://127.0.0.1:${httpRig.port}/echo`,
  });
  loginUid = await seedRequest({
    ...base,
    name: 'web: jar login',
    method: 'GET',
    url: `http://127.0.0.1:${httpRig.port}/login`,
    cookieJar: true,
  });
  meUid = await seedRequest({
    ...base,
    name: 'web: jar me',
    method: 'GET',
    url: `http://127.0.0.1:${httpRig.port}/me`,
    cookieJar: true,
  });

  // The directory user admitted BEFORE the tab loads: the gate is a
  // pure function of server state, and an admitted account with a
  // password turns the unclaimed setup card into the sign-in card.
  await admitTabUser();

  browser = await chromium.launch();
  // A desktop-window viewport: the editor's tab strip overflows at the
  // 1280-wide default, and a Playwright click on a tab at the strip's
  // scrolled edge lands after antd re-applies its own transform — the
  // pointer's tab moves between mousedown and mouseup and nothing
  // selects. A person sees a settled strip; the tab does too.
  context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  page = await context.newPage();
  watchConsole(page, 'tab');
  await page.goto(`${ORIGIN}/`);

  await page.waitForSelector(EMAIL_INPUT, { timeout: 5_000 });
  await page.fill(EMAIL_INPUT, USER_EMAIL);
  await page.fill(PASSWORD_INPUT, USER_PASSWORD);
  await page.click('[data-testid=login-gate-password-submit]');
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 10_000 });
});

test.afterAll(async () => {
  await browser?.close();
  await electronApp?.close();
  await httpRig?.close();
});

// ── Down-sync: the seeded requests reach the tab ─────────────────────

test('the seeded requests sync down into the served workbench', async () => {
  await showRequestsView();
  await expect
    .poll(
      async () => {
        await openRequest(echoUid).catch(() => {});
        return page
          .locator(`[data-item-id="request-${echoUid}"]`)
          .isVisible()
          .catch(() => false);
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

// ── Gate outcome 1: opt-in OFF ⇒ honest refusal on the response panel ─

test('opt-in OFF: the forwarded Send renders the host-aware refusal notice', async () => {
  await openRequest(echoUid);
  await send();
  const notice = page.getByTestId('peer-execute-disabled-notice').filter({ visible: true });
  await notice.waitFor({ state: 'visible', timeout: 5_000 });
  const message = (await notice.textContent()) ?? '';
  expect(message).toContain('Sending from this device\u2019s browsers is turned off in the desktop app');
  expect(message).toContain('Backup and Sync \u203a Your devices');
});

// ── Gate outcome 2: flipped ON per frame, no restart ─────────────────

test('flipping backend.allowLocalPeerExecute on lets the same Send return a real snapshot', async () => {
  await setUserSetting('backend.allowLocalPeerExecute', true);
  await openRequest(echoUid);
  await send();
  const status = await responseStatusText();
  expect(status).toContain('200');
  const echo = JSON.parse(await responseRawBody()) as { host: string; url: string };
  expect(echo.host).toBe(`127.0.0.1:${httpRig.port}`);
  expect(echo.url).toBe('/echo');
});

// ── Egress attribution: the run says WHERE it executed ───────────────
// A delegated send's egress connection is the serving host's — the
// target saw ITS IP and locale, not the tab device's. The answering
// host stamps `executedOn` at run time; the tab's meta strip renders
// the "Sent from" tag, and the place control beside Send sets the
// expectation before the first send: the tab is the CONTEXT (resolved
// here), the serving daemon only opens the socket (the Execution Place
// plan, Phase W).

test('the response meta strip attributes the run to the serving host', async () => {
  // The serving desktop runs in this same test process's machine — its
  // hostname label is computable here.
  const expectedLabel = hostname().split('.')[0]?.trim().toLowerCase() ?? '';
  const tag = page.getByTestId('oh-response-executed-on').filter({ visible: true });
  await tag.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(tag).toContainText(`Sent from ${expectedLabel}`);
});

test('the place control names the connected back-end before the first send', async () => {
  const placeChip = page.getByTestId('execution-place-chip').filter({ visible: true }).first();
  await expect(placeChip).toHaveText(`Runs on 127.0.0.1:${DAEMON_PORT}`);
  await expect(placeChip).toHaveAttribute('data-place', 'workspace-server');
  await placeChip.click();
  const popover = page.getByTestId('execution-place-popover').filter({ visible: true });
  await expect(popover).toContainText(
    `Resolved here; 127.0.0.1:${DAEMON_PORT} opens the connection on this request's behalf.`,
  );
  // Close the popover so it never occludes later legs.
  await page.keyboard.press('Escape');
  await page.mouse.move(0, 0);
});

// ── The jar loop over the wire, keyed by the tab's stamped workspace ─
// RED since Phase W (measured 2026-09-18, the epic's F25): the jar is
// the tab's own over the delegating transport, which attaches the
// jar's Cookie on the FIRST hop and captures Set-Cookie from the FINAL
// response, while the serving daemon follows the login's 302 itself —
// the mid-chain Set-Cookie is consumed nowhere and `/me` carries no
// cookie. The four legs stay as the contract; the ruling on where the
// redirect follower lives for a jar-carrying delegated send is pending.

test('a jar-enabled login send captures the cookie mid-chain daemon-side', async () => {
  await openRequest(loginUid);
  await send();
  const status = await responseStatusText();
  expect(status).toContain('200');
  expect(await responseRawBody()).toBe('cookie=[session=live123]');
});

test('the next jar send attaches the stored cookie from the daemon jar', async () => {
  await openRequest(meUid);
  await send();
  expect(await responseRawBody()).toBe('cookie=[session=live123]');
});

test('the jar row shows the value-free count over the forwarded summary channel', async () => {
  await openSettingsTab();
  // The row hides itself when the forwarded summary fails — a miss
  // reports the channel's raw answer through the tab's own bridge.
  const summary = await invokeTab<unknown>({ type: 'getCookieJarSummary' }).catch(
    (err: Error) => `rejected: ${err.message}`,
  );
  const row = jarRow();
  await row.waitFor({ state: 'visible', timeout: 5_000 }).catch((err: Error) => {
    throw new Error(`jar row absent; getCookieJarSummary answered ${JSON.stringify(summary)} — ${err.message}`);
  });
  await expect(row).toContainText('1 cookie in this workspace');
});

test('Clear empties the jar over the wire — the next send carries nothing', async () => {
  await jarRow().getByRole('button', { name: 'Clear' }).click();
  await expect(jarRow()).toContainText('0 cookies in this workspace');
  await send();
  expect(await responseRawBody()).toBe('cookie=[]');
});

// ── Scripts on the tab's Send: the tab's own Safe sandbox ───────────
// A scripted draft dispatched from the tab runs its pre-request and
// post-response scripts HERE, in the tab's sandboxed iframe (the
// self-contained sandbox document the build bundled, mounted inline —
// the Execution Place plan, Phase W), and only the socket opens on the
// serving host.
// The pre-request mutation must reach the real wire through the
// delegated frame (the rig echoes the script-set header), the
// post-response assertions must see the real response, the snapshot
// must stamp the Safe mode it ran under, and the sandbox iframe must
// have mounted and reached ready — the one platform claim no unit pin
// proves.

test("a scripted Send runs in the tab's Safe sandbox, the socket opens on the serving host, the mode is stamped", async () => {
  const result = await invokeTab<{
    success: boolean;
    error?: string;
    snapshot?: {
      error: string | null;
      status: number;
      body: string;
      executedOn?: { kind: string; name: string };
      scripts?: {
        mode?: string;
        preRequest?: { succeeded: boolean };
        postResponse?: { succeeded: boolean; assertions?: Array<{ name: string; passed: boolean }> };
      };
    };
  }>({
    type: 'executeRequest',
    draft: {
      schemaVersion: 5,
      uid: 'req-web-script-1',
      path: 'requests/settings-web/scripted',
      name: 'web: scripted echo',
      method: 'GET',
      url: `http://127.0.0.1:${httpRig.port}/echo`,
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
      preRequestScript: "oh.setHeader('Authorization', 'Bearer forwarded-safe');",
      postResponseScript: [
        'const echoed = JSON.parse(oh.response.body);',
        "await oh.test('script header reached the wire', () => {",
        "  oh.expect(echoed.authorization).toBe('Bearer forwarded-safe');",
        '});',
      ].join('\n'),
    },
  });
  expect(result.success, result.error).toBe(true);
  const snapshot = result.snapshot;
  expect(snapshot?.error ?? null).toBeNull();
  expect(snapshot?.status).toBe(200);
  expect(JSON.parse(snapshot?.body ?? '{}').authorization).toBe('Bearer forwarded-safe');
  expect(snapshot?.scripts?.mode).toBe('safe');
  expect(snapshot?.scripts?.preRequest?.succeeded).toBe(true);
  expect(snapshot?.scripts?.postResponse?.assertions).toEqual([
    expect.objectContaining({ name: 'script header reached the wire', passed: true }),
  ]);
  // Egress attribution rides the raw channel too, not only the UI path.
  expect(snapshot?.executedOn?.kind).toBe('backend');
  expect(snapshot?.executedOn?.name).toBe(hostname().split('.')[0]?.trim().toLowerCase());

  // The scripts ran in the tab: the shared iframe transport mounted the
  // bundled sandbox document INLINE — sandboxed by the frame, reached
  // by no URL, needing no network (an offline tab runs it the same).
  const sandbox = page.getByTestId('oh-page-script-sandbox');
  await expect(sandbox).toHaveCount(1);
  await expect(sandbox).toHaveAttribute('sandbox', 'allow-scripts');
  expect(await sandbox.getAttribute('src')).toBeNull();
  expect(await sandbox.getAttribute('srcdoc')).toContain('<meta http-equiv="Content-Security-Policy"');
});

// ── A scripted session in the tab: the executor here, the socket there ─
// The three session kinds ride the same model: the tab keeps the
// session's executor (the handshake resolved here, every hook run in
// the tab's sandbox), and the serving daemon opens the socket over the
// delegated socket family. Before connect sets a handshake header the
// probe's greeting mirrors back; On message answers the greeting with
// the probe's close command so the session settles on its own.

test('a scripted WebSocket session runs its hooks in the tab and opens its socket on the serving host', async () => {
  const result = await invokeTab<{
    success: boolean;
    error?: string;
    snapshot?: {
      messages: Array<{ direction: 'up' | 'down'; dataBase64: string }>;
      close: { code: number; reason: string } | null;
      executedOn?: { kind: string; name: string };
      scripts?: { mode?: string; beforeConnect?: { dials: number } };
    };
  }>({
    type: 'executeWebSocketRequest',
    sendId: 'settings-web-ws-scripted',
    draft: {
      schemaVersion: 5,
      uid: 'wswscrp1',
      path: 'requests/settings-web/ws-scripted',
      name: 'web: scripted ws',
      url: 'ws://127.0.0.1:3000/net/ws-probe',
      flavor: 'raw',
      subprotocols: [],
      headers: [],
      params: [],
      message: '',
      scripts: {
        'ws-before-connect': "oh.setHeader('x-probe-client', 'tab-scripted');",
        'ws-on-message': "await oh.send('close');",
      },
    },
  });
  expect(result.success, result.error).toBe(true);
  const snapshot = result.snapshot;
  const decoded = (snapshot?.messages ?? []).map((m) => ({
    direction: m.direction,
    text: Buffer.from(m.dataBase64, 'base64').toString('utf-8'),
  }));
  // The greeting mirrors the header the Before connect hook set here.
  const greeting = decoded.find((m) => m.direction === 'down');
  expect(greeting, JSON.stringify(decoded)).toBeTruthy();
  expect(JSON.parse(greeting?.text ?? '{}').xProbeClient).toBe('tab-scripted');
  // The On message hook's reply rode the write rider up the wire.
  expect(decoded.some((m) => m.direction === 'up' && m.text === 'close')).toBe(true);
  expect(snapshot?.close?.code).toBe(1000);
  expect(snapshot?.scripts?.mode).toBe('safe');
  expect(snapshot?.scripts?.beforeConnect?.dials).toBe(1);
  expect(snapshot?.executedOn?.kind).toBe('backend');
  expect(snapshot?.executedOn?.name).toBe(hostname().split('.')[0]?.trim().toLowerCase());
});

test("the Settings tab states the tab's Safe-only script posture as a fact row", async () => {
  // The tab declares Safe alone (`scriptRuntime` names the mode
  // roster): the node sheet's Scripts row reads "Safe mode" as a fact,
  // and no chooser renders — a browser tab has no Developer mode.
  await openRequest(echoUid);
  await openSettingsTab();
  const reveal = page
    .getByRole('button', { name: /runtime-managed/ })
    .filter({ visible: true })
    .first();
  await reveal.waitFor({ state: 'visible', timeout: 5_000 });
  await reveal.click();
  const scriptsRow = page.getByTestId('oh-managed-scripts-row').filter({ visible: true }).first();
  await scriptsRow.waitFor({ state: 'visible', timeout: 5_000 });
  await expect(scriptsRow).toContainText('Safe mode');
  await expect(page.getByTestId('oh-script-mode-select')).toHaveCount(0);
});

// ── The desktop window, unchanged ────────────────────────────────────
// The same request opened in the serving desktop app's own window:
// its roster names both modes, so the Settings tab keeps the chooser,
// and its send runs here with no other place (the home Org binds no
// server) — the chip reads muted "Runs here".

test('the desktop window keeps its script-mode chooser and runs the request here', async () => {
  await showRequestsView(workbench);
  await openRequest(echoUid, workbench);
  await openSettingsTab(workbench);
  const chip = workbench.getByTestId('execution-place-chip').filter({ visible: true }).first();
  await expect(chip).toHaveText('Runs here');
  await expect(chip).toHaveAttribute('data-place', 'here');
  await expect(chip).toHaveAttribute('data-state', 'ready');
  await expect(workbench.getByTestId('oh-script-mode-select').filter({ visible: true })).toHaveCount(1);
});

// ── In-tab workspace export/import over the tab oracle ──────────────
// The tab answers the whole export/import channel family itself (same
// lifted oracle modules as the extension SW and daemon spine). The
// import write leg emits ordinary LOCAL mutations through the tab's
// resident sync engine, so an in-tab import crosses the outbound plane
// and lands daemon-side — asserted below by polling the daemon's own
// MCP view until the imported probe request appears.

let webEnvelope: WorkspaceExport;

test('in-tab exportWorkspace mints a web-stamped envelope carrying the synced requests', async () => {
  const exported = await invokeTab<{ success: boolean; yaml?: string; error?: string }>({
    type: 'exportWorkspace',
    scope: { kind: 'workspace' },
  });
  expect(exported.success, exported.error).toBe(true);

  const parsed = parseWorkspaceExport(exported.yaml as string);
  expect(parsed.ok, parsed.ok ? undefined : parsed.details).toBe(true);
  if (!parsed.ok) return;
  webEnvelope = parsed.export;
  expect(webEnvelope.source.app).toBe('web');
  expect(webEnvelope.source.platform).toBe('chrome');
  const names = webEnvelope.entities.requests.map((r) => r.name);
  expect(names).toEqual(expect.arrayContaining(['web: echo', 'web: jar login', 'web: jar me']));
  expect(webEnvelope.entities.vault).toBeUndefined();
});

test('the read-shaped import channels answer in-tab', async () => {
  const preview = await invokeTab<{ success: boolean; diff?: unknown; targetWorkspaceId?: string; error?: string }>({
    type: 'previewWorkspaceImport',
    incoming: webEnvelope,
    target: { mode: 'current' },
  });
  expect(preview.success, preview.error).toBe(true);
  expect(preview.diff).toBeTruthy();

  const snapshots = await invokeTab<{ snapshots: Record<string, string> }>({
    type: 'getLastImportedSnapshots',
    workspaceId: preview.targetWorkspaceId as string,
  });
  expect(snapshots.snapshots).toEqual({});

  const matches = await invokeTab<{
    exportIdSameTarget: unknown[];
    exportIdOtherTargets: unknown[];
    workspaceUidMatches: unknown[];
  }>({
    type: 'findWorkspaceExportImportMatches',
    exportId: webEnvelope.exportId,
    workspaceUid: webEnvelope.workspace.uid,
    currentTargetWorkspaceId: null,
  });
  expect(matches.exportIdSameTarget).toEqual([]);
  expect(matches.exportIdOtherTargets).toEqual([]);

  const review = await invokeTab<{ uids: string[] }>({ type: 'getRequestScriptsReviewPending' });
  expect(review.uids).toEqual([]);
});

test('an in-tab import syncs up the wire — the daemon sees the imported request', async () => {
  // Mutate the exported envelope into an import that ADDS one request:
  // clone the echo request under a fresh uid + name so the diff plans a
  // create (the untouched entities skip as unchanged uid-collisions).
  const echo = webEnvelope.entities.requests.find((r) => r.name === 'web: echo');
  expect(echo).toBeTruthy();
  const probe = { ...(echo as Record<string, unknown>), uid: 'e2e0prb1', name: 'web: imported probe' };
  const incoming: WorkspaceExport = {
    ...webEnvelope,
    entities: { ...webEnvelope.entities, requests: [...webEnvelope.entities.requests, probe] },
    meta: {
      ...webEnvelope.meta,
      counts: { ...webEnvelope.meta.counts, requests: webEnvelope.meta.counts.requests + 1 },
    },
  } as WorkspaceExport;

  const imported = await invokeTab<{ success: boolean; report?: unknown; error?: string }>({
    type: 'importWorkspace',
    incoming,
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:settings-web-roundtrip',
  });
  expect(imported.success, imported.error).toBe(true);

  // The imported request must reach the DAEMON — its own MCP view is
  // the authority, not the tab's stores.
  await expect
    .poll(
      async () => {
        const payload = await callTool('requests_list', {});
        const requests = payload.requests as Array<{ name: string }>;
        return requests.some((r) => r.name === 'web: imported probe');
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

test('a desktop-side import lands in the daemon stores and down-syncs into the joined tab', async () => {
  // The reverse direction of the round-trip leg above: the workbench
  // bridge drives the daemon spine's own `importWorkspace` with an
  // entity-carrying envelope. The entity must materialize in the
  // daemon's stores (its MCP view) AND reach the joined tab's oracle.
  // The foreign-workspace envelope re-mints uids (`new-uid` strategy),
  // so both polls adopt the landed uid by NAME — never the envelope's.
  const imported = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({
      type: 'importWorkspace',
      incoming: {
        schemaVersion: 5,
        kind: 'workspace-export',
        exportFormatVersion: 1,
        exportId: 'e2e0dsk1',
        exportedAt: '2026-07-13T00:00:00.000Z',
        source: { app: 'desktop', appVersion: '0.0.0', platform: 'electron', workspaceLabel: 'Settings Web Rig' },
        scope: 'workspace',
        workspace: { uid: '01905000-0000-7000-8000-00000000e2e2', name: 'Settings Web Rig' },
        entities: {
          collections: [],
          folders: [],
          rules: [],
          requests: [],
          templates: [],
          environments: [
            {
              schemaVersion: 5,
              uid: 'e2edske1',
              name: 'desktop: imported env',
              variables: [{ uid: 'e2edskv1', name: 'DESKTOP_IMPORTED', value: 'yes', type: 'default' }],
            },
          ],
          workspaceVars: { schemaVersion: 5, variables: [] },
          liveWorkflows: [],
          liveVariables: [],
          specs: [],
        },
        meta: {
          redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
          counts: {
            rules: 0,
            requests: 0,
            environments: 1,
            liveWorkflows: 0,
            liveVariables: 0,
            templates: 0,
            secrets: 0,
            specs: 0,
          },
        },
      },
      strategies: {},
      target: { mode: 'current' },
      sourceHash: 'sha256:settings-web-desktop-import',
    })) as { success: boolean; error?: string };
  });
  expect(imported.success, imported.error).toBe(true);

  // The daemon's own MCP view is the materialization authority.
  await expect
    .poll(
      async () => {
        const payload = await callTool('environments_list', {});
        const environments = payload.environments as Array<{ uid: string; name: string }>;
        return environments.some((e) => e.name === 'desktop: imported env');
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Down-sync: the joined tab's oracle receives the same entity.
  await expect
    .poll(
      async () => {
        const snapshot = await page.evaluate(async () => {
          const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
          const active = (await bridge.invoke({ type: 'getActiveWorkspaceId' })) as {
            activeWorkspaceId: string | null;
          };
          return (await bridge.invoke({
            type: 'oh.sync.snapshotEnvironments',
            workspaceId: active.activeWorkspaceId,
          })) as { entries: Array<{ environment: { name: string } }> };
        });
        return (snapshot.entries ?? []).some((e) => e.environment?.name === 'desktop: imported env');
      },
      { timeout: 10_000 },
    )
    .toBe(true);
});

test('the cipher-less tab refuses a vault-inclusive export honestly', async () => {
  const exported = await invokeTab<{ success: boolean; error?: string }>({
    type: 'exportWorkspace',
    scope: { kind: 'workspace' },
    vaultMode: 'plaintext',
  });
  expect(exported.success).toBe(false);
  expect(exported.error).toContain('no vault storage');
});

// ── The environment pointer: the tab's own, never the daemon's ──────
// The tab's active-environment pointer is tab-local and null here (the
// fresh tab never picked one) while the daemon's pointer names an env
// that resolves {{PROBE_HOST}}. The tab resolves its own send (Phase
// W): an explicit environmentId on the message pins that env in the
// tab, and no environmentId runs env-free and refuses the unresolved
// reference — the daemon's pointer never reaches a tab's run.

test('a No-environment tab forces an env-free run — the daemon pointer must not resolve it', async () => {
  // Seed the env through the TAB's `importWorkspace` (environment
  // writes have no direct bridge RPC by design; the in-tab import's
  // local mutations up-sync to the daemon — the path the import leg
  // above already proves), then point the DAEMON's pointer at it.
  const envUid = 'e2eprbe1';
  const seeded = await invokeTab<{ success: boolean; error?: string }>({
    type: 'importWorkspace',
    incoming: {
      schemaVersion: 5,
      kind: 'workspace-export',
      exportFormatVersion: 1,
      exportId: 'e2e0env1',
      exportedAt: '2026-07-13T00:00:00.000Z',
      source: { app: 'desktop', appVersion: '0.0.0', platform: 'electron', workspaceLabel: 'Settings Web Rig' },
      scope: 'workspace',
      workspace: { uid: '01905000-0000-7000-8000-00000000e2e1', name: 'Settings Web Rig' },
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests: [],
        templates: [],
        environments: [
          {
            schemaVersion: 5,
            uid: envUid,
            name: 'web: probe env',
            variables: [{ uid: 'e2eprbv1', name: 'PROBE_HOST', value: '127.0.0.1', type: 'default' }],
          },
        ],
        workspaceVars: { schemaVersion: 5, variables: [] },
        liveWorkflows: [],
        liveVariables: [],
        specs: [],
      },
      meta: {
        redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
        counts: {
          rules: 0,
          requests: 0,
          environments: 1,
          liveWorkflows: 0,
          liveVariables: 0,
          templates: 0,
          secrets: 0,
          specs: 0,
        },
      },
    },
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:settings-web-env-probe',
  });
  expect(seeded.success, seeded.error).toBe(true);

  // The import emits ordinary sync mutations and may re-mint the uid
  // (foreign-workspace envelope) — poll the daemon's own view by NAME
  // and adopt whatever uid landed.
  let envUidOnDaemon = '';
  await expect
    .poll(
      async () => {
        const payload = await callTool('environments_list', {});
        const environments = payload.environments as Array<{ uid: string; name: string }>;
        envUidOnDaemon = environments.find((e) => e.name === 'web: probe env')?.uid ?? '';
        return envUidOnDaemon !== '';
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  const { activeWorkspaceId } = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'getActiveWorkspaceId' })) as { activeWorkspaceId: string | null };
  });
  expect(activeWorkspaceId).toBeTruthy();
  await workbench.evaluate(
    async ({ key, value }) => {
      const bridge = (
        window as unknown as { oh: { storage: { set(req: { key: string; value: unknown }): Promise<unknown> } } }
      ).oh;
      await bridge.storage.set({ key, value });
    },
    { key: `oh.ws.${activeWorkspaceId}.activeEnvironmentId`, value: envUidOnDaemon },
  );

  const probeUid = await seedRequest({
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    name: 'web: env probe',
    method: 'GET',
    url: `http://{{PROBE_HOST}}:${httpRig.port}/echo`,
  });
  // The tab resolves the request against its OWN mirrors — the seeded
  // entity must have synced down before the run names it by uid.
  await expect
    .poll(
      async () => {
        await openRequest(probeUid).catch(() => {});
        return page
          .locator(`[data-item-id="request-${probeUid}"]`)
          .isVisible()
          .catch(() => false);
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  // Control leg first — an explicit env pin on the same seam resolves
  // in the tab and sends, proving the refusal below is the pointer's.
  const pinned = await invokeTab<{ success: boolean; snapshot?: { error: string | null; status: number } }>({
    type: 'executeRequest',
    requestUid: probeUid,
    environmentId: envUidOnDaemon,
  });
  expect(pinned.success).toBe(true);
  expect(pinned.snapshot?.error).toBeNull();
  expect(pinned.snapshot?.status).toBe(200);

  // The tab's own send — no environmentId on the message, so the run
  // takes the tab's null pointer as "No environment" and refuses the
  // unresolved reference; the daemon's pointer, set above, must not
  // leak in. (The workbench UI never fires this shape itself — Send
  // disables on a tab-unresolvable draft — so the RPC seam is the
  // surface under test.)
  const none = await invokeTab<{ success: boolean; snapshot?: { error: string | null } }>({
    type: 'executeRequest',
    requestUid: probeUid,
  });
  expect(none.success).toBe(true);
  expect(none.snapshot?.error).toContain('unresolved variables');
});

// ── Hygiene ─────────────────────────────────────────────────────────

test('zero console errors across every leg', async () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await context.close();
});
