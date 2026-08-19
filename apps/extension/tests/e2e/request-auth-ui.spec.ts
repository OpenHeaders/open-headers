/**
 * Authorization-tab UI e2e — the DOM counterpart to the auth half of
 * `request-executor.spec.ts`.
 *
 * Where the RPC spec proves the executor folds every auth kind into the
 * wire, this one proves the *tab* the user actually touches: pick an
 * auth type in the rail Select → type credentials into the fields →
 * Send → read the `/api/echo` reflection back and assert the exact
 * credentials rode the wire. On top of the wire legs it pins the two
 * behaviors only the DOM has:
 *
 *  - SecretField masking — literal characters render as discs
 *    (CSS `text-security`, so the DOM text stays the real value) with
 *    the in-field eye toggling reveal/mask.
 *  - The value-detection rail inside SecretField — a JWT bearer token
 *    surfaces the "Edit as JWT" icon, and the JWT editor's re-sign
 *    flow runs end-to-end: edit the payload, enter an HMAC secret,
 *    Save, and the token on the wire equals an INDEPENDENT
 *    `node:crypto` HMAC of the same signing input (WebCrypto in the
 *    real browser and node can only agree on a correct signature).
 */

import { createHmac } from 'node:crypto';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
let requestUid: string;

const b64url = (text: string) => Buffer.from(text).toString('base64url');

/** Compact-JSON JWT — the same serialization `encodeJWT` uses, so the
 *  modal's carried encode of an untouched segment is byte-identical. */
function makeJWT(header: object, payload: object, secret: string): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

const JWT_HEADER = { alg: 'HS256', typ: 'JWT' };
const JWT_PAYLOAD = { sub: 'user@openheaders.io', iss: 'openheaders.io' };
const JWT_PAYLOAD_EDITED_OBJ = { sub: 'admin@openheaders.io', iss: 'openheaders.io' };
const JWT_PAYLOAD_EDITED = JSON.stringify(JWT_PAYLOAD_EDITED_OBJ);
const JWT_ORIGINAL = makeJWT(JWT_HEADER, JWT_PAYLOAD, 'legacy-secret');
const RESIGN_SECRET = 'oh-e2e-signing-secret';
const JWT_RESIGNED = makeJWT(JWT_HEADER, JWT_PAYLOAD_EDITED_OBJ, RESIGN_SECRET);

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
    name: 'auth-ui',
    method: 'GET',
    url: API_ECHO_URL,
    auth: { type: 'none' },
    body: { type: 'none' },
  });
  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();

  await workbench.openRequest(requestUid);
  await workbench.openEditorTab(/Authorization/);
});

test.afterAll(async () => {
  await context.close();
});

interface Echo {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[]>;
  auth: { kind: 'none' } | { kind: 'basic'; username: string; password: string } | { kind: 'bearer'; token: string };
}

test.describe('Authorization tab — credentials typed in the DOM reach the wire', () => {
  test('basic auth: username + password ride as the Authorization header', async () => {
    await workbench.selectAuthType('Basic Auth');
    await workbench.fillTemplateInput('username', 'alice@openheaders.io');
    await workbench.fillTemplateInput('password', 'p4ssw0rd!!');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'alice@openheaders.io', password: 'p4ssw0rd!!' });
  });

  test('the password field masks by default; the eye reveals and re-masks', async () => {
    const input = workbench.templateInput('password');
    // The mask is pure CSS (`text-security: disc`): the RENDERED text
    // (innerText) is all discs while the DOM text (textContent) stays
    // the literal secret — the value round-trip is untouched.
    await expect(input).toHaveClass(/oh-template-input-secret/);
    expect((await input.innerText()).trim()).toBe('•'.repeat('p4ssw0rd!!'.length));
    expect((await input.textContent())?.trim()).toBe('p4ssw0rd!!');

    const wrapper = workbench.templateInputWrapper('password');
    await wrapper.hover();
    await wrapper.getByLabel('Show value').click();
    await expect(input).not.toHaveClass(/oh-template-input-secret/);
    await wrapper.getByLabel('Hide value').click();
    await expect(input).toHaveClass(/oh-template-input-secret/);
  });

  test('bearer token rides as Authorization: Bearer', async () => {
    await workbench.selectAuthType('Bearer Token');
    await workbench.fillTemplateInput('bearer token', 'oh-bearer-ui-token');
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.auth).toMatchObject({ kind: 'bearer', token: 'oh-bearer-ui-token' });
  });

  test('api-key: rides its own header, then moves to the query string', async () => {
    await workbench.selectAuthType('API Key');
    await workbench.fillTemplateInput('e.g. X-API-Key', 'X-API-Key');
    await workbench.fillTemplateInput('api key value', 'oh-apikey-ui-value');
    await workbench.send();
    let echo = await workbench.responseEcho<Echo>();
    expect(echo.auth.kind).toBe('none');
    expect(echo.headers['x-api-key']).toBe('oh-apikey-ui-value');

    await workbench.selectApiKeyPlacement('Query Params');
    await workbench.send();
    echo = await workbench.responseEcho<Echo>();
    expect(echo.query['X-API-Key']).toBe('oh-apikey-ui-value');
    expect(echo.headers['x-api-key']).toBeUndefined();
  });

  test('a JWT bearer token opens the JWT editor; a secret re-signs it onto the wire', async () => {
    await workbench.selectAuthType('Bearer Token');
    await workbench.fillTemplateInput('bearer token', JWT_ORIGINAL);

    // The detector rail reaches inside SecretField — the masked JWT
    // still surfaces its edit affordance.
    await workbench.openValueEditor('Edit as JWT');
    const modal = page.getByRole('dialog').filter({ hasText: 'JWT Editor' }).filter({ visible: true }).first();
    await expect(modal).toBeVisible();

    // Editor 0 is the header, 1 the payload.
    await workbench.fillMonacoWithin(modal, 1, JWT_PAYLOAD_EDITED);
    await modal.getByPlaceholder('Signing secret').fill(RESIGN_SECRET);

    // The signing status is derived — it may only claim "re-signed"
    // once the async WebCrypto sign has actually landed in the preview.
    await expect(modal.getByText('Token re-signed with HS256')).toBeVisible();
    await modal.getByRole('button', { name: /Save$/ }).click();
    await expect(modal).toBeHidden();

    // The field now holds the re-signed token — byte-equal to an
    // independent node:crypto HMAC over the same signing input.
    // textContent, not innerText: the field is masked and innerText
    // reads the rendered discs.
    expect((await workbench.templateInput('bearer token').textContent())?.trim()).toBe(JWT_RESIGNED);

    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.auth).toMatchObject({ kind: 'bearer', token: JWT_RESIGNED });
  });
});
