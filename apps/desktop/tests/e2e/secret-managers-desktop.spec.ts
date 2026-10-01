/**
 * Secret managers on the desktop host (the Secret Providers plan, S3):
 *
 *   L1  Settings › Secret Managers › Connections — add a connection,
 *       the status cell, Test (the companion app's own prompt when its
 *       approval window has lapsed), edit keeps the uid;
 *   L2  the Vault row of kind Secret Manager — provider → connection →
 *       path, the reference line, the chip before and after the pick,
 *       save, the Vault note's link and the row's Manage… link;
 *   L3  a Send carrying `{{vault.opToken}}` against a reference the
 *       manager cannot find — the gate names the reference with its
 *       reason — and Copy as cURL, which never prompts and names the
 *       entry for what it is;
 *   L4  a WebSocket session whose handshake header carries
 *       `{{vault.opToken}}` resolves it at Connect (the value read on
 *       the spec's own socket rig, never printed); a rider naming a
 *       second secret-manager row the session never referenced
 *       resolves it through the session's pre-pass and rides the wire
 *       (P2b); a rider naming a row whose field the manager lacks
 *       reads the gate's typed reason; a rider naming the Connect-time
 *       row rides the wire.
 *
 * OH_LOOK_ACCOUNT names the companion app's account (as its sidebar
 * shows it); without it a bogus account exercises the refusal shapes.
 * OH_LOOK_DIR receives a screenshot per step. OH_LOOK_APP points at a
 * packaged app's executable for the packaged pass. Requires
 * `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import http from 'node:http';
import type net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { WebSocketServer } from 'ws';

/** An echo that remembers the Authorization header of its last request —
 *  the wire read, so the resolved value is checked and never printed. */
interface EchoRig {
  port: number;
  lastAuthorization: () => string | undefined;
  close: () => Promise<void>;
}

async function startEchoRig(): Promise<EchoRig> {
  let lastAuthorization: string | undefined;
  const server = http.createServer((req, res) => {
    lastAuthorization = req.headers.authorization;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ url: req.url ?? '', authorized: typeof req.headers.authorization === 'string' }));
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port));
  });
  return {
    port,
    lastAuthorization: () => lastAuthorization,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** A socket echo that remembers the upgrade's Authorization header and
 *  the last text frame it received — the wire read for the session leg. */
interface SocketRig {
  port: number;
  lastAuthorization: () => string | undefined;
  lastMessage: () => string | undefined;
  close: () => Promise<void>;
}

async function startSocketRig(): Promise<SocketRig> {
  let lastAuthorization: string | undefined;
  let lastMessage: string | undefined;
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  server.on('connection', (socket, req) => {
    lastAuthorization = req.headers.authorization;
    socket.on('message', (data) => {
      lastMessage = data.toString();
      socket.send(`echo:${lastMessage.length}`);
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', reject);
  });
  return {
    port: (server.address() as net.AddressInfo).port,
    lastAuthorization: () => lastAuthorization,
    lastMessage: () => lastMessage,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

const APP_ROOT = path.resolve(__dirname, '../..');
const DAEMON_PORT = 20237;
const LOOK_DIR = process.env.OH_LOOK_DIR ?? path.join(tmpdir(), 'oh-secret-managers-look');
const ACCOUNT = process.env.OH_LOOK_ACCOUNT ?? 'no-such-account-openheaders';
// The vault holding `api.openheaders.io` › `token`; a vault the account
// lacks exercises the not-found shape, one that holds it the wire.
const VAULT_NAME = process.env.OH_LOOK_VAULT ?? 'Engineering';
const REQUEST_UID = 'e2esmreq';
const SOCKET_UID = 'e2esmws1';
const COLLECTION_UID = 'e2esmcol';

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;
let httpRig: EchoRig;
let socketRig: SocketRig;

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

// A PACKAGED app's executable (the Electron 44 packaged pass: the
// prompt's attribution, the dylib under the hardened runtime, the wasm
// from the asar); absent, the built source tree runs under electron.
const PACKAGED_APP = process.env.OH_LOOK_APP;

async function launchApp(): Promise<void> {
  electronApp = await _electron.launch({
    ...(PACKAGED_APP !== undefined ? { executablePath: PACKAGED_APP } : { args: [APP_ROOT] }),
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  const child = electronApp.process();
  console.log(`[look] app pid ${child.pid}`);
  child.stdout?.on('data', (chunk: Buffer) => console.log(`[main:out] ${String(chunk).trimEnd()}`));
  child.stderr?.on('data', (chunk: Buffer) => console.log(`[main:err] ${String(chunk).trimEnd()}`));
  electronApp.on('close', () => console.log('[look] app closed'));
  workbench = await electronApp.firstWindow();
  workbench.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[renderer:${msg.type()}] ${msg.text()}`);
  });
  workbench.on('close', () => console.log('[look] page closed'));
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

const visible = (locator: Locator): Locator => locator.filter({ visible: true }).first();

async function shot(name: string): Promise<void> {
  await workbench.screenshot({ path: path.join(LOOK_DIR, `${name}.png`) });
}

async function settle(): Promise<void> {
  await workbench
    .locator('.settings-modal')
    .evaluate((modal) =>
      Promise.all(modal.getAnimations({ subtree: true }).map((motion) => motion.finished.catch(() => undefined))),
    )
    .catch(() => undefined);
}

async function lastToast(timeout = 10_000): Promise<string> {
  const notice = workbench.locator('.ant-message-notice-title').last();
  await notice.waitFor({ state: 'visible', timeout });
  return (await notice.textContent()) ?? '';
}

async function pickOption(select: Locator, text: string | RegExp): Promise<void> {
  await select.click();
  const dropdown = workbench.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
}

test.beforeAll(async () => {
  test.setTimeout(240_000);
  mkdirSync(LOOK_DIR, { recursive: true });
  httpRig = await startEchoRig();
  socketRig = await startSocketRig();
  const root = await mkdtemp(path.join(tmpdir(), 'oh-secret-managers-look-'));
  userData = path.join(root, 'user-data');
  mkdirSync(userData);
  mkdirSync(path.join(userData, 'data'));
  const storagePath = path.join(userData, 'data', 'settings.json');
  writeFileSync(
    storagePath,
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  workspaceId = res.activeWorkspaceId as string;
  await quit();

  const envelope = JSON.parse(readFileSync(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  const p = `oh.ws.${workspaceId}`;
  envelope.values[`${p}.requestCollections`] = [
    {
      schemaVersion: 5,
      uid: COLLECTION_UID,
      path: `requests/api-${COLLECTION_UID}`,
      name: 'API',
      variables: [],
    },
  ];
  envelope.values[`${p}.requests`] = [
    {
      schemaVersion: 5,
      uid: REQUEST_UID,
      path: `requests/api-${COLLECTION_UID}/echo-${REQUEST_UID}`,
      name: 'Echo',
      method: 'GET',
      url: `http://127.0.0.1:${httpRig.port}/echo`,
      headers: [],
      params: [],
      auth: { type: 'bearer', token: '{{vault.opToken}}' },
      body: { type: 'none' },
    },
  ];
  envelope.values[`${p}.websocketRequests`] = [
    {
      schemaVersion: 5,
      uid: SOCKET_UID,
      path: `requests/api-${COLLECTION_UID}/echo-socket-${SOCKET_UID}`,
      name: 'Echo Socket',
      url: `ws://127.0.0.1:${socketRig.port}/echo`,
      flavor: 'raw',
      subprotocols: [],
      headers: [{ uid: 'e2esmwsh', key: 'Authorization', value: 'Bearer {{vault.opToken}}', enabled: true }],
      params: [],
      // The rider names a second secret-manager row the session never
      // referenced at Connect.
      message: '{{vault.opOther}}',
      messageFormat: 'text',
    },
  ];
  writeFileSync(storagePath, JSON.stringify(envelope));
  await launchApp();
});

test.afterAll(async () => {
  if (electronApp) await quit();
  await httpRig?.close();
  await socketRig?.close();
});

async function openSecretManagersSettings(): Promise<void> {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench.locator('.settings-modal').waitFor({ state: 'visible', timeout: 10_000 });
  await settle();
  await workbench
    .locator('.settings-category-nav')
    .getByRole('button', { name: 'Secret Managers', exact: true })
    .click();
  await shot('00-settings-landing');
  const connections = workbench.getByRole('button', { name: 'Connections', exact: true }).filter({ visible: true });
  if ((await connections.count()) > 0) await connections.first().click();
  await expect(workbench.getByTestId('secret-manager-table')).toBeVisible({ timeout: 10_000 });
}

async function selectToolWindow(id: string): Promise<void> {
  const tab = workbench.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
}

test('L1 — Settings › Secret Managers: add, status, Test, edit keeps the uid', async () => {
  test.setTimeout(300_000);
  await openSecretManagersSettings();
  await expect(workbench.getByTestId('secret-manager-empty')).toBeVisible();
  await shot('01-settings-empty');

  await workbench.getByTestId('secret-manager-add').click();
  await expect(workbench.getByTestId('secret-manager-form')).toBeVisible();
  await shot('02-form-blank');
  await workbench.getByTestId('secret-manager-form-label').fill('Work');
  await workbench.getByTestId('secret-manager-form-account').fill(ACCOUNT);
  await shot('03-form-filled');
  await workbench.getByTestId('secret-manager-form-save').click();
  const row = workbench.getByTestId('secret-manager-row').first();
  await expect(row).toBeVisible();
  await expect.poll(async () => (await row.locator('.ant-tag').count()) > 0, { timeout: 10_000 }).toBe(true);
  console.log(`[look] status after add: ${await row.locator('.ant-tag').first().textContent()}`);
  await shot('04-list-added');

  const listed = await invoke<{ connections: Array<{ uid: string; label: string; config: unknown }> }>({
    type: 'oh.secretManager.list',
  });
  console.log(`[look] list: ${JSON.stringify(listed)}`);
  const uid = listed.connections[0]?.uid;

  await row.getByTestId('secret-manager-test').click();
  // The companion app may prompt here; the wait is the toast, not a timer.
  const toast = await lastToast(240_000);
  console.log(`[look] Test toast: ${toast}`);
  console.log(`[look] probe after Test: ${JSON.stringify(await invoke({ type: 'oh.secretManager.probe', uid }))}`);
  await expect.poll(async () => (await row.locator('.ant-tag').count()) > 0, { timeout: 10_000 }).toBe(true);
  console.log(`[look] status after Test: ${await row.locator('.ant-tag').first().textContent()}`);
  await row.locator('.ant-tag').first().hover();
  await workbench.waitForTimeout(600);
  await shot('05-after-test');
  await workbench.mouse.move(0, 0);

  await row.getByTestId('secret-manager-edit').click();
  await workbench.getByTestId('secret-manager-form-label').fill('Work (renamed)');
  await shot('06-edit-form');
  await workbench.getByTestId('secret-manager-form-save').click();
  await expect(workbench.getByTestId('secret-manager-form')).toHaveCount(0);
  const after = await invoke<{ connections: Array<{ uid: string; label: string }> }>({
    type: 'oh.secretManager.list',
  });
  console.log(`[look] after edit: ${JSON.stringify(after)}`);
  expect(after.connections[0]?.uid).toBe(uid);
  expect(after.connections[0]?.label).toBe('Work (renamed)');
  await shot('07-list-edited');
  await workbench.keyboard.press('Escape');
  await expect(workbench.locator('.settings-modal')).toBeHidden({ timeout: 10_000 });
});

test('L2 — the Vault row: kind, provider, connection, path, reference, chip, save, links', async () => {
  await selectToolWindow('variables');
  await workbench.locator('[data-item-id="vault-row"]').first().click();
  const nameInput = visible(workbench.getByPlaceholder('Add secret…'));
  await nameInput.waitFor({ state: 'visible', timeout: 15_000 });
  await shot('08-vault-empty');
  // The placeholder row's sortable wrapper carries aria-disabled, which
  // the driver reads as a disabled input — focus and type instead.
  await nameInput.evaluate((el) => (el as HTMLInputElement).focus());
  await workbench.keyboard.type('opToken');
  // The typed row is the one enabled kind select reading Text; the new
  // placeholder row's select stays disabled.
  const kindSelect = visible(workbench.locator('.ant-select:not(.ant-select-disabled)').filter({ hasText: 'Text' }));
  await pickOption(kindSelect, 'Secret Manager');
  await expect(visible(workbench.getByTestId('vault-sm-provider'))).toBeVisible();
  await shot('09-vault-row-kind');
  console.log(`[look] chip (no connection): ${await visible(workbench.getByTestId('vault-sm-status')).textContent()}`);
  await pickOption(visible(workbench.getByTestId('vault-sm-connection')), /Work/);
  await visible(workbench.getByTestId('vault-sm-field-vault')).fill(VAULT_NAME);
  await visible(workbench.getByTestId('vault-sm-field-item')).fill('api.openheaders.io');
  await visible(workbench.getByTestId('vault-sm-field-field')).fill('token');
  await expect(visible(workbench.getByTestId('vault-sm-reference'))).toHaveText(
    `op://${VAULT_NAME}/api.openheaders.io/token`,
  );
  await expect
    .poll(async () => workbench.getByTestId('vault-sm-status').filter({ visible: true }).count())
    .toBeGreaterThan(0);
  console.log(
    `[look] chip (connection picked): ${await visible(workbench.getByTestId('vault-sm-status')).textContent()}`,
  );
  await shot('10-vault-row-filled');

  const save = visible(workbench.locator('.rules-editor-header-actions button').filter({ hasText: /^Save/ }));
  await expect(save).toHaveText(/Save$/);
  await save.click();
  await expect(save).toHaveText(/Saved/, { timeout: 10_000 });
  await shot('11-vault-saved');

  const note = visible(workbench.getByTestId('vault-secret-managers-note'));
  await expect(note).toBeVisible();
  console.log(`[look] note: ${await note.textContent()}`);
  await note.getByRole('button').click();
  await workbench.locator('.settings-modal').waitFor({ state: 'visible', timeout: 10_000 });
  await settle();
  await expect(workbench.getByTestId('secret-manager-table')).toBeVisible();
  await shot('12-note-link-settings');
  await workbench.keyboard.press('Escape');
  await expect(workbench.locator('.settings-modal')).toBeHidden({ timeout: 10_000 });

  await visible(workbench.getByTestId('vault-sm-manage')).click();
  await workbench.locator('.settings-modal').waitFor({ state: 'visible', timeout: 10_000 });
  await settle();
  await expect(workbench.getByTestId('secret-manager-table')).toBeVisible();
  await workbench.keyboard.press('Escape');
  await expect(workbench.locator('.settings-modal')).toBeHidden({ timeout: 10_000 });
});

test('L3 — Send carrying the reference reads the gate; Copy as cURL never prompts', async () => {
  await selectToolWindow('api-requests');
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 15_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') await sectionHeader.click();
  const collection = workbench.locator(`[data-item-id="req-col-${COLLECTION_UID}"]`);
  await collection.waitFor({ state: 'visible', timeout: 15_000 });
  const request = workbench.locator(`[data-item-id="request-${REQUEST_UID}"]`);
  if ((await request.count()) === 0) await collection.click();
  await request.waitFor({ state: 'visible', timeout: 10_000 });
  await request.click();
  const send = visible(workbench.getByRole('button', { name: /Send$/ }));
  await send.waitFor({ state: 'visible', timeout: 15_000 });
  await shot('13-request');
  await send.click();
  const error = workbench.getByTestId('oh-response-error').filter({ visible: true });
  const status = workbench.getByTestId('oh-response-status').filter({ visible: true });
  await expect
    .poll(async () => (await error.count()) > 0 || (await status.count()) > 0, { timeout: 90_000 })
    .toBe(true);
  if ((await status.count()) > 0) {
    // The manager holds the item: the value rode the wire as the
    // bearer the echo received — checked on the rig, never printed.
    await expect(status.first()).toContainText('200');
    const authorization = httpRig.lastAuthorization() ?? '';
    console.log(`[look] wire authorization: Bearer <${Math.max(0, authorization.length - 7)} chars>`);
    expect(authorization.startsWith('Bearer ')).toBe(true);
    expect(authorization.length).toBeGreaterThan('Bearer '.length);
    expect(authorization).not.toContain('{{');
  } else {
    // The reference names an item the manager does not hold: the gate
    // names the reference with the manager's reason (an unknown account
    // reads the device's unavailability instead), never the bare line.
    const sendError = (await error.first().textContent()) ?? '';
    console.log(`[look] send error: ${sendError}`);
    const after = await invoke<{ connections: Array<{ uid: string }> }>({ type: 'oh.secretManager.list' });
    const uid = after.connections[0]?.uid;
    console.log(`[look] probe after Send: ${JSON.stringify(await invoke({ type: 'oh.secretManager.probe', uid }))}`);
    expect(sendError).toContain('{{vault.opToken}}:');
    expect(sendError).not.toMatch(/variables\. Define them/);
  }
  await shot('14-send-result');

  await visible(workbench.getByRole('button', { name: 'More actions' })).click();
  await workbench.locator('.ant-dropdown:not(.ant-dropdown-hidden)').getByText('Copy as cURL').click();
  const toast = await lastToast();
  console.log(`[look] curl toast: ${toast}`);
  expect(toast).toContain("{{vault.opToken}}: a secret manager's value is resolved only when sending");
  await shot('15-curl-toast');
});

/** Replace the visible compose editor's buffer — one bulk insert so the
 *  editor's auto-closing can't mangle the braces; Esc dismisses the
 *  suggest widget. */
async function fillComposeEditor(text: string): Promise<void> {
  const editor = workbench.locator('.monaco-editor').filter({ visible: true }).first();
  await editor.click();
  await workbench.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await workbench.keyboard.press('Backspace');
  await workbench.keyboard.insertText(text);
  await workbench.keyboard.press('Escape');
}

/** Add a Vault row of kind Secret Manager on the Work connection,
 *  pointing at the pass's item with the given field, and save. */
async function addSecretManagerRow(name: string, field: string, shotName: string): Promise<void> {
  await selectToolWindow('variables');
  await workbench.locator('[data-item-id="vault-row"]').first().click();
  const nameInput = visible(workbench.getByPlaceholder('Add secret…'));
  await nameInput.waitFor({ state: 'visible', timeout: 15_000 });
  await nameInput.evaluate((el) => (el as HTMLInputElement).focus());
  await workbench.keyboard.type(name);
  const kindSelect = visible(workbench.locator('.ant-select:not(.ant-select-disabled)').filter({ hasText: 'Text' }));
  await pickOption(kindSelect, 'Secret Manager');
  const row = workbench.locator('[data-testid="vault-sm-provider"]').filter({ visible: true }).last();
  await row.waitFor({ state: 'visible' });
  await pickOption(workbench.getByTestId('vault-sm-connection').filter({ visible: true }).last(), /Work/);
  await workbench.getByTestId('vault-sm-field-vault').filter({ visible: true }).last().fill(VAULT_NAME);
  await workbench.getByTestId('vault-sm-field-item').filter({ visible: true }).last().fill('api.openheaders.io');
  await workbench.getByTestId('vault-sm-field-field').filter({ visible: true }).last().fill(field);
  const save = visible(workbench.locator('.rules-editor-header-actions button').filter({ hasText: /^Save/ }));
  await save.click();
  await expect(save).toHaveText(/Saved/, { timeout: 10_000 });
  await shot(shotName);
}

test("L4 — a WebSocket Connect resolves the header; riders resolve through the session's pre-pass and read the gate's reason", async () => {
  test.setTimeout(300_000);
  // A second secret-manager row the session never references at
  // Connect — the first rider's target, the same field the handshake
  // resolved, so the pre-pass's answer is checked against the
  // handshake's. A third row names a field the manager lacks — the
  // refused rider's target.
  await addSecretManagerRow('opOther', 'token', '16-vault-second-row');
  await addSecretManagerRow('opMissing', 'no-such-field', '16b-vault-third-row');

  await selectToolWindow('api-requests');
  const socket = workbench.locator(`[data-item-id="websocket-request-${SOCKET_UID}"]`);
  if ((await socket.count()) === 0) await workbench.locator(`[data-item-id="req-col-${COLLECTION_UID}"]`).click();
  await socket.waitFor({ state: 'visible', timeout: 10_000 });
  await socket.click();
  const connect = workbench.getByTestId('websocket-connect-button').filter({ visible: true }).first();
  await connect.waitFor({ state: 'visible', timeout: 15_000 });
  await shot('17-socket-request');
  await connect.click();
  // The manager may prompt at Connect; the badge or the error row is the listener.
  const badge = workbench
    .getByTestId('ws-session-live-badge')
    .filter({ visible: true })
    .filter({ hasText: 'Connected' });
  const errorDetail = workbench.getByTestId('ws-session-error-detail').filter({ visible: true });
  await expect
    .poll(async () => (await badge.count()) > 0 || (await errorDetail.count()) > 0, { timeout: 240_000 })
    .toBe(true);
  if ((await errorDetail.count()) > 0) console.log(`[look] connect error: ${await errorDetail.first().textContent()}`);
  await shot('18-socket-connected');
  expect(await badge.count()).toBeGreaterThan(0);
  const authorization = socketRig.lastAuthorization() ?? '';
  console.log(`[look] socket authorization: Bearer <${Math.max(0, authorization.length - 7)} chars>`);
  expect(authorization.startsWith('Bearer ')).toBe(true);
  expect(authorization.length).toBeGreaterThan('Bearer '.length);
  expect(authorization).not.toContain('{{');

  const token = authorization.slice('Bearer '.length);
  const echoRows = () =>
    workbench
      .getByTestId('ws-timeline-message-row')
      .filter({ visible: true })
      .filter({ hasText: `echo:${token.length}` })
      .count();

  // The rider naming the unreferenced row: the session's pre-pass asks
  // the manager for it now (its prompt may stand — the rig's message is
  // the listener), and the rider rides the wire with the same value
  // the handshake carried.
  const send = workbench.getByTestId('websocket-send-message').filter({ visible: true }).first();
  await expect(send).toBeEnabled();
  await send.click();
  await expect.poll(async () => socketRig.lastMessage() !== undefined, { timeout: 240_000 }).toBe(true);
  const prepared = socketRig.lastMessage() ?? '';
  console.log(`[look] rider through the pre-pass on the wire: <${prepared.length} chars>`);
  expect(prepared).toBe(token);
  await expect.poll(echoRows, { timeout: 10_000 }).toBe(1);
  await shot('19-rider-prepass');

  // The rider naming the row whose field the manager lacks: the gate
  // names the reference with the manager's own reason.
  await fillComposeEditor('{{vault.opMissing}}');
  await send.click();
  const riderToast = await lastToast(60_000);
  console.log(`[look] rider toast: ${riderToast}`);
  expect(riderToast).toContain('Message has unresolved variables.');
  expect(riderToast).toContain('{{vault.opMissing}}: The secret manager could not find a secret at this reference.');
  await expect.poll(echoRows).toBe(1);
  await shot('20-rider-refused');

  // The rider naming the Connect-time row rides the wire — the rig
  // receives the value the handshake carried.
  await fillComposeEditor('{{vault.opToken}}');
  await send.click();
  await expect.poll(echoRows, { timeout: 10_000 }).toBe(2);
  const received = socketRig.lastMessage() ?? '';
  console.log(`[look] rider on the wire: <${received.length} chars>`);
  expect(received).toBe(token);
  await shot('21-rider-sent');
  await connect.filter({ hasText: 'Disconnect' }).click();
});
