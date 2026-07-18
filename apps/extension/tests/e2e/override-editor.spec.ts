/**
 * Override-editor byte-fidelity e2e — the format-aware body epic's
 * closing invariants, driven end-to-end through the production UI paths
 * (no seeding seams: every rule is minted by the CTA → popover → Save
 * flow the user actually walks).
 *
 * The panel runs OUTSIDE a DevTools window: `panel.html?ohInspectTabId=N`
 * binds the plain-tab panel to an inspected tab and the CDP pin
 * (`setCdpTabPin`) feeds its lifecycle plane — Playwright cannot attach
 * to a real DevTools window.
 *
 * The origin is `/probe/fidelity-json`: minified JSON whose exact bytes
 * a JSON.parse/stringify round-trip would corrupt (integer beyond 2^53,
 * `1.0`, `1e3`, a `\uXXXX` escape, a duplicate key). Legs:
 *
 *   1  no-edit override — the popover's Monaco body opens in Formatted
 *      mode, yet Save stores and SERVES the origin bytes exactly (the
 *      verbatim short-circuit); Content-Length, when present, matches
 *      the served bytes
 *   2  edited minified original — the edit popover's formatted-space
 *      edit re-emits in the origin's minified profile on the wire,
 *      hazard bytes surviving the edit
 *   3  templated body — a `{{…}}` atom formats in the popover and the
 *      no-edit Save round-trips the stored body byte-exactly (wire
 *      assertion stops at the store: template resolution is the serve
 *      plane's own concern)
 *   4  tab document — "Open in tab" escalates the create popover to the
 *      rule-editor document: born dirty, name + Raw-mode body edit,
 *      Save mints + publishes and re-keys the pill (draft dot drops),
 *      the served response reflects the edit, and a dirty tab's close
 *      walks the Save-changes guard (Cancel keeps it, Don't save
 *      closes it)
 *
 * P6 parity legs — the same wire-space plane on the OTHER override CTAs
 * (`/echo` reflects the request body, so its echo IS the wire truth):
 *
 *   5  request-body override — the Payload tab's CTA seeds the hazard
 *      bytes, the popover's Monaco body opens Formatted, and a no-edit
 *      Save stores AND puts on the wire the captured bytes exactly
 *   6  ws frame override — the Messages grid's per-frame Override seeds
 *      the frame verbatim; the formatted view + no-edit Save stores the
 *      frame bytes exactly
 *   7  sse event override — the EventStream grid's per-event Override,
 *      same invariant against a captured event's data
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';

// MUST mirror the playground's /probe/fidelity-* literals byte-for-byte
// (playground/vite.config.ts) — the assertions compare served text
// against these strings.
const FIDELITY_PATH = '/probe/fidelity-json';
const FIDELITY_BODY =
  '{"big":9007199254740993,"pi":1.0,"exp":1e3,"esc":"caf\\u00e9","dup":1,"dup":2,"site":"https://openheaders.io","target":"original"}';
const TEMPLATE_PATH = '/probe/fidelity-template';
const TEMPLATE_BODY = '{"seq":1,"token":{{session.token}},"ok":true}';

// Leg 2: typed into the FORMATTED view as one line (whitespace between
// tokens is what the view owns) — the wire re-emission must come back
// in the origin's minified profile with the hazard bytes intact.
const EDIT_VIEW = '{ "big": 9007199254740993, "esc": "caf\\u00e9", "target": "edited" }';
const EDITED_WIRE = '{"big":9007199254740993,"esc":"caf\\u00e9","target":"edited"}';

// Leg 5: the reflected request body — the echo's `body` field is the
// wire truth for what the extension actually sent.
const ECHO_PATH = '/echo?case=oh-ovr-reqbody';
// Leg 6/7: hazard payloads a parse/stringify would corrupt, sent as a
// ws frame / observed as an sse event.
const WS_URL_PATH = '/net/ws-echo';
const WS_FRAME_BODY = '{"marker":"OH_WS_FIDELITY","big":9007199254740993,"pi":1.0,"op":"subscribe"}';
const SSE_PATH = '/net/sse/4?ms=50';
const SSE_EVENT_BODY = '{"seq":2}';

// Leg 4: the tab document's Raw-mode body is stored AS IS (the
// wire-space builder law), so the served bytes are exactly this line.
const TAB_ORIGIN_PATH = '/probe/json?case=oh-override-tab';
const TAB_RULE_NAME = 'Override tab rule';
const TAB_EDITED_BODY = '{"probe":"json","sentinel":"OH_TAB_EDITED","big":9007199254740993}';
const TAB_DIRTY_BODY = '{"probe":"json","sentinel":"OH_TAB_GUARDED"}';

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let playgroundPage: Page;
let panelPage: Page;

interface ServedResponse {
  text: string;
  contentLength: string | null;
}

/** Fetch a same-origin path from the playground page and reflect the
 *  served body text + the Content-Length the page can read. */
function fetchServed(pathname: string): Promise<ServedResponse> {
  return playgroundPage.evaluate(async (p: string) => {
    const res = await fetch(p, { cache: 'no-store' });
    const contentLength = res.headers.get('content-length');
    const text = await res.text();
    return { text, contentLength };
  }, pathname);
}

/** The open quick-editor popover. */
function popover(): Locator {
  return panelPage.locator('[data-rule-popover-root]').filter({ visible: true }).first();
}

/** The popover's body editor — the shared format-aware Monaco (tab
 *  parity); lazy-loaded, so wait for the editor before reading. */
function popoverBody(): Locator {
  return popover().locator('.monaco-editor').first();
}

/** The Formatted/Raw toggle's selected segment inside the popover. */
function popoverBodyMode(): Locator {
  return popover().locator('.ant-segmented-item-selected').first();
}

async function popoverBodyText(): Promise<string> {
  await popoverBody().waitFor({ state: 'visible', timeout: 15_000 });
  return (await popoverBody().locator('.view-lines').innerText()).replace(/\u00a0/g, ' ');
}

/** Single-line bulk replace in the popover's Monaco body. NO
 *  suggest-dismissing Escape — it would bubble to the popover shell and
 *  close it under the next click (the fillMonacoWithin modal trap); the
 *  Save click below lands outside Monaco, which closes a stray suggest
 *  widget harmlessly. */
async function fillPopoverBody(text: string): Promise<void> {
  await popoverBody().click();
  await panelPage.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await panelPage.keyboard.press('Backspace');
  await panelPage.keyboard.insertText(text);
}

/** Newest traffic row whose text carries `marker`. */
function rowFor(marker: string): Locator {
  return panelPage.locator('.dt-row').filter({ hasText: marker }).last();
}

/** Activate a detail-view section tab by its label. */
async function openSection(label: string): Promise<void> {
  const tab = panelPage.locator('.dt-detail-section-tab').filter({ hasText: label }).filter({ visible: true }).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

function openResponseSection(): Promise<void> {
  return openSection('Response');
}

/** The Response tab's override CTA by its current label
 *  ("Override Response" create / "Edit override" edit). */
function cta(label: string): Locator {
  return panelPage.locator('.dt-body-override-cta').filter({ hasText: label }).filter({ visible: true }).first();
}

interface StoredRule {
  uid: string;
  type: string;
  name?: string;
  published?: boolean;
  action?: { responseBody?: string; requestBody?: string; payload?: string };
}

/** The stored response rule whose body is byte-equal to `body`. */
async function findRuleByBody(body: string): Promise<StoredRule | undefined> {
  const res = await workbench.rpc<{ rules: StoredRule[] }>('getLocalRules');
  return res.rules.find((r) => r.type === 'response' && r.action?.responseBody === body);
}

/** The stored request-body rule whose static body is byte-equal to `body`. */
async function findRequestBodyRuleByBody(body: string): Promise<StoredRule | undefined> {
  const res = await workbench.rpc<{ rules: StoredRule[] }>('getLocalRules');
  return res.rules.find((r) => r.type === 'request-body' && r.action?.requestBody === body);
}

/** The stored ws/sse rule whose payload is byte-equal to `payload`. */
async function findMessageRuleByPayload(type: 'ws' | 'sse', payload: string): Promise<StoredRule | undefined> {
  const res = await workbench.rpc<{ rules: StoredRule[] }>('getLocalRules');
  return res.rules.find((r) => r.type === type && r.action?.payload === payload);
}

/** The rule-editor document body (the active editor-group document). */
function docRoot(): Locator {
  return panelPage.locator('.dt-storagedoc').filter({ visible: true }).first();
}

/** The rule-editor tab pill (the OVR badge is the arm's tab identity). */
function rulePill(): Locator {
  return panelPage.locator('.dt-editor-tab').filter({ hasText: 'OVR' }).first();
}

/** Switch the document's format-aware body editor to Raw mode. */
async function switchDocBodyToRaw(): Promise<void> {
  await docRoot().locator('.ant-segmented').waitFor({ state: 'visible', timeout: 15_000 });
  await docRoot().locator('.ant-segmented-item').filter({ hasText: 'Raw' }).click();
}

/** Single-line bulk replace in the document's Monaco. */
async function fillDocMonaco(text: string): Promise<void> {
  await docRoot().locator('.monaco-editor').first().click();
  await panelPage.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await panelPage.keyboard.press('Backspace');
  await panelPage.keyboard.insertText(text);
  await panelPage.keyboard.press('Escape');
}

/** The dirty-close confirmation dialog. */
function closeGuard(): Locator {
  return panelPage.locator('.ant-modal').filter({ hasText: 'Save changes?' }).filter({ visible: true }).first();
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      // Suppress the debugging infobar so attach commits without layout shifts.
      '--silent-debugger-extension-api',
    ],
  });
  sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  workbenchPage = await context.newPage();
  workbench = await WorkbenchPage.open(workbenchPage, extensionId);

  // Seed flags from the PAGE context (shared extension-origin storage).
  await workbenchPage.evaluate(
    () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // The quick-create destination's first-collection fallback needs one.
  const col = await workbench.rpc<{ success: boolean }>('createLocalCollection', { name: 'Override editor rules' });
  expect(col.success).toBe(true);

  // ── Pin the playground tab into CDP, bind the plain-tab panel to it ──
  playgroundPage = await context.newPage();
  await playgroundPage.goto(PLAYGROUND_URL);
  const tabId = await workbench.tabIdForUrl(PLAYGROUND_URL);
  const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
  expect(pin.success).toBe(true);

  panelPage = await context.newPage();
  panelPage.on('pageerror', (err) => console.error('[panel pageerror]', err.stack ?? err.message));
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  // Attach is async — keep re-firing until a captured row shows up.
  await expect(async () => {
    await fetchServed(FIDELITY_PATH);
    await expect(panelPage.locator('.dt-row').filter({ hasText: 'fidelity-json' }).first()).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 30_000 });
});

test.afterAll(async () => {
  await context.close();
});

test('a no-edit override shows a formatted view yet serves the origin bytes exactly', async () => {
  test.setTimeout(90_000);
  await rowFor('fidelity-json').click();
  await openResponseSection();
  // The CDP body fetch is lazy — the CTA's draft reads the attached
  // body, so wait for the hazard bytes to render before clicking.
  await expect(panelPage.getByText('9007199254740993').first()).toBeVisible({ timeout: 15_000 });

  await cta('Override Response').click();
  await expect(popover()).toBeVisible();

  // The Monaco body opens in Formatted mode showing the formatted VIEW
  // of the wire text (": " gaps only exist in the view — the origin is
  // minified).
  const view = await popoverBodyText();
  expect(view).toContain('"big": 9007199254740993');
  expect(view).toContain('caf\\u00e9');
  expect(view).not.toBe(FIDELITY_BODY);
  await expect(popoverBodyMode()).toHaveText('Formatted');

  // Save mints + publishes; the stored body must be the origin bytes —
  // the verbatim short-circuit, the epic's headline invariant.
  await popover().getByRole('button', { name: /Save$/ }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);
  await expect.poll(async () => (await findRuleByBody(FIDELITY_BODY))?.published, { timeout: 15_000 }).toBe(true);

  // The served response is byte-identical to what the origin sent.
  await expect.poll(async () => (await fetchServed(FIDELITY_PATH)).text, { timeout: 20_000 }).toBe(FIDELITY_BODY);
  const served = await fetchServed(FIDELITY_PATH);
  expect(served.text).toBe(FIDELITY_BODY);
  if (served.contentLength !== null) {
    expect(Number(served.contentLength)).toBe(new TextEncoder().encode(served.text).length);
  }
});

test('an edited minified original serves minified — profile re-emission with hazard bytes intact', async () => {
  test.setTimeout(90_000);
  // Fire-join is async — re-fire until a row carries the fired rule and
  // the CTA flips to edit mode.
  await expect(async () => {
    await fetchServed(FIDELITY_PATH);
    await rowFor('fidelity-json').click();
    await openResponseSection();
    await expect(cta('Edit override')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  await cta('Edit override').click();
  await expect(popover()).toBeVisible();
  expect(await popoverBodyText()).toContain('"big": 9007199254740993');

  // Edit in formatted space (single line — inter-token whitespace is
  // view-owned); Save re-encodes to the origin's minified profile.
  await fillPopoverBody(EDIT_VIEW);
  const save = popover().getByRole('button', { name: /Save$/ });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);

  await expect.poll(async () => (await findRuleByBody(EDITED_WIRE))?.published, { timeout: 15_000 }).toBe(true);
  await expect.poll(async () => (await fetchServed(FIDELITY_PATH)).text, { timeout: 20_000 }).toBe(EDITED_WIRE);
});

test('a templated body formats in the popover and a no-edit Save round-trips the bytes', async () => {
  test.setTimeout(90_000);
  await expect(async () => {
    await fetchServed(TEMPLATE_PATH);
    await expect(rowFor('fidelity-template')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await rowFor('fidelity-template').click();
  await openResponseSection();
  await expect(panelPage.getByText('session.token').first()).toBeVisible({ timeout: 15_000 });

  await cta('Override Response').click();
  await expect(popover()).toBeVisible();

  // The {{…}} atom is an opaque token — the body still formats, the
  // template rides the view verbatim.
  const view = await popoverBodyText();
  expect(view).toContain('{{session.token}}');
  expect(view).toContain('"seq": 1');
  await expect(popoverBodyMode()).toHaveText('Formatted');

  await popover().getByRole('button', { name: /Save$/ }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);
  await expect.poll(async () => (await findRuleByBody(TEMPLATE_BODY))?.published, { timeout: 15_000 }).toBe(true);
});

test('"Open in tab" escalates to the rule document: Save mints + publishes, the edit rides the wire, and a dirty close walks the guard', async () => {
  test.setTimeout(120_000);
  await expect(async () => {
    await fetchServed(TAB_ORIGIN_PATH);
    await expect(rowFor('oh-override-tab')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await rowFor('oh-override-tab').click();
  await openResponseSection();
  await expect(panelPage.getByText('OH_PROBE_JSON_OK').first()).toBeVisible({ timeout: 15_000 });

  await cta('Override Response').click();
  await expect(popover()).toBeVisible();
  await popover().getByRole('button', { name: 'Open in tab' }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);

  // The create document: OVR pill born dirty, response-override crumb.
  await expect(rulePill()).toBeVisible();
  await expect(rulePill().locator('.dt-editor-tab-dirty')).toBeVisible();
  await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText('Response override');

  // Edit the name and the body — Raw mode stores the line AS IS (the
  // wire-space builder law: no re-profiling of a deliberate Raw edit).
  await panelPage.getByTestId('oh-ruledoc-name').fill(TAB_RULE_NAME);
  await switchDocBodyToRaw();
  await fillDocMonaco(TAB_EDITED_BODY);

  const save = docRoot().locator('.dt-storagedoc-save');
  await expect(save).toBeEnabled();
  await save.click();

  // First Save mints + publishes and re-keys the tab: the pill takes
  // the final name and the draft dot drops.
  await expect.poll(async () => (await findRuleByBody(TAB_EDITED_BODY))?.published, { timeout: 15_000 }).toBe(true);
  await expect(rulePill()).toContainText(TAB_RULE_NAME);
  await expect(rulePill().locator('.dt-editor-tab-dirty')).toHaveCount(0, { timeout: 15_000 });

  // The served response reflects the edit byte-for-byte.
  await expect.poll(async () => (await fetchServed(TAB_ORIGIN_PATH)).text, { timeout: 20_000 }).toBe(TAB_EDITED_BODY);

  // Dirty the (now edit-mode, remounted) document and close: the guard
  // must offer Save / Don't save / Cancel — Cancel keeps the tab…
  await switchDocBodyToRaw();
  await fillDocMonaco(TAB_DIRTY_BODY);
  await expect(rulePill().locator('.dt-editor-tab-dirty')).toBeVisible();
  await rulePill().hover();
  await rulePill().locator('.dt-editor-tab-close').click();
  await expect(closeGuard()).toBeVisible();
  await closeGuard().getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panelPage.locator('.ant-modal').filter({ hasText: 'Save changes?' })).toBeHidden();
  await expect(rulePill()).toBeVisible();

  // …and Don't save discards it.
  await rulePill().hover();
  await rulePill().locator('.dt-editor-tab-close').click();
  await expect(closeGuard()).toBeVisible();
  await closeGuard()
    .getByRole('button', { name: /Don.t save/ })
    .click();
  await expect(panelPage.locator('.dt-editor-tab').filter({ hasText: 'OVR' })).toHaveCount(0);
});

/** POST the given body to /echo from the page and return the `body`
 *  field the server received — the wire truth for the request body. */
function postEcho(body: string): Promise<string> {
  return playgroundPage.evaluate(
    async ({ p, b }: { p: string; b: string }) => {
      const res = await fetch(p, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: b,
        cache: 'no-store',
      });
      const json = (await res.json()) as { body: string };
      return json.body;
    },
    { p: ECHO_PATH, b: body },
  );
}

test('a no-edit request-body override stores and puts on the wire the captured bytes exactly', async () => {
  test.setTimeout(90_000);
  await expect(async () => {
    await postEcho(FIDELITY_BODY);
    await expect(rowFor('oh-ovr-reqbody')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await rowFor('oh-ovr-reqbody').click();
  await openSection('Payload');
  await expect(panelPage.getByText('9007199254740993').first()).toBeVisible({ timeout: 15_000 });

  await cta('Override request body').click();
  await expect(popover()).toBeVisible();

  // The Monaco body opens Formatted, showing the formatted VIEW of the
  // captured wire text — the form record itself stays wire bytes.
  const view = await popoverBodyText();
  expect(view).toContain('"big": 9007199254740993');
  expect(view).toContain('caf\\u00e9');
  await expect(popoverBodyMode()).toHaveText('Formatted');

  await popover().getByRole('button', { name: /Save$/ }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);
  await expect
    .poll(async () => (await findRequestBodyRuleByBody(FIDELITY_BODY))?.published, { timeout: 15_000 })
    .toBe(true);

  // The wire truth: a request with a DIFFERENT page body is sent with
  // the stored bytes — byte-identical to the original capture.
  await expect.poll(() => postEcho('{"page":"body"}'), { timeout: 20_000 }).toBe(FIDELITY_BODY);
});

test('a ws frame override seeds the frame verbatim and a no-edit Save stores the frame bytes exactly', async () => {
  test.setTimeout(90_000);
  await playgroundPage.evaluate(
    ({ p, frame }: { p: string; frame: string }) =>
      new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://${location.host}${p}`);
        ws.onerror = () => reject(new Error('ws-echo connection failed'));
        ws.onopen = () => ws.send(frame);
        // Wait for the echo so both directions are on the wire, then close.
        ws.onmessage = () => {
          ws.close();
          resolve();
        };
      }),
    { p: WS_URL_PATH, frame: WS_FRAME_BODY },
  );
  await expect(rowFor('ws-echo')).toBeVisible({ timeout: 15_000 });
  await rowFor('ws-echo').click();
  await openSection('Messages');

  // The SEND frame (the echo carries the same marker with an `echo:`
  // prefix — the direction class disambiguates).
  const frameRow = panelPage.locator('.dt-ws-row.dt-ws-row--send').filter({ hasText: 'OH_WS_FIDELITY' }).first();
  await expect(frameRow).toBeVisible({ timeout: 15_000 });
  await frameRow.locator('button').filter({ hasText: 'Override' }).click();
  await expect(popover()).toBeVisible();

  const view = await popoverBodyText();
  expect(view).toContain('"big": 9007199254740993');
  await expect(popoverBodyMode()).toHaveText('Formatted');

  await popover().getByRole('button', { name: /Save$/ }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);
  await expect
    .poll(async () => (await findMessageRuleByPayload('ws', WS_FRAME_BODY))?.published, { timeout: 15_000 })
    .toBe(true);
});

test('an sse event override seeds the event verbatim and a no-edit Save stores the event bytes exactly', async () => {
  test.setTimeout(90_000);
  await playgroundPage.evaluate(
    (p: string) =>
      new Promise<void>((resolve) => {
        const es = new EventSource(p);
        let seen = 0;
        // Two default "message" events (seq 2 and 4) end the wait; the
        // stream closing early resolves too — the row check gates.
        es.onmessage = () => {
          seen++;
          if (seen >= 2) {
            es.close();
            resolve();
          }
        };
        es.onerror = () => {
          es.close();
          resolve();
        };
      }),
    SSE_PATH,
  );
  await expect(rowFor('sse/4')).toBeVisible({ timeout: 15_000 });
  await rowFor('sse/4').click();
  await openSection('EventStream');

  const eventRow = panelPage.locator('.dt-sse-row').filter({ hasText: '{"seq":2}' }).first();
  await expect(eventRow).toBeVisible({ timeout: 15_000 });
  await eventRow.locator('button').filter({ hasText: 'Override' }).click();
  await expect(popover()).toBeVisible();

  const view = await popoverBodyText();
  expect(view).toContain('"seq": 2');
  await expect(popoverBodyMode()).toHaveText('Formatted');

  await popover().getByRole('button', { name: /Save$/ }).click();
  await expect(panelPage.locator('[data-rule-popover-root]')).toHaveCount(0);
  await expect
    .poll(async () => (await findMessageRuleByPayload('sse', SSE_EVENT_BODY))?.published, { timeout: 15_000 })
    .toBe(true);
});
