/**
 * Settings inheritance on the desktop host — the per-kind cascade
 * driven through the built app's shared workbench UI over a seeded
 * tree (`Payments › Cards › Refunds › Charge`, `Live` under Cards,
 * `Ping` at the root, a transparent `Other`), the moves the sidebar
 * allows, and the wire the sends hit:
 *
 *   S1  the collection's Settings section: the seeded HTTP slice reads
 *       under HTTP, the WebSocket slice under WebSocket, and a knob
 *       edited under one sub-tab dots that sub-tab alone; Save persists
 *       the kind's slice (the export's per-kind record);
 *   S2  a folder reads the collection's value as its placeholder with
 *       the inherited line; its own value turns the line into the
 *       overrides reading; Save persists it and the folder's mirror
 *       carries it back into the editor (the S5 finding: the folder
 *       slot used to drop every ancestor field);
 *   S3  a request two levels down inherits from the nearest folder
 *       with the chain (i) listing every level; its own value overrides
 *       the folder and names the shadowed value; Save persists;
 *   S4  a WebSocket request under the same chain reads the WebSocket
 *       slice alone — the HTTP TLS floor never reaches it;
 *   S5  a folder dragged into another collection takes its request out
 *       of the chain: nothing inherited, the own value kept; a knob set
 *       on the new collection afterwards reaches the moved request;
 *   S6  Send under the new collection: the meta strip's "Inherited
 *       settings" tag names the knob and its level;
 *   S7  the request dragged back under the old folder reads the old
 *       chain again; reset-to-inherit persists as an absent knob.
 *
 * Reads are the editors' rows and lines, the sidebar's document order
 * and a workspace export parsed by the REAL codec. Requires
 * `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { type Rig, startHttpRig } from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SEED_SCRIPT = path.join(__dirname, 'fixtures/settings-inheritance-desktop-seed.ts');
// Port etiquette: off every prior suite's ports (…, 20037).
const DAEMON_PORT = 20137;

// The seed's fixed uids (`fixtures/settings-inheritance-desktop-seed.ts`).
const SEED = {
  payments: 'e2esicol',
  other: 'e2esioth',
  cards: 'e2esifca',
  refunds: 'e2esifre',
  charge: 'e2esirch',
  ping: 'e2esirpg',
  live: 'e2esiwsl',
} as const;

const PAYMENTS = `req-col-${SEED.payments}`;
const OTHER = `req-col-${SEED.other}`;
const CARDS = `req-folder-${SEED.cards}`;
const REFUNDS = `req-folder-${SEED.refunds}`;
const CHARGE = `request-${SEED.charge}`;
const LIVE = `websocket-request-${SEED.live}`;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;
let httpRig: Rig;

interface ExportEnvelope {
  entities: {
    collections: Array<{ uid: string; settings?: Record<string, Record<string, unknown>> }>;
    folders: Array<{ uid: string; settings?: Record<string, Record<string, unknown>> }>;
    requests: Array<{ uid: string; tlsMinVersion?: string; timeoutMs?: number }>;
  };
}

// ── app helpers ─────────────────────────────────────────────────────

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();
  workbench.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[renderer:${msg.type()}] ${msg.text()}`);
  });
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
}

async function quit(): Promise<void> {
  await electronApp
    .evaluate(({ app }) => {
      app.quit();
    })
    .catch(() => undefined);
  await electronApp.close().catch(() => undefined);
}

/** Run the tsx seed/parse helper (core schemas are TS source the Playwright loader cannot resolve). */
function helper(args: string[], input?: string, env: Record<string, string> = {}): string {
  const result = spawnSync('pnpm', ['--filter', '@openheaders/extension', 'exec', 'tsx', SEED_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    input,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

async function exportOf(): Promise<ExportEnvelope> {
  const res = await invoke<{ success: boolean; yaml?: string; error?: string }>({
    type: 'exportWorkspace',
    scope: { kind: 'workspace' },
  });
  expect(res.success, res.error).toBe(true);
  return JSON.parse(helper(['parse'], res.yaml ?? '')) as ExportEnvelope;
}

/** The API Requests sidebar with the seeded collections visible. */
async function openApiRequestsSidebar(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected').catch(() => null)) === 'true') await docsTab.click();
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') await viewTab.click();
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 15_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') await sectionHeader.click();
  await workbench.locator(`[data-item-id="${PAYMENTS}"]`).waitFor({ state: 'visible', timeout: 15_000 });
}

// ── tree rows (the tree-order spec's gestures) ──────────────────────

const row = (id: string): Locator => workbench.locator(`[data-item-id="${id}"]`);

async function order(): Promise<string[]> {
  return workbench
    .locator('[data-item-id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id') ?? ''));
}

async function orderOf(ids: readonly string[]): Promise<string[]> {
  return (await order()).filter((id) => ids.includes(id));
}

async function expandIfCollapsed(id: string): Promise<void> {
  const target = row(id);
  await target.waitFor({ state: 'visible', timeout: 10_000 });
  const caret = target.locator('.rules-sidebar-item-caret .anticon');
  const expanded = await caret
    .evaluate((el) => (el as HTMLElement).style.transform.includes('90deg'))
    .catch(() => false);
  if (!expanded) await target.click();
}

async function drag(source: Locator, target: Locator, band: number): Promise<void> {
  await source.hover();
  const from = (await source.boundingBox())!;
  await workbench.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await workbench.mouse.down();
  await workbench.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  const to = (await target.boundingBox())!;
  await workbench.mouse.move(to.x + to.width / 2, to.y + to.height * band, { steps: 8 });
  await workbench.waitForTimeout(150);
  const settled = (await target.boundingBox())!;
  await workbench.mouse.move(settled.x + settled.width / 2 + 1, settled.y + settled.height * band, { steps: 3 });
  await workbench.mouse.up();
}

async function expectMovedToast(count: number): Promise<void> {
  const text = count === 1 ? '1 item moved' : `${count} items moved`;
  await expect(workbench.locator('.ant-message-notice-title', { hasText: text }).last()).toBeVisible({
    timeout: 5000,
  });
}

// ── editors (the shared UI's selectors; visible-scoped — background
//    tabs stay mounted) ───────────────────────────────────────────────

const visible = (locator: Locator): Locator => locator.filter({ visible: true }).first();

/** A container row's click opens its editor (and toggles its caret). */
async function openContainerSettings(id: string, kind: 'http' | 'websocket'): Promise<void> {
  await row(id).click();
  await visible(workbench.getByRole('tab', { name: /Settings/ })).click();
  await visible(workbench.getByTestId(`oh-container-settings-kind-${kind}`)).click();
}

async function openRequestSettings(id: string): Promise<void> {
  await row(id).waitFor({ state: 'visible', timeout: 10_000 });
  await row(id).click();
  await visible(workbench.getByRole('tab', { name: 'Settings' })).click();
}

const saveButton = (): Locator => visible(workbench.locator('button').filter({ hasText: /^Save$/ }));
const savedButton = (): Locator => visible(workbench.locator('button').filter({ hasText: /^Saved$/ }));

async function save(): Promise<void> {
  await saveButton().click();
  await savedButton().waitFor({ state: 'visible', timeout: 10_000 });
}

/** The inherited / overrides line under a knob's row. */
const note = (key: string): Locator =>
  visible(workbench.locator(`[data-testid="oh-inherited-setting-note"][data-key="${key}"]`));

async function noteText(key: string): Promise<string> {
  return ((await note(key).textContent()) ?? '').trim();
}

/** The visible select root behind a row's test id — antd may stamp
 *  the id on the inner (opacity-0) input, so the visibility filter
 *  applies to the root, and the value / placeholder spans are read
 *  under it. */
const tlsMinRoot = (prefix: string): Locator =>
  workbench
    .getByTestId(`${prefix}-tls-min`)
    .locator('xpath=ancestor-or-self::*[contains(concat(" ", normalize-space(@class), " "), " ant-select ")][1]')
    .filter({ visible: true })
    .first();

/** Pick a TLS version in a select row — the real dropdown. */
async function pickTlsMin(prefix: string, version: string): Promise<void> {
  await tlsMinRoot(prefix).click();
  const option = visible(workbench.locator(`.ant-select-item-option[title="${version}"]`));
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

/** The select's content cell — it carries the value as its title
 *  (`ant-select-content-has-value`) or shows the placeholder text. */
const tlsMinContent = (prefix: string): Locator => tlsMinRoot(prefix).locator('.ant-select-content');

/** The select row's shown value ('' while it shows a placeholder). */
async function tlsMinValue(prefix: string): Promise<string> {
  const content = tlsMinContent(prefix);
  await content.waitFor({ state: 'visible', timeout: 10_000 });
  const classes = (await content.getAttribute('class')) ?? '';
  if (!classes.includes('ant-select-content-has-value')) return '';
  return ((await content.getAttribute('title')) ?? (await content.textContent()) ?? '').trim();
}

async function tlsMinPlaceholder(prefix: string): Promise<string> {
  const content = tlsMinContent(prefix);
  await content.waitFor({ state: 'visible', timeout: 10_000 });
  const classes = (await content.getAttribute('class')) ?? '';
  if (classes.includes('ant-select-content-has-value')) return '';
  return ((await content.textContent()) ?? '').trim();
}

const timeoutCombo = (label: string): Locator => visible(workbench.getByRole('combobox', { name: label }));

async function typeTimeout(label: string, text: string): Promise<void> {
  const combo = timeoutCombo(label);
  await combo.click();
  await combo.fill(text);
  await combo.press('Tab');
}

const unsavedDotOn = (kind: string): Locator =>
  workbench
    .getByTestId(`oh-container-settings-kind-${kind}`)
    .filter({ visible: true })
    .getByTestId('oh-section-unsaved');

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  httpRig = await startHttpRig();
  const root = await mkdtemp(path.join(tmpdir(), 'oh-settings-inheritance-desktop-e2e-'));
  userData = path.join(root, 'user-data');
  mkdirSync(userData);
  mkdirSync(path.join(userData, 'data'));
  writeFileSync(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await quit();

  const seeded = helper(['seed'], undefined, {
    OH_E2E_WORKSPACE_ID: workspaceId,
    OH_E2E_REQUEST_URL: `http://127.0.0.1:${httpRig.port}/echo`,
  });
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(readFileSync(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded) as Record<string, unknown>);
  writeFileSync(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots.
  await launchApp();
  await openApiRequestsSidebar();
});

test.afterAll(async () => {
  if (electronApp) await quit();
  await httpRig?.close();
});

test('S1 — the collection section reads each kind’s slice under its sub-tab; an edit dots its kind alone; Save persists the slice', async () => {
  await openContainerSettings(PAYMENTS, 'http');
  expect(await tlsMinValue('request')).toBe('1.3');
  await expect(timeoutCombo('Request timeout')).toHaveValue('30 s');
  await expect(workbench.getByTestId('oh-inherited-setting-note').filter({ visible: true })).toHaveCount(0);

  await visible(workbench.getByTestId('oh-container-settings-kind-websocket')).click();
  await expect(timeoutCombo('Connect timeout')).toHaveValue('5 s');
  expect(await tlsMinValue('websocket')).toBe('');

  await visible(workbench.getByTestId('oh-container-settings-kind-http')).click();
  await typeTimeout('Request timeout', '20s');
  await expect(timeoutCombo('Request timeout')).toHaveValue('20 s');
  await expect(unsavedDotOn('http')).toHaveCount(1);
  await expect(unsavedDotOn('websocket')).toHaveCount(0);
  await save();

  const exported = await exportOf();
  const payments = exported.entities.collections.find((c) => c.uid === SEED.payments);
  expect(payments?.settings).toEqual({
    http: { tlsMinVersion: '1.3', timeoutMs: 20_000 },
    websocket: { timeoutMs: 5_000 },
  });
});

test('S2 — a folder reads the collection’s value with the inherited line; its own value overrides with the shadowed value; Save persists and the mirror carries it back', async () => {
  await expandIfCollapsed(PAYMENTS);
  await openContainerSettings(CARDS, 'http');
  expect(await tlsMinValue('request')).toBe('');
  expect(await tlsMinPlaceholder('request')).toBe('1.3');
  expect(await noteText('tlsMinVersion')).toContain('Inherited from Collection ‘Payments’');
  await expect(note('tlsMinVersion')).toHaveAttribute('data-reading', 'inherited');
  await expect(note('tlsMinVersion').getByTestId('oh-inherited-setting-chain')).toHaveCount(0);

  await pickTlsMin('request', '1.2');
  expect(await tlsMinValue('request')).toBe('1.2');
  await expect(note('tlsMinVersion')).toHaveAttribute('data-reading', 'overrides');
  expect(await noteText('tlsMinVersion')).toContain('Overrides Collection ‘Payments’ (1.3)');
  await save();

  const exported = await exportOf();
  const cards = exported.entities.folders.find((f) => f.uid === SEED.cards);
  expect(cards?.settings).toEqual({ http: { tlsMinVersion: '1.2' } });

  // Away and back: the folder's mirror carries the knob into the editor
  // (a container row's click toggles its caret too — re-expand first).
  await openContainerSettings(PAYMENTS, 'http');
  await expandIfCollapsed(PAYMENTS);
  await openContainerSettings(CARDS, 'http');
  expect(await tlsMinValue('request')).toBe('1.2');
  expect(await noteText('tlsMinVersion')).toContain('Overrides Collection ‘Payments’ (1.3)');
  await savedButton().waitFor({ state: 'visible', timeout: 5_000 });
});

test('S3 — a request two levels down inherits from the nearest folder with the chain; its own value overrides the folder; Save persists', async () => {
  await expandIfCollapsed(CARDS);
  await expandIfCollapsed(REFUNDS);
  await openRequestSettings(CHARGE);
  expect(await tlsMinPlaceholder('request')).toBe('1.2');
  expect(await noteText('tlsMinVersion')).toContain('Inherited from Folder ‘Cards’');
  await expect(note('tlsMinVersion').getByTestId('oh-inherited-setting-chain')).toHaveCount(1);
  await expect(timeoutCombo('Request timeout')).toHaveValue('');
  expect(await noteText('timeoutMs')).toContain('Inherited from Collection ‘Payments’');

  // The chain (i): every level's value, outermost first.
  await note('tlsMinVersion').getByRole('button', { name: 'About Where this setting is set' }).click();
  const popover = visible(workbench.locator('.ant-popover'));
  await popover.waitFor({ state: 'visible', timeout: 10_000 });
  const text = (await popover.textContent()) ?? '';
  expect(text).toContain('Collection ‘Payments’');
  expect(text).toContain('1.3');
  expect(text).toContain('Folder ‘Cards’');
  expect(text).toContain('1.2');
  expect(text.indexOf('Collection ‘Payments’')).toBeLessThan(text.indexOf('Folder ‘Cards’'));
  await workbench.keyboard.press('Escape');

  await pickTlsMin('request', '1.1');
  await expect(note('tlsMinVersion')).toHaveAttribute('data-reading', 'overrides');
  expect(await noteText('tlsMinVersion')).toContain('Overrides Folder ‘Cards’ (1.2)');
  await save();

  const exported = await exportOf();
  const charge = exported.entities.requests.find((r) => r.uid === SEED.charge);
  expect(charge?.tlsMinVersion).toBe('1.1');
  expect(charge?.timeoutMs).toBeUndefined();
});

test('S4 — a WebSocket request under the chain reads the WebSocket slice alone', async () => {
  await openRequestSettings(LIVE);
  await expect(timeoutCombo('Connect timeout')).toHaveValue('');
  expect(await noteText('timeoutMs')).toContain('Inherited from Collection ‘Payments’');
  await expect(
    workbench.locator('[data-testid="oh-inherited-setting-note"][data-key="tlsMinVersion"]').filter({ visible: true }),
  ).toHaveCount(0);
  expect(await tlsMinPlaceholder('websocket')).not.toBe('1.2');
});

test('S5 — a folder dragged into another collection takes its request out of the chain; a knob set on the new collection reaches it', async () => {
  await expandIfCollapsed(PAYMENTS);
  await expandIfCollapsed(CARDS);
  await drag(row(REFUNDS), row(OTHER), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expandIfCollapsed(OTHER);
  await expandIfCollapsed(REFUNDS);
  await expect.poll(() => orderOf([OTHER, REFUNDS, CHARGE])).toEqual([OTHER, REFUNDS, CHARGE]);

  await openRequestSettings(CHARGE);
  expect(await tlsMinValue('request')).toBe('1.1');
  await expect(workbench.getByTestId('oh-inherited-setting-note').filter({ visible: true })).toHaveCount(0);

  await openContainerSettings(OTHER, 'http');
  await typeTimeout('Request timeout', '10s');
  await save();

  await expandIfCollapsed(OTHER);
  await expandIfCollapsed(REFUNDS);
  await openRequestSettings(CHARGE);
  await expect(timeoutCombo('Request timeout')).toHaveValue('');
  expect(await noteText('timeoutMs')).toContain('Inherited from Collection ‘Other’');
  await expect(workbench.getByTestId('oh-inherited-setting-note').filter({ visible: true })).toHaveCount(1);
});

test('S6 — Send under the new collection: the meta strip attributes the inherited knob to its level', async () => {
  await openRequestSettings(CHARGE);
  await visible(workbench.getByRole('button', { name: /Send$/ })).click();
  const status = visible(workbench.getByTestId('oh-response-status'));
  await expect
    .poll(async () => (await status.textContent().catch(() => '')) ?? '', { timeout: 45_000 })
    .toContain('200');
  const tag = visible(workbench.getByTestId('oh-response-inherited-settings'));
  await expect(tag).toHaveText('Inherited settings · 1');
  await tag.hover();
  const popover = visible(workbench.locator('.ant-popover'));
  await popover.waitFor({ state: 'visible', timeout: 10_000 });
  const text = (await popover.textContent()) ?? '';
  expect(text).toContain('Request timeout');
  expect(text).toContain('Collection ‘Other’');
  await workbench.mouse.move(0, 0);
});

test('S7 — the request dragged back under the old folder reads the old chain; reset-to-inherit persists as an absent knob', async () => {
  await expandIfCollapsed(OTHER);
  await expandIfCollapsed(REFUNDS);
  await expandIfCollapsed(PAYMENTS);
  await drag(row(CHARGE), row(CARDS), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expandIfCollapsed(CARDS);
  await expect.poll(() => orderOf([PAYMENTS, CARDS, CHARGE, OTHER])).toEqual([PAYMENTS, CARDS, CHARGE, OTHER]);

  await openRequestSettings(CHARGE);
  expect(await noteText('tlsMinVersion')).toContain('Overrides Folder ‘Cards’ (1.2)');
  expect(await noteText('timeoutMs')).toContain('Inherited from Collection ‘Payments’');
  await expect(timeoutCombo('Request timeout')).toHaveValue('');

  await visible(workbench.getByRole('button', { name: 'Reset TLS version minimum to default' })).click();
  expect(await tlsMinValue('request')).toBe('');
  expect(await tlsMinPlaceholder('request')).toBe('1.2');
  await expect(note('tlsMinVersion')).toHaveAttribute('data-reading', 'inherited');
  await expect(note('tlsMinVersion').getByTestId('oh-inherited-setting-chain')).toHaveCount(1);
  await save();

  const exported = await exportOf();
  const charge = exported.entities.requests.find((r) => r.uid === SEED.charge);
  expect(charge?.tlsMinVersion).toBeUndefined();
});
