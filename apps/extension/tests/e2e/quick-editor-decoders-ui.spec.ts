/**
 * Quick-editor compact decoder e2e — the value-detection plane of the
 * devtools panel's rule quick-editor popover, where the inline
 * `CompactValueEditor` replaces the portal modals (a modal can't live
 * inside the hover popover).
 *
 * The panel runs OUTSIDE a DevTools window: `panel.html?ohInspectTabId=N`
 * binds the plain-tab panel to an inspected tab (the e2e hook in
 * `install-navigation-host.ts`), and the CDP pin (`setCdpTabPin`) feeds
 * its lifecycle plane without `chrome.devtools` — Playwright cannot
 * attach to a real DevTools window.
 *
 * The loop under test: a published header rule fires on playground
 * traffic → the request row's Matched Rules panel hover-opens the
 * quick editor → the Basic-base64 value field carries the rail icon →
 * clicking it expands the INLINE editor (role=group, NO modal) →
 * decoded seed, save-disabled-when-clean, Esc closes the editor but
 * pins the popover open, preview shows the exact re-encode → compact
 * Save writes the field → popover Save persists the rule with
 * `published` intact → the re-fired request carries the edited value
 * on the wire.
 */

import { createHmac } from 'node:crypto';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Locator, type Page, test, type Worker } from '@playwright/test';
import { seedPanelDebugFlags } from './fixtures/panel-seed';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const ECHO_PATH = '/api/echo';

let context: BrowserContext;
let extensionId: string;
let sw: Worker;
let workbench: WorkbenchPage;
let workbenchPage: Page;
let playgroundPage: Page;
let panelPage: Page;

const b64 = (text: string) => Buffer.from(text).toString('base64');
const BASIC_ORIGINAL = `Basic ${b64('user@openheaders.io:hunter2!!')}`;
const BASIC_EDITED = `Basic ${b64('admin@openheaders.io:rotated2026!!')}`;
const RULE_NAME = 'Panel decoder rule';
const HEADER_NAME = 'X-OH-Deco';

interface EchoHeaders {
  headers: Record<string, string | string[] | undefined>;
}

/** Fire a same-origin /api/echo fetch from the playground page and
 *  return the reflected request headers. */
function echoFetch(): Promise<EchoHeaders> {
  return playgroundPage.evaluate(
    (path: string) => fetch(path).then((r) => r.json() as Promise<EchoHeaders>),
    ECHO_PATH,
  );
}

/** The open quick-editor popover. */
function popover(): Locator {
  return panelPage.locator('[data-rule-popover-root]').filter({ visible: true }).first();
}

/** The inline compact editor card. */
function compactEditor(): Locator {
  return popover().getByRole('group', { name: 'Base64 value' });
}

/** The popover's Header Value cell (the compact `DetectedValueInput`). */
function valueCell(): Locator {
  return popover()
    .locator('.oh-template-input-wrapper')
    .filter({ has: panelPage.getByLabel('Edit Base64 value', { exact: true }) })
    .first();
}

async function valueCellText(): Promise<string> {
  return (await valueCell().locator('.oh-template-input-editable').innerText()).replace(/\u00a0/g, ' ').trim();
}

/** Publish a header rule through the real editor Save flow (rules are
 *  minted by sync mutators, not a bare RPC; the editor's Save is also
 *  the publication gate the DNR compile hangs on). Saves into the
 *  spec's collection, which must already exist. */
async function publishHeaderRule(name: string, headerName: string, value: string): Promise<void> {
  const draftRes = await workbench.rpc<{ success: boolean; nonce?: string }>('createRuleDraft', {
    draft: {
      type: 'header',
      name,
      // Domain-form filter: the wire plane (raw DNR urlFilter,
      // substring) and the panel projections (formatUrlPattern →
      // '*://127.0.0.1:3000/*') agree on this shape. A path-only
      // filter ('/api/echo') fires on the wire too but the projection
      // side only matches it from the compiler fix this session — the
      // domain form keeps this spec independent of build staleness.
      urlFilter: '127.0.0.1:3000',
      requestHeaders: [{ operation: 'override', headerName, value }],
    },
  });
  expect(draftRes.success).toBe(true);
  await sw.evaluate(
    async ({ url, intent }: { url: string; intent: object }) => {
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        chrome.tabs.query({ url: `${url}*` }, (found) => resolve(found));
      });
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') return;
      try {
        await new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'workspace-intent', intent }, () => {
            void chrome.runtime.lastError;
            resolve();
          });
        });
      } catch {
        // Listener doesn't respond; the message WAS delivered.
      }
    },
    {
      url: `chrome-extension://${extensionId}/workbench.html`,
      intent: { kind: 'create-rule', ruleType: 'header', draftNonce: draftRes.nonce },
    },
  );
  await workbenchPage.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
  const saveModal = workbenchPage.getByRole('dialog').filter({ hasText: 'Save to' }).filter({ visible: true }).first();
  await expect(saveModal).toBeVisible();
  await saveModal.getByRole('option').filter({ hasText: 'Panel decoder rules' }).click();
  await saveModal.getByRole('button', { name: /Save$/ }).click();
  await expect(saveModal).toBeHidden();
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;
  sw = await seedPanelDebugFlags(context);

  workbenchPage = await context.newPage();
  workbench = await WorkbenchPage.open(workbenchPage, extensionId);

  const col = await workbench.rpc<{ success: boolean }>('createLocalCollection', { name: 'Panel decoder rules' });
  expect(col.success).toBe(true);
  await publishHeaderRule(RULE_NAME, HEADER_NAME, BASIC_ORIGINAL);

  // ── Playground traffic: poll until the published rule rides DNR ──
  playgroundPage = await context.newPage();
  await playgroundPage.goto(PLAYGROUND_URL);
  await expect
    .poll(async () => (await echoFetch()).headers[HEADER_NAME.toLowerCase()], { timeout: 15_000 })
    .toBe(BASIC_ORIGINAL);

  // ── Pin the tab into CDP so the panel gets a lifecycle feed with no
  //    DevTools window, then open the plain-tab panel bound to it. ──
  const tabId = await workbench.tabIdForUrl(PLAYGROUND_URL);
  const pin = await workbench.rpc<{ success: boolean }>('setCdpTabPin', { tabId, pinned: true });
  expect(pin.success).toBe(true);

  panelPage = await context.newPage();
  await panelPage.goto(`chrome-extension://${extensionId}/panel.html?ohInspectTabId=${tabId}`);
  await panelPage.locator('.dt-panel-root').waitFor({ state: 'visible', timeout: 15_000 });

  // Attach is async — keep re-firing until a captured row shows up.
  await expect(async () => {
    await echoFetch();
    await expect(panelPage.locator('.dt-row').filter({ hasText: 'echo' }).first()).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Panel quick editor — compact inline decoder', () => {
  test('the matched-rule hover opens the quick editor with the rail on the value field', async () => {
    await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).first().click();

    const matchedTab = panelPage.locator('[data-tool-window="matched-rules"]').first();
    if ((await matchedTab.getAttribute('aria-selected')) !== 'true') {
      await matchedTab.click();
    }
    // Diagnostic-first: on a miss this prints the panel's whole text
    // (Matched / Future counts and row names) instead of a bare
    // element-not-found. The rule may land in either section — a fire
    // join gap still leaves the published rule as a future match, and
    // both row shapes hover-open the same quick editor.
    await expect(panelPage.locator('.dt-matched-rules-panel-body')).toContainText(RULE_NAME, { timeout: 10_000 });
    const ruleRow = panelPage.locator('.dt-matched-rule').filter({ hasText: RULE_NAME }).first();
    await expect(ruleRow).toBeVisible();
    await ruleRow.hover();
    await expect(popover()).toBeVisible();
    await expect(valueCell()).toBeVisible();
    expect(await valueCellText()).toBe(BASIC_ORIGINAL);
  });

  test('the rail icon expands the INLINE editor — no portal modal, decoded seed, Save disabled clean', async () => {
    const cell = valueCell();
    await cell.hover();
    await cell.getByLabel('Edit Base64 value', { exact: true }).click();

    const editor = compactEditor();
    await expect(editor).toBeVisible();
    // Inline by design: the whole point of the compact variant is that
    // no modal ever portals over the popover.
    await expect(panelPage.locator('.ant-modal').filter({ visible: true })).toHaveCount(0);

    const textarea = editor.getByLabel('Base64 value decoded text');
    await expect(textarea).toHaveValue('user@openheaders.io:hunter2!!');
    await expect(editor.getByRole('button', { name: /Save$/ })).toBeDisabled();
    // Clean text → no divergence → no preview block.
    await expect(editor.getByText('Encoded preview')).toHaveCount(0);
  });

  test('Escape closes the inline editor but leaves the quick popover open', async () => {
    await compactEditor().getByLabel('Base64 value decoded text').press('Escape');
    await expect(compactEditor()).toHaveCount(0);
    await expect(popover()).toBeVisible();
  });

  test('an edited credential previews the exact re-encode and writes back under the Basic prefix', async () => {
    const cell = valueCell();
    await cell.hover();
    await cell.getByLabel('Edit Base64 value', { exact: true }).click();
    const editor = compactEditor();

    await editor.getByLabel('Base64 value decoded text').fill('admin@openheaders.io:rotated2026!!');
    // The preview IS what Save writes — prefix carried.
    await expect(editor.getByText('Encoded preview')).toBeVisible();
    await expect(editor).toContainText(BASIC_EDITED);

    const save = editor.getByRole('button', { name: /Save$/ });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(compactEditor()).toHaveCount(0);
    expect(await valueCellText()).toBe(BASIC_EDITED);
  });

  test('the popover Save persists the edit with publication intact, and it rides the wire', async () => {
    await popover().getByRole('button', { name: /Save$/ }).click();

    interface StoredHeaderRule {
      type: string;
      name?: string;
      published?: boolean;
      action?: { requestHeaders?: Array<{ headerName: string; value?: string }> };
    }
    await expect
      .poll(async () => {
        const res = await workbench.rpc<{ rules: StoredHeaderRule[] }>('getLocalRules');
        const rule = res.rules.find((r) => r.name === RULE_NAME);
        return {
          value: rule?.action?.requestHeaders?.find((h) => h.headerName === HEADER_NAME)?.value,
          published: rule?.published,
        };
      })
      .toEqual({ value: BASIC_EDITED, published: true });

    // Re-fire: the DNR recompile lands async after the mutation.
    await expect
      .poll(async () => (await echoFetch()).headers[HEADER_NAME.toLowerCase()], { timeout: 15_000 })
      .toBe(BASIC_EDITED);
  });
});

// ── Value-document tab — the compact editor's escalation ────────────
// Continues on the state the compact loop left behind: the rule's
// value is BASIC_EDITED and the rule is published.

const DOC_DECODED = 'svc@openheaders.io:final2026!!';
const DOC_EDITED = `Basic ${b64(DOC_DECODED)}`;

/** The value-document body (the active editor-group document). */
function docRoot(): Locator {
  return panelPage.locator('.dt-storagedoc').filter({ visible: true }).first();
}

/** The document's editor-group tab pill. */
function docPill(): Locator {
  return panelPage.locator('.dt-editor-tab').filter({ hasText: HEADER_NAME }).first();
}

async function docMonacoText(): Promise<string> {
  return (await docRoot().locator('.dt-storagedoc-source .view-lines').innerText()).replace(/\u00a0/g, ' ');
}

/** Single-line bulk replace in the document's Monaco (same insertText
 *  contract as the workbench POM, driven on the panel page). */
async function fillDocMonaco(text: string): Promise<void> {
  await docRoot().locator('.monaco-editor').first().click();
  await panelPage.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await panelPage.keyboard.press('Backspace');
  await panelPage.keyboard.insertText(text);
}

/** Reopen the quick editor on the rule row and expand the compact
 *  editor on the Base64 value field. The Matched Rules panel keys off
 *  the SELECTED REQUEST — with the value document holding the editor
 *  group's focus there is none (the panel shows its empty state), so
 *  re-select an echo row first. */
async function openCompactEditor(): Promise<void> {
  await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).first().click();
  await expect(panelPage.locator('.dt-matched-rules-panel-body')).toContainText(RULE_NAME, { timeout: 10_000 });
  const ruleRow = panelPage.locator('.dt-matched-rule').filter({ hasText: RULE_NAME }).first();
  await ruleRow.hover();
  await expect(popover()).toBeVisible();
  const cell = valueCell();
  await cell.hover();
  await cell.getByLabel('Edit Base64 value', { exact: true }).click();
  await expect(compactEditor()).toBeVisible();
}

test.describe('Panel value document — the compact editor escalation', () => {
  test('"Open as document" opens a rule-value editor tab and closes the popover', async () => {
    // The document tab steals the editor group's focus later — make
    // sure the Matched Rules tool window is showing first.
    const matchedTab = panelPage.locator('[data-tool-window="matched-rules"]').first();
    if ((await matchedTab.getAttribute('aria-selected')) !== 'true') {
      await matchedTab.click();
    }
    await openCompactEditor();

    const openDoc = compactEditor().getByRole('button', { name: 'Open as document' });
    await expect(openDoc).toBeVisible();
    await openDoc.click();

    // The popover closes — the tab reads the canonical, and the
    // popover's ephemeral drafts die with it by design.
    await expect(popover()).toHaveCount(0);

    // New editor-group tab: VAL badge, header-name label, document
    // body with the rule crumb, type title, and the decoded value in
    // Monaco (async layout — poll the buffer).
    await expect(docPill()).toBeVisible();
    await expect(docPill()).toContainText('VAL');
    await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText(`${RULE_NAME} › ${HEADER_NAME}`);
    await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText('Base64 value');
    await expect(async () => {
      expect(await docMonacoText()).toContain('admin@openheaders.io:rotated2026!!');
    }).toPass({ timeout: 15_000 });
    // Pristine document: nothing to save, no preview strip.
    await expect(docRoot().locator('.dt-storagedoc-save')).toBeDisabled();
    await expect(docRoot().getByLabel('Encoded preview')).toHaveCount(0);
  });

  test('a document edit previews the exact re-encode, dirties the pill, and Save persists + rides the wire', async () => {
    await fillDocMonaco(DOC_DECODED);

    // The preview IS what Save writes — prefix carried.
    await expect(docRoot().getByLabel('Encoded preview')).toContainText(DOC_EDITED);
    await expect(docPill().locator('.dt-editor-tab-dirty')).toBeVisible();

    const save = docRoot().locator('.dt-storagedoc-save');
    await expect(save).toBeEnabled();
    await save.click();

    interface StoredHeaderRule {
      type: string;
      name?: string;
      published?: boolean;
      action?: { requestHeaders?: Array<{ headerName: string; value?: string }> };
    }
    await expect
      .poll(async () => {
        const res = await workbench.rpc<{ rules: StoredHeaderRule[] }>('getLocalRules');
        const rule = res.rules.find((r) => r.name === RULE_NAME);
        return {
          value: rule?.action?.requestHeaders?.find((h) => h.headerName === HEADER_NAME)?.value,
          published: rule?.published,
        };
      })
      .toEqual({ value: DOC_EDITED, published: true });

    // The document reads clean immediately (re-seeded to the written
    // value) and the dirty dot clears.
    await expect(save).toBeDisabled();
    await expect(docPill().locator('.dt-editor-tab-dirty')).toHaveCount(0);

    // Re-fire: the DNR recompile lands async after the mutation.
    await expect
      .poll(async () => (await echoFetch()).headers[HEADER_NAME.toLowerCase()], { timeout: 15_000 })
      .toBe(DOC_EDITED);
  });

  test('re-opening the same field activates the existing tab — no duplicate', async () => {
    await openCompactEditor();
    await compactEditor().getByRole('button', { name: 'Open as document' }).click();
    await expect(popover()).toHaveCount(0);
    await expect(docPill()).toBeVisible();
    await expect(panelPage.locator('.dt-editor-tab').filter({ hasText: HEADER_NAME })).toHaveCount(1);
    // The document reflects the saved edit — the canonical, not a draft.
    await expect(async () => {
      expect(await docMonacoText()).toContain(DOC_DECODED);
    }).toPass({ timeout: 15_000 });
  });
});

// ── Pair-grid document body — cookie values ──────────────────────────
// A second published rule carries a cookie-shaped value: the compact
// popover editor stays a textarea BY DESIGN, and the escalated
// document swaps Monaco for the name/value grid — the grid is a view
// over the same decoded line format, so the preview and the written
// value still come from the one codec spine.

const COOKIE_RULE_NAME = 'Panel grid rule';
const COOKIE_HEADER = 'X-OH-Grid';
const COOKIE_ORIGINAL = 'session=abc123; theme=dark; Secure';
const COOKIE_EDITED = 'session=rotated2026; theme=dark; Secure';

function cookieDocPill(): Locator {
  return panelPage.locator('.dt-editor-tab').filter({ hasText: COOKIE_HEADER }).first();
}

test.describe('Panel value document — pair grid for a cookie value', () => {
  test('a cookie value keeps the compact textarea but escalates to a grid document', async () => {
    test.setTimeout(90_000);
    await publishHeaderRule(COOKIE_RULE_NAME, COOKIE_HEADER, COOKIE_ORIGINAL);
    await expect
      .poll(async () => (await echoFetch()).headers[COOKIE_HEADER.toLowerCase()], { timeout: 15_000 })
      .toBe(COOKIE_ORIGINAL);

    // A fresh row that fired BOTH rules — attribution is per-request,
    // and rows append newest-last.
    await echoFetch();
    const matchedTab = panelPage.locator('[data-tool-window="matched-rules"]').first();
    if ((await matchedTab.getAttribute('aria-selected')) !== 'true') {
      await matchedTab.click();
    }
    await panelPage.locator('.dt-row').filter({ hasText: 'echo' }).last().click();
    await expect(panelPage.locator('.dt-matched-rules-panel-body')).toContainText(COOKIE_RULE_NAME, {
      timeout: 10_000,
    });
    await panelPage.locator('.dt-matched-rule').filter({ hasText: COOKIE_RULE_NAME }).first().hover();
    await expect(popover()).toBeVisible();

    const cell = popover()
      .locator('.oh-template-input-wrapper')
      .filter({ has: panelPage.getByLabel('Edit cookie pairs', { exact: true }) })
      .first();
    await cell.hover();
    await cell.getByLabel('Edit cookie pairs', { exact: true }).click();

    // Compact stays a textarea — the grid needs room the popover
    // doesn't have; line-per-segment seed unchanged.
    const editor = popover().getByRole('group', { name: 'Cookie value' });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Cookie value decoded text')).toHaveValue('session=abc123\ntheme=dark\nSecure');

    await editor.getByRole('button', { name: 'Open as document' }).click();
    await expect(popover()).toHaveCount(0);

    // The document body is the grid, not Monaco: one row per segment,
    // the bare flag with its flag placeholder.
    await expect(cookieDocPill()).toBeVisible();
    await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText(`${COOKIE_RULE_NAME} › ${COOKIE_HEADER}`);
    await expect(docRoot().locator('.dt-storagedoc-crumb')).toContainText('Cookie value');
    await expect(docRoot().locator('.monaco-editor')).toHaveCount(0);
    await expect(docRoot().getByLabel('Row 1 name')).toHaveValue('session');
    await expect(docRoot().getByLabel('Row 1 value')).toHaveValue('abc123');
    await expect(docRoot().getByLabel('Row 3 name')).toHaveValue('Secure');
    await expect(docRoot().getByLabel('Row 3 value')).toHaveAttribute('placeholder', 'flag');
    await expect(docRoot().locator('.dt-storagedoc-save')).toBeDisabled();
  });

  test('a grid cell edit previews the re-joined value, and Save persists + rides the wire', async () => {
    await docRoot().getByLabel('Row 1 value').fill('rotated2026');

    // The preview IS what Save writes — re-joined `; ` framing.
    await expect(docRoot().getByLabel('Encoded preview')).toContainText(COOKIE_EDITED);
    await expect(cookieDocPill().locator('.dt-editor-tab-dirty')).toBeVisible();

    const save = docRoot().locator('.dt-storagedoc-save');
    await expect(save).toBeEnabled();
    await save.click();

    interface StoredHeaderRule {
      type: string;
      name?: string;
      published?: boolean;
      action?: { requestHeaders?: Array<{ headerName: string; value?: string }> };
    }
    await expect
      .poll(async () => {
        const res = await workbench.rpc<{ rules: StoredHeaderRule[] }>('getLocalRules');
        const rule = res.rules.find((r) => r.name === COOKIE_RULE_NAME);
        return {
          value: rule?.action?.requestHeaders?.find((h) => h.headerName === COOKIE_HEADER)?.value,
          published: rule?.published,
        };
      })
      .toEqual({ value: COOKIE_EDITED, published: true });

    // Reads clean immediately — re-seeded to the written value.
    await expect(save).toBeDisabled();
    await expect(cookieDocPill().locator('.dt-editor-tab-dirty')).toHaveCount(0);

    await expect
      .poll(async () => (await echoFetch()).headers[COOKIE_HEADER.toLowerCase()], { timeout: 15_000 })
      .toBe(COOKIE_EDITED);
  });
});

// ── JWT modal re-signing on a published rule ─────────────────────────
// Re-signing lives ONLY in the workbench JWT modal (the panel's compact
// editor is payload-only by design), so this leg drives the RULE editor
// the publish flow left open: the Bearer-JWT value's rail opens the
// modal → payload edit + HMAC secret → derived "re-signed" status →
// modal Save carries the `Bearer ` prefix back → rule Save re-publishes
// → the DNR-injected header on the wire is byte-equal to an INDEPENDENT
// node:crypto HMAC over the same signing input.

const JWT_RULE_NAME = 'Panel jwt rule';
const JWT_HEADER_NAME = 'X-OH-Jwt';
const b64url = (text: string) => Buffer.from(text).toString('base64url');

/** Compact-JSON JWT — the same serialization `encodeJWT` uses. */
function makeJWT(header: object, payload: object, secret: string): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

const JWT_HEADER_OBJ = { alg: 'HS256', typ: 'JWT' };
const JWT_PAYLOAD_EDITED_OBJ = { sub: 'admin@openheaders.io', iss: 'openheaders.io' };
const JWT_ORIGINAL = makeJWT(JWT_HEADER_OBJ, { sub: 'user@openheaders.io', iss: 'openheaders.io' }, 'legacy-secret');
const RESIGN_SECRET = 'oh-e2e-signing-secret';
const JWT_RESIGNED = makeJWT(JWT_HEADER_OBJ, JWT_PAYLOAD_EDITED_OBJ, RESIGN_SECRET);

test.describe('Workbench JWT modal — re-sign a published Bearer value onto the wire', () => {
  test('the modal re-signs with the secret and Save carries the prefix back', async () => {
    test.setTimeout(90_000);
    await publishHeaderRule(JWT_RULE_NAME, JWT_HEADER_NAME, `Bearer ${JWT_ORIGINAL}`);
    await expect
      .poll(async () => (await echoFetch()).headers[JWT_HEADER_NAME.toLowerCase()], { timeout: 15_000 })
      .toBe(`Bearer ${JWT_ORIGINAL}`);

    // The publish flow leaves the rule editor open — its value field
    // carries the JWT rail icon (prefix detected, modal gets the bare
    // token).
    await workbench.openValueEditor('Edit as JWT');
    const modal = workbenchPage.getByRole('dialog').filter({ hasText: 'JWT Editor' }).filter({ visible: true }).first();
    await expect(modal).toBeVisible();

    // Editor 0 is the header, 1 the payload.
    await workbench.fillMonacoWithin(modal, 1, JSON.stringify(JWT_PAYLOAD_EDITED_OBJ));
    await modal.getByPlaceholder('Signing secret').fill(RESIGN_SECRET);

    // Derived status — claimed only once the async WebCrypto sign has
    // landed in the preview.
    await expect(modal.getByText('Token re-signed with HS256')).toBeVisible();
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();

    // The cell holds the re-signed token under the carried prefix.
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit as JWT'))).toBe(`Bearer ${JWT_RESIGNED}`);
  });

  test('rule Save re-publishes, and the re-signed token rides the wire', async () => {
    await workbenchPage.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();

    interface StoredHeaderRule {
      type: string;
      name?: string;
      published?: boolean;
      action?: { requestHeaders?: Array<{ headerName: string; value?: string }> };
    }
    await expect
      .poll(async () => {
        const res = await workbench.rpc<{ rules: StoredHeaderRule[] }>('getLocalRules');
        const rule = res.rules.find((r) => r.name === JWT_RULE_NAME);
        return {
          value: rule?.action?.requestHeaders?.find((h) => h.headerName === JWT_HEADER_NAME)?.value,
          published: rule?.published,
        };
      })
      .toEqual({ value: `Bearer ${JWT_RESIGNED}`, published: true });

    // The wire token is byte-equal to the independent node:crypto HMAC.
    await expect
      .poll(async () => (await echoFetch()).headers[JWT_HEADER_NAME.toLowerCase()], { timeout: 15_000 })
      .toBe(`Bearer ${JWT_RESIGNED}`);
  });
});
