/**
 * OAuth 2.0 DPoP on the desktop host (RFC 9449) — driven through the
 * renderer bridge → `oh:rpc` → the daemon spine's OAuth plane and the
 * node transport, against the playground IdP (`playground/server/
 * oauth-api.ts`, which verifies the proof on the token POST and issues
 * the token bound to the key) and the echo (`playground/server/
 * api-echo.ts`, which verifies the resource proof and the binding):
 * a client-credentials exchange under a fresh bound key comes back as
 * a DPoP token whose send proves possession again at the echo; the
 * IdP's nonce demand (§8) is answered once inside the exchange; the
 * echo's nonce demand (§9) is answered once by the transport.
 *
 * Its own spec (the desktop e2e budget law): a fresh app launch is a
 * fresh per-origin refresh bucket. This one spends two token POSTs
 * (the nonce retry rides inside the second's bucket payment).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 and the other OAuth suites' ports.
const DAEMON_PORT = 18667;
const PLAYGROUND = 'http://127.0.0.1:3000';
const API_ECHO_URL = `${PLAYGROUND}/api/echo`;
const JKT = /^[A-Za-z0-9_-]{43}$/;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;

interface Bundle {
  accessToken: string;
  tokenType: string;
  dpop?: { algorithm: string; jkt: string; publicJwk: { kty: string; crv?: string } };
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
  auth:
    | { kind: 'none' }
    | { kind: 'bearer'; token: string }
    | {
        kind: 'dpop';
        token: string;
        jkt: string;
        proof: { verified: true; htm: string; htu: string; ath: true; nonce: string | null };
      }
    | { kind: 'dpop-invalid'; reason: string };
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

function dpopConfig(credentialRef: string, scopes: string[]): Record<string, unknown> {
  return {
    type: 'oauth2',
    credentialRef,
    flow: 'client-credentials',
    grantType: 'client-credentials',
    tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
    clientId: 'oh-client-id',
    clientSecret: 'oh-client-secret',
    scopes,
    tokenBinding: 'dpop',
  };
}

let nextUid = 0;
async function sendWith(auth: Record<string, unknown>, url = API_ECHO_URL): Promise<{ status: number; echo: Echo }> {
  nextUid += 1;
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: {
      schemaVersion: 5,
      uid: `req-oauth-dpop-${nextUid}`,
      path: `requests/oauth-dpop-desktop/req-${nextUid}`,
      name: 'oauth dpop desktop e2e',
      method: 'GET',
      url,
      headers: [],
      params: [],
      auth,
      body: { type: 'none' },
    },
  });
  expect(res.success, res.error).toBe(true);
  const snapshot = res.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  return {
    status: snapshot.status,
    echo: snapshot.body ? (JSON.parse(snapshot.body) as Echo) : { auth: { kind: 'none' } },
  };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'oh-oauth-dpop-app-'));
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

let boundJkt = '';

test('client credentials under DPoP: the IdP verifies the proof and issues a bound DPoP token, the send proves again at the echo', async () => {
  const config = dpopConfig('cred-dpop-cc', ['read']);
  const res = await invoke<FlowResult>({ type: 'oauthClientCredentials', config });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle?.tokenType).toBe('DPoP');
  expect(res.bundle?.accessToken.startsWith('oh-oauth-cc-token.dpop.')).toBe(true);
  expect(res.bundle?.dpop?.jkt).toMatch(JKT);
  expect(res.bundle?.dpop?.publicJwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
  boundJkt = res.bundle?.dpop?.jkt ?? '';
  const { status, echo } = await sendWith(config);
  expect(status).toBe(200);
  expect(echo.auth).toMatchObject({
    kind: 'dpop',
    token: 'oh-oauth-cc-token',
    jkt: boundJkt,
    proof: { verified: true, htm: 'GET', htu: API_ECHO_URL, ath: true, nonce: null },
  });
});

test("the resource's use_dpop_nonce challenge is answered once by the transport — the send lands with the issued nonce", async () => {
  const config = dpopConfig('cred-dpop-cc', ['read']);
  const { status, echo } = await sendWith(config, `${API_ECHO_URL}?dpopNonce=1`);
  expect(status).toBe(200);
  expect(echo.auth).toMatchObject({
    kind: 'dpop',
    token: 'oh-oauth-cc-token',
    jkt: boundJkt,
    proof: { verified: true, htm: 'GET', htu: API_ECHO_URL, nonce: 'oh-echo-nonce-1' },
  });
});

test("the IdP's use_dpop_nonce challenge is answered once inside the exchange — the token still binds", async () => {
  const config = dpopConfig('cred-dpop-nonce', ['nonce']);
  const res = await invoke<FlowResult>({ type: 'oauthClientCredentials', config });
  expect(res.success, res.error).toBe(true);
  expect(res.bundle?.tokenType).toBe('DPoP');
  expect(res.bundle?.dpop?.jkt).toMatch(JKT);
  expect(res.bundle?.dpop?.jkt).not.toBe(boundJkt);
  const { status, echo } = await sendWith(config);
  expect(status).toBe(200);
  expect(echo.auth).toMatchObject({ kind: 'dpop', token: 'oh-oauth-cc-token', jkt: res.bundle?.dpop?.jkt });
});
