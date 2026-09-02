/**
 * Session auth on the desktop host — the widened per-kind mask driven
 * through the built app's shared workbench UI, the node WebSocket and
 * gRPC transports, the playground's `/net/ws-probe` (its greeting
 * mirrors the handshake's authorization header, request-target and
 * Host) and h2c gRPC probe (`x-echo-authorization` mirrors the call's
 * authorization metadata), and the playground IdP for the OAuth 2.0
 * client-credentials exchange. Every session INHERITS its credential
 * from the seeded collection pool — the slice's point.
 *
 *   S1  OAuth 2.0: the bundle acquired at the IdP rides the handshake
 *       as `Authorization: Bearer …` — read from the token store at
 *       the dial, no token on the request.
 *   S2  JWT Bearer, header mode: the greeting's authorization carries
 *       a token minted at the dial that verifies under the pool's
 *       secret with the configured subject and lifetime.
 *   S3  JWT Bearer, query mode: the token rides the handshake URL's
 *       `token` parameter and verifies the same way.
 *   S4  AWS SigV4, query mode: the dial URL carries the `X-Amz-*`
 *       parameters and the signature recomputes over the request-
 *       target and Host the probe saw — the API Gateway shape.
 *   S5  AWS SigV4, header mode: refused by name before the wire.
 *   S6  api-key in query: the key rides the handshake URL.
 *   G1  gRPC + OAuth 2.0: the same bundle rides the authorization
 *       metadata pair.
 *   G2  gRPC + JWT Bearer: a per-invoke token, verified.
 *   G3  gRPC + JWT in query mode: refused by name, nothing invoked.
 *
 * Its own spec (the desktop e2e budget law): a fresh app launch is a
 * fresh per-origin refresh bucket. This one spends ONE token POST.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the pool collection + the requests (built and
 * schema-validated by `fixtures/session-auth-desktop-seed.ts` under
 * the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports.
const DAEMON_PORT = 21337;
const PLAYGROUND = 'http://127.0.0.1:3000';
const WS_PROBE_PORT = 3000;
const GRPC_PORT = 3130;

// The pool material the seed fixture carries — the spec verifies the
// wire against these.
const OAUTH_CONFIG = {
  type: 'oauth2',
  credentialRef: 'oauth2-cred-e2esa001',
  flow: 'client-credentials',
  tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
  clientId: 'oh-client-id',
  clientSecret: 'oh-client-secret',
  scopes: ['read'],
};
const OAUTH_CC_TOKEN = 'oh-oauth-cc-token';
const JWT_SECRET = 'oh-e2e-session-jwt-secret';
const JWT_SUBJECT = 'session-auth-e2e';
const JWT_LIFETIME_SECONDS = 120;
const AWS_ACCESS_KEY_ID = 'AKIDEXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY';
const API_KEY_VALUE = 'e2e-partner-key';

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

// ── Verification helpers — the verifiers' own steps, sharing no code
//    with the signers ────────────────────────────────────────────────

/** Verify an HS256 compact JWT under the secret; returns its claims. */
function verifyHs256(jwt: string, secret: string): Record<string, unknown> {
  const [head, body, sig] = jwt.split('.');
  expect(createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url')).toBe(sig);
  expect(JSON.parse(Buffer.from(head, 'base64url').toString('utf8'))).toEqual({ typ: 'JWT', alg: 'HS256' });
  return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
}

const rfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** Recompute a query-mode SigV4 signature over the request-target and
 *  Host the SERVER saw — the AWS verifier's own steps. */
function recomputeSigV4(requestTarget: string, host: string): { signature: string; expected: string } {
  const url = new URL(requestTarget, 'http://placeholder');
  const pairs: Array<[string, string]> = [];
  url.searchParams.forEach((value, key) => {
    if (key !== 'X-Amz-Signature') pairs.push([rfc3986(key), rfc3986(value)]);
  });
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const amzDate = url.searchParams.get('X-Amz-Date') ?? '';
  const scope = (url.searchParams.get('X-Amz-Credential') ?? '').split('/').slice(1).join('/');
  const [dateStamp, region, service] = scope.split('/');
  const canonicalRequest = [
    'GET',
    url.pathname,
    pairs.map(([k, v]) => `${k}=${v}`).join('&'),
    `host:${host}\n`,
    'host',
    createHash('sha256').update('').digest('hex'),
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  let key: Buffer = createHmac('sha256', `AWS4${AWS_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
  for (const part of [region, service, 'aws4_request']) key = createHmac('sha256', key).update(part).digest();
  return {
    signature: url.searchParams.get('X-Amz-Signature') ?? '',
    expected: createHmac('sha256', key).update(stringToSign).digest('hex'),
  };
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
  const collection = workbench.locator('[data-item-id="req-col-e2esacol"]');
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
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
  // The clipboard still holds the previous leg's greeting — clear it so
  // the poll below waits for THIS session's copy.
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
  userData = await mkdtemp(path.join(tmpdir(), 'oh-session-auth-desktop-e2e-'));
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
      path.join(__dirname, 'fixtures/session-auth-desktop-seed.ts'),
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
  await workbench.locator('[data-item-id="req-col-e2esacol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── S1: OAuth 2.0 ────────────────────────────────────────────────────

test('S1 — the OAuth 2.0 bundle acquired at the IdP rides the handshake as the Authorization header', async () => {
  // The exchange lands the bundle in the token store under the pool
  // entry's credentialRef — the session reads it at the dial.
  const flow = await invoke<{ success: boolean; bundle?: { accessToken: string; tokenType: string }; error?: string }>({
    type: 'oauthClientCredentials',
    config: OAUTH_CONFIG,
  });
  expect(flow.success, flow.error).toBe(true);
  expect(flow.bundle?.accessToken).toBe(OAUTH_CC_TOKEN);

  await openWebsocketRequest('e2esaws1');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization).toBe(`Bearer ${OAUTH_CC_TOKEN}`);
  expect(greeting.url).toBe('/net/ws-probe');
  await disconnectAndAwaitClose();
});

// ── S2 / S3: JWT Bearer ──────────────────────────────────────────────

test('S2 — a JWT minted at the dial rides the Authorization header and verifies under the pool secret', async () => {
  const before = Math.floor(Date.now() / 1000);
  await openWebsocketRequest('e2esaws2');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization.startsWith('Bearer ')).toBe(true);
  const claims = verifyHs256(greeting.authorization.slice('Bearer '.length), JWT_SECRET);
  expect(claims.sub).toBe(JWT_SUBJECT);
  expect(claims.iat).toBeGreaterThanOrEqual(before);
  expect(claims.exp).toBe((claims.iat as number) + JWT_LIFETIME_SECONDS);
  await disconnectAndAwaitClose();
});

test('S3 — in query mode the JWT rides the handshake URL token parameter, no header', async () => {
  await openWebsocketRequest('e2esaws3');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization).toBe('');
  const token = new URL(greeting.url, 'http://placeholder').searchParams.get('token') ?? '';
  expect(verifyHs256(token, JWT_SECRET).sub).toBe(JWT_SUBJECT);
  await disconnectAndAwaitClose();
});

// ── S4 / S5: AWS SigV4 ───────────────────────────────────────────────

test('S4 — the signed URL carries the X-Amz-* parameters and the signature recomputes over what the probe saw', async () => {
  await openWebsocketRequest('e2esaws4');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization).toBe('');
  const url = new URL(greeting.url, 'http://placeholder');
  expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
  expect(url.searchParams.get('X-Amz-Credential')).toMatch(
    new RegExp(`^${AWS_ACCESS_KEY_ID}/\\d{8}/us-east-1/execute-api/aws4_request$`),
  );
  expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
  expect(greeting.url.split('&').at(-1)).toMatch(/^X-Amz-Signature=[0-9a-f]{64}$/);
  const { signature, expected } = recomputeSigV4(greeting.url, greeting.host);
  expect(signature).toBe(expected);
  await disconnectAndAwaitClose();
});

test('S5 — an AWS signature in header mode is refused by name before the wire', async () => {
  await openWebsocketRequest('e2esaws5');
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  const errorState = workbench.getByTestId('ws-timeline-error-row').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(workbench.getByTestId('ws-session-error-detail').filter({ visible: true }).first()).toContainText(
    "Inherited AWS Signature v4 in header from Collection 'Session Auth' › Gateway (header) cannot be applied to a WebSocket session.",
  );
  await expect(closeTag()).toHaveText('Connect failed');
});

// ── S6: api-key in query ─────────────────────────────────────────────

test('S6 — a query-placed api-key rides the handshake URL', async () => {
  await openWebsocketRequest('e2esaws6');
  await connectAndAwaitOpen();
  const greeting = await readGreeting();
  expect(greeting.authorization).toBe('');
  expect(new URL(greeting.url, 'http://placeholder').searchParams.get('api_key')).toBe(API_KEY_VALUE);
  await disconnectAndAwaitClose();
});

// ── G1 / G2 / G3: gRPC ───────────────────────────────────────────────

test('G1 — the OAuth 2.0 bundle rides the gRPC authorization metadata pair', async () => {
  await openGrpcRequest('e2esagr1');
  await invokeAndAwaitOk();
  expect(await echoedAuthorization()).toBe(`Bearer ${OAUTH_CC_TOKEN}`);
});

test('G2 — a JWT minted per invoke rides the authorization pair and verifies under the pool secret', async () => {
  const before = Math.floor(Date.now() / 1000);
  await openGrpcRequest('e2esagr2');
  await invokeAndAwaitOk();
  const value = await echoedAuthorization();
  const claims = verifyHs256(value.slice('Bearer '.length), JWT_SECRET);
  expect(claims.sub).toBe(JWT_SUBJECT);
  expect(claims.iat).toBeGreaterThanOrEqual(before);
  expect(claims.exp).toBe((claims.iat as number) + JWT_LIFETIME_SECONDS);
});

test('G3 — a JWT in query mode is refused by name on a gRPC call, nothing invoked', async () => {
  await openGrpcRequest('e2esagr3');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  const errorState = workbench.getByTestId('grpc-response-error-state').filter({ visible: true }).first();
  await expect(errorState).toContainText(
    "Inherited JWT Bearer in query from Collection 'Session Auth' › Signer (query) cannot be applied to a gRPC call.",
    { timeout: 20_000 },
  );
});
