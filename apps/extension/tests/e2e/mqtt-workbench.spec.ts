/**
 * MQTT workbench legs — the Phase B entity/editor gate plus the
 * Phase D page-realm SESSION gate on the standalone extension
 * workbench: real Chromium with the built extension, no daemon; the
 * live legs ride the playground's `/net/mqtt` aedes upgrade path (the
 * Playwright webServer boots the playground; aedes speaks 3.1.1, so
 * the suite request runs the version KNOB). The workbench registers
 * the `mqttPageSession` capability, so ws(s):// URLs ENABLE Connect —
 * MQTT-over-WebSocket executes IN this page — while mqtt(s):// tcp
 * schemes keep the honest named affordance (a browser page cannot
 * open a raw TCP socket; the scheme is named, never silently
 * downgraded to ws).
 *
 *   E1  context-create: the collection `+` menu's "Add MQTT Request"
 *       mints a persisted entity, the primed breadcrumb rename commits
 *       a name (the create-gesture rename law — the mqtt-edit mode
 *       rides the same StatusBar rename gate as its siblings), the
 *       sidebar leaf carries the MQTT tag, the always-attached session
 *       pane shows the connect hint, and Connect is disabled only for
 *       the missing URL — the runtime gate is gone on this surface.
 *   E2  edit → Save → reload → reopen: url, the 3.1.1 version knob,
 *       the compose payload, a Topics row and a saved message persist
 *       through a full page reload — and the filled mqtt:// URL leaves
 *       Connect on the tcp-scheme honesty gate (named, not enabled).
 *   E3  version honesty: the 3.1.1 knob renders the Properties tab
 *       disabled-honest — the 5.0-only grid is inert with the copy
 *       naming why.
 *   E4  AsyncAPI binding: a spec created from the SPECS `+` menu's
 *       AsyncAPI 3.0 scaffold binds through the editor's spec picker,
 *       the footer names the link, and the specLink persists.
 *   E5  encoding honesty: invalid Base64 shows the inline error and
 *       the Send scaffold's gate copy names the fix.
 *   E6  page-realm session walk (Phase D): a ws:// URL enables
 *       Connect; the session opens against the aedes probe (Connected
 *       row expanding to the verbatim 3.1.1 CONNACK), the open-time SUBACK
 *       grants both topic rows, the pre-seeded retained message lands
 *       with its Retained fact tag, Send echoes through the probe's
 *       reply topic (↑ then ↓ with topic chips), no node-only knob is
 *       configured so there is NO honesty notice, and Disconnect
 *       settles the clean Disconnected tag with the ended row.
 *   E7  tcp-scheme honesty (Phase D): flipping the scheme select to
 *       mqtt:// disables Connect with the copy NAMING the scheme —
 *       never a silent downgrade to ws.
 *   E8  node-knob honesty (Phase D): SSL verification toggled OFF
 *       surfaces the Connect-side notice naming the knob for the
 *       session's whole life — the session still runs and settles
 *       clean, and the notice persists on the settled capture.
 *   E9  compose aids (Phase E): the linked spec's census feeds the
 *       Message-tab "Use example message" picker (synthesized payload
 *       lands in the payload editor, the ENCODING flips to JSON, and
 *       the channel address prefills the publish topic — the
 *       mqtt-only affordance) and the AsyncAPI tab's channel browser
 *       (picking a message row composes its example and switches to
 *       the Message tab).
 *   E10 Save Response (Phase E): a settled session freezes into an
 *       MqttResponseExample — viewer tab with the captured end pill,
 *       sidebar example leaf under the parent request, and "Open in
 *       Request" returns to the parent editor.
 *   E11 Basic auth (Phase F): the Auth tab's probe identity rides the
 *       CONNECT packet and opens the session; a wrong password settles
 *       as the verbatim CONNACK refusal (Bad user name or password,
 *       code 4).
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

const CONNECT_NEEDS_URL_COPY = 'Enter a broker URL to connect.';
const CONNECT_TCP_SCHEME_COPY = 'mqtt:// sessions run on the desktop app or server';
// Context-create persists immediately under the kind's default name
// (the born-clean gRPC posture) and primes the breadcrumb rename —
// committing this name proves the rename gate end to end.
const MQTT_NAME = 'Probe MQTT';
const SPEC_NAME = 'Broker AsyncAPI';
const MQTT_URL = 'mqtt://broker.openheaders.io:1883';
const MQTT_PAYLOAD = '{"temp": 21}';
const MQTT_TOPIC = 'sensors/1/temperature';
const MQTT_TOPIC_FILTER = 'sensors/+/temperature';
// The playground webServer's aedes probe — the live session legs'
// target (the dev server's MQTT-over-WebSocket upgrade path).
const MQTT_WS_PROBE_URL = 'ws://127.0.0.1:3000/net/mqtt';
const ECHO_PAYLOAD = 'echo-me-workbench';

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

/** Assert a Connect gate: the button visible, disabled, its tooltip
 *  carrying the honest copy. The `mqttPageSession` capability retired
 *  the runtime gate on this surface — what remains is the needs-url
 *  gate and the named tcp-scheme affordance. */
async function expectConnectGate(copy: string): Promise<void> {
  const button = connectButton();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await expect(button).toBeDisabled();
  // Park first so the hover always lands as a fresh mouseenter.
  await page.mouse.move(0, 0);
  await button.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(copy)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.mouse.move(0, 0);
}

function sendButton() {
  return page.getByTestId('mqtt-send-message').filter({ visible: true }).first();
}

function liveBadge() {
  return page.getByTestId('mqtt-session-live-badge').filter({ visible: true }).first();
}

function endTag() {
  return page.getByTestId('mqtt-session-end-tag').filter({ visible: true }).first();
}

function timelineMessageRows() {
  return page.getByTestId('mqtt-timeline-message-row').filter({ visible: true });
}

/** Connect and wait for the CONNACK to settle on the live badge. */
async function connectAndAwaitOpen(): Promise<void> {
  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Disconnect (the clean DISCONNECT + close) and wait for the tag. */
async function disconnectAndAwaitClose(): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await endTag().filter({ hasText: 'Disconnected' }).waitFor({ state: 'visible', timeout: 20_000 });
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

// ── E1: context-create + the needs-url Connect gate ─────────────────

test('E1 — the collection + menu creates an MQTT request gated only on its empty URL', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('Add MQTT Request');
  await commitAutoRename(/^New MQTT Request/, MQTT_NAME);

  // The renamed entity lands as a sidebar leaf carrying the MQTT tag.
  const row = await mqttRow(MQTT_NAME);
  await expect(row.getByText('MQTT', { exact: true }).first()).toBeVisible();

  // The editor is open on the fresh entity — the always-attached
  // session pane shows the connect hint, and Connect is PRESENT but
  // disabled only for the missing URL (the `mqttPageSession`
  // capability retired the runtime gate on this surface).
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('mqtt-session-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await expectConnectGate(CONNECT_NEEDS_URL_COPY);
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
  // The rail starts COLLAPSED — the vertical strip expands it.
  await workbench.fillMonaco(0, MQTT_PAYLOAD);
  await page.getByTestId('mqtt-topic-input').filter({ visible: true }).first().fill(MQTT_TOPIC);
  await page.getByTestId('mqtt-saved-rail-strip').filter({ visible: true }).first().click();
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

  // The filled mqtt:// URL does NOT enable Connect on this surface —
  // a browser page cannot open a raw TCP socket, and the honesty gate
  // NAMES the scheme instead of silently downgrading to ws.
  await expectConnectGate(CONNECT_TCP_SCHEME_COPY);

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
  // Doubles as the sliver-regression gate: a fill CodeEditor dropped
  // straight into a row-flex host renders a few px wide, wraps every
  // character onto its own virtualized view line, and this readback
  // truncates — the column-direction host keeps it full width. Polled:
  // a just-reopened Monaco with wrap on first lays out at collapsed
  // width and renders only the first wrapped char line — the poll
  // rides out that relayout, while a truly squished editor never
  // settles to the full text.
  await expect.poll(async () => workbench.monacoText(0), { timeout: 10_000 }).toContain(MQTT_PAYLOAD);
  await expect(page.getByTestId('mqtt-topic-input').filter({ visible: true }).first()).toHaveValue(MQTT_TOPIC);
  // The reload remounts the editor, so the rail is back to its
  // collapsed default — expand it to see the persisted row.
  await page.getByTestId('mqtt-saved-rail-strip').filter({ visible: true }).first().click();
  await page
    .getByTestId('mqtt-saved-row')
    .filter({ visible: true })
    .filter({ hasText: 'Message' })
    .first()
    .waitFor({ state: 'visible' });
  await page.getByRole('tab', { name: 'Topics', exact: true }).filter({ visible: true }).first().click();
  // The filter cell is a TemplateInput (contentEditable) — assert its
  // text, not an input value.
  await expect(page.getByTestId('mqtt-topic-filter-input').filter({ visible: true }).first()).toHaveText(
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
  await page.getByTestId('mqtt-payload-format').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Base64' })
    .first()
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

// ── E6: page-realm session walk against the aedes probe ─────────────

test('E6 — Connect runs the session in-page: CONNACK row, SUBACK grants, retained tag, echo, clean Disconnect', async () => {
  await openMqttRequest(MQTT_NAME);
  // The CURRENT compose state connects (the draft-send law) — point
  // the draft at the probe's ws upgrade path without saving.
  await urlInput().fill(MQTT_WS_PROBE_URL);

  // E5 left the compose on invalid Base64 — flip back to Text and
  // compose the echo publish (topic probe/echo → the probe republishes
  // on probe/echo/reply, same QoS).
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-payload-format').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Text' })
    .first()
    .click();
  await workbench.fillMonaco(0, ECHO_PAYLOAD);
  await page.getByTestId('mqtt-topic-input').filter({ visible: true }).first().fill('probe/echo');

  // Both subscription rows for the walk: the echo reply topic (refill
  // E2's row) and the pre-seeded retained topic (mint via the
  // placeholder row).
  await page.getByRole('tab', { name: 'Topics', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-topic-filter-input').filter({ visible: true }).nth(0).fill('probe/echo/reply');
  await page.getByTestId('mqtt-topic-filter-input').filter({ visible: true }).nth(1).fill('probe/retained');
  // Minted rows start UNSUBSCRIBED — enable both switches so the
  // session subscribes at open (the ghost row's disabled switch
  // carries no testid, so nth() targets the real rows).
  await page.getByTestId('mqtt-topic-subscribe').filter({ visible: true }).nth(0).click();
  await page.getByTestId('mqtt-topic-subscribe').filter({ visible: true }).nth(1).click();

  // A ws:// URL ENABLES Connect — the session executes IN this page.
  await connectAndAwaitOpen();
  await expect(connectButton()).toHaveText(/Disconnect/);

  // The version knob locks while the session is in flight — the open
  // session speaks the version it connected with.
  await expect(
    page.getByTestId('mqtt-version-select').filter({ visible: true }).first(),
  ).toHaveClass(/ant-select-disabled/);

  // The Connected lifecycle row reads plain; expanding it shows the
  // verbatim CONNACK facts — the 3.1.1 return-code name beside the
  // code (the version knob from E2; aedes speaks 3.1.1 only) — as
  // key: value rows.
  const connectedRow = page
    .getByTestId('mqtt-timeline-connected-row')
    .filter({ visible: true })
    .filter({ hasText: 'Connected' })
    .first();
  await connectedRow.waitFor({ state: 'visible', timeout: 10_000 });
  await connectedRow.click();
  const connackDetails = page.getByTestId('mqtt-timeline-connack-details').filter({ visible: true }).first();
  await connackDetails.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(connackDetails).toContainText('cmd: connack');
  // aedes frames the 3.1.1 CONNACK with Remaining Length 2 — recorded
  // at decode, rendered verbatim.
  await expect(connackDetails).toContainText('length: 2');
  await expect(connackDetails).toContainText('reasonCode: 0 (Connection Accepted)');
  await expect(connackDetails).toContainText('sessionPresent: false');
  await connectedRow.click();
  await connackDetails.waitFor({ state: 'hidden', timeout: 10_000 });

  // Both rows subscribed at open in ONE packet — the Subscribed
  // lifecycle row records each SUBACK grant verbatim.
  await page
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .filter({ hasText: 'probe/echo/reply' })
    .filter({ hasText: 'probe/retained' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // The pre-seeded retained message arrives on subscribe carrying its
  // Retained fact tag.
  const retainedRow = timelineMessageRows().filter({ hasText: 'retained-hello' }).first();
  await retainedRow.waitFor({ state: 'visible', timeout: 15_000 });
  await retainedRow
    .getByTestId('mqtt-timeline-retained-tag')
    .filter({ hasText: 'Retained' })
    .first()
    .waitFor({ state: 'visible' });

  // Send publishes the compose: the ↑ frame and the probe's republish
  // ↓ land, each with its topic chip.
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await timelineMessageRows()
    .filter({ has: page.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: 'probe/echo/reply' }) })
    .filter({ hasText: ECHO_PAYLOAD })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows()
    .filter({ has: page.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: /^probe\/echo$/ }) })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // No node-only knob configured — no honesty notice on this session.
  await expect(page.getByTestId('mqtt-host-knob-notice')).toHaveCount(0);

  await disconnectAndAwaitClose();
  await page
    .getByTestId('mqtt-timeline-ended-row')
    .filter({ visible: true })
    .filter({ hasText: 'Disconnected' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
});

// ── E7: tcp-scheme honesty — the scheme is named, never downgraded ──

test('E7 — flipping the scheme to mqtt:// gates Connect with the copy naming the scheme', async () => {
  await page.getByTestId('mqtt-scheme-select').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: /^mqtt:\/\/$/ })
    .first()
    .click();
  await expect(urlInput()).toHaveValue('mqtt://127.0.0.1:3000/net/mqtt');
  await expectConnectGate(CONNECT_TCP_SCHEME_COPY);
});

// ── E8: node-knob honesty — TLS verify-off is named, never dropped ──

test('E8 — SSL verification off rides the honesty notice for the session’s whole life', async () => {
  // Back onto the ws scheme, then configure the node-only knob.
  await page.getByTestId('mqtt-scheme-select').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: /^ws:\/\/$/ })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-ssl-verify').filter({ visible: true }).first().click();

  await connectAndAwaitOpen();
  const notice = page.getByTestId('mqtt-host-knob-notice').filter({ visible: true }).first();
  await notice.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(notice).toContainText('disabled SSL verification');

  await disconnectAndAwaitClose();
  // The notice persists on the settled capture — honesty for the
  // session's whole life, not a transient toast.
  await expect(notice).toBeVisible();
});

// ── E9: compose aids off the linked spec's census ───────────────────

test('E9 — "Use example message" synthesizes the scaffold payload and prefills the topic; the channel browser composes on pick', async () => {
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();

  // The Message-tab picker lists the census's messages; `subscribe`
  // synthesizes from the scaffold's authored examples + default, and
  // its channel's ADDRESS lands as the publish topic (the mqtt-only
  // affordance — on MQTT the address IS the topic).
  await page.getByTestId('mqtt-use-example-message').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'subscribe' })
    .first()
    .click();
  // Poll: Monaco repaints a beat after the pick lands the synthesis.
  await expect.poll(async () => workbench.monacoText(0), { timeout: 10_000 }).toContain('"topics"');
  const composed = await workbench.monacoText(0);
  expect(composed).toContain('"orders"');
  expect(composed).toContain('"format": "full"');
  await expect(page.getByTestId('mqtt-topic-input').filter({ visible: true }).first()).toHaveValue('/ws/events');

  // The AsyncAPI tab's channel browser: picking the `ping` message row
  // composes its example (const op), prefills the topic with its own
  // channel address, and switches back to Message.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  const browser = page.getByTestId('mqtt-asyncapi-browser').filter({ visible: true }).first();
  await browser.waitFor({ state: 'visible', timeout: 10_000 });
  await browser.getByText('ping', { exact: true }).first().click();
  await page
    .getByRole('tab', { name: 'Message', exact: true })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible' });
  // Poll: Monaco repaints a beat after the tab switch lands the text.
  await expect.poll(async () => workbench.monacoText(0), { timeout: 10_000 }).toContain('"op": "ping"');
  await expect(page.getByTestId('mqtt-topic-input').filter({ visible: true }).first()).toHaveValue('/ws/control');
});

// ── E10: Save Response — the settled session freezes into an example ─

test('E10 — Save Response mints the example: viewer end pill, sidebar leaf, Open in Request returns', async () => {
  // The draft still points at the probe (E8's ws scheme) — run a
  // fresh session and settle it clean.
  await expect(urlInput()).toHaveValue(MQTT_WS_PROBE_URL);
  await connectAndAwaitOpen();
  await disconnectAndAwaitClose();

  // Save Response lives in the session pane's ⋯ actions menu (first item).
  await page.getByTestId('mqtt-session-actions').filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-save-response').filter({ visible: true }).first().click();

  // The minted example opens in its viewer tab: the captured end pill
  // + the read-only result pane.
  await page.getByTestId('mqtt-example-result-pane').filter({ visible: true }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await page
    .getByTestId('mqtt-example-end-tag')
    .filter({ visible: true })
    .filter({ hasText: 'Disconnected' })
    .first()
    .waitFor({ state: 'visible' });

  // The sidebar nests the example leaf under its parent request row.
  await page
    .locator('[data-item-id^="mqtt-example-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // "Open in Request" returns to the parent editor with the captured
  // shape riding the prefill bus as unsaved draft edits.
  await page.getByTestId('mqtt-example-open-in-request').filter({ visible: true }).first().click();
  await urlInput().waitFor({ state: 'visible', timeout: 10_000 });
  await expect(urlInput()).toHaveValue(MQTT_WS_PROBE_URL);
});

// ── E11: Basic auth on CONNECT (Phase F) ────────────────────────────

test('E11 — the probe identity opens the session; a wrong password refuses with the verbatim CONNACK code', async () => {
  // The draft still points at the probe (E10's prefill) — configure
  // the Auth tab's Basic pair; the credential rides the CONNECT
  // packet, resolved at Connect.
  await expect(urlInput()).toHaveValue(MQTT_WS_PROBE_URL);
  await page.getByRole('tab', { name: 'Authorization', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('mqtt-auth-type').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Basic auth' })
    .first()
    .click();
  await page.getByTestId('mqtt-auth-username').filter({ visible: true }).first().fill('probe');
  await page.getByTestId('mqtt-auth-password').filter({ visible: true }).first().fill('probe-secret');

  await connectAndAwaitOpen();
  await disconnectAndAwaitClose();

  // The wrong password settles as the verbatim CONNACK refusal — the
  // classified pre-open error, never a synthesized status.
  await page.getByTestId('mqtt-auth-password').filter({ visible: true }).first().fill('wrong-secret');
  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  const errorState = page.getByTestId('mqtt-timeline-error-row').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(page.getByTestId('mqtt-session-error-detail').filter({ visible: true }).first()).toContainText(
    'Bad user name or password (code 4)',
  );
});
