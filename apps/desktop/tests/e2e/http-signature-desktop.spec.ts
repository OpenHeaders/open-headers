/**
 * HTTP Message Signatures (RFC 9421) through the desktop's real spine
 * — a fresh app launch, its own daemon port, the playground echo as
 * the resource.
 *
 * The node executor signs the FINAL wire shape at dispatch: the
 * covered components read from the URL and the header rows, the
 * Content-Digest minted over the body, the Signature-Input and
 * Signature headers under the label. The echo hands the wire back and
 * this spec REBUILDS the signature base from what the server saw and
 * verifies the echoed signature with node:crypto — a reference that
 * shares no code with the signer, so a wrong base cannot self-confirm.
 *
 * Three legs: an ECDSA P-256 signature over the method, the target
 * and a minted digest of a JSON body (created / expires / keyid /
 * nonce / tag on the parameters); an HMAC signature under a custom
 * label covering the authority, path and query with the alg
 * parameter; and the send error a covered header the request does
 * not carry produces — nothing reaches the wire.
 */

import { createHash, createHmac, generateKeyPairSync, verify as nodeVerify } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
// Off the default 8137 and the other suites' ports.
const DAEMON_PORT = 18668;
const PLAYGROUND = 'http://127.0.0.1:3000';
const API_ECHO_URL = `${PLAYGROUND}/api/echo`;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

interface Echo {
  method: string;
  /** Path + query as received. */
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: { kind: string; raw?: string };
}

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

let nextUid = 0;
async function send(
  auth: Record<string, unknown>,
  draft: { method?: string; url?: string; headers?: Array<{ key: string; value: string }>; body?: unknown } = {},
): Promise<{ snapshot: ExecSnapshot; echo: Echo | null }> {
  nextUid += 1;
  const res = await invoke<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>({
    type: 'executeRequest',
    draft: {
      schemaVersion: 5,
      uid: `req-http-sig-${nextUid}`,
      path: `requests/http-signature-desktop/req-${nextUid}`,
      name: 'http signature desktop e2e',
      method: draft.method ?? 'GET',
      url: draft.url ?? API_ECHO_URL,
      headers: (draft.headers ?? []).map((h, i) => ({ uid: `hdr${nextUid}${i}`, ...h })),
      params: [],
      auth,
      body: draft.body ?? { type: 'none' },
    },
  });
  expect(res.success, res.error).toBe(true);
  const snapshot = res.snapshot!;
  return {
    snapshot,
    echo: snapshot.status === 200 && snapshot.body ? (JSON.parse(snapshot.body) as Echo) : null,
  };
}

function single(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : (value ?? '');
}

/**
 * The signature base the server would rebuild: the Signature-Input's
 * covered list in its own order, derived components from the echoed
 * request line and Host, fields from the echoed headers, the
 * parameters line verbatim. Returns the base and the signature bytes.
 */
function rebuild(echo: Echo, label: string): { base: string; params: string; covered: string[]; sig: Buffer } {
  const input = single(echo.headers['signature-input']);
  const signature = single(echo.headers.signature);
  expect(input.startsWith(`${label}=(`), input).toBe(true);
  expect(signature.startsWith(`${label}=:`) && signature.endsWith(':'), signature).toBe(true);
  const params = input.slice(label.length + 1);
  const covered = params
    .slice(1, params.indexOf(')'))
    .split(' ')
    .filter((c) => c !== '')
    .map((c) => c.replace(/^"|"$/g, ''));
  const target = new URL(echo.url, PLAYGROUND);
  const value = (component: string): string => {
    switch (component) {
      case '@method':
        return echo.method.toUpperCase();
      case '@target-uri':
        return target.href;
      case '@authority':
        return single(echo.headers.host);
      case '@scheme':
        return target.protocol.slice(0, -1);
      case '@request-target':
        return echo.url;
      case '@path':
        return target.pathname;
      case '@query':
        return target.search || '?';
      default:
        return single(echo.headers[component]).trim();
    }
  };
  const base = [...covered.map((c) => `"${c}": ${value(c)}`), `"@signature-params": ${params}`].join('\n');
  return { base, params, covered, sig: Buffer.from(signature.slice(label.length + 2, -1), 'base64') };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  userData = await mkdtemp(path.join(tmpdir(), 'oh-http-signature-app-'));
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

test('ecdsa-p256-sha256 over the method, the target and a minted Content-Digest of a JSON body — the echoed signature verifies under the public key', async () => {
  const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const body = '{"hello": "world"}';
  const { snapshot, echo } = await send(
    {
      type: 'http-signature',
      algorithm: 'ecdsa-p256-sha256',
      privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      secret: '',
      keyId: 'oh-desktop-key-1',
      components: '@method @target-uri content-type content-digest',
      contentDigest: 'sha-256',
      expiresInSeconds: 300,
      nonce: true,
      tag: 'oh-desktop',
    },
    { method: 'POST', url: `${API_ECHO_URL}?leg=ecdsa`, body: { type: 'json', content: body } },
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(echo).not.toBeNull();
  const seen = echo as Echo;
  expect(seen.method).toBe('POST');
  expect(seen.url).toBe('/api/echo?leg=ecdsa');
  expect(single(seen.headers['content-digest'])).toBe(
    `sha-256=:${createHash('sha256').update(body).digest('base64')}:`,
  );
  const { base, params, covered, sig } = rebuild(seen, 'sig1');
  expect(covered).toEqual(['@method', '@target-uri', 'content-type', 'content-digest']);
  expect(params).toMatch(
    /^\("@method" "@target-uri" "content-type" "content-digest"\);created=\d+;expires=\d+;keyid="oh-desktop-key-1";nonce="[0-9a-f]{32}";tag="oh-desktop"$/,
  );
  const created = Number(params.match(/created=(\d+)/)?.[1]);
  expect(Number(params.match(/expires=(\d+)/)?.[1])).toBe(created + 300);
  expect(base).toContain('"@method": POST\n');
  expect(base).toContain(`"@target-uri": ${API_ECHO_URL}?leg=ecdsa\n`);
  expect(sig).toHaveLength(64);
  expect(nodeVerify('sha256', Buffer.from(base), { key: pair.publicKey, dsaEncoding: 'ieee-p1363' }, sig)).toBe(true);
});

test('hmac-sha256 under a custom label covering the authority, path and query with the alg parameter — the echoed signature matches the secret', async () => {
  const { snapshot, echo } = await send(
    {
      type: 'http-signature',
      algorithm: 'hmac-sha256',
      privateKey: '',
      secret: 'oh-desktop-shared-secret',
      keyId: 'oh-desktop-hmac',
      components: '@method @authority @path @query',
      label: 'oh',
      includeAlgorithm: true,
    },
    { url: `${API_ECHO_URL}?leg=hmac&x=1` },
  );
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  const seen = echo as Echo;
  const { base, params, sig } = rebuild(seen, 'oh');
  expect(params).toMatch(
    /^\("@method" "@authority" "@path" "@query"\);created=\d+;keyid="oh-desktop-hmac";alg="hmac-sha256"$/,
  );
  expect(base).toContain('"@authority": 127.0.0.1:3000\n');
  expect(base).toContain('"@path": /api/echo\n');
  expect(base).toContain('"@query": ?leg=hmac&x=1\n');
  expect(sig.toString('base64')).toBe(createHmac('sha256', 'oh-desktop-shared-secret').update(base).digest('base64'));
  // No digest was asked for — none rides.
  expect(seen.headers['content-digest']).toBeUndefined();
});

test('a covered header the request does not carry is the send error naming it — nothing reaches the wire', async () => {
  const { snapshot, echo } = await send({
    type: 'http-signature',
    algorithm: 'hmac-sha256',
    privateKey: '',
    secret: 'oh-desktop-shared-secret',
    components: '@method date',
  });
  expect(snapshot.error).toBe('HTTP Message Signature signing failed: the request carries no "date" header to cover');
  expect(snapshot.status).toBe(0);
  expect(echo).toBeNull();
});
