/**
 * OAuth 2.0 signed assertions on the desktop host (RFC 7523) — the two
 * JWT client-authentication methods and the JWT bearer grant driven
 * through the renderer bridge → `oh:rpc` → the daemon spine's OAuth
 * plane, against the playground IdP (`playground/server/oauth-api.ts`),
 * which VERIFIES every assertion under its registered P-256 public key
 * (or the client secret's HMAC): `private_key_jwt` on client
 * credentials, the jwt-bearer grant and its bearer riding a real send
 * to `/api/echo`, `client_secret_jwt` on the code exchange and again
 * on the refresh POST, and a wrong-audience assertion refused with
 * `invalid_client` and nothing persisted.
 *
 * Its own spec (not a leg of `oauth-desktop.spec.ts`): a fresh app
 * launch is a fresh per-origin refresh bucket, and that suite already
 * spends the five token POSTs a minute the bucket admits. This one
 * makes exactly five as well.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import {
  ASAP_SUITE_PRIVATE_KEY_PEM,
  OAUTH2_JWT_BEARER_SEED_AUTH,
} from '../../../../playground/scripts/auth-type-suite';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 and the other OAuth suite's port so the runs
// never collide with a real install or each other.
const DAEMON_PORT = 18647;
const PLAYGROUND = 'http://127.0.0.1:3000';
const API_ECHO_URL = `${PLAYGROUND}/api/echo`;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;

interface Bundle {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
}

interface FlowResult {
  success: boolean;
  bundle?: Bundle;
  error?: string;
}

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

interface Echo {
  auth: { kind: 'none' } | { kind: 'bearer'; token: string };
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

/** The suite's P-256 key — the IdP registered its public half. */
function signedConfig(over: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'oauth2',
    flow: 'client-credentials',
    tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
    clientId: 'oh-client-id',
    scopes: ['read'],
    assertionAlgorithm: 'ES256',
    assertionKeyId: 'openheaders/suite/key-1',
    assertionPrivateKey: ASAP_SUITE_PRIVATE_KEY_PEM,
    ...over,
  };
}

let nextUid = 0;
async function sendWith(auth: Record<string, unknown>): Promise<Echo> {
  nextUid += 1;
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: {
      schemaVersion: 5,
      uid: `req-oauth-as-${nextUid}`,
      path: `requests/oauth-assertion-desktop/req-${nextUid}`,
      name: 'oauth assertion desktop e2e',
      method: 'GET',
      url: API_ECHO_URL,
      headers: [],
      params: [],
      auth,
      body: { type: 'none' },
    },
  });
  expect(res.success, res.error).toBe(true);
  const snapshot = res.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as Echo;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'oh-oauth-assertion-app-'));
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

  // The user-agent stand-in for the code grant leg: follow the
  // provider's redirect the way a browser would, onto the loopback callback.
  await electronApp.evaluate(async ({ shell }) => {
    (shell as { openExternal: (url: string) => Promise<void> }).openExternal = async (url: string) => {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`authorize page answered ${res.status}`);
    };
  });
});

test.afterAll(async () => {
  await electronApp?.close();
  await rm(userData, { recursive: true, force: true });
});

test('private_key_jwt client credentials: the IdP verifies the signed client_assertion and issues the token', async () => {
  const res = await invoke<FlowResult>({
    type: 'oauthClientCredentials',
    config: signedConfig({ credentialRef: 'cred-as-pkjwt', clientAuthentication: 'private-key-jwt' }),
  });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle?.accessToken).toBe('oh-oauth-cc-token');
});

test('the JWT bearer grant mints its token from the signed assertion and the bearer rides a real send', async () => {
  const config = { ...OAUTH2_JWT_BEARER_SEED_AUTH, credentialRef: 'cred-as-jwtbearer' };
  const res = await invoke<FlowResult>({ type: 'oauthJwtBearer', config });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle).toMatchObject({ accessToken: 'oh-oauth-jwt-token', tokenType: 'Bearer' });
  expect(res.bundle?.refreshToken).toBeUndefined();
  const echo = await sendWith(config as unknown as Record<string, unknown>);
  expect(echo.auth).toEqual({ kind: 'bearer', token: 'oh-oauth-jwt-token' });
});

test('client_secret_jwt authenticates the code exchange over the loopback callback, then the refresh POST', async () => {
  const config = signedConfig({
    credentialRef: 'cred-as-csjwt',
    flow: 'authorization-code-pkce',
    authorizationEndpoint: `${PLAYGROUND}/api/oauth/authorize`,
    clientSecret: 'oh-client-secret',
    clientAuthentication: 'client-secret-jwt',
    assertionAlgorithm: 'HS256',
    assertionPrivateKey: undefined,
  });
  const authorized = await invoke<FlowResult>({ type: 'oauthAuthorize', config });
  expect(authorized.success, authorized.error).toBe(true);
  expect(authorized.bundle).toMatchObject({ accessToken: 'oh-oauth-ac-token', refreshToken: 'oh-oauth-refresh-token' });
  const refreshed = await invoke<FlowResult>({ type: 'oauthRefresh', config });
  expect(refreshed.success, refreshed.error).toBe(true);
  expect(refreshed.bundle?.accessToken).toBe('oh-oauth-refreshed-token');
});

test('an assertion for another audience is refused as invalid_client and nothing persists', async () => {
  const config = signedConfig({
    credentialRef: 'cred-as-refused',
    clientAuthentication: 'private-key-jwt',
    assertionAudience: 'https://idp.openheaders.io/token',
  });
  const res = await invoke<FlowResult>({ type: 'oauthClientCredentials', config });
  expect(res.success).toBe(false);
  expect(res.error).toContain('client_credentials: Token endpoint returned 401');
  expect(res.error).toContain('invalid_client');
  const echo = await sendWith(config);
  expect(echo.auth.kind).toBe('none');
});
