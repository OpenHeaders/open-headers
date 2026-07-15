/**
 * Response viewer content-type sweep e2e — the DESKTOP leg of the
 * extension's `request-response-media-ui.spec.ts`: the same probe pack
 * (`playground/server/api-binary.ts` + the PDF probe) driven through
 * the built app's real workbench window. The viewer is shared ui, so
 * the sweep assertions mirror the extension's; what is desktop-specific
 * — and the reason this spec exists — is the renderer CSP
 * (`media-src 'self' blob:`, `frame-src 'self' blob:`,
 * `img-src … blob:` in `src/renderer/index.html`): a preview that
 * merely mounts proves nothing about the blob actually loading, so the
 * media legs assert decode progress (image `naturalWidth`, media
 * `readyState`) and a console watcher fails the suite on any CSP
 * violation report.
 *
 * Probe requests are seeded desktop-side through the real MCP
 * `requests_save` write tool (the request-settings-web idiom) — it
 * mints the default collection, so the sidebar rows materialize
 * exactly like user-created requests.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 * Playwright boots the playground webServer, so the probes are up at
 * 127.0.0.1:3000.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137, 19237).
const DAEMON_PORT = 19337;

const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${ORIGIN}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-media-sweep-client', version: '0.0.0' },
};

const PROBE_URL = (name: string) => `http://127.0.0.1:3000/api/${name}`;
const SHOT_DIR = path.join(__dirname, 'test-results', 'response-media-shots');

/** Probe requests seeded once — names key the minted uids. */
const PROBE_REQUESTS = [
  'image',
  'svg',
  'zip',
  'gzip',
  'wasm',
  'csv',
  'yaml',
  'ndjson',
  'media',
  'latin1',
  'pdf',
] as const;
type ProbeName = (typeof PROBE_REQUESTS)[number];

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
const seededUids = new Map<ProbeName, string>();
const consoleErrors: string[] = [];

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

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

/** Seed one saved request desktop-side via the real MCP write tool. */
async function seedRequest(request: Record<string, unknown>): Promise<string> {
  const payload = await callTool('requests_save', { request });
  const uid = (payload.request as { uid: string }).uid;
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

/** Open a probe request and Send it; wait for the 200 status chip. */
async function sendProbe(name: ProbeName): Promise<void> {
  const uid = seededUids.get(name);
  expect(uid, `no seeded uid for ${name}`).toBeTruthy();
  await openRequest(uid as string);
  await workbench.getByRole('button', { name: /Send$/ }).filter({ visible: true }).click();
  const tag = workbench.getByTestId('oh-response-status').filter({ visible: true });
  await tag.waitFor({ state: 'visible', timeout: 30_000 });
  expect((await tag.textContent())?.trim()).toContain('200');
}

/** Switch the response Body pane to a picker view by its trailing label.
 *  While Preview holds the selection the picker's FIRST click only takes
 *  it back to the base view without opening the menu (the two-way toggle
 *  law), so a second click may be needed before the menu items exist. */
async function pickResponseView(label: RegExp): Promise<void> {
  const picker = workbench.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  await picker.click();
  const item = workbench
    .locator('.ant-dropdown-menu-item')
    .filter({ hasText: label })
    .filter({ visible: true })
    .first();
  try {
    await item.waitFor({ state: 'visible', timeout: 2000 });
  } catch {
    await picker.click();
    await item.waitFor({ state: 'visible', timeout: 15_000 });
  }
  await item.click();
}

/** Text of the response Body view picker (detected language / view). */
async function responseViewPickerLabel(): Promise<string> {
  const picker = workbench.getByTestId('oh-response-view-picker').filter({ visible: true }).first();
  await picker.waitFor({ state: 'visible', timeout: 15_000 });
  return (await picker.textContent())?.trim() ?? '';
}

/** Read the rendered response body verbatim via the Raw view. */
async function responseRawBody(): Promise<string> {
  await pickResponseView(/Raw$/);
  const body = workbench.getByTestId('oh-response-body').filter({ visible: true });
  await body.waitFor({ state: 'visible', timeout: 15_000 });
  return (await body.innerText()).trim();
}

/** Read the Hex view's dump text — hex pairs + ASCII columns. */
async function responseHexText(): Promise<string> {
  await pickResponseView(/Hex$/);
  const hex = workbench.getByTestId('oh-response-hex').filter({ visible: true });
  await hex.waitFor({ state: 'visible', timeout: 15_000 });
  return (await hex.textContent()) ?? '';
}

/** The response Body pane's Preview toggle — rendered only when the
 *  body previews, so its absence is itself an assertable state. */
function responsePreviewToggle() {
  return workbench.getByRole('button', { name: /Preview$/ }).filter({ visible: true });
}

/** Full-window screenshot for the human half of the live pass. */
async function shot(name: string): Promise<void> {
  await workbench.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await mkdir(SHOT_DIR, { recursive: true });
  const userData = await mkdtemp(path.join(tmpdir(), 'oh-media-e2e-'));
  await writeFile(
    path.join(userData, 'storage.json'),
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
  workbench.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  workbench.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

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

  // MCP handshake: mint a token through the desktop bridge, initialize,
  // then seed the probes via `requests_save` (mints the default
  // collection on first create).
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
    label: 'media-sweep-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);

  const base = { headers: [], params: [], auth: { type: 'none' }, body: { type: 'none' } };
  for (const name of PROBE_REQUESTS) {
    seededUids.set(
      name,
      await seedRequest({ ...base, name: `GET ${name} probe`, method: 'GET', url: PROBE_URL(name) }),
    );
  }

  await showRequestsView();
  await collapseDocsPanel();
  const imageUid = seededUids.get('image') as string;
  await expect
    .poll(
      async () => {
        await openRequest(imageUid).catch(() => {});
        return workbench
          .locator(`[data-item-id="request-${imageUid}"]`)
          .isVisible()
          .catch(() => false);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
});

test.afterAll(async () => {
  await electronApp?.close();
});

test.describe('Response viewer — content-type sweep (desktop workbench)', () => {
  test('PNG opens on the image Preview and the blob decodes under the CSP', async () => {
    await sendProbe('image');
    const img = workbench.getByTestId('oh-response-image-preview').filter({ visible: true });
    await img.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await responsePreviewToggle().count()).toBe(1);

    // Decode proof: a CSP-blocked (or corrupt) blob never gains
    // intrinsic dimensions — visibility alone would pass on a dead img.
    await expect.poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await shot('image-preview');

    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('89 50 4E 47 0D 0A 1A 0A')).toBe(true);
  });

  test('SVG stays a text body (XML grammar) with the image Preview on top', async () => {
    await sendProbe('svg');
    const img = workbench.getByTestId('oh-response-image-preview').filter({ visible: true });
    await img.waitFor({ state: 'visible', timeout: 15_000 });
    await expect.poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await shot('svg-preview');

    await responsePreviewToggle().click();
    expect(await responseViewPickerLabel()).toMatch(/XML$/);
    expect(await responseRawBody()).toContain('<svg xmlns=');
  });

  test('WAV opens on the media Preview and reaches metadata under the CSP', async () => {
    await sendProbe('media');
    const media = workbench.getByTestId('oh-response-media-preview').filter({ visible: true });
    await media.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);

    // HAVE_METADATA (1) or better proves the blob loaded — a media-src
    // CSP block fires the element's error path and never gets there.
    await expect.poll(async () => media.evaluate((el) => (el as HTMLMediaElement).readyState)).toBeGreaterThan(0);
    await shot('media-preview');

    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('52 49 46 46')).toBe(true);
  });

  test('PDF opens on the iframe Preview and the viewer plugin renders it', async () => {
    await sendProbe('pdf');
    const frame = workbench.getByTestId('oh-response-pdf-preview').filter({ visible: true });
    await frame.waitFor({ state: 'visible', timeout: 15_000 });
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);

    // Render proof: Chromium's PDF viewer mounts an <embed> inside the
    // blob frame — an iframe that is merely visible passes on a blank
    // viewer (the `plugins: true` regression shape).
    await workbench
      .frameLocator('[data-testid="oh-response-pdf-preview"]')
      .locator('embed')
      .waitFor({ state: 'attached', timeout: 15_000 });
    // Paint settle for the screenshot artifact — the embed attaches
    // before the viewer rasterizes the first page.
    await workbench.waitForTimeout(1_000);
    await shot('pdf-preview');

    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('25 50 44 46')).toBe(true);
  });

  test('ZIP defaults to Hex with no preview offered', async () => {
    await sendProbe('zip');
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await responsePreviewToggle().count()).toBe(0);

    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('50 4B 03 04')).toBe(true);
  });

  test('gzip defaults to Hex, magic bytes first', async () => {
    await sendProbe('gzip');
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);
    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('1F 8B')).toBe(true);
  });

  test('wasm defaults to Hex, magic bytes first', async () => {
    await sendProbe('wasm');
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);
    const hex = await responseHexText();
    expect(hex.trimStart().startsWith('00 61 73 6D 01 00 00 00')).toBe(true);
  });

  test('CSV renders as plain text with no preview', async () => {
    await sendProbe('csv');
    expect(await responseViewPickerLabel()).toMatch(/Text$/);
    expect(await responsePreviewToggle().count()).toBe(0);
    expect(await responseRawBody()).toContain('1,Echo,api.openheaders.io');
  });

  test('YAML detects its grammar', async () => {
    await sendProbe('yaml');
    expect(await responseViewPickerLabel()).toMatch(/YAML$/);
    expect(await responseRawBody()).toContain('probe: yaml');
  });

  test('NDJSON keeps the json grammar and offers the tree Preview', async () => {
    await sendProbe('ndjson');
    expect(await responseViewPickerLabel()).toMatch(/JSON$/);
    expect(await responsePreviewToggle().count()).toBe(1);
  });

  test('latin-1 text decodes with its declared charset in Raw', async () => {
    await sendProbe('latin1');
    expect(await responseViewPickerLabel()).toMatch(/Hex$/);
    expect(await responseRawBody()).toContain('café au lait à volonté');
  });

  test('no CSP violations surfaced in the workbench console', async () => {
    const cspErrors = consoleErrors.filter((e) => /Content Security Policy/i.test(e));
    expect(cspErrors).toEqual([]);
  });
});
