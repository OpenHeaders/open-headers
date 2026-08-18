/**
 * Phase-3 WAN acceptance — the daemon behind a TLS-terminating reverse
 * proxy (the daemon plan §3/§4, `apps/daemon/README.md` → "Behind a
 * reverse proxy (TLS)"), using the reusable `playground/daemon-rig`:
 *
 *   1. Spawn the built daemon on LOOPBACK — the reverse-proxy posture:
 *      only the proxy is reachable from outside — with
 *      `--trusted-proxy --allowed-host oh.test`.
 *   2. Spawn the rig's TLS proxy in front of it (self-signed `oh.test`
 *      cert, `X-Forwarded-For` append, WS upgrade forwarding).
 *   3. A HELLO client joins over `wss://oh.test` end-to-end.
 *   4. A bad token is rejected, and the reject log carries the client
 *      address the proxy appended to X-Forwarded-For (`::1` — the rig
 *      probe dials the proxy over IPv6 loopback precisely so the XFF
 *      entry differs from the proxy→daemon socket, `127.0.0.1`).
 *   5. Admission matrix through the proxy: foreign Origin and rebound
 *      Host each 403; `/healthz` and the pairing page pass.
 *   6. A bad-token hammer throttles the XFF peer (upgrades close 1008
 *      `rate-limited`; even a valid token is refused while blocked) and
 *      `/healthz` never throttles. Runs LAST — the block outlives the
 *      suite.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon`.
 * The rig scripts run under plain Node (spawned, not imported — they
 * are ESM living in the playground package); the daemon runs under the
 * repo's electron binary for the better-sqlite3 ABI, like the T3 spec.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import https from 'node:https';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
// realpath so the rig CLIs' `import.meta.url === pathToFileURL(argv[1])`
// entry gate holds when the playground is reached through a symlink
// (Node realpath-resolves the main module, argv[1] stays as spawned).
const DAEMON_RIG = realpathSync(path.join(REPO_ROOT, 'playground/daemon-rig'));
const RIG_CA = path.join(DAEMON_RIG, '.certs/oh.test.cert.pem');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off 8137 (default), 18137 (mcp.spec), 18238 (daemon-join.spec).
const DAEMON_PORT = 18338;
const PROXY_PORT = 18339;

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let proxy: ChildProcess;
let token: string;
const daemonLog: string[] = [];

/** Run the rig's HELLO probe CLI; resolves to its stdout (one line per attempt). */
function runProbe(probeToken: string, count = 1): Promise<string> {
  return new Promise((resolve, reject) => {
    const probe = spawn(
      process.execPath,
      [path.join(DAEMON_RIG, 'hello-probe.mjs'), probeToken, String(count)],
      { env: { ...process.env, PROXY_PORT: String(PROXY_PORT) } },
    );
    let out = '';
    probe.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    probe.stderr?.on('data', (chunk: Buffer) => {
      out += chunk.toString();
    });
    probe.once('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`probe exit ${code}:\n${out}`))));
    probe.once('error', reject);
  });
}

/**
 * HTTPS request through the proxy as `oh.test` without touching DNS:
 * connect to 127.0.0.1, verify the rig cert against SNI `oh.test`, and
 * send the wanted Host header explicitly (fetch/undici refuses to
 * override Host, so this goes through node:https).
 */
function httpsViaProxy(
  requestPath: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: '127.0.0.1',
        port: PROXY_PORT,
        path: requestPath,
        servername: 'oh.test',
        ca: readFileSync(RIG_CA),
        headers: { host: `oh.test:${PROXY_PORT}`, ...headers },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.once('error', reject);
    req.end();
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-wan-'));

  // Offline admin bootstrap, same shape as the T3 spec.
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.daemonAuthTokens': [
          {
            id: 'wan-bootstrap-token',
            tokenHash,
            label: 'wan e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );

  daemon = spawn(
    electronBinary,
    [
      DAEMON_MAIN,
      '--data-dir',
      dataDir,
      '--bind-address',
      '127.0.0.1',
      '--bind-port',
      String(DAEMON_PORT),
      '--trusted-proxy',
      '--allowed-host',
      'oh.test',
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  daemonExited = new Promise((resolve) => daemon.once('exit', (code) => resolve(code)));

  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/healthz`);
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);

  // The proxy CLI mints the oh.test cert on boot; ready line = listening.
  proxy = spawn(process.execPath, [path.join(DAEMON_RIG, 'tls-proxy.mjs')], {
    env: { ...process.env, PROXY_PORT: String(PROXY_PORT), DAEMON_PORT: String(DAEMON_PORT) },
  });
  let proxyOut = '';
  proxy.stdout?.on('data', (chunk: Buffer) => {
    proxyOut += chunk.toString();
  });
  proxy.stderr?.on('data', (chunk: Buffer) => {
    proxyOut += chunk.toString();
  });
  await expect.poll(() => proxyOut.includes('listening'), { timeout: 15000 }).toBe(true);
});

test.afterAll(async () => {
  proxy?.kill('SIGTERM');
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── TLS termination + HTTP plane through the proxy ──────────────────

test('healthz answers through the proxy', async () => {
  const { status } = await httpsViaProxy('/healthz');
  expect(status).toBe(200);
});

test('the pairing page renders through the proxy for a well-formed unknown code', async () => {
  const { status, body } = await httpsViaProxy('/pair/123456');
  expect(status).toBe(404);
  expect(body).toContain('<!DOCTYPE html>');
});

test('a foreign Origin and a rebound Host are each refused with 403', async () => {
  const foreignOrigin = await httpsViaProxy('/pair/123456', { origin: 'https://evil.openheaders.io' });
  expect(foreignOrigin.status).toBe(403);

  const reboundHost = await httpsViaProxy('/pair/123456', { host: 'evil.openheaders.io' });
  expect(reboundHost.status).toBe(403);
});

// ── wss:// data plane ───────────────────────────────────────────────

test('a HELLO client joins over wss:// end-to-end', async () => {
  const out = await runProbe(token);
  expect(out).toContain('accepted');
});

test('a bad token is rejected and the log carries the X-Forwarded-For peer', async () => {
  const out = await runProbe('oh_wrong-token-guess');
  expect(out).toContain('rejected: auth-required');
  // ::1 is the probe→proxy address from XFF; the proxy→daemon socket is
  // 127.0.0.1. Without --trusted-proxy this line would blame the proxy.
  expect(daemonLog.join('')).toContain('HELLO rejected: auth-required (peer=::1)');
});

// ── Brute-force throttle on the XFF peer — must run last ────────────

test('a bad-token hammer throttles the forwarded client, not the proxy', async () => {
  const out = await runProbe('oh_wrong-token-guess', 12);
  expect(out).toContain('rejected: auth-required');
  expect(out).toContain('rate-limited');
  expect(daemonLog.join('')).toMatch(/peer throttled: \d+ failed ws-auth attempts .* \(peer=::1\)/);

  // The block is by peer, not by token — a valid token is refused too.
  const valid = await runProbe(token);
  expect(valid).toContain('rate-limited');

  // /healthz never throttles.
  const { status } = await httpsViaProxy('/healthz');
  expect(status).toBe(200);
});
