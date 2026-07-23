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
 * The S8 mTLS and S9 proxy-credentials legs seed their vault entries
 * through the real `importWorkspace` channel (plaintext-vault export —
 * the request-vars e2e idiom), now that the daemon spine answers it.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseWorkspaceExport } from '@openheaders/core/workspace-export';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';
import {
  freePort,
  mintClientCert,
  mintLocalhostCert,
  type OAuthTokenRig,
  type ProxyRig,
  type Rig,
  type SocketRig,
  startConnectProxy,
  startH2Echo,
  startHttpRig,
  startHttpsEcho,
  startMtlsEcho,
  startOAuthTokenRig,
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
let mtlsEcho: Rig;
let proxy: ProxyRig;
let authProxy: ProxyRig;
let unixEcho: SocketRig;
let tokenRig: OAuthTokenRig;

const PROXY_AUTH_PAIR = 'rig-user:rig-pass';

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
  scripts?: {
    mode?: string;
    preRequest?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      consoleLog: Array<{ level: string; args: string[] }>;
      mutation?: { headers?: Array<{ key: string; value: string }> };
    };
    postResponse?: {
      succeeded: boolean;
      assertions: Array<{ name: string; passed: boolean; message?: string }>;
      consoleLog: Array<{ level: string; args: string[] }>;
    };
  } | null;
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

async function exec(d: Record<string, unknown>, extra: Record<string, unknown> = {}): Promise<ExecSnapshot> {
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: d,
    ...extra,
  });
  expect(res.success, res.error).toBe(true);
  expect(res.snapshot).toBeTruthy();
  return res.snapshot as ExecSnapshot;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  scratchDir = await mkdtemp(path.join(tmpdir(), 'oh-settings-e2e-'));
  const material = await mintLocalhostCert(scratchDir);
  const clientMaterial = await mintClientCert(scratchDir);
  [httpRig, httpsEcho, tls11Echo, h2Echo, mtlsEcho, proxy, authProxy, tokenRig] = await Promise.all([
    startHttpRig(),
    startHttpsEcho(material),
    startTls11Echo(material),
    startH2Echo(material),
    startMtlsEcho(material, clientMaterial.cert),
    startConnectProxy(),
    startConnectProxy(PROXY_AUTH_PAIR),
    startOAuthTokenRig(),
  ]);
  // Kept short deliberately — sun_path caps socket paths around 104 chars.
  unixEcho = await startUnixEcho(path.join(tmpdir(), `oh-live-${process.pid}.sock`));

  const userData = await mkdtemp(path.join(tmpdir(), 'oh-settings-app-'));
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

  // Vault seeding through the real `importWorkspace` channel (the same
  // host-neutral orchestrator the extension SW answers with; wired on
  // the daemon spine for the shared import UI). The entries feed the S8
  // `clientCertificateRef` and S9 `proxyCredentialRef` legs — vault
  // writes have no direct bridge RPC by design, and a plaintext-vault
  // export is the sanctioned seeding path (the request-vars e2e idiom).
  const seeded = await invoke<{ success: boolean; error?: string }>({
    type: 'importWorkspace',
    incoming: {
      schemaVersion: 5,
      kind: 'workspace-export',
      exportFormatVersion: 1,
      exportId: 'e2e0va01',
      exportedAt: '2026-07-13T00:00:00.000Z',
      source: { app: 'desktop', appVersion: '0.0.0', platform: 'electron', workspaceLabel: 'Settings Live Rig' },
      scope: 'workspace',
      workspace: { uid: '01905000-0000-7000-8000-00000000e2e0', name: 'Settings Live Rig' },
      entities: {
        collections: [],
        folders: [],
        rules: [],
        requests: [],
        templates: [],
        environments: [],
        workspaceVars: { schemaVersion: 5, variables: [] },
        liveWorkflows: [],
        liveVariables: [],
        vault: {
          schemaVersion: 5,
          secrets: [
            {
              uid: 'vlt00001',
              kind: 'client-certificate',
              name: 'gateway-mtls',
              cert: clientMaterial.cert.toString(),
              key: clientMaterial.key.toString(),
            },
            { uid: 'vlt00002', kind: 'string', name: 'proxy-auth', value: PROXY_AUTH_PAIR },
            { uid: 'vlt00003', kind: 'string', name: 'proxy-auth-wrong', value: 'rig-user:wrong-pass' },
          ],
        },
      },
      meta: {
        redactions: { vault: 'plaintext', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
        counts: {
          rules: 0,
          requests: 0,
          environments: 0,
          liveWorkflows: 0,
          liveVariables: 0,
          templates: 0,
          secrets: 3,
        },
      },
    },
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:settings-live-vault',
  });
  expect(seeded.success, seeded.error).toBe(true);
});

test.afterAll(async () => {
  await electronApp?.close();
  await Promise.all(
    [httpRig, httpsEcho, tls11Echo, h2Echo, mtlsEcho, proxy, authProxy, unixEcho, tokenRig]
      .filter(Boolean)
      .map((rig) => rig.close()),
  );
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

// ── S8: mTLS client certificates (vault-seeded) ──────────────────────

test('a certless send to a cert-demanding server fails the severed handshake', async () => {
  const snapshot = await exec(draft({ url: `https://localhost:${mtlsEcho.port}/`, sslVerification: false }));
  // No certificate configured ⇒ the classifier keeps the generic close
  // message (an unrelated close must not speculate about mTLS — S8).
  expect(snapshot.error ?? '').toMatch(/other side closed/);
});

test('clientCertificateRef presents the vault pair and completes mutual TLS', async () => {
  const snapshot = await exec(
    draft({ url: `https://localhost:${mtlsEcho.port}/`, sslVerification: false, clientCertificateRef: 'gateway-mtls' }),
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.body).toBe('mtls-ok');
});

test('an unresolved certificate ref fails before the wire naming the entry', async () => {
  const snapshot = await exec(
    draft({ url: `https://localhost:${mtlsEcho.port}/`, sslVerification: false, clientCertificateRef: 'missing-cert' }),
  );
  expect(snapshot.error ?? '').toContain('references the vault entry "missing-cert"');
});

// ── S9: per-request proxy (credentials leg, vault-seeded) ────────────

test('an authenticating proxy without credentials classifies the 407', async () => {
  const snapshot = await exec(
    draft({
      url: `https://localhost:${httpsEcho.port}/`,
      sslVerification: false,
      proxyUrl: `http://127.0.0.1:${authProxy.port}`,
    }),
  );
  expect(snapshot.error ?? '').toMatch(/requires authentication \(407\)/);
});

test('proxyCredentialRef authenticates the tunnel, end-to-end TLS intact', async () => {
  const before = authProxy.tunnels.length;
  const snapshot = await exec(
    draft({
      url: `https://localhost:${httpsEcho.port}/`,
      sslVerification: false,
      proxyUrl: `http://127.0.0.1:${authProxy.port}`,
      proxyCredentialRef: 'proxy-auth',
    }),
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(authProxy.tunnels.slice(before)).toContain(`localhost:${httpsEcho.port}`);
});

test('wrong credentials name the vault entry on the 407', async () => {
  const snapshot = await exec(
    draft({
      url: `https://localhost:${httpsEcho.port}/`,
      sslVerification: false,
      proxyUrl: `http://127.0.0.1:${authProxy.port}`,
      proxyCredentialRef: 'proxy-auth-wrong',
    }),
  );
  expect(snapshot.error ?? '').toMatch(/rejected the credentials \(407\)/);
  expect(snapshot.error ?? '').toContain('"proxy-auth-wrong"');
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

test('deleteCookieJarEntry drops one entry by its summary identity', async () => {
  // Re-mint the session cookie the clear test just removed.
  await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/login`, cookieJar: true }));
  const summary = await invoke<{ cookies: Array<Record<string, unknown>> }>({ type: 'getCookieJarSummary' });
  const entry = summary.cookies.find((c) => c.name === 'session');
  expect(entry).toBeDefined();
  const deleted = await invoke<{ success: boolean }>({
    type: 'deleteCookieJarEntry',
    name: entry?.name,
    domain: entry?.domain,
    path: entry?.path,
  });
  expect(deleted.success).toBe(true);
  const after = await invoke<{ cookies: Array<Record<string, unknown>> }>({ type: 'getCookieJarSummary' });
  expect(after.cookies.map((c) => c.name)).not.toContain('session');
  // And the wire agrees: the deleted cookie no longer attaches.
  const snapshot = await exec(draft({ url: `http://127.0.0.1:${httpRig.port}/me`, cookieJar: true }));
  expect(snapshot.body).toBe('cookie=[]');
});

// ── S17: workspace export round-trip ─────────────────────────────────
// The export side of the host-neutral port: an export minted on this
// desktop (gatherer → core builder → YAML) parses back and re-imports
// through the already-wired `importWorkspace`, and the dedup walker
// names the freshly created target.

test('exportWorkspace round-trips through importWorkspace with the vault intact', async () => {
  const exported = await invoke<{ success: boolean; yaml?: string; exportId?: string; error?: string }>({
    type: 'exportWorkspace',
    scope: { kind: 'workspace' },
    vaultMode: 'plaintext',
  });
  expect(exported.success, exported.error).toBe(true);

  const parsed = parseWorkspaceExport(exported.yaml as string);
  expect(parsed.ok, parsed.ok ? undefined : parsed.details).toBe(true);
  if (!parsed.ok) return;
  const envelope = parsed.export;
  expect(envelope.source.app).toBe('desktop');
  expect(envelope.source.platform).toBe('electron');
  expect(envelope.entities.vault?.secrets.map((s) => s.name).sort()).toEqual([
    'gateway-mtls',
    'proxy-auth',
    'proxy-auth-wrong',
  ]);

  const imported = await invoke<{
    success: boolean;
    report?: { summary: { imported: number } };
    targetWorkspaceId?: string;
    error?: string;
  }>({
    type: 'importWorkspace',
    incoming: envelope,
    strategies: {},
    target: { mode: 'new', name: 'Round Trip' },
    sourceHash: 'sha256:settings-live-roundtrip',
  });
  expect(imported.success, imported.error).toBe(true);
  expect(imported.targetWorkspaceId).toBeTruthy();

  const matches = await invoke<{
    exportIdSameTarget: Array<{ workspaceId: string }>;
    exportIdOtherTargets: Array<{ workspaceId: string }>;
    workspaceUidMatches: Array<{ workspaceId: string }>;
  }>({
    type: 'findWorkspaceExportImportMatches',
    exportId: envelope.exportId,
    workspaceUid: envelope.workspace.uid,
    currentTargetWorkspaceId: null,
  });
  expect(matches.exportIdOtherTargets.map((m) => m.workspaceId)).toContain(imported.targetWorkspaceId);
});

// ── Scripts: the desktop Safe-mode sandbox ───────────────────────────
// A scripted send runs its pre/post scripts in the hidden sandboxed
// renderer through the main-process broker — the pre-request mutation
// must reach the real wire, the post-response assertions must see the
// real response, and the snapshot must record the Safe mode it ran
// under. This is the live proof of the whole chain: renderer bridge →
// spine route → interactive pipeline → sandbox window → node transport.

test('a scripted send mutates the request in the sandbox and records assertions + mode', async () => {
  const snapshot = await exec(
    draft({
      preRequestScript: [
        "oh.setHeader('Authorization', 'Bearer sandbox-token');",
        "console.log('pre-request ran');",
      ].join('\n'),
      postResponseScript: [
        'const echoed = JSON.parse(oh.response.body);',
        "await oh.test('mutated header reached the wire', () => {",
        "  oh.expect(echoed.authorization).toBe('Bearer sandbox-token');",
        '});',
        "await oh.test('status is 200', () => { oh.expect(oh.response).toHaveStatus(200); });",
      ].join('\n'),
    }),
  );
  expect(snapshot.error).toBeNull();
  expect(snapshot.status).toBe(200);
  // The rig echoed the header the SCRIPT set — the mutation crossed the
  // sandbox boundary and rode the actual fetch.
  expect(JSON.parse(snapshot.body).authorization).toBe('Bearer sandbox-token');
  expect(snapshot.scripts?.mode).toBe('safe');
  expect(snapshot.scripts?.preRequest?.succeeded).toBe(true);
  expect(snapshot.scripts?.preRequest?.consoleLog).toEqual([
    expect.objectContaining({ level: 'log', args: ['pre-request ran'] }),
  ]);
  expect(snapshot.scripts?.postResponse?.succeeded).toBe(true);
  expect(snapshot.scripts?.postResponse?.assertions).toEqual([
    expect.objectContaining({ name: 'mutated header reached the wire', passed: true }),
    expect.objectContaining({ name: 'status is 200', passed: true }),
  ]);
});

test('interactive semantics stay lenient — a failed assertion is recorded, the run is not failed', async () => {
  const snapshot = await exec(
    draft({
      postResponseScript: "await oh.test('impossible', () => { oh.expect(oh.response).toHaveStatus(599); });",
    }),
  );
  expect(snapshot.error).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.scripts?.mode).toBe('safe');
  expect(snapshot.scripts?.postResponse?.assertions).toEqual([
    expect.objectContaining({ name: 'impossible', passed: false }),
  ]);
});

// ── Scripts: the Developer-mode worker ───────────────────────────────
// Flipping the ACTIVE workspace's `oh.scriptExecutionModes` slot (the
// same host-storage seam the Settings tab's chooser writes) must route
// the next scripted send into the full-Node utilityProcess worker: a
// Node-only construct works, the mutation reaches the real wire, and
// the snapshot stamps `'developer'`. Clearing the slot returns the
// workspace to Safe — where the same construct is a recorded script
// error, proving the sandbox really carries no `require`.

async function setActiveWorkspaceScriptMode(mode: 'developer' | null): Promise<void> {
  const { activeWorkspaceId } = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(activeWorkspaceId).toBeTruthy();
  await workbench.evaluate(
    async (input) => {
      const storage = (
        window as unknown as { oh: { storage: { set(req: { key: string; value: unknown }): Promise<unknown> } } }
      ).oh.storage;
      await storage.set({
        key: 'oh.scriptExecutionModes',
        value: input.mode ? { [input.wsId]: input.mode } : {},
      });
    },
    { wsId: activeWorkspaceId as string, mode },
  );
}

const NODE_ONLY_PRE_SCRIPT = [
  "const crypto = require('node:crypto');",
  "const sig = crypto.createHash('sha256').update('openheaders').digest('hex').slice(0, 12);",
  "oh.setHeader('Authorization', 'NodeSig ' + sig);",
  "console.log('node', process.versions.node);",
].join('\n');

test('a developer-mode workspace runs scripts in the full-runtime worker and stamps the mode', async () => {
  await setActiveWorkspaceScriptMode('developer');
  const snapshot = await exec(draft({ preRequestScript: NODE_ONLY_PRE_SCRIPT }));
  expect(snapshot.error).toBeNull();
  expect(snapshot.status).toBe(200);
  // The rig echoed a value only a Node runtime could compute — the
  // script really ran with require + process in scope.
  expect(JSON.parse(snapshot.body).authorization).toMatch(/^NodeSig [0-9a-f]{12}$/);
  expect(snapshot.scripts?.mode).toBe('developer');
  expect(snapshot.scripts?.preRequest?.succeeded).toBe(true);
  expect(snapshot.scripts?.preRequest?.consoleLog).toEqual([
    expect.objectContaining({ level: 'log', args: expect.arrayContaining(['node']) }),
  ]);
});

test('clearing the slot returns the workspace to Safe — where require does not exist', async () => {
  await setActiveWorkspaceScriptMode(null);
  const snapshot = await exec(draft({ preRequestScript: NODE_ONLY_PRE_SCRIPT }));
  // Lenient interactive semantics: the script fault is recorded, the
  // send still reached the wire unmutated under the Safe sandbox.
  expect(snapshot.error).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.scripts?.mode).toBe('safe');
  expect(snapshot.scripts?.preRequest?.succeeded).toBe(false);
  expect(snapshot.scripts?.preRequest?.error?.message).toContain('require');
  expect(JSON.parse(snapshot.body).authorization).toBe('');
});

// ── OAuth refresh-on-expired on the node send path ───────────────────
// An oauth2-authed send whose stored bundle is expired refreshes it at
// the token endpoint BEFORE attaching — the extension's exact
// semantics on the node executor. Seeding rides the token store's own
// cross-workspace representation: a fresh workspace is minted through
// the real importWorkspace channel and its `oh.ws.<id>.oauth` blob is
// written through the storage bridge; the PINNED dispatch (the
// forwarded-send path) reads and persists that workspace's store
// directly.

const OAUTH_WS_EXPORT = {
  schemaVersion: 5,
  kind: 'workspace-export',
  exportFormatVersion: 1,
  exportId: 'e2e0oa01',
  exportedAt: '2026-07-14T00:00:00.000Z',
  source: { app: 'desktop', appVersion: '0.0.0', platform: 'electron', workspaceLabel: 'OAuth Rig' },
  scope: 'workspace',
  workspace: { uid: '01905000-0000-7000-8000-00000000e2e3', name: 'OAuth Rig' },
  entities: {
    collections: [],
    folders: [],
    rules: [],
    requests: [],
    templates: [],
    environments: [],
    workspaceVars: { schemaVersion: 5, variables: [] },
    liveWorkflows: [],
    liveVariables: [],
  },
  meta: {
    redactions: { vault: 'omitted', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
    counts: { rules: 0, requests: 0, environments: 0, liveWorkflows: 0, liveVariables: 0, templates: 0, secrets: 0 },
  },
};

let oauthWorkspaceId = '';

function oauthDraft(credentialRef: string, tokenPath: string): Record<string, unknown> {
  return draft({
    url: `http://127.0.0.1:${httpRig.port}/echo`,
    auth: {
      type: 'oauth2',
      credentialRef,
      flow: 'authorization-code-pkce',
      tokenEndpoint: `http://127.0.0.1:${tokenRig.port}${tokenPath}`,
      clientId: 'client-live',
      scopes: [],
    },
  });
}

async function readOAuthBlob(): Promise<{ tokens: Record<string, { accessToken: string }> }> {
  return (await workbench.evaluate(async (key) => {
    const storage = (
      window as unknown as { oh: { storage: { get(req: { key: string }): Promise<{ value: unknown }> } } }
    ).oh.storage;
    return (await storage.get({ key })).value;
  }, `oh.ws.${oauthWorkspaceId}.oauth`)) as { tokens: Record<string, { accessToken: string }> };
}

test('seed: a fresh workspace holds two expired bundles through the storage bridge', async () => {
  const imported = await invoke<{ success: boolean; targetWorkspaceId?: string; error?: string }>({
    type: 'importWorkspace',
    incoming: OAUTH_WS_EXPORT,
    strategies: {},
    target: { mode: 'new', name: 'OAuth Rig' },
    sourceHash: 'sha256:settings-live-oauth',
  });
  expect(imported.success, imported.error).toBe(true);
  oauthWorkspaceId = imported.targetWorkspaceId ?? '';
  expect(oauthWorkspaceId).toBeTruthy();

  const expired = {
    tokenType: 'Bearer',
    expiresAt: Date.now() - 60_000,
    issuedAt: Date.now() - 3_660_000,
    scope: '',
  };
  await workbench.evaluate(
    async ({ key, value }) => {
      const storage = (
        window as unknown as { oh: { storage: { set(req: { key: string; value: unknown }): Promise<unknown> } } }
      ).oh.storage;
      await storage.set({ key, value });
    },
    {
      key: `oh.ws.${oauthWorkspaceId}.oauth`,
      value: {
        schemaVersion: 5,
        tokens: {
          'cred-live': { ...expired, accessToken: 'at-expired', refreshToken: 'rt-live' },
          'cred-broken': { ...expired, accessToken: 'at-stale-broken', refreshToken: 'rt-broken' },
        },
        configs: {},
        refreshErrors: {},
      },
    },
  );
});

test('an expired bundle refreshes at the token endpoint and the fresh token rides the wire', async () => {
  const before = tokenRig.calls.length;
  const snapshot = await exec(oauthDraft('cred-live', '/token'), { workspaceId: oauthWorkspaceId });
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  const echo = JSON.parse(snapshot.body) as Echo;
  expect(echo.authorization).toBe('Bearer at-1');
  const grants = tokenRig.calls.slice(before);
  expect(grants).toHaveLength(1);
  expect(grants[0].grant_type).toBe('refresh_token');
  expect(grants[0].refresh_token).toBe('rt-live');
  expect(grants[0].client_id).toBe('client-live');
});

test('the refreshed bundle persisted — the next send attaches it without another refresh', async () => {
  const blob = await readOAuthBlob();
  expect(blob.tokens['cred-live'].accessToken).toBe('at-1');

  const before = tokenRig.calls.length;
  const snapshot = await exec(oauthDraft('cred-live', '/token'), { workspaceId: oauthWorkspaceId });
  expect(snapshot.status).toBe(200);
  expect((JSON.parse(snapshot.body) as Echo).authorization).toBe('Bearer at-1');
  expect(tokenRig.calls.length).toBe(before);
});

test('a failed refresh attaches the stale bundle and lets the target speak — never a run failure', async () => {
  const snapshot = await exec(oauthDraft('cred-broken', '/token-broken'), { workspaceId: oauthWorkspaceId });
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect((JSON.parse(snapshot.body) as Echo).authorization).toBe('Bearer at-stale-broken');
  // The stale bundle stays put for the next attempt.
  const blob = await readOAuthBlob();
  expect(blob.tokens['cred-broken'].accessToken).toBe('at-stale-broken');
});
