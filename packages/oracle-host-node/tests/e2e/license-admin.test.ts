/**
 * Licensing enforcement over the live admin wire — end to end against
 * a REAL daemon (the licensing plan §3–§4), driving the same ws peer
 * plane the admin console rides: HELLO/WELCOME with a daemon auth
 * token, then `oh.daemon.license.*` + `oh.daemon.users.*` frames.
 *
 * Two targets, one spec:
 *   - default: a daemon spawned from `apps/daemon/dist` (loopback);
 *   - `OH_DROPLET_URL` + `OH_DROPLET_TOKEN`: a standing WAN daemon
 *     over wss/TLS (the DigitalOcean droplet) — nothing is spawned.
 *
 * Opt-in: skipped unless `OH_LICENSE_E2E=1` or the droplet env is
 * present, so the default unit suite never spawns daemons.
 *
 * What it proves live:
 *   - the token peer holds `daemon.admin` (probe answers admin:true);
 *   - the snapshot plane answers with a well-formed license snapshot;
 *   - install refuses garbage (malformed) and a WELL-FORMED license
 *     signed by an untrusted key (unknown-kid) — the compiled ring is
 *     the only trust root, so locally minted licenses cannot pass;
 *   - the seat gate refuses user creation past the free limit with the
 *     typed seat-limit refusal, and deactivation frees the seat again;
 *   - `license.remove` on an unlicensed daemon is a safe no-op.
 *
 * The POSITIVE install leg (production-signed license → seats lift)
 * needs a key signed by the live ring: set `OH_LICENSE_E2E_KEY_FILE`
 * to a real license file to enable it; it restores the prior state
 * (remove) afterwards. Without the env the leg is skipped — this spec
 * never mints production licenses.
 */

import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { FREE_SEAT_LIMIT, generateLicenseSigningKeys, type License, signLicense } from '@openheaders/core/licensing';
import { PROTOCOL_VERSION, SYNC_HELLO_TYPE, SYNC_WELCOME_TYPE } from '@openheaders/core/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

const DROPLET_URL = process.env.OH_DROPLET_URL;
const DROPLET_TOKEN = process.env.OH_DROPLET_TOKEN;
const LICENSE_KEY_FILE = process.env.OH_LICENSE_E2E_KEY_FILE;
const ENABLED = process.env.OH_LICENSE_E2E === '1' || Boolean(DROPLET_URL && DROPLET_TOKEN);

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: 19639 is fresh (multi-backend ledger up to 19538).
const LOCAL_PORT = 19639;
const RUN = Date.now().toString(36);

interface Target {
  label: string;
  wsUrl: string;
  httpUrl: string;
  token: string;
}

let target: Target;
let daemonProc: ReturnType<typeof spawn> | null = null;
let daemonDataDir: string | null = null;
const daemonLog: string[] = [];
let wire: WebSocket;

async function spawnLocalDaemon(): Promise<Target> {
  const token = `oh_${randomBytes(32).toString('base64url')}`;
  daemonDataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-license-e2e-'));
  await writeFile(
    path.join(daemonDataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: `license-e2e-${RUN}`,
            tokenHash: createHash('sha256').update(token).digest('hex'),
            label: 'license e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
  daemonProc = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', daemonDataDir, '--bind-address', '127.0.0.1', '--bind-port', String(LOCAL_PORT)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemonProc.stdout, daemonProc.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  const deadline = Date.now() + 30000;
  for (;;) {
    const status = await fetch(`http://127.0.0.1:${LOCAL_PORT}/healthz`)
      .then((r) => r.status)
      .catch(() => 0);
    if (status === 200) break;
    if (Date.now() > deadline) {
      throw new Error(`spawned daemon never answered /healthz:\n${daemonLog.join('')}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return {
    label: 'spawned daemon',
    wsUrl: `ws://127.0.0.1:${LOCAL_PORT}`,
    httpUrl: `http://127.0.0.1:${LOCAL_PORT}`,
    token,
  };
}

async function mcpTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${target.httpUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${target.token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  expect(response.status, `${target.label} mcp ${name}`).toBe(200);
  const json = (await response.json()) as { result?: { isError?: boolean; content: Array<{ text: string }> } };
  expect(json.result?.isError, `${target.label} mcp ${name}`).toBeFalsy();
  return JSON.parse(json.result?.content[0]?.text ?? '{}') as Record<string, unknown>;
}

async function connectAdminWire(): Promise<WebSocket> {
  // HELLO carries a workspace id; join with a workspace the backend
  // already has so WORKSPACE_UNKNOWN can never reject the admin wire.
  const listed = await mcpTool('workspaces_list', {});
  const workspaceId = (listed.workspaces as Array<{ id: string }>)[0]?.id;
  expect(workspaceId, `${target.label} has at least one workspace`).toBeTruthy();

  const client = new WebSocket(target.wsUrl);
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });
  const welcome = new Promise<{ accepted: boolean; reason?: string; detail?: string }>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; accepted: boolean; reason?: string; detail?: string };
      if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
    });
  });
  client.send(
    JSON.stringify({
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: 'web',
      nodeId: `license-e2e-${RUN}`,
      workspaceId,
      agent: '@openheaders/web@license-e2e',
      authToken: target.token,
    }),
  );
  const outcome = await welcome;
  expect(outcome.accepted, `${target.label} handshake: ${outcome.reason ?? ''} ${outcome.detail ?? ''}`).toBe(true);
  return client;
}

async function adminCall(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  const type = String(message.type);
  const response = new Promise<{ payload?: Record<string, unknown>; __error?: string }>((resolve) => {
    const listener = (raw: unknown): void => {
      const msg = JSON.parse(String(raw)) as { type: string; payload?: Record<string, unknown>; __error?: string };
      if (msg.type === `${type}:response`) {
        wire.off('message', listener);
        resolve(msg);
      }
    };
    wire.on('message', listener);
  });
  wire.send(JSON.stringify(message));
  const result = await response;
  expect(result.__error, `${target.label} ${type}`).toBeUndefined();
  return result.payload ?? {};
}

async function mintUntrustedLicense(): Promise<string> {
  const { privateKey } = await generateLicenseSigningKeys();
  const year = new Date().getUTCFullYear();
  const license: License = {
    schemaVersion: 1,
    licenseId: `lic-e2e-${RUN}`,
    licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
    seats: 25,
    entitlements: [],
    issuedAt: Date.now(),
    validUntil: Date.UTC(year + 1, 0, 1),
    graceDays: 21,
    kid: 'oh-lic-e2e-untrusted',
  };
  return signLicense(license, privateKey);
}

interface DirectoryUser {
  userId: string;
  displayName: string;
  deactivatedAt: number | null;
}

async function listUsers(): Promise<DirectoryUser[]> {
  const payload = await adminCall({ type: 'oh.daemon.users.list' });
  return payload.users as DirectoryUser[];
}

const activeCount = (users: DirectoryUser[]): number => users.filter((u) => u.deactivatedAt === null).length;

describe.skipIf(!ENABLED)('licensing enforcement over the admin wire', () => {
  let initialStatus = '';

  beforeAll(async () => {
    target =
      DROPLET_URL && DROPLET_TOKEN
        ? {
            label: `droplet ${DROPLET_URL}`,
            wsUrl: DROPLET_URL,
            httpUrl: DROPLET_URL.replace(/^ws/, 'http'),
            token: DROPLET_TOKEN,
          }
        : await spawnLocalDaemon();
    wire = await connectAdminWire();
  }, 60000);

  afterAll(async () => {
    wire?.close();
    if (daemonProc) {
      daemonProc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        daemonProc?.once('exit', () => resolve());
        setTimeout(() => {
          daemonProc?.kill('SIGKILL');
          resolve();
        }, 5000).unref();
      });
    }
    if (daemonDataDir) await rm(daemonDataDir, { recursive: true, force: true });
  });

  it('the token peer holds daemon.admin', async () => {
    const probe = await adminCall({ type: 'oh.daemon.admin.status' });
    expect(probe).toEqual({ admin: true });
  });

  it('license.status answers a well-formed snapshot', async () => {
    const payload = await adminCall({ type: 'oh.daemon.license.status' });
    const snapshot = payload.snapshot as { status: string };
    expect(['unlicensed', 'licensed', 'grace', 'expired', 'invalid']).toContain(snapshot.status);
    initialStatus = snapshot.status;
  });

  it('install refuses garbage as malformed', async () => {
    const refused = await adminCall({ type: 'oh.daemon.license.install', text: 'not-a-license' });
    expect(refused.ok).toBe(false);
    expect(String(refused.error)).toContain('not a license');
  });

  it('install refuses a well-formed license signed by an untrusted key', async () => {
    const text = await mintUntrustedLicense();
    const refused = await adminCall({ type: 'oh.daemon.license.install', text });
    expect(refused.ok).toBe(false);
    expect(String(refused.error)).toContain('key this build does not trust');
  });

  it('the seat gate refuses creation past the limit and deactivation frees the seat', async () => {
    const statusPayload = await adminCall({ type: 'oh.daemon.license.status' });
    const snapshot = statusPayload.snapshot as { status: string; seats?: number };
    const seatLimit =
      snapshot.status === 'licensed' || snapshot.status === 'grace' ? (snapshot.seats ?? 0) : FREE_SEAT_LIMIT;

    const before = await listUsers();
    const free = seatLimit - activeCount(before);
    expect(free, `seat probe needs headroom on ${target.label} (limit ${seatLimit})`).toBeGreaterThan(0);

    const probeIds: string[] = [];
    try {
      for (let i = 0; i < free; i++) {
        const created = await adminCall({
          type: 'oh.daemon.users.create',
          displayName: `e2e-seat-probe-${RUN}-${i}`,
          email: `seat-probe-${RUN}-${i}@openheaders.io`,
        });
        expect(created.ok, `probe user ${i} admitted (${String(created.error ?? '')})`).toBe(true);
        probeIds.push(String(created.userId));
      }

      const refused = await adminCall({
        type: 'oh.daemon.users.create',
        displayName: `e2e-seat-probe-${RUN}-over`,
        email: `seat-probe-${RUN}-over@openheaders.io`,
      });
      expect(refused.ok).toBe(false);
      expect(refused.reason).toBe('seat-limit-reached');
      expect(String(refused.error)).toContain(`seat limit reached (${seatLimit} active users)`);
    } finally {
      for (const userId of probeIds) {
        const gone = await adminCall({ type: 'oh.daemon.users.deactivate', userId });
        expect(gone.ok, `probe ${userId} deactivated`).toBe(true);
      }
    }

    // Deactivation freed the seats: one more admission passes again.
    const again = await adminCall({
      type: 'oh.daemon.users.create',
      displayName: `e2e-seat-probe-${RUN}-refill`,
      email: `seat-probe-${RUN}-refill@openheaders.io`,
    });
    expect(again.ok).toBe(true);
    const cleanup = await adminCall({ type: 'oh.daemon.users.deactivate', userId: String(again.userId) });
    expect(cleanup.ok).toBe(true);
  });

  it('remove on an unlicensed daemon is a safe no-op', async () => {
    if (initialStatus !== 'unlicensed') return;
    const removed = await adminCall({ type: 'oh.daemon.license.remove' });
    expect(removed.ok).toBe(true);
    expect((removed.snapshot as { status: string }).status).toBe('unlicensed');
  });

  it('a production-signed license installs, lifts the seat limit, and removes cleanly', async () => {
    if (!LICENSE_KEY_FILE) return;
    if (initialStatus !== 'unlicensed') return;
    const text = await readFile(LICENSE_KEY_FILE, 'utf8');
    const installed = await adminCall({ type: 'oh.daemon.license.install', text });
    expect(installed.ok, String(installed.error ?? '')).toBe(true);
    const snapshot = installed.snapshot as { status: string; seats: number };
    expect(['licensed', 'grace']).toContain(snapshot.status);
    expect(snapshot.seats).toBeGreaterThan(FREE_SEAT_LIMIT);
    const removed = await adminCall({ type: 'oh.daemon.license.remove' });
    expect(removed.ok).toBe(true);
    expect((removed.snapshot as { status: string }).status).toBe('unlicensed');
  });
});
