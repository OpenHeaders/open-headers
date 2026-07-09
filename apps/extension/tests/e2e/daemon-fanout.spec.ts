/**
 * Two-peer fan-out gate — the peer→hub→peer relay (S12 origin-aware
 * forwarding) exercised against the real daemon, which no other suite
 * covers with two live WS clients:
 *
 *   1. Spawn the built `apps/daemon` bundle with a pre-seeded token
 *      ledger + MCP (same idiom as the T3 gate); seed a rule via MCP.
 *   2. Two raw WS clients (peer-a, peer-b) HELLO in with the minted
 *      token; peer-a runs the `__global__` catch-up to learn the
 *      daemon's home-Org id (every delta envelope carries it).
 *   3. peer-a puts a rule mutation on the wire. The daemon applies it
 *      inbound and the hub forwarder relays it to peer-b live —
 *      excluding the originator by HELLO nodeId, so peer-a NEVER sees
 *      its own envelope come back.
 *   4. A host-local (layout-state) mutation from peer-a reaches
 *      neither peer-b nor the daemon's log — dropped at ingest; the
 *      pipe stays live for the next rule mutation.
 *   5. SIGTERM exits clean.
 *
 * Requires build: `pnpm turbo build --filter=@openheaders/daemon`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: off every prior suite (…19037/19039, 19137).
const DAEMON_PORT = 19237;
const WS_URL = `ws://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-fanout-client', version: '0.0.0' },
};

let daemon: ChildProcess;
let daemonExited: Promise<number | null>;
let dataDir: string;
let token: string;
const daemonLog: string[] = [];

async function rpc(
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

/** A raw sync peer: one socket, a real HELLO, every inbound frame kept. */
interface RawPeer {
  nodeId: string;
  frames: Array<Record<string, unknown>>;
  send(frame: Record<string, unknown>): void;
  close(): void;
}

async function connectPeer(nodeId: string): Promise<RawPeer> {
  const ws = new WebSocket(WS_URL);
  const frames: Array<Record<string, unknown>> = [];
  const welcome = new Promise<Record<string, unknown>>((resolve, reject) => {
    ws.addEventListener('message', (event) => {
      const frame = JSON.parse(String(event.data)) as Record<string, unknown>;
      frames.push(frame);
      if (frame.type === 'oh.sync.welcome') resolve(frame);
    });
    ws.addEventListener('error', () => reject(new Error(`${nodeId}: socket error`)));
    ws.addEventListener('close', (event) => reject(new Error(`${nodeId}: closed ${event.code} ${event.reason}`)));
  });
  await new Promise<void>((resolve) => ws.addEventListener('open', () => resolve()));
  ws.send(
    JSON.stringify({
      type: 'oh.sync.hello',
      protocolVersion: 1,
      role: 'cli',
      nodeId,
      workspaceId: '__global__',
      agent: `@openheaders/extension fanout-gate ${nodeId}`,
      authToken: token,
    }),
  );
  const accepted = await welcome;
  expect(accepted.accepted, `${nodeId} HELLO`).toBe(true);
  return {
    nodeId,
    frames,
    send: (frame) => ws.send(JSON.stringify(frame)),
    close: () => ws.close(),
  };
}

function mutationFramesOf(peer: RawPeer): Array<Record<string, unknown>> {
  return peer.frames.filter((f) => f.type === 'oh.sync.mutation');
}

function envelopeOf(frame: Record<string, unknown>): Record<string, unknown> {
  return frame.envelope as Record<string, unknown>;
}

function makeRuleEnvelope(input: {
  mutationId: string;
  nodeId: string;
  workspaceId: string;
  orgId: string;
  name: string;
}): Record<string, unknown> {
  const uid = input.mutationId.slice(0, 8);
  return {
    mutationId: input.mutationId,
    hlc: { physicalMs: Date.now(), logical: 0, nodeId: input.nodeId },
    origin: { surfaceId: 'fanout-gate', deviceId: input.nodeId },
    workspaceId: input.workspaceId,
    orgId: input.orgId,
    mutatorVersion: 1,
    body: {
      kind: 'create',
      type: 'rule',
      id: uid,
      payload: {
        schemaVersion: 5,
        uid,
        path: `rules/x/${uid}`,
        type: 'header',
        name: input.name,
        enabled: true,
        conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
        action: {
          requestHeaders: [{ uid: 'hmd00001', headerName: 'X-Fanout', operation: 'set', value: '1' }],
          responseHeaders: [],
        },
      },
    },
  };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-daemon-fanout-'));

  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: 'fanout-bootstrap-token',
            tokenHash,
            label: 'fanout e2e',
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
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(DAEMON_PORT)],
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
      { timeout: 30_000 },
    )
    .toBe(200);
});

test.afterAll(async () => {
  peerA?.close();
  peerB?.close();
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

let peerA: RawPeer;
let peerB: RawPeer;
let workspaceId: string;
let orgId: string;

test('MCP seeds a rule and names the active workspace', async () => {
  const { status } = await rpc('initialize', INITIALIZE_PARAMS);
  expect(status).toBe(200);
  await callTool('rules_create', {
    rule: {
      name: 'Fanout seed rule',
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Seed', value: 'fanout' }],
        responseHeaders: [],
      },
    },
  });
  const workspaces = await callTool('workspaces_list', {});
  workspaceId = (workspaces.activeWorkspaceId as string) ?? '';
  expect(workspaceId).toBeTruthy();
});

test('two peers join; the __global__ catch-up names the daemon Org', async () => {
  peerA = await connectPeer('fanout-peer-a');
  peerB = await connectPeer('fanout-peer-b');

  // Delta-only scope (the workspace-list singleton) — every envelope
  // carries the daemon's home-Org id, which inbound applies must match.
  peerA.send({ type: 'oh.sync.stateVector', workspaceId: '__global__', perNodeMaxHlc: {} });
  await expect.poll(() => peerA.frames.some((f) => f.type === 'oh.sync.synced'), { timeout: 15_000 }).toBe(true);
  const globalEnvelope = mutationFramesOf(peerA).map(envelopeOf)[0];
  expect(globalEnvelope, 'a __global__ delta envelope').toBeDefined();
  orgId = globalEnvelope.orgId as string;
  expect(orgId).toBeTruthy();
});

test("peer-a's mutation reaches peer-b live through the hub relay", async () => {
  const framesBefore = mutationFramesOf(peerB).length;
  peerA.send({
    type: 'oh.sync.mutation',
    workspaceId,
    envelope: makeRuleEnvelope({
      mutationId: 'fanout-live-1',
      nodeId: peerA.nodeId,
      workspaceId,
      orgId,
      name: 'Fanout relay rule',
    }),
  });
  await expect
    .poll(
      () =>
        mutationFramesOf(peerB)
          .slice(framesBefore)
          .some((f) => envelopeOf(f).mutationId === 'fanout-live-1'),
      { timeout: 15_000 },
    )
    .toBe(true);
});

test('the mutation never bounces back to its originator', async () => {
  // peer-b has it (previous leg) — give the relay another beat, then
  // assert peer-a's inbound stream never carried its own envelope.
  await new Promise((resolve) => setTimeout(resolve, 750));
  const echoed = mutationFramesOf(peerA).some((f) => envelopeOf(f).mutationId === 'fanout-live-1');
  expect(echoed).toBe(false);
});

test('a host-local (layout) mutation is dropped at ingest and relayed to no one', async () => {
  const framesBefore = mutationFramesOf(peerB).length;
  peerA.send({
    type: 'oh.sync.mutation',
    workspaceId,
    envelope: {
      mutationId: 'fanout-layout-1',
      hlc: { physicalMs: Date.now(), logical: 0, nodeId: peerA.nodeId },
      origin: { surfaceId: 'fanout-gate', deviceId: peerA.nodeId },
      workspaceId,
      orgId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'layout-state', id: 'layout-state', path: 'layout', value: { panes: [] } },
    },
  });
  // Ordering proof: a rule mutation sent AFTER the layout one arrives at
  // peer-b — if the layout envelope were ever going to relay, it would
  // have arrived first on the same socket.
  peerA.send({
    type: 'oh.sync.mutation',
    workspaceId,
    envelope: makeRuleEnvelope({
      mutationId: 'fanout-live-2',
      nodeId: peerA.nodeId,
      workspaceId,
      orgId,
      name: 'Fanout after-layout rule',
    }),
  });
  await expect
    .poll(
      () =>
        mutationFramesOf(peerB)
          .slice(framesBefore)
          .some((f) => envelopeOf(f).mutationId === 'fanout-live-2'),
      { timeout: 15_000 },
    )
    .toBe(true);
  const layoutRelayed = mutationFramesOf(peerB).some((f) => envelopeOf(f).mutationId === 'fanout-layout-1');
  expect(layoutRelayed).toBe(false);
});

test('SIGTERM shuts the daemon down clean', async () => {
  peerA.close();
  peerB.close();
  daemon.kill('SIGTERM');
  expect(await daemonExited).toBe(0);
});
