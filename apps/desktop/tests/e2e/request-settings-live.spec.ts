/**
 * Request-settings live E2E — the automated S2–S12 live passes over the
 * REAL stack: the built desktop app (isolated userData, off-default
 * daemon port), a workbench `executeRequest` draft send through the
 * renderer bridge → `oh:rpc` → the daemon spine's route → the node
 * transport on a real wire, against local rig servers
 * (`request-settings-rigs.ts`). Every wire-affecting knob the epic
 * graduated is exercised end-to-end and asserted on the executed-run
 * snapshot — status, body, classified error messages, and the policy
 * markers (`sslVerificationDisabled`, `tlsFloorLowered`,
 * `authorizationForwarded`, `cookieHeaderAttached`/`cookiesCaptured`).
 *
 * Deliberately NOT here (need vault seeding the bridge doesn't expose):
 * the mTLS client-certificate leg (S8) and the proxy-credentials leg
 * (S9 auth) — those stay manual recipes in the session logs.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import {
  freePort,
  mintLocalhostCert,
  type ProxyRig,
  type Rig,
  type SocketRig,
  startConnectProxy,
  startH2Echo,
  startHttpRig,
  startHttpsEcho,
  startTls11Echo,
  startUnixEcho,
} from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 so the suite never collides with a real install.
const DAEMON_PORT = 18537;

let electronApp: ElectronApplication;
let workbench: Page;
let scratchDir: string;

let httpRig: Rig;
let httpsEcho: Rig;
let tls11Echo: Rig;
let h2Echo: Rig;
let proxy: ProxyRig;
let unixEcho: SocketRig;

interface ExecSnapshot {
  status: number;
  body: string;
  url: string;
  error?: string | null;
  bodyTruncated?: boolean;
  bodyCapBytes?: number;
  sslVerificationDisabled?: boolean;
  tlsFloorLowered?: boolean;
  authorizationForwarded?: boolean;
  cookieHeaderAttached?: string;
  cookiesCaptured?: string[];
}

interface Echo {
  host: string;
  url: string;
  authorization: string;
  cookie: string;
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

let nextUid = 0;
function draft(over: Record<string, unknown>): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-live-${nextUid}`,
    path: `requests/settings-live/req-${nextUid}`,
    name: 'settings live e2e',
    method: 'GET',
    url: `http://127.0.0.1:${httpRig.port}/echo`,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...over,
  };
}

async function exec(d: Record<string, unknown>): Promise<ExecSnapshot> {
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: d,
  });
  expect(res.success, res.error).toBe(true);
  expect(res.snapshot).toBeTruthy();
  return res.snapshot as ExecSnapshot;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  scratchDir = await mkdtemp(path.join(tmpdir(), 'oh-settings-e2e-'));
  const material = await mintLocalhostCert(scratchDir);
  [httpRig, httpsEcho, tls11Echo, h2Echo, proxy] = await Promise.all([
    startHttpRig(),
    startHttpsEcho(material),
    startTls11Echo(material),
    startH2Echo(material),
    startConnectProxy(),
  ]);
  // Kept short deliberately — sun_path caps socket paths around 104 chars.
  unixEcho = await startUnixEcho(path.join(tmpdir(), `oh-live-${process.pid}.sock`));

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-settings-app-'));
  await writeFile(
    path.join(userData, 'storage.json'),
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
  // Engine-ready gate: the pre-engine rpc queue answers once the spine
  // is up, so one bridge round-trip is the readiness probe.
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
  await Promise.all([httpRig, httpsEcho, tls11Echo, h2Echo, proxy, unixEcho].filter(Boolean).map((rig) => rig.close()));
  await rm(scratchDir, { recursive: true, force: true });
});

// ── S2: SSL certificate verification ────────────────────────────────

test('verification ON fails a self-signed target with the classified TLS error', async () => {
  const snapshot = await exec(draft({ url: `https://localhost:${httpsEcho.port}/` }));
  expect(snapshot.error ?? '').toMatch(/TLS certificate error reaching localhost \(DEPTH_ZERO_SELF_SIGNED_CERT\)/);
});

test('verification OFF returns 200 and marks the snapshot Unverified-TLS', async () => {
  const snapshot = await exec(draft({ url: `https://localhost:${httpsEcho.port}/`, sslVerification: false }));
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('{"ok":true}');
  expect(snapshot.sslVerificationDisabled).toBe(true);
});

// ── S3: timeout + response size cap ─────────────────────────────────

test('a 1000 ms timeout aborts a slow send naming the limit', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/slow?ms=3500`, timeoutMs: 1000 }));
  expect(snapshot.error ?? '').toBe('Request timed out after 1000 ms.');
});

test('a 1 KiB response cap truncates and stamps bodyCapBytes', async () => {
  const snapshot = await exec(
    draft({ url: `http://127.0.0.1:${httpRig.port}/big?bytes=8192`, maxResponseBytes: 1024 }),
  );
  expect(snapshot.status).toBe(200);
  expect(snapshot.bodyTruncated).toBe(true);
  expect(snapshot.bodyCapBytes).toBe(1024);
  expect(snapshot.body.length).toBe(1024);
});

// ── S4: redirect loop trio ───────────────────────────────────────────

test('follows a redirect chain to the final response by default', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/hops?n=3` }));
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('done');
});

test('maxRedirects caps the chain with an error naming the limit', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/hops?n=3`, maxRedirects: 2 }));
  expect(snapshot.error ?? '').toBe("Stopped after 2 redirects — the request's redirect limit.");
});

test('Authorization is stripped on a cross-origin hop by default', async () => {
  const to = encodeURIComponent(`http://localhost:${httpRig.port}/echo`);
  const snapshot = await exec(
    draft({
      url: `http://127.0.0.1:${httpRig.port}/hop-to?to=${to}`,
      headers: [{ uid: 'h-auth', key: 'Authorization', value: 'Bearer live-tok', enabled: true }],
    }),
  );
  expect(snapshot.status).toBe(200);
  const echo = JSON.parse(snapshot.body) as Echo;
  expect(echo.authorization).toBe('');
  expect(snapshot.authorizationForwarded).toBeUndefined();
});

test('followAuthorizationHeader forwards it cross-origin and marks the snapshot', async () => {
  const to = encodeURIComponent(`http://localhost:${httpRig.port}/echo`);
  const snapshot = await exec(
    draft({
      url: `http://127.0.0.1:${httpRig.port}/hop-to?to=${to}`,
      headers: [{ uid: 'h-auth', key: 'Authorization', value: 'Bearer live-tok', enabled: true }],
      followAuthorizationHeader: true,
    }),
  );
  expect(snapshot.status).toBe(200);
  const echo = JSON.parse(snapshot.body) as Echo;
  expect(echo.authorization).toBe('Bearer live-tok');
  expect(snapshot.authorizationForwarded).toBe(true);
});

// ── S5: TLS floor ────────────────────────────────────────────────────

test('the default floor refuses a TLS 1.1-max server with a handshake error', async () => {
  const snapshot = await exec(draft({ url: `https://localhost:${tls11Echo.port}/`, sslVerification: false }));
  expect(snapshot.error ?? '').toMatch(/TLS handshake with localhost failed/);
});

test('tlsMinVersion 1.1 negotiates the legacy server and marks the lowered floor', async () => {
  const snapshot = await exec(
    draft({ url: `https://localhost:${tls11Echo.port}/`, sslVerification: false, tlsMinVersion: '1.1' }),
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('legacy-ok');
  expect(snapshot.tlsFloorLowered).toBe(true);
});

// ── S6: Allow HTTP/2 ─────────────────────────────────────────────────

test('stays HTTP/1.1 against an h2 server without the knob', async () => {
  const snapshot = await exec(draft({ url: `https://localhost:${h2Echo.port}/`, sslVerification: false }));
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('http/1.1');
});

test('allowHttp2 negotiates h2 when the server offers it', async () => {
  const snapshot = await exec(
    draft({ url: `https://localhost:${h2Echo.port}/`, sslVerification: false, allowHttp2: true }),
  );
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('h2');
});

// ── S7: resolve-to-address ───────────────────────────────────────────

test('pins the dial while the Host header keeps the URL hostname', async () => {
  const snapshot = await exec(
    draft({ url: `http://openheaders.io:${httpRig.port}/echo`, resolveToAddress: '127.0.0.1' }),
  );
  expect(snapshot.status).toBe(200);
  const echo = JSON.parse(snapshot.body) as Echo;
  expect(echo.host).toBe(`openheaders.io:${httpRig.port}`);
});

test('a refused pinned connect names the resolve-to-address setting', async () => {
  const deadPort = await freePort();
  const snapshot = await exec(draft({ url: `http://openheaders.io:${deadPort}/echo`, resolveToAddress: '127.0.0.1' }));
  expect(snapshot.error ?? '').toMatch(/resolve-to-address setting points openheaders\.io there/);
});

// ── S9: per-request proxy (credential-less leg) ─────────────────────

test('routes the send through a CONNECT proxy, end-to-end TLS intact', async () => {
  const before = proxy.tunnels.length;
  const snapshot = await exec(
    draft({
      url: `https://localhost:${httpsEcho.port}/`,
      sslVerification: false,
      proxyUrl: `http://127.0.0.1:${proxy.port}`,
    }),
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(proxy.tunnels.slice(before)).toContain(`localhost:${httpsEcho.port}`);
});

test('a dead proxy names the proxy, not the target', async () => {
  const deadPort = await freePort();
  const snapshot = await exec(
    draft({ url: `https://localhost:${httpsEcho.port}/`, proxyUrl: `http://127.0.0.1:${deadPort}` }),
  );
  expect(snapshot.error ?? '').toMatch(/Connection refused by the proxy at 127\.0\.0\.1:\d+/);
});

// ── S10: Unix-socket target ──────────────────────────────────────────

test('dials the socket while the URL host stays cosmetic', async () => {
  const snapshot = await exec(draft({ url: `http://openheaders.io/api/x`, unixSocketPath: unixEcho.socketPath }));
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('openheaders.io /api/x');
});

test('a missing socket path names the Unix-socket setting', async () => {
  const snapshot = await exec(
    draft({ url: 'http://openheaders.io/api/x', unixSocketPath: '/tmp/oh-live-missing.sock' }),
  );
  expect(snapshot.error ?? '').toMatch(/No socket at \/tmp\/oh-live-missing\.sock/);
});

test('socket + proxy fails loudly before the wire', async () => {
  const snapshot = await exec(
    draft({
      url: 'http://openheaders.io/api/x',
      unixSocketPath: unixEcho.socketPath,
      proxyUrl: `http://127.0.0.1:${proxy.port}`,
    }),
  );
  expect(snapshot.error ?? '').toMatch(/both a proxy and a Unix socket target/);
});

// ── S11 + S12: cookie jar + inspection channels ──────────────────────

test('the jar captures a login cookie mid-chain and rides it onto the redirect hop', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/login`, cookieJar: true }));
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('cookie=[session=live123]');
  expect(snapshot.cookiesCaptured).toEqual(['session']);
  // Nothing was in the jar at hop one, so no first-hop attachment.
  expect(snapshot.cookieHeaderAttached).toBeUndefined();
});

test('a second jar send attaches the stored cookie and records the attribution', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/me`, cookieJar: true }));
  expect(snapshot.body).toBe('cookie=[session=live123]');
  expect(snapshot.cookieHeaderAttached).toBe('session=live123');
});

test('a jar-off send to the same server carries nothing', async () => {
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/me` }));
  expect(snapshot.body).toBe('cookie=[]');
});

test('getCookieJarSummary lists the entry value-free; clearCookieJar empties it', async () => {
  const summary = await invoke<{ cookies: Array<Record<string, unknown>> }>({ type: 'getCookieJarSummary' });
  const names = summary.cookies.map((c) => c.name);
  expect(names).toContain('session');
  for (const cookie of summary.cookies) {
    expect('value' in cookie).toBe(false);
  }
  const cleared = await invoke<{ success: boolean }>({ type: 'clearCookieJar' });
  expect(cleared.success).toBe(true);
  const after = await invoke<{ cookies: Array<Record<string, unknown>> }>({ type: 'getCookieJarSummary' });
  expect(after.cookies).toEqual([]);
  // And the wire agrees: the emptied jar attaches nothing.
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/me`, cookieJar: true }));
  expect(snapshot.body).toBe('cookie=[]');
});
