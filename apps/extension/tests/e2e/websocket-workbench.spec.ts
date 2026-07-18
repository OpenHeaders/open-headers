/**
 * WebSocket workbench entity/editor legs — the deferred Phase B gate
 * on the standalone extension workbench: real Chromium with the built
 * extension, no daemon, no probe. The session plane is a node-host
 * capability, so this spec proves the ENTITY lifecycle and the honest
 * browser posture:
 *
 *   B1  context-create raw: the collection `+` menu's "Add WebSocket
 *       Request" mints a persisted entity, the primed breadcrumb
 *       rename commits a name (the create-gesture rename law — the
 *       websocket-edit mode rides the same StatusBar rename gate as
 *       its siblings), the sidebar leaf carries the WS tag, and
 *       Connect is PRESENT and DISABLED with the desktop-app tooltip
 *       copy (the CTA-scaffold posture — never a hidden button).
 *   B2  edit → Save → reload → reopen: url, compose message and a
 *       subprotocol tag persist through a full page reload.
 *   B3  context-create socketio: the sibling menu entry pre-sets the
 *       flavor — SIO sidebar tag, Socket.IO editor flavor tag, and
 *       the same honest disabled Connect.
 *   B4  AsyncAPI binding: a spec created from the SPECS `+` menu's
 *       AsyncAPI 3.0 scaffold binds through the editor's spec picker,
 *       the footer names the link, and the specLink persists.
 *
 * Deliberately NOT here: any live session leg — Connect/Send/close
 * capture run on node hosts and are the desktop rig's legs
 * (`websocket-desktop.spec.ts`).
 *
 * Requires the extension `dist/chrome` build.
 *
 * Seeding: onboarding rides a popup PAGE evaluate (never
 * serviceWorker.evaluate); the collection rides the real CRUD RPC from
 * the workbench page realm. The entities themselves are created
 * through the UI — the creation gesture IS the leg.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const CONNECT_DISABLED_COPY = 'WebSocket sessions run on the desktop app or daemon.';
// Context-create persists immediately under the flavor's default name
// (the born-clean gRPC posture) and primes the breadcrumb rename —
// committing these names proves the rename gate end to end.
const RAW_NAME = 'Probe WS';
const SIO_NAME = 'Probe SIO';
const SPEC_NAME = 'Streams AsyncAPI';
const WS_URL = 'wss://ws.openheaders.io/live';
const WS_MESSAGE = 'ping from e2e';
const WS_SUBPROTOCOL = 'graphql-ws';

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let collectionUid: string;

function connectButton() {
  return page.getByTestId('websocket-connect-button').filter({ visible: true }).first();
}

function urlInput() {
  return page.getByTestId('websocket-url-input').filter({ visible: true }).first();
}

/** The collection row's hover-revealed `+` (create-only) menu icon. */
async function openCollectionAddMenu(): Promise<void> {
  const row = page.locator(`[data-item-id="req-col-${collectionUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.hover();
  await row.locator('.rules-sidebar-collection-actions .anticon-plus').first().click();
}

async function clickAddMenuItem(label: string): Promise<void> {
  await page.locator('.ant-dropdown').filter({ visible: true }).getByRole('menuitem', { name: label }).first().click();
}

/** Commit the create gesture's primed breadcrumb rename: wait until
 *  the auto-focused input holds the default label (its text arrives
 *  selected), replace it, Enter. */
async function commitAutoRename(defaultLabel: RegExp, name: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.activeElement;
          return el instanceof HTMLInputElement ? el.value : '';
        }),
      { timeout: 10000 },
    )
    .toMatch(defaultLabel);
  await page.keyboard.insertText(name);
  await page.keyboard.press('Enter');
}

/** The sidebar leaf for a websocket request by its display name —
 *  expands the suite collection first when a reload collapsed it. A
 *  committed rename lands async, so the missing NAME alone never
 *  triggers the expand click (on an expanded collection that click
 *  would toggle it closed): only a sidebar with no websocket leaf at
 *  all warrants expanding. */
async function websocketRow(name: string) {
  const row = page
    .locator('[data-item-id^="websocket-request-"]')
    .filter({ hasText: name })
    .filter({ visible: true })
    .first();
  const visibleNow = await row.waitFor({ state: 'visible', timeout: 3000 }).then(
    () => true,
    () => false,
  );
  if (!visibleNow) {
    const anyLeaf = await page.locator('[data-item-id^="websocket-request-"]').filter({ visible: true }).count();
    if (anyLeaf === 0) {
      await page.locator(`[data-item-id="req-col-${collectionUid}"]`).click();
    }
    await row.waitFor({ state: 'visible', timeout: 10000 });
  }
  return row;
}

async function openWebsocketRequest(name: string): Promise<void> {
  await (await websocketRow(name)).click();
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
}

/** Assert the honest browser posture: Connect visible, disabled, and
 *  its tooltip carrying the desktop-app copy. */
async function expectConnectDisabledHonestly(): Promise<void> {
  const button = connectButton();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await expect(button).toBeDisabled();
  // Park first so the hover always lands as a fresh mouseenter.
  await page.mouse.move(0, 0);
  await button.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(CONNECT_DISABLED_COPY)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.mouse.move(0, 0);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  // Onboarding gate — popup PAGE evaluate (the seeding law).
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );
  await popup.close();

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // The suite collection through the real CRUD RPC (page realm).
  const created = await workbench.rpc<{ success: boolean; collection?: { uid: string }; error?: string }>(
    'createLocalRequestCollection',
    { name: 'WS Suite' },
  );
  expect(created.success, created.error).toBe(true);
  collectionUid = created.collection!.uid;

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
});

test.afterAll(async () => {
  await context.close();
});

// ── B1: context-create raw + the honest disabled Connect ───────────

test('the collection + menu creates a raw WebSocket request with Connect honestly disabled', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('Add WebSocket Request');
  await commitAutoRename(/^New WebSocket Request/, RAW_NAME);

  // The renamed entity lands as a sidebar leaf carrying the WS tag.
  const row = await websocketRow(RAW_NAME);
  await expect(row.getByText('WS', { exact: true }).first()).toBeVisible();

  // The editor is open on the fresh entity — empty-state session pane
  // attached, Connect present but disabled with the honest copy.
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('ws-session-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await expectConnectDisabledHonestly();
});

// ── B2: edit → Save → reload → persisted ────────────────────────────

test('url, message and subprotocols survive Save + reload + reopen', async () => {
  await urlInput().fill(WS_URL);
  // The Message tab is the default-active compose surface.
  await workbench.fillMonaco(0, WS_MESSAGE);
  // Subprotocols live on the Settings tab (a tags Select — type + Enter).
  await page.getByRole('tab', { name: 'Settings' }).filter({ visible: true }).first().click();
  await page.getByTestId('websocket-subprotocols').filter({ visible: true }).first().click();
  await page.keyboard.insertText(WS_SUBPROTOCOL);
  await page.keyboard.press('Enter');

  // A filled URL still keeps Connect disabled on a browser host — the
  // runtime gate outranks the needs-url gate.
  await expectConnectDisabledHonestly();

  await page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
  await page
    .getByRole('button', { name: /Saved$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
  await openWebsocketRequest(RAW_NAME);

  await expect(urlInput()).toHaveValue(WS_URL);
  expect(await workbench.monacoText(0)).toContain(WS_MESSAGE);
  await page.getByRole('tab', { name: 'Settings' }).filter({ visible: true }).first().click();
  await expect(
    page.getByTestId('websocket-subprotocols').filter({ visible: true }).first().locator('.ant-select-selection-item'),
  ).toHaveText(WS_SUBPROTOCOL);
});

// ── B3: context-create socketio ─────────────────────────────────────

test('the sibling menu entry creates a Socket.IO-flavored request', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('Add Socket.IO Request');
  await commitAutoRename(/^New Socket\.IO Request/, SIO_NAME);

  const row = await websocketRow(SIO_NAME);
  await expect(row.getByText('SIO', { exact: true }).first()).toBeVisible();

  // The editor header names the flavor; Connect stays honestly disabled.
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await expect(page.getByText('Socket.IO', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expectConnectDisabledHonestly();
});

// ── B4: AsyncAPI spec binding persists ──────────────────────────────

test('an AsyncAPI spec binds through the picker and the specLink persists', async () => {
  // Mint the spec from the SPECS section's format menu (AsyncAPI 3.0
  // scaffold), naming it through the same primed rename (the spec-edit
  // mode rides the same StatusBar rename gate).
  await page.getByTestId('sidebar-create-spec').click();
  await page
    .locator('.ant-dropdown')
    .filter({ visible: true })
    .getByRole('menuitem', { name: 'AsyncAPI 3.0' })
    .first()
    .click();
  await commitAutoRename(/^New Specification/, SPEC_NAME);

  await openWebsocketRequest(RAW_NAME);
  // Exact: the substring would also match the "Streams AsyncAPI"
  // DOCUMENT tab and switch documents instead of editor tabs.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('websocket-spec-select').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: SPEC_NAME })
    .first()
    .click();
  await expect(page.getByText(`Using ${SPEC_NAME}`).filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
  await page
    .getByRole('button', { name: /Saved$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
  await openWebsocketRequest(RAW_NAME);
  // Exact: the substring would also match the "Streams AsyncAPI"
  // DOCUMENT tab and switch documents instead of editor tabs.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  // Read the select's own text — a single-mode Select renders its
  // value in `.ant-select-content` (no selection-item element).
  await expect(page.getByTestId('websocket-spec-select').filter({ visible: true }).first()).toContainText(SPEC_NAME);
});
