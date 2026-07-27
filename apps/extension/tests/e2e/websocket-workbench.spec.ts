/**
 * WebSocket workbench legs — the Phase B entity/editor gate plus the
 * Phase D page-realm SESSION gate on the standalone extension
 * workbench: real Chromium with the built extension, no daemon; the
 * live legs ride the playground's `/net/ws-probe` (the Playwright
 * webServer boots the playground). The workbench registers the
 * `wsPageSession` capability, so Connect is ENABLED here — the
 * browser-native socket executes the session IN this page — and the
 * only disabled state left is the needs-url gate.
 *
 *   B1  context-create raw: the collection `+` menu's "Add WebSocket
 *       Request" mints a persisted entity, the primed breadcrumb
 *       rename commits a name (the create-gesture rename law — the
 *       websocket-edit mode rides the same StatusBar rename gate as
 *       its siblings), the sidebar leaf carries the WS tag, and
 *       Connect is PRESENT but disabled with the needs-url tooltip —
 *       the runtime gate is gone on this surface.
 *   B2  edit → Save → reload → reopen: url, compose message and a
 *       subprotocol tag persist through a full page reload; a filled
 *       URL ENABLES Connect.
 *   B3  context-create socketio: the sibling menu entry pre-sets the
 *       flavor — SIO sidebar tag, Socket.IO editor flavor tag, the
 *       same needs-url gate.
 *   B4  AsyncAPI binding: a spec created from the SPECS `+` menu's
 *       AsyncAPI 3.0 scaffold binds through the editor's spec picker,
 *       the footer names the link, and the specLink persists.
 *   B5  page-realm session walk: Connect morphs to Disconnect, the
 *       greeting proves the subprotocol offer rode the platform
 *       constructor, Send echoes (↑ then ↓), Disconnect settles the
 *       clean Closed 1000 with the Disconnected lifecycle row — and
 *       with no node-only knob configured there is NO honesty notice.
 *   B6  per-knob honesty: a configured header row surfaces the
 *       Connect-side notice naming custom handshake headers, and the
 *       greeting mirrors an EMPTY `x-probe-client` — the row honestly
 *       never reached the wire (never a silent drop, never a gate).
 *   B7  socketio flavor (Phase E): the same page-realm path runs the
 *       hand-rolled engine.io/socket.io framing against the REAL
 *       socket.io server at `/net/sio-probe` — namespace connect,
 *       decoded event rows, an acked `echo` emit with its reply and
 *       correlated ACK, clean Disconnect.
 *   B8  compose aids (Phase F): the linked spec's census feeds the
 *       Message-tab "Use example message" picker (synthesized payload
 *       lands in the compose editor, display mode flips to JSON) and
 *       the AsyncAPI tab's channel browser (picking a message row
 *       composes its example and switches to the Message tab).
 *   B9  Save Response (Phase F): a settled session freezes into a
 *       WsResponseExample — viewer tab with the captured close pill,
 *       sidebar example leaf under the parent request, and "Open in
 *       Request" returns to the parent editor.
 *   B10 session credential + Events listen filter (Phase G): a bearer
 *       token configured on the socketio flavor rides the CONNECT
 *       packet's auth payload IN the page realm (the probe greeting
 *       mirrors it; NO honesty notice — the in-band payload applies on
 *       every host), and a named Events row filters the timeline to
 *       the listened incoming events (the ack still lands; the
 *       unlisted reply row hides — display only, capture verbatim).
 *
 * Deliberately NOT here: the node-knob session legs (custom headers /
 * TLS verify-off on the wire, `?push=` param batches, foreign close
 * codes, refused-dial classification) — the desktop rig's W-legs
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

const CONNECT_NEEDS_URL_COPY = 'Enter a ws:// or wss:// URL to connect.';
// Context-create persists immediately under the flavor's default name
// (the born-clean gRPC posture) and primes the breadcrumb rename —
// committing these names proves the rename gate end to end.
const RAW_NAME = 'Probe WS';
const SIO_NAME = 'Probe SIO';
const SPEC_NAME = 'Streams AsyncAPI';
const WS_URL = 'wss://ws.openheaders.io/live';
const WS_MESSAGE = 'ping from e2e';
const WS_SUBPROTOCOL = 'graphql-ws';
// The playground webServer's ws-probe — the live session legs' target.
const WS_PROBE_URL = 'ws://127.0.0.1:3000/net/ws-probe';
// The REAL socket.io server the socketio flavor's leg dials — the URL
// path IS the engine.io path.
const SIO_PROBE_URL = 'ws://127.0.0.1:3000/net/sio-probe';

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

/** Assert the needs-url gate: Connect visible, disabled, its tooltip
 *  carrying the url copy — the ONLY disabled state on this surface
 *  (the `wsPageSession` capability retired the runtime gate). */
async function expectConnectNeedsUrl(): Promise<void> {
  const button = connectButton();
  await button.waitFor({ state: 'visible', timeout: 10000 });
  await expect(button).toBeDisabled();
  // Park first so the hover always lands as a fresh mouseenter.
  await page.mouse.move(0, 0);
  await button.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(CONNECT_NEEDS_URL_COPY)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.mouse.move(0, 0);
}

function sendButton() {
  return page.getByTestId('websocket-send-message').filter({ visible: true }).first();
}

function liveBadge() {
  return page.getByTestId('ws-session-live-badge').filter({ visible: true }).first();
}

function closeTag() {
  return page.getByTestId('ws-session-close-tag').filter({ visible: true }).first();
}

function timelineMessageRows() {
  return page.getByTestId('ws-timeline-message-row').filter({ visible: true });
}

/** Disconnect (the clean close 1000) and wait for the settled tag. */
async function disconnectAndAwaitClose(): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await closeTag().filter({ hasText: 'Closed 1000' }).waitFor({ state: 'visible', timeout: 20_000 });
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

// ── B1: context-create raw + the needs-url Connect gate ────────────

test('the collection + menu creates a raw WebSocket request gated only on its empty URL', async () => {
  await openCollectionAddMenu();
  await clickAddMenuItem('Add WebSocket Request');
  await commitAutoRename(/^New WebSocket Request/, RAW_NAME);

  // The renamed entity lands as a sidebar leaf carrying the WS tag.
  const row = await websocketRow(RAW_NAME);
  await expect(row.getByText('WS', { exact: true }).first()).toBeVisible();

  // The editor is open on the fresh entity — empty-state session pane
  // attached, Connect present, disabled only for the missing URL.
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('ws-session-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await expectConnectNeedsUrl();
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

  // A filled URL ENABLES Connect — the `wsPageSession` capability
  // retired the runtime gate on this surface.
  await expect(connectButton()).toBeEnabled();

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
  await expect(row.getByText('S.IO', { exact: true }).first()).toBeVisible();

  // The editor header names the flavor; the fresh entity's empty URL
  // is the only Connect gate.
  await urlInput().waitFor({ state: 'visible', timeout: 10000 });
  await expect(page.getByText('Socket.IO', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expectConnectNeedsUrl();
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

// ── B5: page-realm session walk against the probe ───────────────────

test('B5 — Connect runs the session in-page: greeting subprotocol, Send echo, Disconnect Closed 1000', async () => {
  await openWebsocketRequest(RAW_NAME);
  // The CURRENT compose state connects (the draft-send law) — point
  // the draft at the probe without saving.
  await urlInput().fill(WS_PROBE_URL);
  // B4 left the AsyncAPI editor tab active; Send lives on Message.
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();

  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });
  await expect(connectButton()).toHaveText(/Disconnect/);

  // The greeting names the negotiated subprotocol — the offer rode the
  // platform constructor (the browser DOES support subprotocols).
  await timelineMessageRows()
    .filter({ hasText: `"protocol":"${WS_SUBPROTOCOL}"` })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page
    .getByTestId('ws-timeline-connected-row')
    .filter({ visible: true })
    .filter({ hasText: `Connected — subprotocol ${WS_SUBPROTOCOL}` })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // Send the compose text: the ↑ frame and the probe's echo ↓ land.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await timelineMessageRows()
    .filter({ hasText: `echo:${WS_MESSAGE}` })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  // No node-only knob configured — no honesty notice on this session.
  await expect(page.getByTestId('ws-host-knob-notice')).toHaveCount(0);

  await disconnectAndAwaitClose();
  await page
    .getByTestId('ws-timeline-ended-row')
    .filter({ visible: true })
    .filter({ hasText: 'Disconnected' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
});

// ── B6: per-knob honesty — a header row is named, never silently sent ─

test('B6 — a configured header row rides the honesty notice and honestly stays off the wire', async () => {
  // Configure a handshake header on the still-open editor. The grid
  // cells are TemplateInput contentEditables — the placeholder lives
  // on `data-placeholder`, never a native [placeholder] attribute.
  await page.getByRole('tab', { name: 'Headers', exact: true }).filter({ visible: true }).first().click();
  await page.locator('[data-placeholder="Header name"]').filter({ visible: true }).first().click();
  await page.keyboard.insertText('x-probe-client');
  await page.locator('[data-placeholder="Value"]').filter({ visible: true }).first().click();
  await page.keyboard.insertText('oh-ext-e2e');

  await connectButton().click();
  const notice = page.getByTestId('ws-host-knob-notice').filter({ visible: true }).first();
  await notice.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(notice).toContainText('custom handshake headers');

  // The greeting mirrors an EMPTY x-probe-client — the configured row
  // never reached the wire, and the notice said so up front.
  await timelineMessageRows()
    .filter({ hasText: '"xProbeClient":""' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  await disconnectAndAwaitClose();
  // The notice persists on the settled capture — honesty for the
  // session's whole life, not a transient toast.
  await expect(notice).toBeVisible();
});

// ── B7: socketio flavor session against the real socket.io server ───

test('B7 — socketio runs in-page: namespace connect, decoded events, acked echo emit', async () => {
  await openWebsocketRequest(SIO_NAME);
  // The CURRENT compose state connects (the draft-send law).
  await urlInput().fill(SIO_PROBE_URL);

  // Namespace rides the Settings tab (socketio-only row).
  await page.getByRole('tab', { name: 'Settings', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('websocket-namespace').filter({ visible: true }).first().fill('/probe');

  // Event compose on the Message tab: name + ack opt-in + per-arg
  // rail (Phase G compose parity) — two args composed through their
  // own editors join into the one arguments array on the wire.
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('websocket-event-name').filter({ visible: true }).first().fill('echo');
  await page.getByTestId('websocket-expect-ack').filter({ visible: true }).first().click();
  await workbench.fillMonaco(0, '"from-ext"');
  await page.getByTestId('ws-arg-add').filter({ visible: true }).first().click();
  await workbench.fillMonaco(0, '9');

  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });

  // The greeting proves the whole handshake chain decoded: engine.io
  // open, our namespace CONNECT, the server's connect ack, the first
  // EVENT by name.
  const eventNames = page.getByTestId('ws-sio-event-name').filter({ visible: true });
  await eventNames.filter({ hasText: 'probe:hello' }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows().filter({ hasText: 'connect /probe' }).first().waitFor({ state: 'visible' });
  await timelineMessageRows().filter({ hasText: 'connected /probe' }).first().waitFor({ state: 'visible' });
  await timelineMessageRows().filter({ hasText: 'engine.io open' }).first().waitFor({ state: 'visible' });

  // Send emits the composed event with ack id 1; the reply EVENT and
  // the correlated ACK land decoded.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await eventNames.filter({ hasText: 'echo:reply' }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows()
    .filter({ hasText: 'echo' })
    .filter({ hasText: '#1' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await timelineMessageRows()
    .filter({ hasText: 'ack' })
    .filter({ hasText: '#1' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  await disconnectAndAwaitClose();
});

// ── B8: compose aids off the linked spec's census ───────────────────

test('B8 — "Use example message" synthesizes the scaffold payload; the channel browser composes on pick', async () => {
  await openWebsocketRequest(RAW_NAME);
  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();

  // The Message-tab picker lists the census's messages; `subscribe`
  // synthesizes from the scaffold's authored examples + default.
  await page.getByTestId('ws-use-example-message').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'subscribe' })
    .first()
    .click();
  const composed = await workbench.monacoText(0);
  expect(composed).toContain('"topics"');
  expect(composed).toContain('"orders"');
  expect(composed).toContain('"format": "full"');

  // The AsyncAPI tab's channel browser: picking the `ping` message row
  // composes its example (const op) and switches back to Message.
  await page.getByRole('tab', { name: 'AsyncAPI', exact: true }).filter({ visible: true }).first().click();
  const browser = page.getByTestId('ws-asyncapi-browser').filter({ visible: true }).first();
  await browser.waitFor({ state: 'visible', timeout: 10_000 });
  await browser.getByText('ping', { exact: true }).first().click();
  await page
    .getByRole('tab', { name: 'Message', exact: true })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible' });
  // Poll: Monaco repaints a beat after the tab switch lands the text.
  await expect.poll(async () => workbench.monacoText(0), { timeout: 10_000 }).toContain('"op": "ping"');
});

// ── B9: Save Response — the settled session freezes into an example ──

test('B9 — Save Response mints the example: viewer close pill, sidebar leaf, Open in Request returns', async () => {
  // The draft still points at the probe (B5) — run a fresh session.
  await urlInput().fill(WS_PROBE_URL);
  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });
  await disconnectAndAwaitClose();

  // Save Response lives in the session pane's ⋯ actions menu (first item).
  await page.getByTestId('ws-session-actions').filter({ visible: true }).first().click();
  await page.getByTestId('ws-save-response').filter({ visible: true }).first().click();

  // The minted example opens in its viewer tab: the captured close
  // pill + the read-only result pane.
  await page.getByTestId('ws-example-result-pane').filter({ visible: true }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await page
    .getByTestId('ws-example-close-tag')
    .filter({ visible: true })
    .filter({ hasText: 'Closed 1000' })
    .first()
    .waitFor({ state: 'visible' });

  // The sidebar nests the example leaf under its parent request row.
  await page
    .locator('[data-item-id^="ws-example-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // "Open in Request" returns to the parent editor with the captured
  // shape riding the prefill bus as unsaved draft edits.
  await page.getByTestId('ws-example-open-in-request').filter({ visible: true }).first().click();
  await urlInput().waitFor({ state: 'visible', timeout: 10_000 });
  await expect(urlInput()).toHaveValue(WS_PROBE_URL);
});

// ── B10: session credential + Events listen filter (Phase G) ────────

test('B10 — the bearer credential rides the CONNECT auth payload in-page and the Events rows filter the timeline', async () => {
  // The SIO draft still points at the probe with the /probe namespace
  // and the acked echo compose (B7's edits live in the mounted tab).
  await openWebsocketRequest(SIO_NAME);

  // Listen only to the greeting — the reply event stays unlisted.
  await page.getByRole('tab', { name: 'Events', exact: true }).filter({ visible: true }).first().click();
  await page.getByPlaceholder('Event name').filter({ visible: true }).first().click();
  await page.keyboard.insertText('probe:hello');

  // The credential on the Authorization tab.
  await page.getByRole('tab', { name: 'Authorization', exact: true }).filter({ visible: true }).first().click();
  await page.getByTestId('ws-auth-type').filter({ visible: true }).first().click();
  await page
    .locator('.ant-select-dropdown')
    .filter({ visible: true })
    .locator('.ant-select-item-option')
    .filter({ hasText: 'Bearer token' })
    .first()
    .click();
  await page.getByTestId('ws-auth-token').filter({ visible: true }).first().fill('sio-page-tok');

  await page.getByRole('tab', { name: 'Message', exact: true }).filter({ visible: true }).first().click();
  await expect(connectButton()).toBeEnabled();
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });

  // The greeting mirrors the CONNECT auth payload — the credential
  // works IN the page realm, so no honesty notice appears on THIS
  // session (visible-scoped: the raw editor's B6 notice persists in
  // its background tab).
  await timelineMessageRows()
    .filter({ hasText: 'sio-page-tok' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await expect(page.getByTestId('ws-host-knob-notice').filter({ visible: true })).toHaveCount(0);

  // Send the acked echo: the correlated ACK lands (proof the reply
  // cycle completed), while the unlisted `echo:reply` row stays hidden
  // by the listen filter — display only, the capture stays verbatim.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await timelineMessageRows()
    .filter({ hasText: 'ack' })
    .filter({ hasText: '#1' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  const eventNames = page.getByTestId('ws-sio-event-name').filter({ visible: true });
  await expect(eventNames.filter({ hasText: 'echo:reply' })).toHaveCount(0);

  await disconnectAndAwaitClose();
});
