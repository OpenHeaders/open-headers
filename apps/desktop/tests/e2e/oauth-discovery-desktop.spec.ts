/**
 * Authorization-server discovery on the desktop host (RFC 8414 / OpenID
 * Connect Discovery) — the `oauthDiscover` channel the shared editor's
 * Discover action calls, driven through the renderer bridge → `oh:rpc`
 * → the daemon spine's OAuth plane over the node transport, against the
 * playground IdP's metadata document (`playground/server/oauth-api.ts`
 * serves it at the origin, the IdP's issuer identifier): the OpenID
 * form read first for a bare issuer, a pasted RFC 8414 URL read
 * verbatim, a path with no document refused by name, and the
 * discovered token endpoint minting a client-credentials bundle through
 * the real exchange — the fill is the editor's (pinned in vitest with
 * the real component); the wire is what this suite proves.
 *
 * One token POST against the playground IdP (the per-origin refresh
 * bucket admits five starts a minute).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 and the sibling OAuth suites' ports.
const DAEMON_PORT = 18647;
const PLAYGROUND = 'http://127.0.0.1:3000';
const OPENID_URL = `${PLAYGROUND}/.well-known/openid-configuration`;
const RFC8414_URL = `${PLAYGROUND}/.well-known/oauth-authorization-server`;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;

interface Metadata {
  issuer: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  deviceAuthorizationEndpoint?: string;
  grantTypesSupported?: string[];
  tokenEndpointAuthMethodsSupported?: string[];
  codeChallengeMethodsSupported?: string[];
  dpopSigningAlgValuesSupported?: string[];
  scopesSupported?: string[];
}

interface DiscoverResult {
  success: boolean;
  metadata?: Metadata;
  url?: string;
  error?: string;
}

interface FlowResult {
  success: boolean;
  bundle?: { accessToken: string; tokenType: string };
  error?: string;
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'oh-oauth-discovery-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
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
      { timeout: 45000 },
    )
    .toBe(true);
});

test.afterAll(async () => {
  await electronApp?.close();
  await rm(userData, { recursive: true, force: true });
});

test('D1 — a bare issuer reads the OpenID form and answers the four endpoints and the stated lists', async () => {
  const res = await invoke<DiscoverResult>({ type: 'oauthDiscover', input: PLAYGROUND });
  expect(res.success, res.error).toBe(true);
  expect(res.url).toBe(OPENID_URL);
  expect(res.metadata).toMatchObject({
    issuer: PLAYGROUND,
    authorizationEndpoint: `${PLAYGROUND}/api/oauth/authorize`,
    tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
    deviceAuthorizationEndpoint: `${PLAYGROUND}/api/oauth/device`,
    codeChallengeMethodsSupported: ['S256'],
  });
  expect(res.metadata?.grantTypesSupported).toEqual(
    expect.arrayContaining([
      'authorization_code',
      'client_credentials',
      'urn:ietf:params:oauth:grant-type:device_code',
    ]),
  );
  expect(res.metadata?.tokenEndpointAuthMethodsSupported).toEqual(
    expect.arrayContaining(['client_secret_post', 'client_secret_basic', 'private_key_jwt', 'client_secret_jwt']),
  );
  expect(res.metadata?.dpopSigningAlgValuesSupported).toContain('ES256');
  expect(res.metadata?.scopesSupported).toContain('openid');
});

test('D2 — a pasted RFC 8414 well-known URL is read verbatim and names the same issuer', async () => {
  const res = await invoke<DiscoverResult>({ type: 'oauthDiscover', input: RFC8414_URL });
  expect(res.success, res.error).toBe(true);
  expect(res.url).toBe(RFC8414_URL);
  expect(res.metadata?.issuer).toBe(PLAYGROUND);
  expect(res.metadata?.tokenEndpoint).toBe(`${PLAYGROUND}/api/oauth/token`);
});

test('D3 — an issuer path with no document is refused by name after every candidate', async () => {
  const res = await invoke<DiscoverResult>({ type: 'oauthDiscover', input: `${PLAYGROUND}/api/nowhere` });
  expect(res.success).toBe(false);
  expect(res.error).toMatch(/^discovery: no metadata document for http:\/\/127\.0\.0\.1:3000\/api\/nowhere/);
  expect(res.metadata).toBeUndefined();
});

test('D4 — the discovered token endpoint mints a client-credentials bundle through the real exchange', async () => {
  const discovered = await invoke<DiscoverResult>({ type: 'oauthDiscover', input: PLAYGROUND });
  expect(discovered.success, discovered.error).toBe(true);
  const res = await invoke<FlowResult>({
    type: 'oauthClientCredentials',
    config: {
      type: 'oauth2',
      credentialRef: 'cred-desktop-discovered-cc',
      issuer: discovered.metadata?.issuer,
      flow: 'client-credentials',
      authorizationEndpoint: discovered.metadata?.authorizationEndpoint,
      tokenEndpoint: discovered.metadata?.tokenEndpoint,
      clientId: 'oh-client-id',
      clientSecret: 'oh-client-secret',
      scopes: ['read'],
    },
  });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle).toMatchObject({ accessToken: 'oh-oauth-cc-token', tokenType: 'Bearer' });
});
