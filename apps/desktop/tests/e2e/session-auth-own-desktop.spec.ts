/**
 * The request's OWN session credential on the desktop host — the
 * session tabs' widened own-auth schemas driven through the built
 * app's shared workbench UI, the node WebSocket and gRPC transports,
 * the playground's `/net/ws-probe` (its greeting mirrors the
 * handshake's authorization header and request-target) and h2c gRPC
 * probe (`x-echo-authorization` mirrors the call's authorization
 * metadata), and the playground IdP for the OAuth 2.0
 * client-credentials exchange. Every request DEFINES its credential —
 * the seeded collection carries no pool, so nothing above the request
 * could have supplied it (the session-auth-desktop spec's twin, on
 * the own side).
 *
 *   O1  WebSocket + own OAuth 2.0: the bundle acquired at the IdP under
 *       the request's own credentialRef rides the handshake as
 *       `Authorization: Bearer …`; the Authorization tab reads the own
 *       type with the OAuth rail controls.
 *   O2  WebSocket + own JWT Bearer: the greeting's authorization
 *       carries a token minted at the dial that verifies under the
 *       request's own secret with the configured subject and lifetime.
 *   O3  gRPC + own OAuth 2.0: the same bundle rides the authorization
 *       metadata pair.
 *   O4  gRPC + own JWT Bearer: a per-invoke token, verified.
 *   O5  gRPC + own api-key in query mode (a stored config the filtered
 *       Add-to never offers): refused by the request-level sentence,
 *       nothing invoked.
 *
 * Its own spec (the desktop e2e budget law): a fresh app launch is a
 * fresh per-origin refresh bucket. This one spends ONE token POST.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the collection + the requests (built and
 * schema-validated by `fixtures/session-auth-own-desktop-seed.ts`
 * under the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports.
const DAEMON_PORT = 21437;
const PLAYGROUND = 'http://127.0.0.1:3000';
const WS_PROBE_PORT = 3000;
const GRPC_PORT = 3130;

// The requests' own material the seed fixture carries — the spec
// verifies the wire against these.
const OAUTH_CONFIG = {
  type: 'oauth2',
  credentialRef: 'oauth2-cred-e2eown01',
  flow: 'client-credentials',
  tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
  clientId: 'oh-client-id',
  clientSecret: 'oh-client-secret',
  scopes: ['read'],
};
const OAUTH_CC_TOKEN = 'oh-oauth-cc-token';
const JWT_SECRET = 'oh-e2e-own-jwt-secret';
const JWT_SUBJECT = 'session-auth-own-e2e';
const JWT_LIFETIME_SECONDS = 120;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;

interface Greeting {
  probe: string;
  authorization: string;
  url: string;
  host: string;
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
    },
  });
  workbench = await electronApp.firstWindow();
  await expect
    .poll(
      async () => {
        try {
          const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
          return typeof res.activeWorkspaceId === 'string';
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

/** Verify an HS256 compact JWT under the secret; returns its claims —
 *  the verifier's own steps, sharing no code with the signer. */
function verifyHs256(jwt: string, secret: string): Record<string, unknown> {
  const [head, body, sig] = jwt.split('.');
  expect(createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')).toBe(sig);
  expect(JSON.parse(Buffer.from(head, 'base64url').toString('utf8'))).toEqual({ typ: 'JWT', alg: 'HS256' });
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
}

// ── Workbench DOM helpers (the shared UI's selectors; visible-scoped —
//    background tabs stay mounted) ───────────────────────────────────

async function showRequestsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

async function collapseDocsPanel(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected')) === 'true') {
    await docsTab.click();
  }
}

async function expandCollection(): Promise<void> {
  const collection = workbench.locator('[data-item-id="req-col-e2eowcol"]');
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
}

function editorTab(name: string): Locator {
  return workbench.getByRole('tab', { name, exact: true }).filter({ visible: true }).first();
}

function connectButton(): Locator {
  return workbench.getByTestId('websocket-connect-button').filter({ visible: true }).first();
}

function liveBadge(): Locator {
  return workbench.getByTestId('ws-session-live-badge').filter({ visible: true }).first();
}

function closeTag(): Locator {
  return workbench.getByTestId('ws-session-close-tag').filter({ visible: true }).first();
}

function timelineMessageRows(): Locator {
  return workbench.getByTestId('ws-timeline-message-row').filter({ visible: true });
}

async function openWebsocketRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="websocket-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) await expandCollection();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await connectButton().waitFor({ state: 'visible', timeout: 10_000 });
}

async function connectAndAwaitOpen(): Promise<void> {
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  await liveBadge().filter({ hasText: 'Connected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

async function disconnectAndAwaitClose(): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await closeTag().filter({ hasText: 'Disconnected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** The probe greeting in full: the timeline preview clips long frames,
 *  so the row's copy action hands the verbatim payload over the
 *  clipboard (read back from the main process). */
async function readGreeting(): Promise<Greeting> {
  const row = timelineMessageRows().filter({ hasText: '"probe":"ws-probe"' }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  await row.hover();
  await electronApp.evaluate(({ clipboard }) => clipboard.clear());
  await row.getByTestId('ws-timeline-copy-message').click({ force: true });
  let text = '';
  await expect
    .poll(
      async () => {
        text = await electronApp.evaluate(({ clipboard }) => clipboard.readText());
        return text;
      },
      { timeout: 10_000 },
    )
    .toMatch(/"probe":"ws-probe"/);
  return JSON.parse(text) as Greeting;
}

function invokeButton(): Locator {
  return workbench.getByTestId('grpc-invoke-button').filter({ visible: true }).first();
}

function statusTag(): Locator {
  return workbench.getByTestId('grpc-status-tag').filter({ visible: true }).first();
}

function responsePane(): Locator {
  return workbench.getByTestId('grpc-response-pane').filter({ visible: true }).first();
}

async function openGrpcRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="grpc-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) await expandCollection();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await invokeButton().waitFor({ state: 'visible', timeout: 10_000 });
}

async function invokeAndAwaitOk(): Promise<void> {
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** The `x-echo-authorization` value the probe mirrored back, read off
 *  the response pane's Metadata tab. */
async function echoedAuthorization(): Promise<string> {
  await workbench
    .locator('.rules-response-tabs')
    .filter({ visible: true })
    .getByRole('tab', { name: /Metadata/ })
    .first()
    .click();
  const row = responsePane().locator('.oh-resp-hdr-row', { hasText: 'x-echo-authorization' }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  return ((await row.locator('> span').nth(1).textContent()) ?? '').trim();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-session-auth-own-desktop-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await electronApp.close();

  const seeded = spawnSync(
    'pnpm',
    [
      '--filter',
      '@openheaders/extension',
      'exec',
      'tsx',
      path.join(__dirname, 'fixtures/session-auth-own-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_WS_PROBE_PORT: String(WS_PROBE_PORT),
        OH_E2E_GRPC_PORT: String(GRPC_PORT),
        OH_E2E_PLAYGROUND: PLAYGROUND,
        OH_E2E_WORKSPACE_ID: workspaceId,
      },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots and open the requests view.
  await launchApp();
  await showRequestsView();
  await collapseDocsPanel();
  await workbench.locator('[data-item-id="req-col-e2eowcol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── O1 / O2: WebSocket ───────────────────────────────────────────────

test('O1 — an own OAuth 2.0 config: the bundle acquired under its credentialRef rides the handshake header', async () => {
  // The exchange lands the bundle in the token store under the
  // REQUEST's credentialRef — the session reads it at the dial.
  const flow = await invoke<{ success: boolean; bundle?: { accessToken: string; tokenType: string }; error?: string }>({
    type: 'oauthClientCredentials',
    config: OAUTH_CONFIG,
  });
  expect(flow.success, flow.error).toBe(true);
  expect(flow.bundle?.accessToken).toBe(OAUTH_CC_TOKEN);

  await openWebsocketRequest('e2eowws1');
  // The Authorization tab reads the request's own type with the OAuth
  // rail controls — the session kinds' own offer is the full mask.
  await editorTab('Authorization').click();
  await expect(workbench.getByTestId('ws-auth-type').filter({ visible: true }).first()).toContainText('OAuth 2.0');
  await expect(workbench.getByTestId('oh-auth-oauth2-send-as').filter({ visible: true }).first()).toBeVisible();
  await editorTab('Message').click();

  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization).toBe(`Bearer ${OAUTH_CC_TOKEN}`);
  expect(greeting.url).toBe('/net/ws-probe');
  await disconnectAndAwaitClose();
});

test('O2 — an own JWT minted at the dial rides the Authorization header and verifies under the request secret', async () => {
  const before = Math.floor(Date.now() / 1000);
  await openWebsocketRequest('e2eowws2');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization.startsWith('Bearer ')).toBe(true);
  const claims = verifyHs256(greeting.authorization.slice('Bearer '.length), JWT_SECRET);
  expect(claims.sub).toBe(JWT_SUBJECT);
  expect(claims.iat).toBeGreaterThanOrEqual(before);
  expect(claims.exp).toBe((claims.iat as number) + JWT_LIFETIME_SECONDS);
  await disconnectAndAwaitClose();
});

// ── O3 / O4 / O5: gRPC ───────────────────────────────────────────────

test('O3 — an own OAuth 2.0 config rides the gRPC authorization metadata pair', async () => {
  await openGrpcRequest('e2eowgr1');
  await invokeAndAwaitOk();
  expect(await echoedAuthorization()).toBe(`Bearer ${OAUTH_CC_TOKEN}`);
});

test('O4 — an own JWT minted per invoke rides the authorization pair and verifies under the request secret', async () => {
  const before = Math.floor(Date.now() / 1000);
  await openGrpcRequest('e2eowgr2');
  await invokeAndAwaitOk();
  const value = await echoedAuthorization();
  const claims = verifyHs256(value.slice('Bearer '.length), JWT_SECRET);
  expect(claims.sub).toBe(JWT_SUBJECT);
  expect(claims.iat).toBeGreaterThanOrEqual(before);
  expect(claims.exp).toBe((claims.iat as number) + JWT_LIFETIME_SECONDS);
});

test('O5 — an own query-placed api-key is refused by the request-level sentence on a gRPC call, nothing invoked', async () => {
  await openGrpcRequest('e2eowgr3');
  // The stored config is named above its form — the Add-to select
  // itself never offers Query on a gRPC call.
  await editorTab('Authorization').click();
  await expect(workbench.getByTestId('oh-auth-own-refusal').filter({ visible: true }).first()).toHaveText(
    'API Key in query cannot be applied to a gRPC call.',
  );
  await editorTab('Message').click();
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  const errorState = workbench.getByTestId('grpc-response-error-state').filter({ visible: true }).first();
  await expect(errorState).toContainText('API Key in query cannot be applied to a gRPC call.', { timeout: 20_000 });
});
