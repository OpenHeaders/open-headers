/**
 * Request-settings web-host live E2E — the scope-C leg of the S14 live
 * pass: the three forwarded workbench request channels
 * (`executeRequest` + the cookie-jar pair) driven through a REAL wire
 * end to end. The built desktop app serves the web bundle
 * (`backend.serveWebApp`) on an off-default port; a Playwright Chromium
 * tab pairs with a desktop-minted token and clicks Send in the served
 * workbench, so the send travels renderer → `dispatchWebRpc` →
 * `wire-requests-rpc` (workspace/env stamp) → WS wire →
 * `peer-requests-rpc` (opt-in gate → capability → audit) →
 * `runStepRequest` → undici against the S14 HTTP rig.
 *
 * Both gate outcomes are asserted live:
 *   • `backend.allowPeerExecute` OFF (the default — the seed omits it):
 *     the daemon's honest refusal rides back as an error SNAPSHOT
 *     (`success: true` + `snapshot.error`) and renders on the response
 *     panel's error state, never a silent null.
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

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

const TOKEN_INPUT = 'input[data-testid=login-gate-token], [data-testid=login-gate-token] input';

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
async function showRequestsView(): Promise<void> {
  const viewTab = page.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = page
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

/** Click a synced request row, expanding its collection first if hidden. */
async function openRequest(uid: string): Promise<void> {
  const row = page.locator(`[data-item-id="request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collections = page.locator('[data-item-id^="req-col-"]').filter({ visible: true });
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

/** Click Send in the active request editor (anchored: "caret-right Send"). */
async function send(): Promise<void> {
  await page.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
}

/** Wait for the failed-send error state; return its classified message. */
async function responseErrorText(): Promise<string> {
  const msg = page.getByTestId('oh-response-error').filter({ visible: true });
  await msg.waitFor({ state: 'visible', timeout: 30_000 });
  return (await msg.textContent())?.trim() ?? '';
}

/** Wait for the response status chip; return its text. */
async function responseStatusText(): Promise<string> {
  const tag = page.getByTestId('oh-response-status').filter({ visible: true });
  await tag.waitFor({ state: 'visible', timeout: 30_000 });
  return (await tag.textContent())?.trim() ?? '';
}

/** Read the verbatim wire body via the response Body tab's Raw view. */
async function responseRawBody(): Promise<string> {
  const picker = page.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
  await picker.waitFor({ state: 'visible', timeout: 30_000 });
  await picker.click();
  await page.locator('.ant-dropdown-menu-item').filter({ hasText: /Raw$/ }).filter({ visible: true }).first().click();
  const body = page.getByTestId('oh-response-body').filter({ visible: true });
  await body.waitFor({ state: 'visible', timeout: 15_000 });
  return (await body.textContent())?.trim() ?? '';
}

/** The editor Settings tab's cookie-jar inspection row. */
function jarRow() {
  return page.getByTestId('oh-cookie-jar-row').filter({ visible: true });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  httpRig = await startHttpRig();

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-settings-web-e2e-'));
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
          // backend.allowPeerExecute deliberately ABSENT — default OFF
          // is the first gate outcome under test.
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
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'settings-web-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
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

  browser = await chromium.launch();
  context = await browser.newContext();
  page = await context.newPage();
  watchConsole(page, 'tab');
  await page.goto(`${ORIGIN}/`);

  await page.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  await page.fill(TOKEN_INPUT, token);
  await page.click('[data-testid=login-gate-submit]');
  await page.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
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
      { timeout: 30_000 },
    )
    .toBe(true);
});

// ── Gate outcome 1: opt-in OFF ⇒ honest refusal on the response panel ─

test('opt-in OFF: the forwarded Send renders the refusal naming the setting', async () => {
  await openRequest(echoUid);
  await send();
  const message = await responseErrorText();
  expect(message).toContain('Sending requests from connected devices is disabled on this host');
  expect(message).toContain('Settings → Backend');
});

// ── Gate outcome 2: flipped ON per frame, no restart ─────────────────

test('flipping backend.allowPeerExecute on lets the same Send return a real snapshot', async () => {
  await setUserSetting('backend.allowPeerExecute', true);
  await openRequest(echoUid);
  await send();
  const status = await responseStatusText();
  expect(status).toContain('200');
  const echo = JSON.parse(await responseRawBody()) as { host: string; url: string };
  expect(echo.host).toBe(`127.0.0.1:${httpRig.port}`);
  expect(echo.url).toBe('/echo');
});

// ── The jar loop over the wire, keyed by the tab's stamped workspace ─

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
  await page
    .getByRole('tab', { name: /Settings/ })
    .filter({ visible: true })
    .first()
    .click();
  const row = jarRow();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  await expect(row).toContainText('1 cookie in this workspace');
});

test('Clear empties the jar over the wire — the next send carries nothing', async () => {
  await jarRow().getByRole('button', { name: 'Clear' }).click();
  await expect(jarRow()).toContainText('0 cookies in this workspace');
  await send();
  expect(await responseRawBody()).toBe('cookie=[]');
});

// ── S18: in-tab workspace export/import over the tab oracle ─────────
// The tab answers the read-shaped export/import channels itself (same
// lifted oracle modules as the extension SW and daemon spine); the
// import write leg REFUSES for now — the post-import reseed applies
// inbound-origin, so an in-tab import would never reach the daemon.

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

test('the read-shaped import channels answer in-tab; the write leg refuses honestly', async () => {
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

  const imported = await invokeTab<{ success: boolean; error?: string }>({
    type: 'importWorkspace',
    incoming: webEnvelope,
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:settings-web-refusal',
  });
  expect(imported.success).toBe(false);
  expect(imported.error).toContain('not yet supported on this surface');
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

// ── Hygiene ─────────────────────────────────────────────────────────

test('zero console errors across every leg', async () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await context.close();
});
