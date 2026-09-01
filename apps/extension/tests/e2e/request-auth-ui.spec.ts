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
import {
  AUTH_SUITE_OAUTH_SEEDS,
  AUTH_TYPE_CASES,
  buildAuthSuiteSeedEnvelope,
} from '../../../../playground/scripts/auth-type-suite';
import { assertEchoAuth, type EchoAuthResponse } from './pages/echo-auth';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
/** Seeded request uid per suite case name — the import mints fresh uids. */
const suiteUids = new Map<string, string>();

const b64url = (text: string) => Buffer.from(text).toString('base64url');

/** Compact-JSON JWT — the same serialization `encodeJWT` uses, so the
 *  modal's carried encode of an untouched segment is byte-identical. */
function makeJWT(header: object, payload: object, secret: string): string {
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

/** The Headers tab's Bulk Edit textarea, by its placeholder. */
const HEADERS_BULK = /Content-Type: application/;

/** RFC 7617's `Authorization` value for a credential pair — node's
 *  encoder, independent of the SW's TextEncoder + btoa. */
const basicHeader = (username: string, password: string) =>
  `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;

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

  // The oauth2 cases read the per-workspace token store — seed it once
  // through the real flows against the playground IdP (the assertion
  // cases' bundles prove the IdP verified the signed assertion).
  for (const { channel, config } of AUTH_SUITE_OAUTH_SEEDS) {
    const seed = await workbench.rpc<{ success: boolean; error?: string }>(channel, { config });
    expect(seed.success, `${channel} ${config.credentialRef}: ${seed.error ?? ''}`).toBe(true);
  }

  // One import seeds the whole suite — the collection with its auth
  // pool and one request per type — secrets intact (the raw envelope
  // bypasses the export pipeline's stripping). Uids are minted on
  // import, so the cases are recovered by name.
  const imported = await workbench.rpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: buildAuthSuiteSeedEnvelope(),
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:auth-type-suite-seed',
  });
  expect(imported.success, imported.error).toBe(true);
  const reqs = await workbench.rpc<{ requests: Array<{ uid: string; name: string }> }>('getLocalRequests');
  for (const c of AUTH_TYPE_CASES) {
    const hit = reqs.requests.find((r) => r.name === c.name);
    expect(hit, `seeded request for ${c.name}`).toBeDefined();
    suiteUids.set(c.name, hit!.uid);
  }

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
});

async function openSuiteRequest(name: string): Promise<void> {
  await workbench.openRequest(suiteUids.get(name)!);
}

test.afterAll(async () => {
  await context.close();
});

type Echo = EchoAuthResponse;

test.describe("Auth type suite — every type's request opens and sends", () => {
  for (const c of AUTH_TYPE_CASES) {
    test(c.name, async () => {
      await openSuiteRequest(c.name);
      await workbench.send();
      assertEchoAuth(await workbench.responseEcho<Echo>(), c.expected);
    });
  }
});

test.describe('Authorization tab — seeded credentials render in the form', () => {
  test('the Basic Auth request shows its username and its masked password', async () => {
    await openSuiteRequest('Basic Auth');
    await workbench.openEditorTab(/Authorization/);
    expect((await workbench.templateInput('username').textContent())?.trim()).toBe('alice@openheaders.io');
    const password = workbench.templateInput('password');
    await expect(password).toHaveClass(/oh-template-input-secret/);
    expect((await password.textContent())?.trim()).toBe('p4ssw0rd');
  });
});

test.describe('Authorization tab — credentials typed in the DOM reach the wire', () => {
  test('basic auth: username + password ride as the Authorization header', async () => {
    // The No Auth request is the scratch surface for the typed legs —
    // the rail Select picks each type, the fields take the credentials.
    await openSuiteRequest('No Auth');
    await workbench.openEditorTab(/Authorization/);
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

  test("a user's Authorization row is struck through under basic auth and does not ride", async () => {
    // Basic is still selected from the legs above; add a colliding
    // user row on the Headers tab and read the tab's promise back off
    // the wire — the struck row is the one the executor drops.
    await workbench.openEditorTab(/Headers/);
    await workbench.fillBulkEdit(HEADERS_BULK, 'Authorization: Bearer stale-user-token');
    await expect(page.getByTestId('oh-kv-row-warning').filter({ visible: true })).toBeVisible();
    await workbench.send();
    const echo = await workbench.responseEcho<Echo>();
    expect(echo.headers.authorization).toBe(basicHeader('alice@openheaders.io', 'p4ssw0rd!!'));
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'alice@openheaders.io', password: 'p4ssw0rd!!' });

    // Clear the row so the later legs (api-key asserts NO Authorization
    // at all) start from the seeded header-less request.
    await workbench.fillBulkEdit(HEADERS_BULK, '');
    await expect(page.getByTestId('oh-kv-row-warning').filter({ visible: true })).toHaveCount(0);
    await workbench.openEditorTab(/Authorization/);
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
