/**
 * OAuth 2.0 on the desktop host — the six `oauth*` channels the shared
 * Authorization editor calls, driven through the renderer bridge →
 * `oh:rpc` → the daemon spine's OAuth plane, against the playground IdP
 * (`playground/server/oauth-api.ts`): the loopback redirect URI, the
 * authorization-code grant with PKCE (the provider's redirect landing
 * on the spine's `/oauth/callback` route), the plain code grant, the
 * provider-error redirect, client credentials, password, refresh,
 * revoke — and the acquired token riding a real send to `/api/echo`.
 *
 * The user-agent hop is the one thing a headless run cannot do: the
 * spine opens the provider page through `shell.openExternal`, swapped
 * here in the main process for a redirect-following `fetch` — the
 * playground's 302 then lands on the loopback callback exactly as a
 * browser would, so everything from the authorize URL to the persisted
 * bundle is the production path.
 *
 * The suite makes exactly five token POSTs against the playground IdP —
 * the per-origin refresh bucket admits five starts a minute, and a
 * sixth would wait out the window (a refused exchange is pinned in the
 * oracle flows unit test instead).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 (and the settings-live suite's port) so the run
// never collides with a real install.
const DAEMON_PORT = 18637;
const PLAYGROUND = 'http://127.0.0.1:3000';
const API_ECHO_URL = `${PLAYGROUND}/api/echo`;
const REDIRECT_URI = `http://127.0.0.1:${DAEMON_PORT}/oauth/callback`;

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
  redirectUri?: string;
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

function oauthConfig(over: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'oauth2',
    credentialRef: 'cred-desktop-ac',
    flow: 'authorization-code-pkce',
    authorizationEndpoint: `${PLAYGROUND}/api/oauth/authorize`,
    tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
    clientId: 'oh-client-id',
    clientSecret: 'oh-client-secret',
    scopes: ['read'],
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
      uid: `req-oauth-${nextUid}`,
      path: `requests/oauth-desktop/req-${nextUid}`,
      name: 'oauth desktop e2e',
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
  userData = await mkdtemp(path.join(tmpdir(), 'oh-oauth-app-'));
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

  // The user-agent stand-in: follow the provider's redirect the way a
  // browser would, landing on the spine's loopback callback route.
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

test('the redirect URI is the loopback callback on the bound port', async () => {
  const res = await invoke<{ redirectUri: string }>({ type: 'oauthGetRedirectUri' });
  expect(res.redirectUri).toBe(REDIRECT_URI);
});

test('authorization code + PKCE: the provider redirect lands on the callback and the bundle persists', async () => {
  const res = await invoke<FlowResult>({ type: 'oauthAuthorize', config: oauthConfig({}) });
  expect(res.success, res.error).toBe(true);
  expect(res.redirectUri).toBe(REDIRECT_URI);
  expect(res.bundle).toMatchObject({ accessToken: 'oh-oauth-ac-token', refreshToken: 'oh-oauth-refresh-token' });
});

test('the acquired token rides a real send as the bearer', async () => {
  const echo = await sendWith(oauthConfig({}));
  expect(echo.auth).toEqual({ kind: 'bearer', token: 'oh-oauth-ac-token' });
});

test('the plain authorization-code grant completes without PKCE', async () => {
  const res = await invoke<FlowResult>({
    type: 'oauthAuthorize',
    config: oauthConfig({ credentialRef: 'cred-desktop-plain', grantType: 'authorization-code' }),
  });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle?.accessToken).toBe('oh-oauth-ac-token');
});

test("a provider refusal surfaces as the authorize step's error, nothing persisted", async () => {
  const res = await invoke<FlowResult>({
    type: 'oauthAuthorize',
    config: oauthConfig({ credentialRef: 'cred-desktop-refused', clientId: 'not-a-client' }),
  });
  expect(res.success).toBe(false);
  expect(res.error).toBe('authorize: Provider returned error: unauthorized_client Unknown client');
  const echo = await sendWith(oauthConfig({ credentialRef: 'cred-desktop-refused', clientId: 'not-a-client' }));
  expect(echo.auth.kind).toBe('none');
});

test('client credentials and password grants mint their bundles', async () => {
  const cc = await invoke<FlowResult>({
    type: 'oauthClientCredentials',
    config: oauthConfig({ credentialRef: 'cred-desktop-cc', flow: 'client-credentials' }),
  });
  expect(cc.success, cc.error).toBe(true);
  expect(cc.bundle?.accessToken).toBe('oh-oauth-cc-token');

  const pw = await invoke<FlowResult>({
    type: 'oauthPasswordCredentials',
    config: oauthConfig({
      credentialRef: 'cred-desktop-pw',
      flow: 'password-credentials',
      username: 'alice@openheaders.io',
      password: 'p4ssw0rd',
    }),
  });
  expect(pw.success, pw.error).toBe(true);
  expect(pw.bundle?.accessToken).toBe('oh-oauth-pw-token');
});

test('refresh exchanges the stored refresh token and the fresh bearer rides the next send', async () => {
  const res = await invoke<FlowResult>({ type: 'oauthRefresh', config: oauthConfig({}) });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle?.accessToken).toBe('oh-oauth-refreshed-token');
  const echo = await sendWith(oauthConfig({}));
  expect(echo.auth).toEqual({ kind: 'bearer', token: 'oh-oauth-refreshed-token' });
});

test('revoke drops the bundle; the next send carries no Authorization', async () => {
  const res = await invoke<{ success: boolean; removed: boolean }>({
    type: 'oauthRevoke',
    credentialRef: 'cred-desktop-ac',
  });
  expect(res).toEqual({ success: true, removed: true });
  const echo = await sendWith(oauthConfig({}));
  expect(echo.auth.kind).toBe('none');
});
