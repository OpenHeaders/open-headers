/**
 * Grid-rail decoder UI e2e — the value-detection plane of the editable
 * grids, where the FULL detector registry is user-reachable (the body
 * buffer stays JWT-only by design; `request-body-decoders-ui.spec.ts`
 * pins that half).
 *
 * One header row per non-JWT registry type (the JWT rail is pinned in
 * jsdom by `grid-value-field-rail.test.tsx`), seeded through Bulk Edit.
 * Every type is walked through: value in the DOM → hover reveals the
 * rail edit icon (its aria-label is the per-type tooltip) → the
 * EncodedValueModal opens with the type's title and decoded view →
 * Save sits disabled while nothing is dirty → Cancel leaves the cell
 * untouched. A curated set then drives the full edit loop — Save
 * re-encodes and writes back into the cell in the value's ORIGINAL
 * shape (Basic prefix carry, 10-digit epoch resolution, `; ` cookie
 * re-join, compact JSON, Digest scheme carry, %XX escapes) — and one
 * final Send proves the edited values rode the wire via `/api/echo`.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Matches the Headers bulk-edit textarea placeholder. */
const HEADERS_BULK = /Content-Type: application/;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let requestUid: string;

const b64 = (text: string) => Buffer.from(text).toString('base64');
const hex = (text: string) => Buffer.from(text).toString('hex');

const BASIC_ORIGINAL = `Basic ${b64('user@openheaders.io:hunter2!!')}`;
const BASIC_EDITED = `Basic ${b64('admin@openheaders.io:rotated2026!!')}`;

/** One row per non-JWT registry type. `icon` is the rail edit icon's
 *  accessible name (the per-type tooltip), `title` the modal's, and
 *  `probe` a fragment the decoded pane must show. */
const CASES = [
  {
    key: 'X-Data-Uri',
    value: 'data:text/plain,hello%20openheaders',
    icon: 'Edit data URI content',
    title: 'Data URI',
    probe: 'hello openheaders',
  },
  {
    key: 'X-Http-Date',
    value: 'Wed, 21 Oct 2026 07:28:00 GMT',
    icon: 'Edit HTTP date',
    title: 'HTTP date',
    probe: '2026-10-21T07:28:00Z',
  },
  {
    key: 'X-CSP',
    value: "default-src 'self'; script-src 'self' https://cdn.openheaders.io",
    icon: 'Edit CSP directives',
    title: 'Content Security Policy',
    probe: "script-src 'self' https://cdn.openheaders.io",
  },
  {
    key: 'X-HSTS',
    value: 'max-age=31536000; includeSubDomains; preload',
    icon: 'Edit HSTS directives',
    title: 'Strict-Transport-Security',
    probe: 'includeSubDomains',
  },
  {
    key: 'X-Disposition',
    value: 'attachment; filename="report.pdf"',
    icon: 'Edit disposition parameters',
    title: 'Content-Disposition',
    probe: 'filename="report.pdf"',
  },
  {
    key: 'X-Link',
    value: '<https://api.openheaders.io/v2?page=3>; rel="next", <https://api.openheaders.io/v2?page=1>; rel="prev"',
    icon: 'Edit links',
    title: 'Link header',
    probe: '<https://api.openheaders.io/v2?page=1>; rel="prev"',
  },
  {
    key: 'X-Cookie',
    value: 'session=abc123; theme=dark; Path=/; Secure',
    icon: 'Edit cookie pairs',
    title: 'Cookie value',
    probe: 'session=abc123',
  },
  {
    key: 'Authorization',
    value: 'Digest username="oh-user", realm="api", nonce="abc123"',
    icon: 'Edit auth parameters',
    title: 'Authorization parameters',
    probe: 'username="oh-user"',
  },
  {
    key: 'X-Query',
    value: 'grant_type=client_credentials&scope=read%20write',
    icon: 'Edit query pairs',
    title: 'Query string',
    probe: 'grant_type=client_credentials',
  },
  {
    key: 'X-Cache-Control',
    value: 'max-age=3600, must-revalidate',
    icon: 'Edit cache directives',
    title: 'Cache-Control',
    probe: 'must-revalidate',
  },
  {
    key: 'X-Accept',
    value: 'text/html,application/xhtml+xml;q=0.9',
    icon: 'Edit accept list',
    title: 'Accept list',
    probe: 'application/xhtml+xml;q=0.9',
  },
  {
    key: 'X-Url-Encoded',
    value: 'https%3A%2F%2Fapi.openheaders.io%2Fv1',
    icon: 'Edit URL-encoded value',
    title: 'URL-encoded value',
    probe: 'https://api.openheaders.io/v1',
  },
  {
    key: 'X-Timestamp',
    value: '1720000000',
    icon: 'Edit timestamp',
    title: 'Unix timestamp',
    probe: '2024-07-03T09:46:40Z',
  },
  {
    key: 'X-Hex',
    value: hex('hello openheaders'),
    icon: 'Edit hex-encoded value',
    title: 'Hex-encoded value',
    probe: 'hello openheaders',
  },
  {
    key: 'X-Json-String',
    value: '"{\\"userId\\":123}"',
    icon: 'Edit quoted string',
    title: 'Quoted string',
    probe: '{"userId":123}',
  },
  {
    key: 'X-Json',
    value: '{"userId":123,"scopes":["read"]}',
    icon: 'Edit as JSON',
    title: 'JSON value',
    probe: '"userId": 123',
  },
  {
    key: 'X-Basic',
    value: BASIC_ORIGINAL,
    icon: 'Edit Base64 value',
    title: 'Base64 value',
    probe: 'user@openheaders.io:hunter2!!',
  },
] as const;

/** The open editor modal for a case — anchored on its type title. */
function editorModal(title: string) {
  return page.getByRole('dialog').filter({ hasText: title }).filter({ visible: true }).first();
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
  requestUid = await workbench.seedRequest({
    name: 'grid-decoders',
    method: 'POST',
    url: API_ECHO_URL,
    auth: { type: 'none' },
    body: { type: 'none' },
  });
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();

  await workbench.openRequest(requestUid);
  await workbench.openEditorTab(/Headers/);
  const lines = [...CASES.map((c) => `${c.key}: ${c.value}`), 'X-Plain: application/json'];
  await workbench.fillBulkEdit(HEADERS_BULK, lines.join('\n'));
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

test.describe('Request editor — grid value rail decoders', () => {
  test('every registry type surfaces its edit icon; plain values get the ✕ instead', async () => {
    for (const c of CASES) {
      await expect(workbench.valueCellByEditIcon(c.icon)).toHaveCount(1);
    }
    // A rail holding an edit icon suppresses the destructive ✕ …
    await expect(workbench.valueCellByEditIcon('Edit Base64 value').getByLabel('Clear value')).toHaveCount(0);
    // … while the plain row (no detector hit) keeps the ✕ and gets no
    // edit affordance — mirroring the jsdom rail pins in the real DOM.
    const plainCell = page
      .locator('.oh-template-input-wrapper')
      .filter({ hasText: 'application/json' })
      .filter({ visible: true })
      .first();
    await expect(plainCell.getByLabel('Clear value')).toHaveCount(1);
    expect(
      await plainCell
        .locator('.oh-template-input-action')
        .evaluateAll((icons) => icons.map((el) => el.getAttribute('aria-label'))),
    ).toEqual(['Clear value']);
  });

  test('each type opens its editor modal with the decoded view; Cancel leaves the cell untouched', async () => {
    for (const c of CASES) {
      await workbench.openValueEditor(c.icon);
      const modal = editorModal(c.title);
      await expect(modal).toBeVisible();
      // Retry the read — Monaco lays the buffer out asynchronously and a
      // multi-line decode may have only its first line in the DOM yet.
      await expect(async () => {
        expect(await workbench.monacoTextWithin(modal, 0)).toContain(c.probe);
      }).toPass();
      // Nothing is dirty yet — Save must sit disabled.
      await expect(modal.getByRole('button', { name: /Save$/ })).toBeDisabled();
      await modal.getByRole('button', { name: 'Cancel' }).click();
      await expect(modal).toBeHidden();
      expect(await workbench.valueCellText(workbench.valueCellByEditIcon(c.icon))).toBe(c.value);
    }
  });

  test('base64: an edited value re-encodes under the carried Basic prefix', async () => {
    await workbench.openValueEditor('Edit Base64 value');
    const modal = editorModal('Base64 value');
    await workbench.fillMonacoWithin(modal, 0, 'admin@openheaders.io:rotated2026!!');
    // The live preview shows exactly what Save will write — prefix included.
    await expect(modal).toContainText(BASIC_EDITED);
    const save = modal.getByRole('button', { name: /Save$/ });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit Base64 value'))).toBe(BASIC_EDITED);
  });

  test('timestamp: an invalid edit blocks Save; a valid ISO date writes back in 10-digit resolution', async () => {
    await workbench.openValueEditor('Edit timestamp');
    const modal = editorModal('Unix timestamp');
    await workbench.fillMonacoWithin(modal, 0, 'not a date');
    await expect(modal.getByText('Cannot encode', { exact: false })).toBeVisible();
    await expect(modal.getByRole('button', { name: /Save$/ })).toBeDisabled();
    await workbench.fillMonacoWithin(modal, 0, '2026-01-01T00:00:00Z');
    await expect(modal).toContainText('1767225600');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit timestamp'))).toBe('1767225600');
  });

  test('cookie: line-per-segment edits re-join with `; `', async () => {
    await workbench.openValueEditor('Edit cookie pairs');
    const modal = editorModal('Cookie value');
    await workbench.fillMonacoWithin(modal, 0, 'session=xyz789\ntheme=light\nPath=/\nSecure');
    await expect(modal).toContainText('session=xyz789; theme=light; Path=/; Secure');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit cookie pairs'))).toBe(
      'session=xyz789; theme=light; Path=/; Secure',
    );
  });

  test('shape preservation: %XX escapes, compact JSON, and the Digest scheme all survive the round trip', async () => {
    await workbench.openValueEditor('Edit URL-encoded value');
    let modal = editorModal('URL-encoded value');
    await workbench.fillMonacoWithin(modal, 0, 'https://api.openheaders.io/v2');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit URL-encoded value'))).toBe(
      'https%3A%2F%2Fapi.openheaders.io%2Fv2',
    );

    // The original was compact — the pretty-printed edit re-compacts.
    await workbench.openValueEditor('Edit as JSON');
    modal = editorModal('JSON value');
    await workbench.fillMonacoWithin(modal, 0, '{"userId":456,"scopes":["write"]}');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit as JSON'))).toBe(
      '{"userId":456,"scopes":["write"]}',
    );

    await workbench.openValueEditor('Edit auth parameters');
    modal = editorModal('Authorization parameters');
    await workbench.fillMonacoWithin(modal, 0, 'username="new-user"\nrealm="api"\nnonce="abc123"');
    await expect(modal).toContainText('Digest username="new-user", realm="api", nonce="abc123"');
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();
    expect(await workbench.valueCellText(workbench.valueCellByEditIcon('Edit auth parameters'))).toBe(
      'Digest username="new-user", realm="api", nonce="abc123"',
    );
  });

  test('the edited values ride the wire', async () => {
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers['x-basic']).toBe(BASIC_EDITED);
    expect(echo.headers['x-timestamp']).toBe('1767225600');
    expect(echo.headers['x-cookie']).toBe('session=xyz789; theme=light; Path=/; Secure');
    expect(echo.headers['x-url-encoded']).toBe('https%3A%2F%2Fapi.openheaders.io%2Fv2');
    expect(echo.headers['x-json']).toBe('{"userId":456,"scopes":["write"]}');
    expect(echo.headers.authorization).toBe('Digest username="new-user", realm="api", nonce="abc123"');
  });
});
