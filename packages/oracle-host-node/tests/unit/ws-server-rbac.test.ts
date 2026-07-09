/**
 * Phase 5 slice 2 — RBAC at the gate, over real sockets.
 *
 * Two directory users hold different grants on the same workspace; each
 * connects with its own bound token against a real bound WS server:
 *
 *   - The EDITOR's `oh.sync.mutationBatch` applies end-to-end — the
 *     entity materializes in the workspace oracle and the write-gate
 *     audit names the editor as the actor.
 *   - The VIEWER's identical batch is silently dropped + audited; the
 *     socket stays up (deny never tears the connection down).
 *   - A no-grant peer's STATE_VECTOR catch-up is answered with an EMPTY
 *     SYNCED — the scope loop proceeds, the log is never read.
 *   - `broadcastFrame`'s `filterPeer` (fed by `makeWorkspaceReadFilter`)
 *     delivers a workspace frame to the granted peer only.
 *
 * The write path proves the whole chain: connection.ts threads the
 * peer's userId into `dispatchSyncRpc`, which re-resolves the user's
 * snapshot per frame and gates the inbound bridge as that user.
 */

import { createServer } from 'node:net';
import {
  clearIdentitySnapshot,
  createDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  mintDaemonAuthToken,
  type ResolvedAuditEntry,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import {
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
} from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import { type MutationBatch, type MutatorContext, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { DaemonUserRecord, Rule } from '@openheaders/core/types';
import { __resetMutationStreamBridgeForTests } from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { makeWorkspaceReadFilter } from '../../src/daemon/peer-read-filter';
import { type OracleWsServer, startOracleWsServer } from '../../src/host-runtime/ws-server';
import { createHostStorageFake } from './_host-storage-fake';

const IDENTITY = { role: 'desktop' as const, nodeId: 'host-node-1', agent: '@openheaders/desktop@test' };
const WS_ID = 'ws-rbac';

let server: OracleWsServer | null = null;
const clients: WebSocket[] = [];
let daemonOrgId = '';
let audits: ResolvedAuditEntry[] = [];

async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const addr = probe.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function addUserWithGrant(name: string, role: 'editor' | 'viewer' | null): Promise<DaemonUserRecord> {
  const created = await createDaemonUser({ displayName: name });
  if (!created.ok) throw new Error('directory create failed');
  if (role !== null) {
    await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: WS_ID, role });
  }
  return created.record;
}

async function connectAs(port: number, record: DaemonUserRecord, nodeId: string): Promise<WebSocket> {
  const bound = await mintDaemonAuthToken({ label: `${record.user.displayName} device`, userId: record.user.id });
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  clients.push(client);
  await new Promise<void>((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });
  const welcome = new Promise<{ accepted: boolean }>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_WELCOME_TYPE) resolve(msg);
    });
  });
  client.send(
    JSON.stringify({
      type: SYNC_HELLO_TYPE,
      protocolVersion: PROTOCOL_VERSION,
      role: 'extension',
      nodeId,
      workspaceId: WS_ID,
      agent: '@openheaders/extension@test',
      authToken: bound.secret,
    }),
  );
  expect((await welcome).accepted).toBe(true);
  return client;
}

function makeRule(uid: string): Rule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name: 'r',
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  } as unknown as Rule;
}

function makeBatch(uid: string, ms: number): MutationBatch {
  const ctx: MutatorContext = {
    workspaceId: WS_ID,
    orgId: daemonOrgId,
    hlc: { physicalMs: ms, logical: 0, nodeId: 'ext-node-1' },
    surfaceId: 's',
    deviceId: 'peer-device',
  };
  return seedRule(makeRule(uid), ctx);
}

/** Send a batch and await its RPC response frame. */
async function sendBatch(client: WebSocket, batch: MutationBatch): Promise<void> {
  const responded = new Promise<void>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === `${SYNC_MUTATION_BATCH_TYPE}:response`) resolve();
    });
  });
  client.send(JSON.stringify({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: WS_ID, batch }));
  await responded;
}

beforeAll(() => {
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  server = null;
  clients.length = 0;
  audits = [];
  setAuditSink((entry) => audits.push(entry));
  setHostStorage(createHostStorageFake());
  const record = await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
  daemonOrgId = record.org.id;
  // The ingest org filter reads the DAEMON's registry snapshot; hydrate
  // it so envelopes stamped with the daemon's org pass to the write gate.
  await refreshIdentitySnapshotFromHostStorage();
  __initSyncServiceForTests(WS_ID);
  __resetMutationStreamBridgeForTests();
});

afterEach(async () => {
  for (const client of clients) {
    try {
      client.close();
    } catch {
      // ignore
    }
  }
  clients.length = 0;
  await server?.close();
  server = null;
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
  resetAuditSink();
  clearIdentitySnapshot();
});

describe('RBAC at the gate — two users over real sockets', () => {
  it("an editor's batch applies end-to-end; a viewer's identical write is silently dropped + audited", async () => {
    const editor = await addUserWithGrant('Alice', 'editor');
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const editorClient = await connectAs(port, editor, 'ext-editor');
    const viewerClient = await connectAs(port, viewer, 'ext-viewer');

    const editorRuleUid = 'aaaaaaaa';
    await sendBatch(editorClient, makeBatch(editorRuleUid, 1_000));
    const oracle = getOracleForCurrentWorkspace();
    expect(oracle?.materializeOne(RULE_ENTITY_TYPE, editorRuleUid)).toBeDefined();
    const editorGate = audits.find((a) => a.capability === 'workspace.write' && a.actorUserId === editor.user.id);
    expect(editorGate?.decision.allow).toBe(true);

    const viewerRuleUid = 'bbbbbbbb';
    await sendBatch(viewerClient, makeBatch(viewerRuleUid, 2_000));
    expect(oracle?.materializeOne(RULE_ENTITY_TYPE, viewerRuleUid)).toBeFalsy();
    const viewerGate = audits.find((a) => a.capability === 'workspace.write' && a.actorUserId === viewer.user.id);
    expect(viewerGate?.decision).toEqual({ allow: false, reason: 'insufficient-workspace-role' });
    // Deny never tears the socket down.
    expect(viewerClient.readyState).toBe(WebSocket.OPEN);
    expect(server.connectedCount()).toBe(2);
  });

  it('a no-grant user cannot write at all', async () => {
    const stranger = await addUserWithGrant('Mallory', null);
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = await connectAs(port, stranger, 'ext-stranger');
    await sendBatch(client, makeBatch('cccccccc', 3_000));
    expect(getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, 'cccccccc')).toBeFalsy();
    const gate = audits.find((a) => a.capability === 'workspace.write' && a.actorUserId === stranger.user.id);
    expect(gate?.decision).toEqual({ allow: false, reason: 'no-workspace-role-assignment' });
  });

  it("a no-grant user's catch-up gets an EMPTY SYNCED for the scope", async () => {
    const stranger = await addUserWithGrant('Mallory', null);
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = await connectAs(port, stranger, 'ext-stranger');
    const synced = new Promise<{ workspaceId: string; stateVectorAfter: Record<string, unknown> }>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_SYNCED_TYPE) resolve(msg);
      });
    });
    client.send(JSON.stringify({ type: SYNC_STATE_VECTOR_TYPE, workspaceId: WS_ID, perNodeMaxHlc: {} }));
    const frame = await synced;
    expect(frame.workspaceId).toBe(WS_ID);
    expect(frame.stateVectorAfter).toEqual({});
    const gate = audits.find((a) => a.capability === 'workspace.read' && a.actorUserId === stranger.user.id);
    expect(gate?.decision).toEqual({ allow: false, reason: 'no-workspace-role-assignment' });
  });

  it('broadcastFrame + makeWorkspaceReadFilter deliver a workspace frame to the granted peer only', async () => {
    const viewer = await addUserWithGrant('Alice', 'viewer');
    const stranger = await addUserWithGrant('Mallory', null);
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const viewerClient = await connectAs(port, viewer, 'ext-viewer');
    const strangerClient = await connectAs(port, stranger, 'ext-stranger');

    const strangerGot: string[] = [];
    strangerClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'test.rule' || msg.type === 'test.sentinel') strangerGot.push(msg.type);
    });
    const viewerGot = new Promise<Record<string, unknown>>((resolve) => {
      viewerClient.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'test.rule') resolve(msg);
      });
    });

    const filterPeer = await makeWorkspaceReadFilter(WS_ID, server.listConnectedPeers());
    server.broadcastFrame({ type: 'test.rule', workspaceId: WS_ID }, { filterPeer });
    // Unfiltered sentinel on the same ordered sockets: if the gate holds,
    // the stranger sees only the sentinel.
    const strangerSentinel = new Promise<void>((resolve) => {
      strangerClient.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'test.sentinel') resolve();
      });
    });
    server.broadcastFrame({ type: 'test.sentinel' });
    await viewerGot;
    await strangerSentinel;
    expect(strangerGot).toEqual(['test.sentinel']);
  });

  it('a revoked grant bites the next frame without reconnecting', async () => {
    const editor = await addUserWithGrant('Alice', 'editor');
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });

    const client = await connectAs(port, editor, 'ext-editor');
    await sendBatch(client, makeBatch('dddddddd', 4_000));
    expect(getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, 'dddddddd')).toBeDefined();

    // Downgrade to viewer while the socket stays up — the per-frame
    // re-resolution must refuse the very next write.
    await grantWorkspaceRole({ principalId: editor.principal.id, workspaceId: WS_ID, role: 'viewer' });
    await sendBatch(client, makeBatch('eeeeeeee', 5_000));
    expect(getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, 'eeeeeeee')).toBeFalsy();
    const deny = audits.find((a) => a.capability === 'workspace.write' && a.decision.allow === false);
    expect(deny?.actorUserId).toBe(editor.user.id);
    expect(deny?.decision.reason).toBe('insufficient-workspace-role');
  });
});
