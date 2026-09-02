/**
 * OAuth 2.0 Device Authorization Grant on the desktop host (RFC 8628)
 * — driven through the renderer bridge → `oh:rpc` → the daemon spine's
 * OAuth plane, against the playground IdP (`playground/server/
 * oauth-api.ts`), whose device grant walks the §3.5 outcomes: the
 * start answers the pending state (the user code and verification URL,
 * never the device code), the host polls at the rig's one-second
 * interval, honors the `slow_down` the rig answers on the second poll
 * (the grant lands no sooner than the grown interval allows), the
 * granted bundle rides a real send to `/api/echo`; a `deny` scope ends
 * in `access_denied` with nothing persisted; a cancel stops the poll
 * and clears the state.
 *
 * Its own spec (the desktop e2e budget law): a fresh app launch is a
 * fresh per-origin refresh bucket. This one spends three device
 * authorization POSTs; the polls ride outside the bucket.
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
const DAEMON_PORT = 18657;
const PLAYGROUND = 'http://127.0.0.1:3000';
const API_ECHO_URL = `${PLAYGROUND}/api/echo`;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;

interface Approval {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresAt: number;
  intervalSeconds: number;
}

type DeviceState =
  | { state: 'pending'; approval: Approval; startedAt: number }
  | { state: 'granted'; grantedAt: number }
  | { state: 'denied' | 'expired' | 'failed'; message: string }
  | { state: 'cancelled' };

interface StartResult {
  success: boolean;
  state?: DeviceState;
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

function deviceConfig(credentialRef: string, scopes: string[]): Record<string, unknown> {
  return {
    type: 'oauth2',
    credentialRef,
    flow: 'device-code',
    grantType: 'device-code',
    deviceAuthorizationEndpoint: `${PLAYGROUND}/api/oauth/device`,
    tokenEndpoint: `${PLAYGROUND}/api/oauth/token`,
    clientId: 'oh-client-id',
    clientSecret: 'oh-client-secret',
    scopes,
  };
}

async function deviceStatus(credentialRef: string): Promise<DeviceState | null> {
  return (await invoke<{ state: DeviceState | null }>({ type: 'oauthDeviceStatus', credentialRef })).state;
}

let nextUid = 0;
async function sendWith(auth: Record<string, unknown>): Promise<Echo> {
  nextUid += 1;
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: {
      schemaVersion: 5,
      uid: `req-oauth-dc-${nextUid}`,
      path: `requests/oauth-device-desktop/req-${nextUid}`,
      name: 'oauth device desktop e2e',
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
  userData = await mkdtemp(path.join(tmpdir(), 'oh-oauth-device-app-'));
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

test('the start answers the pending state — the user code and verification URL, never the device code', async () => {
  const config = deviceConfig('cred-dc-walk', ['read']);
  const res = await invoke<StartResult>({ type: 'oauthDeviceStart', config });
  expect(res.success, res.error).toBe(true);
  expect(res.state?.state).toBe('pending');
  if (res.state?.state !== 'pending') return;
  expect(res.state.approval.userCode).toMatch(/^OHDC-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
  expect(res.state.approval.verificationUri).toBe(`${PLAYGROUND}/api/oauth/device/activate`);
  expect(res.state.approval.verificationUriComplete).toBe(
    `${PLAYGROUND}/api/oauth/device/activate?user_code=${encodeURIComponent(res.state.approval.userCode)}`,
  );
  expect(res.state.approval.intervalSeconds).toBe(1);
  expect(res.state.approval.expiresAt).toBeGreaterThan(Date.now() + 500_000);
  expect(JSON.stringify(res)).not.toContain('oh-device.');
  // The status channel answers the same pending state to a late joiner.
  expect(await deviceStatus('cred-dc-walk')).toMatchObject({ state: 'pending' });
});

test('the host polls at the interval, honors slow_down, and the granted bundle rides a real send', async () => {
  const config = deviceConfig('cred-dc-walk', ['read']);
  const pending = await deviceStatus('cred-dc-walk');
  expect(pending?.state).toBe('pending');
  const startedAt = pending?.state === 'pending' ? pending.startedAt : Date.now();
  await expect
    .poll(async () => (await deviceStatus('cred-dc-walk'))?.state, { timeout: 30000, intervals: [250] })
    .toBe('granted');
  const granted = await deviceStatus('cred-dc-walk');
  // Poll 1 at +1 s (pending), poll 2 at +2 s (slow_down → 6 s), poll 3
  // at +8 s (the grant): a client that ignored slow_down would grant at +3 s.
  expect(granted?.state === 'granted' ? granted.grantedAt - startedAt : 0).toBeGreaterThanOrEqual(7500);
  const echo = await sendWith(config);
  expect(echo.auth).toEqual({ kind: 'bearer', token: 'oh-oauth-dc-token' });
});

test('a refused authorization settles as denied with the provider wording and nothing persists', async () => {
  const config = deviceConfig('cred-dc-deny', ['deny']);
  const res = await invoke<StartResult>({ type: 'oauthDeviceStart', config });
  expect(res.success, res.error).toBe(true);
  await expect
    .poll(async () => (await deviceStatus('cred-dc-deny'))?.state, { timeout: 15000, intervals: [250] })
    .toBe('denied');
  const denied = await deviceStatus('cred-dc-deny');
  expect(denied?.state === 'denied' ? denied.message : '').toContain('access_denied');
  const echo = await sendWith(config);
  expect(echo.auth.kind).toBe('none');
});

test('a cancel stops the poll and clears the state; nothing persists', async () => {
  const config = deviceConfig('cred-dc-cancel', ['read']);
  const res = await invoke<StartResult>({ type: 'oauthDeviceStart', config });
  expect(res.success, res.error).toBe(true);
  const cancelled = await invoke<{ success: boolean; cancelled: boolean }>({
    type: 'oauthDeviceCancel',
    credentialRef: 'cred-dc-cancel',
  });
  expect(cancelled).toEqual({ success: true, cancelled: true });
  expect(await deviceStatus('cred-dc-cancel')).toBeNull();
  // Past the rig's walk (three polls, eight seconds) the slot stays
  // clear and the send carries nothing.
  await workbench.waitForTimeout(9000);
  expect(await deviceStatus('cred-dc-cancel')).toBeNull();
  const echo = await sendWith(config);
  expect(echo.auth.kind).toBe('none');
});
