/**
 * MQTT workbench legs — the Phase B entity/editor gate on the
 * standalone extension workbench: real Chromium with the built
 * extension, no daemon. Entity/editor scope ONLY (the
 * websocket-workbench B1–B4 recipe): the session legs live on the
 * desktop rig (`mqtt-desktop.spec.ts`), and unlike the WS editor there
 * is NO page-session capability yet — Phase D mints it — so Connect is
 * PRESENT but disabled with the browser-host copy on every request,
 * URL or not.
 *
 *   E1  context-create: the collection `+` menu's "Add MQTT Request"
 *       mints a persisted entity, the primed breadcrumb rename commits
 *       a name (the create-gesture rename law — the mqtt-edit mode
 *       rides the same StatusBar rename gate as its siblings), the
 *       sidebar leaf carries the MQTT tag, the always-attached session
 *       pane shows the connect hint, and Connect is disabled with the
 *       browser-host copy.
 *   E2  edit → Save → reload → reopen: url, the 3.1.1 version knob,
 *       the compose payload, a Topics row and a saved message persist
 *       through a full page reload — and the filled URL still leaves
 *       Connect on the browser-host gate (no capability, no enable).
 *   E3  version honesty: the 3.1.1 knob renders the Properties tab
 *       disabled-honest — the 5.0-only grid is inert with the copy
 *       naming why.
 *   E4  AsyncAPI binding: a spec created from the SPECS `+` menu's
 *       AsyncAPI 3.0 scaffold binds through the editor's spec picker,
 *       the footer names the link, and the specLink persists.
 *   E5  encoding honesty: invalid Base64 shows the inline error and
 *       the Send scaffold's gate copy names the fix.
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

const CONNECT_BROWSER_HOST_COPY = 'MQTT sessions run on the desktop app or server.';
// Context-create persists immediately under the kind's default name
// (the born-clean gRPC posture) and primes the breadcrumb rename —
// committing this name proves the rename gate end to end.
const MQTT_NAME = 'Probe MQTT';
const SPEC_NAME = 'Broker AsyncAPI';
const MQTT_URL = 'mqtt://broker.openheaders.io:1883';
const MQTT_PAYLOAD = '{"temp": 21}';
const MQTT_TOPIC = 'sensors/1/temperature';
const MQTT_TOPIC_FILTER = 'sensors/+/temperature';

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let collectionUid: string;

function connectButton() {
  return page.getByTestId('mqtt-connect-button').filter({ visible: true }).first();
}

function urlInput() {
  return page.getByTestId('mqtt-url-input').filter({ visible: true }).first();
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

/** The sidebar leaf for an mqtt request by its display name — expands
 *  the suite collection first when a reload collapsed it. A committed
 *  rename lands async, so the missing NAME alone never triggers the
 *  expand click (on an expanded collection that click would toggle it
 *  closed): only a sidebar with no mqtt leaf at all warrants
 *  expanding. */
async function mqttRow(name: string) {
  const row = page
    .locator('[data-item-id^="mqtt-request-"]')
    .filter({ hasText: name })
    .filter({ visible: true })
    .first();
  const visibleNow = await row.waitFor({ state: 'visible', timeout: 3000 }).then(
    () => true,
    () => false,
  );
  if (!visibleNow) {
    const anyLeaf = await page.locator('[data-item-id^="mqtt-request-"]').filter({ visible: true }).count();
    if (anyLeaf === 0) {
      await page.locator(`[data-item-id="req-col-${collectionUid}"]`).click();
    }
    await row.waitFor({ state: 'visible', timeout: 10000 });
  }
  return row;
}

async function openMqttRequest(name: string): Promise<void> {
  await (await mqttRow(name)).click();
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
}

/** Assert the browser-host gate: Connect visible, disabled, its
 *  tooltip carrying the honest copy — no page-session capability
 *  exists yet (Phase D mints it), so a filled URL never enables it. */
async function expectConnectBrowserGate(): Promise<void> {
  const button = connectButton();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await expect(button).toBeDisabled();
  // Park first so the hover always lands as a fresh mouseenter.
  await page.mouse.move(0, 0);
  await button.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(CONNECT_BROWSER_HOST_COPY)
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
  collectionUid = await workbench.seedRequestCollection('MQTT Suite');

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

test.afterAll(async () => {
  await context.close();
});

// ── E1: context-create + the browser-host Connect gate ──────────────

test('E1 — the collection + menu creates an MQTT request gated on the browser host', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('Add MQTT Request');
  await commitAutoRename(/^New MQTT Request/, MQTT_NAME);

  // The renamed entity lands as a sidebar leaf carrying the MQTT tag.
  const row = await mqttRow(MQTT_NAME);
  await expect(row.getByText('MQTT', { exact: true }).first()).toBeVisible();

  // The editor is open on the fresh entity — the always-attached
  // session pane shows the connect hint, and Connect is PRESENT but
  // disabled with the browser-host copy (no page capability yet —
  // unlike WS, the URL alone never enables it here).
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('mqtt-session-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await expectConnectBrowserGate();
});

// ── E2: edit → Save → reload → persisted ────────────────────────────

test('E2 — url, version knob, payload, a Topics row and a saved message survive Save + reload + reopen', async () => {
  await urlInput().fill(MQTT_URL);

  // The version KNOB — 3.1.1 targets the brokers that still refuse 5.
  await page.getByTestId('mqtt-version-select').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'V3.1.1' })
    .first()
    .click();

  // The Message tab is the default-active compose surface: payload +
  // publish topic, then the compose freezes into a saved-rail preset.
  await workbench.fillMonaco(0, MQTT_PAYLOAD);
  await page.getByTestId('mqtt-topic-input').filter({ visible: true }).first().fill(MQTT_TOPIC);
  await page.getByTestId('mqtt-saved-add').filter({ visible: true }).first().click();
  await page
    .getByTestId('mqtt-saved-row')
    .filter({ visible: true })
    .filter({ hasText: 'Message' })
    .first()
    .waitFor({ state: 'visible' });

  // A subscription row on the Topics grid — typing into the
  // placeholder row mints it.
  await page.getByRole('tab', { name: 'Topics', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-topic-filter-input').filter({ visible: true }).first().fill(MQTT_TOPIC_FILTER);

  // A filled URL does NOT enable Connect on this surface — the
  // browser-host gate is the capability's honesty, not a URL gate.
  await expectConnectBrowserGate();

  await page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
  await page
    .getByRole('button', { name: /Saved$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
  await openMqttRequest(MQTT_NAME);

  await expect(urlInput()).toHaveValue(MQTT_URL);
  await expect(page.getByTestId('mqtt-version-select').filter({ visible: true }).first()).toContainText('V3.1.1');
  expect(await workbench.monacoText(0)).toContain(MQTT_PAYLOAD);
  await expect(page.getByTestId('mqtt-topic-input').filter({ visible: true }).first()).toHaveValue(MQTT_TOPIC);
  await page
    .getByTestId('mqtt-saved-row')
    .filter({ visible: true })
    .filter({ hasText: 'Message' })
    .first()
    .waitFor({ state: 'visible' });
  await page.getByRole('tab', { name: 'Topics', exact: true }).filter({ visible: true }).first().click();
  await expect(page.getByTestId('mqtt-topic-filter-input').filter({ visible: true }).first()).toHaveValue(
    MQTT_TOPIC_FILTER,
  );
});

// ── E3: the 3.1.1 knob renders the Properties tab disabled-honest ───

test('E3 — on 3.1.1 the CONNECT user-properties grid is inert with the honest copy', async () => {
  await page.getByRole('tab', { name: 'Properties', exact: true }).filter({ visible: true }).first().click();
  const propsTab = page.getByTestId('mqtt-user-props').filter({ visible: true }).first();
  await propsTab.waitFor({ state: 'visible', timeout: 10000 });
  await expect(propsTab).toContainText('CONNECT user properties are an MQTT 5.0 feature — this request targets 3.1.1.');
  await expect(propsTab.locator('[aria-disabled="true"]').first()).toBeVisible();
});

// ── E4: AsyncAPI spec binding persists ──────────────────────────────

test('E4 — an AsyncAPI spec binds through the picker and the specLink persists', async () => {
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

  await openMqttRequest(MQTT_NAME);
  // Exact: the substring would also match the "Broker AsyncAPI"
  // DOCUMENT tab and switch documents instead of editor tabs.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-spec-select').filter({ visible: true }).first().click();
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
  await workbench.collapseRightSidebar();
  await openMqttRequest(MQTT_NAME);
  // Exact: the substring would also match the "Broker AsyncAPI"
  // DOCUMENT tab and switch documents instead of editor tabs.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  // Read the select's own text — a single-mode Select renders its
  // value in `.ant-select-content` (no selection-item element).
  await expect(page.getByTestId('mqtt-spec-select').filter({ visible: true }).first()).toContainText(SPEC_NAME);
});

// ── E5: encoding honesty — invalid Base64 gates Send ────────────────

test('E5 — invalid Base64 shows the inline error and the Send gate names the fix', async () => {
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();
  await page
    .getByTestId('mqtt-payload-format')
    .filter({ visible: true })
    .first()
    .getByText('Base64', { exact: true })
    .click();
  await workbench.fillMonaco(0, 'not base64 !!!');

  const inlineError = page.getByTestId('mqtt-encoding-error').filter({ visible: true }).first();
  await inlineError.waitFor({ state: 'visible', timeout: 10000 });
  await expect(inlineError).toContainText('Not valid Base64');

  const send = page.getByTestId('mqtt-send-message').filter({ visible: true }).first();
  await expect(send).toBeDisabled();
  // Park first so the hover always lands as a fresh mouseenter.
  await page.mouse.move(0, 0);
  await send.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText('Fix the payload encoding first.')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.mouse.move(0, 0);
});
