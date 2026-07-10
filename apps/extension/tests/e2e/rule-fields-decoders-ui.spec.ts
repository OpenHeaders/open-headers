/**
 * Rule-editor decoder UI e2e — the value-detection plane of the
 * workbench RULE editors (`DetectedValueInput` on action-side value
 * fields + `valueDetection` on rule body buffers).
 *
 * Coverage is one editor per swapped surface, each seeded through the
 * real draft-handoff wire (`createRuleDraft` RPC → `create-rule`
 * workspace intent with `draftNonce` — the same path the panel's CTAs
 * use) so the editor opens pre-filled and the rail state is what a
 * user landing from a CTA sees:
 *
 *   header value      — Basic base64, full loop incl. rule Save +
 *                       stored-rule readback via `getLocalRules`
 *   auth password     — JWT (typed in — auth has no draft variant),
 *                       payload edit over carried header + signature
 *   query-param value — URL-encoded, %XX shape preserved on write-back
 *   redirect target   — data URI, meta carried on write-back
 *   request-body rule — in-buffer JWT decoration probe (JWT-only plane)
 *
 * Negatives ride the header editor: a base64 blob sitting in the
 * header NAME field and a JWT sitting in the URL condition get NO rail
 * icon — names and condition side are bare by design.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;

const b64 = (text: string) => Buffer.from(text).toString('base64');

const BASIC_ORIGINAL = `Basic ${b64('user@openheaders.io:hunter2!!')}`;
const BASIC_EDITED = `Basic ${b64('admin@openheaders.io:rotated2026!!')}`;
/** Clean base64 blob — detectable as base64, parked in a header NAME
 *  field to pin that names never get the rail. Source length is a
 *  multiple of 3 so the blob is padding-free: `=` is not a legal
 *  header-name tchar, and the point is a VALID name that stays bare,
 *  not one the editor rejects outright. */
const NAME_BLOB = b64('hello world hello world!');

// Token built the way the JWT editor re-assembles one (compact JSON →
// base64url, no padding) so the header segment is byte-stable across a
// decode-edit-reencode round trip.
const b64url = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const JWT_PAYLOAD = { sub: 'user@openheaders.io', exp: 4000000000 };
const SIGNATURE = 'original-sig-bytes';
const TOKEN = `${b64url(JWT_HEADER)}.${b64url(JWT_PAYLOAD)}.${SIGNATURE}`;
const EDITED_PAYLOAD = { sub: 'admin@openheaders.io', role: 'admin' };
const EDITED_TOKEN = `${b64url(JWT_HEADER)}.${b64url(EDITED_PAYLOAD)}.${SIGNATURE}`;

/** The open editor modal for a detected type — anchored on its title. */
function editorModal(title: string) {
  return page.getByRole('dialog').filter({ hasText: title }).filter({ visible: true }).first();
}

/**
 * Stash a draft in the background store and deliver a `create-rule`
 * intent carrying its nonce to the workbench tab — the panel CTA
 * handoff wire. Omit `draft` for a bare create tab (auth has no draft
 * variant).
 */
async function openRuleEditor(ruleType: string, draft?: Record<string, unknown>): Promise<void> {
  let draftNonce: string | undefined;
  if (draft) {
    const res = await workbench.rpc<{ success: boolean; nonce?: string; error?: string }>('createRuleDraft', {
      draft,
    });
    expect(res.success, res.error).toBe(true);
    draftNonce = res.nonce;
  }
  const intent: Record<string, unknown> = { kind: 'create-rule', ruleType };
  if (draftNonce) intent.draftNonce = draftNonce;
  // Warm-path delivery through the SW, same as the workspace navigator —
  // changing location.hash after mount would be a no-op (one-shot router).
  await context.serviceWorkers()[0]!.evaluate(
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
    { url: `chrome-extension://${extensionId}/workbench.html`, intent },
  );
}

/** Type into a TemplateInput (contentEditable) located by its
 *  data-placeholder — the rule editors have no Bulk Edit escape hatch. */
async function fillTemplate(placeholder: string, text: string): Promise<void> {
  const el = page.locator(`[data-placeholder="${placeholder}"]`).filter({ visible: true }).first();
  await el.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(text);
}

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);
  // Destination for the header rule's full Save leg.
  const col = await workbench.rpc<{ success: boolean; collection?: { uid: string } }>('createLocalCollection', {
    name: 'Decoder rules',
  });
  expect(col.success).toBe(true);
});

test.afterAll(async () => {
  await context.close();
});

test.describe('Rule editors — action-side value rail decoders', () => {
  test('header value: rail on the value only; name and condition side stay bare', async () => {
    await openRuleEditor('header', {
      type: 'header',
      // `urlFilter` lands verbatim as a url-filter condition value
      // (`url` would be re-derived through the workspace's draft-URL
      // strategy) — the condition-side bare negative needs the exact
      // token in the input.
      urlFilter: TOKEN,
      requestHeaders: [
        { operation: 'override', headerName: 'Authorization', value: BASIC_ORIGINAL },
        { operation: 'override', headerName: NAME_BLOB, value: 'plain-value' },
      ],
    });

    // The Basic value cell carries the rail icon…
    await expect(workbench.valueCellByEditIcon('Edit Base64 value')).toHaveCount(1);
    // …and it is the ONLY base64 icon in the editor: the second row's
    // NAME field holds a clean base64 blob and must stay bare.
    await expect(page.getByLabel('Edit Base64 value', { exact: true }).filter({ visible: true })).toHaveCount(1);
    const nameCell = page
      .locator('.oh-template-input-wrapper')
      .filter({ hasText: NAME_BLOB })
      .filter({ visible: true })
      .first();
    await expect(nameCell.getByLabel('Clear value')).toHaveCount(1);

    // Condition side: the URL condition holds a JWT — no rail anywhere.
    await expect(page.locator('.oh-template-input-editable').filter({ hasText: TOKEN }).first()).toBeVisible();
    await expect(page.getByLabel('Edit as JWT', { exact: true }).filter({ visible: true })).toHaveCount(0);
  });

  test('header value: decode, edit, modal-save re-encodes under the Basic prefix', async () => {
    await workbench.openValueEditor('Edit Base64 value');
    const modal = editorModal('Base64 value');
    await expect(modal).toBeVisible();
    await expect(async () => {
      expect(await workbench.monacoTextWithin(modal, 0)).toContain('user@openheaders.io:hunter2!!');
    }).toPass();
    await expect(modal.getByRole('button', { name: /Save$/ })).toBeDisabled();

    await workbench.fillMonacoWithin(modal, 0, 'admin@openheaders.io:rotated2026!!');
    await expect(modal).toContainText(BASIC_EDITED);
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit Base64 value'))).toBe(BASIC_EDITED);
  });

  test('header rule: Save persists the re-encoded value into the stored rule', async () => {
    await page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first().click();
    const saveModal = page.getByRole('dialog').filter({ hasText: 'Save to' }).filter({ visible: true }).first();
    await expect(saveModal).toBeVisible();
    await saveModal.getByRole('option').filter({ hasText: 'Decoder rules' }).click();
    await saveModal.getByRole('button', { name: /Save$/ }).click();
    await expect(saveModal).toBeHidden();

    interface StoredHeaderRule {
      type: string;
      action?: { requestHeaders?: Array<{ headerName: string; value?: string }> };
    }
    await expect
      .poll(async () => {
        const res = await workbench.rpc<{ rules: StoredHeaderRule[] }>('getLocalRules');
        const rule = res.rules.find(
          (r) => r.type === 'header' && r.action?.requestHeaders?.some((h) => h.headerName === 'Authorization'),
        );
        return rule?.action?.requestHeaders?.find((h) => h.headerName === 'Authorization')?.value;
      })
      .toBe(BASIC_EDITED);
  });

  test('auth password: a typed JWT gets the rail; payload edit carries header + signature', async () => {
    await openRuleEditor('auth');
    await fillTemplate('e.g. dev-user or {{env.PROXY_USER}}', 'dev-user');
    await fillTemplate('e.g. {{vault.STAGING_PW}}', TOKEN);

    // Password cell lights up; the plain username stays bare — exactly
    // one JWT icon in the editor.
    await expect(page.getByLabel('Edit as JWT', { exact: true }).filter({ visible: true })).toHaveCount(1);

    await workbench.openValueEditor('Edit as JWT');
    const modal = editorModal('JWT Editor');
    await expect(modal).toBeVisible();
    await expect(async () => {
      expect(await workbench.monacoTextWithin(modal, 1)).toContain('"sub": "user@openheaders.io"');
    }).toPass();
    await expect(modal.getByRole('button', { name: /Save$/ })).toBeDisabled();

    await workbench.fillMonacoWithin(modal, 1, JSON.stringify(EDITED_PAYLOAD));
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit as JWT'))).toBe(EDITED_TOKEN);
  });

  test('query-param value: %XX escapes survive the round trip', async () => {
    await openRuleEditor('query-param', {
      type: 'query-param',
      params: [{ operation: 'override', param: 'redirect_uri', value: 'https%3A%2F%2Fapi.openheaders.io%2Fv1' }],
    });

    await workbench.openValueEditor('Edit URL-encoded value');
    const modal = editorModal('URL-encoded value');
    await expect(modal).toBeVisible();
    await expect(async () => {
      expect(await workbench.monacoTextWithin(modal, 0)).toContain('https://api.openheaders.io/v1');
    }).toPass();
    await workbench.fillMonacoWithin(modal, 0, 'https://api.openheaders.io/v2');
    await expect(modal).toContainText('https%3A%2F%2Fapi.openheaders.io%2Fv2');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit URL-encoded value'))).toBe(
      'https%3A%2F%2Fapi.openheaders.io%2Fv2',
    );
  });

  test('redirect target: data URI decodes and re-encodes with its meta carried', async () => {
    await openRuleEditor('redirect', {
      type: 'redirect',
      redirectTo: 'data:text/plain,hello%20openheaders',
    });

    await workbench.openValueEditor('Edit data URI content');
    const modal = editorModal('Data URI');
    await expect(modal).toBeVisible();
    await expect(async () => {
      expect(await workbench.monacoTextWithin(modal, 0)).toContain('hello openheaders');
    }).toPass();
    await workbench.fillMonacoWithin(modal, 0, 'redirect landing');
    await expect(modal).toContainText('data:text/plain,redirect%20landing');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit data URI content'))).toBe(
      'data:text/plain,redirect%20landing',
    );
  });

  test('request-body rule: the static body buffer decorates the JWT and opens the editor', async () => {
    const body = `{"auth":"${TOKEN}","plain":"window.location.href"}`;
    await openRuleEditor('request-body', {
      type: 'request-body',
      bodyType: 'static',
      requestBody: body,
    });

    const buffer = page.locator('.monaco-editor').filter({ visible: true }).first();
    const links = buffer.locator('.oh-jwt-token-link');
    await expect(links.first()).toBeVisible();
    // The decoration covers the whole token and NOTHING else (the
    // dotted `window.location.href` run stays bare).
    await expect(async () => {
      expect((await links.allInnerTexts()).join('')).toBe(TOKEN);
    }).toPass();

    await buffer.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home');
    await links
      .first()
      .click({ position: { x: 10, y: 5 }, modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] });
    const modal = editorModal('JWT Editor');
    await expect(modal).toBeVisible();
    await expect(async () => {
      expect(await workbench.monacoTextWithin(modal, 1)).toContain('"sub": "user@openheaders.io"');
    }).toPass();
    await modal.getByRole('button', { name: 'Cancel' }).click();
    await expect(modal).toBeHidden();
  });
});
