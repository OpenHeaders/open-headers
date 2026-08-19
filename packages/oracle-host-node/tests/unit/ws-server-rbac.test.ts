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
  createDaemonPairingService,
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  mintDaemonAuthToken,
  type ResolvedAuditEntry,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import type { AwarenessState } from '@openheaders/core/protocol';
import {
  PROTOCOL_VERSION,
  SYNC_AWARENESS_PRESENCE_TYPE,
  SYNC_HELLO_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
} from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
  type MutationBatch,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  setWorkspaceOrgResolver,
  workspaceListRowIdForMutation,
} from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { DaemonUserRecord, Rule } from '@openheaders/core/types';
import { __resetMutationStreamBridgeForTests } from '@openheaders/oracle/sync';
import { __initGlobalSyncServiceForTests, disposeGlobal } from '@openheaders/oracle/sync/global-service';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getAwarenessStoreForWorkspace,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaceStore,
  bridgeExtensionWorkspaceSyncEngine,
  createWorkspace,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { queryAuditEntries, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createAdminChannelHandlers } from '../../src/daemon/admin-channels';
import { createAwarenessPeerFanOut } from '../../src/daemon/awareness-fan-out';
import { offerWorkspaceRowsToUserPeers } from '../../src/daemon/grant-workspace-offer';
import { ADMIN_DENIED_MESSAGE, createPeerAdminRpc } from '../../src/daemon/peer-admin-rpc';
import { createFilteredPeerBroadcast, makeWorkspaceReadFilter } from '../../src/daemon/peer-read-filter';
import { type OracleWsServer, startOracleWsServer } from '../../src/host-runtime/ws-server';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';
import { createHostStorageFake } from './_host-storage-fake';

const IDENTITY = { role: 'desktop' as const, nodeId: 'host-node-1', agent: '@openheaders/desktop@test' };
const WS_ID = 'ws-rbac';

let server: OracleWsServer | null = null;
const clients: WebSocket[] = [];
let daemonOrgId = '';
let audits: ResolvedAuditEntry[] = [];
let auditDb: Database.Database;

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
  const device = await connectDeviceAs(port, record, nodeId);
  return device.client;
}

/** `connectAs` variant that also exposes the minted per-device token id. */
async function connectDeviceAs(
  port: number,
  record: DaemonUserRecord,
  nodeId: string,
): Promise<{ client: WebSocket; tokenId: string }> {
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
  return { client, tokenId: bound.record.id };
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
  // Dual sink — the array for in-test assertions, the SQLite log for
  // the slice-4 "denials land as queryable rows" leg (the same sink
  // shape the boot spine installs).
  auditDb = openSqliteDatabase(':memory:');
  const sqliteAudit = new SqliteAuditLog(auditDb);
  setAuditSink((entry) => {
    audits.push(entry);
    void sqliteAudit.append(entry);
  });
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
  auditDb.close();
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

    // Slice 4 — the denied write is a QUERYABLE row in the durable
    // audit log, filtered exactly the way `ohd audit list
    // --decision deny` reads it, with the viewer as the actor.
    const deniedRows = queryAuditEntries(auditDb, { allow: false, capability: 'workspace.write' });
    expect(deniedRows.map((r) => r.actorUserId)).toContain(viewer.user.id);
    expect(deniedRows.map((r) => r.actorUserId)).not.toContain(editor.user.id);
    expect(deniedRows.find((r) => r.actorUserId === viewer.user.id)?.decision.reason).toBe(
      'insufficient-workspace-role',
    );
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

// ── Slice-2 leftovers: per-row `__global__` filtering + §9 presence ──

function makeGlobalRowEnvelope(mutationId: string, rowWorkspaceId: string, ms: number): MutationEnvelope {
  return {
    mutationId,
    hlc: { physicalMs: ms, logical: 0, nodeId: 'daemon-node' },
    origin: { surfaceId: 'sw', deviceId: 'daemon-device' },
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    orgId: daemonOrgId,
    mutatorVersion: 1,
    body: {
      kind: 'addToSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: rowWorkspaceId,
      item: { id: rowWorkspaceId, kind: 'team', name: rowWorkspaceId, orgId: daemonOrgId },
      orderKey: mutationId,
    },
  };
}

function makeGlobalActiveIdEnvelope(mutationId: string, activeWorkspaceId: string, ms: number): MutationEnvelope {
  return {
    mutationId,
    hlc: { physicalMs: ms, logical: 0, nodeId: 'daemon-node' },
    origin: { surfaceId: 'sw', deviceId: 'daemon-device' },
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    orgId: daemonOrgId,
    mutatorVersion: 1,
    body: {
      kind: 'setField',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
      value: activeWorkspaceId,
    },
  };
}

function makePresenceState(instanceId: string): AwarenessState {
  return {
    identity: { instanceId, surfaceKind: 'workbench', appId: 'extension', labelContext: 'Workbench' },
    entityFocus: null,
    fieldFocus: null,
    dirtyFields: [],
    lastActivityHlc: { physicalMs: Date.now(), logical: 0, nodeId: 'ext-node' },
  };
}

/** Run a `__global__` catch-up on `client`; return the streamed envelopes' workspace subjects. */
async function catchUpGlobalRows(client: WebSocket): Promise<string[]> {
  const rows: string[] = [];
  const synced = new Promise<void>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_MUTATION_TYPE && msg.workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
        rows.push(msg.envelope.body.itemId ?? msg.envelope.body.value);
      }
      if (msg.type === SYNC_SYNCED_TYPE && msg.workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) resolve();
    });
  });
  client.send(
    JSON.stringify({ type: SYNC_STATE_VECTOR_TYPE, workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE, perNodeMaxHlc: {} }),
  );
  await synced;
  return rows;
}

describe('per-row __global__ filtering + same-user presence — two users over real sockets', () => {
  afterEach(() => {
    disposeGlobal();
  });

  it("a directory user's __global__ catch-up streams only granted rows and pointer values", async () => {
    const globalLog = new InMemoryMutationLog();
    await globalLog.appendAll([
      makeGlobalRowEnvelope('m-row-a', 'ws-a', 1_000),
      makeGlobalRowEnvelope('m-row-b', 'ws-b', 2_000),
      makeGlobalActiveIdEnvelope('m-active-b', 'ws-b', 3_000),
      makeGlobalActiveIdEnvelope('m-active-a', 'ws-a', 4_000),
    ]);
    __initGlobalSyncServiceForTests({ log: globalLog });

    const granted = await createDaemonUser({ displayName: 'Alice' });
    if (!granted.ok) throw new Error('directory create failed');
    await grantWorkspaceRole({ principalId: granted.record.principal.id, workspaceId: 'ws-a', role: 'viewer' });

    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, granted.record, 'ext-alice');

    // The `activeId` pointer naming the ungranted ws-b is hidden like
    // ws-b's row — the pointer must not reveal an ungranted id.
    expect(await catchUpGlobalRows(client)).toEqual(['ws-a', 'ws-a']);
  });

  it('the live __global__ delta plane fans a workspace-list row to granted peers only', async () => {
    const grantedUser = await addUserWithGrant('Alice', null);
    await grantWorkspaceRole({ principalId: grantedUser.principal.id, workspaceId: 'ws-a', role: 'viewer' });
    const stranger = await addUserWithGrant('Mallory', null);

    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const grantedClient = await connectAs(port, grantedUser, 'ext-alice');
    const strangerClient = await connectAs(port, stranger, 'ext-mallory');

    const strangerGot: string[] = [];
    strangerClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_MUTATION_TYPE || msg.type === 'test.sentinel') strangerGot.push(msg.type);
    });
    const grantedGot = new Promise<{ envelope: MutationEnvelope }>((resolve) => {
      grantedClient.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_MUTATION_TYPE) resolve(msg);
      });
    });

    const broadcast = createFilteredPeerBroadcast(() => server);
    const envelope = makeGlobalRowEnvelope('m-live-a', 'ws-a', 3_000);
    broadcast.enqueue(
      { type: SYNC_MUTATION_TYPE, workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE, envelope },
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    );

    const strangerSentinel = new Promise<void>((resolve) => {
      strangerClient.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'test.sentinel') resolve();
      });
    });
    expect((await grantedGot).envelope.mutationId).toBe('m-live-a');
    server?.broadcastFrame({ type: 'test.sentinel' });
    await strangerSentinel;
    expect(strangerGot).toEqual(['test.sentinel']);
  });

  it("presence is stamped at ingest and reaches the same user's other device — never the origin device or another user", async () => {
    const alice = await addUserWithGrant('Alice', 'viewer');
    const bob = await addUserWithGrant('Bob', 'viewer');

    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const aliceDevice1 = await connectDeviceAs(port, alice, 'ext-alice-1');
    const aliceDevice2 = await connectDeviceAs(port, alice, 'ext-alice-2');
    const bobDevice = await connectDeviceAs(port, bob, 'ext-bob');

    // Device 1 publishes its presence into the hub.
    const ingested = new Promise<void>((resolve) => {
      aliceDevice1.client.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === `${SYNC_AWARENESS_PRESENCE_TYPE}:response`) resolve();
      });
    });
    aliceDevice1.client.send(
      JSON.stringify({
        type: SYNC_AWARENESS_PRESENCE_TYPE,
        workspaceId: WS_ID,
        presence: [makePresenceState('inst-alice-1')],
      }),
    );
    await ingested;

    // Stamp-at-ingest: the hub's store row carries the credential's
    // user + device, regardless of what the frame claimed.
    const stored = getAwarenessStoreForWorkspace(WS_ID)?.list() ?? [];
    expect(stored).toHaveLength(1);
    expect(stored[0].identity.userId).toBe(alice.user.id);
    expect(stored[0].identity.deviceId).toBe(aliceDevice1.tokenId);

    // Fan the canonical set out per peer — the boot spine's hook shape.
    const collect = (socket: WebSocket): string[][] => {
      const frames: string[][] = [];
      socket.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_AWARENESS_PRESENCE_TYPE) {
          frames.push((msg.presence as AwarenessState[]).map((s) => s.identity.instanceId));
        }
      });
      return frames;
    };
    const originFrames = collect(aliceDevice1.client);
    const bobFrames = collect(bobDevice.client);
    const device2Frame = new Promise<AwarenessState[]>((resolve) => {
      aliceDevice2.client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_AWARENESS_PRESENCE_TYPE) resolve(msg.presence);
      });
    });

    const fanOut = createAwarenessPeerFanOut(() => server);
    fanOut.enqueue(WS_ID, stored);

    const relayed = await device2Frame;
    expect(relayed.map((s) => s.identity.instanceId)).toEqual(['inst-alice-1']);
    expect(relayed[0].identity.userId).toBe(alice.user.id);

    // Ordered sentinel proves the negative legs: the origin device and
    // Bob saw no presence frame by the time the sentinel landed.
    const sentinels = [aliceDevice1.client, bobDevice.client].map(
      (socket) =>
        new Promise<void>((resolve) => {
          socket.on('message', (raw) => {
            if (JSON.parse(raw.toString()).type === 'test.sentinel') resolve();
          });
        }),
    );
    server?.broadcastFrame({ type: 'test.sentinel' });
    await Promise.all(sentinels);
    expect(originFrames).toEqual([]);
    expect(bobFrames).toEqual([]);
  });
});

// ── Peer admin plane — gated `oh.daemon.*` over real sockets ────────

/** Send one RPC frame and await its `<type>:response` twin. */
async function callOverWire(
  client: WebSocket,
  message: Record<string, unknown>,
): Promise<{ payload?: Record<string, unknown>; __error?: string }> {
  const response = new Promise<{ payload?: Record<string, unknown>; __error?: string }>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === `${String(message.type)}:response`) resolve(msg);
    });
  });
  client.send(JSON.stringify(message));
  return response;
}

/** Connect a peer riding an UNBOUND token — resolves to the operator. */
async function connectOperator(port: number, nodeId: string): Promise<WebSocket> {
  const minted = await mintDaemonAuthToken({ label: 'operator device' });
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
      role: 'web',
      nodeId,
      workspaceId: WS_ID,
      agent: '@openheaders/web@test',
      authToken: minted.secret,
    }),
  );
  expect((await welcome).accepted).toBe(true);
  return client;
}

async function startServerWithAdminPlane(port: number): Promise<OracleWsServer> {
  const peerRpc = createPeerAdminRpc({
    channels: createAdminChannelHandlers({
      pairing: createDaemonPairingService(),
      getBoundPort: () => port,
      getWsServer: () => server,
      queryAudit: (filter) => queryAuditEntries(auditDb, filter),
      license: {
        getSnapshot: () => ({ status: 'unlicensed' as const }),
        getInstalledText: async () => null,
        install: async () => ({ ok: false as const, error: 'not under test' }),
        remove: async () => ({ ok: true as const, snapshot: { status: 'unlicensed' as const } }),
        reload: async () => ({ status: 'unlicensed' as const }),
        dispose: () => undefined,
      },
      cliProvision: {
        status: async () => ({
          configPath: '/dev/null',
          state: 'unconfigured' as const,
          binaryInstalled: false,
          hostPlatform: 'linux',
        }),
        provision: async () => ({ ok: false as const, error: 'not under test' }),
      },
      proxyTrust: {
        status: async () => ({ ca: null, stores: [], changes: [], systemKeychainTrustSupported: false }),
        install: async () => ({ ok: false as const, error: 'not under test' }),
        remove: async () => ({ ok: true, results: [] }),
        helperState: async () => ({ present: false, available: false, registration: null }),
        helperRegister: async () => ({ ok: false as const, error: 'not under test' }),
        helperUnregister: async () => ({ ok: false as const, error: 'not under test' }),
        helperOpenLoginItems: async () => ({ ok: false as const, error: 'not under test' }),
      },
      proxyCapture: {
        status: async () => ({
          running: false,
          boundPort: null,
          port: 8138,
          scopePatterns: [],
          caPresent: false,
          lastError: null,
        }),
        start: async () => ({ ok: false as const, error: 'not under test' }),
        stop: async () => ({ ok: true as const }),
        setScope: async () => ({ ok: false as const, error: 'not under test' }),
      },
      workspaceTreeDispatch: async () => ({ ok: false, error: 'not under test' }),
    }),
  });
  return startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY, peerRpc });
}

describe('peer admin plane — gated oh.daemon.* over real sockets', () => {
  it('an operator peer administers the directory end-to-end; the probe answers admin without an audit row', async () => {
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');

    // The HELLO admission gate stamps its own row per connect, under
    // the distinct `daemon.admission` vocabulary — never `daemon.admin`
    // (report surfaces label it "admission", not enforcement).
    expect(audits.filter((a) => a.capability === 'daemon.admission' && a.decision.allow).length).toBe(1);
    const baseline = audits.filter((a) => a.capability === 'daemon.admin').length;
    expect(baseline).toBe(0);
    const probe = await callOverWire(operator, { type: 'oh.daemon.admin.status' });
    expect(probe.payload).toEqual({ admin: true });
    // The probe is a visibility question, not an enforcement decision.
    expect(audits.filter((a) => a.capability === 'daemon.admin').length).toBe(baseline);

    const created = await callOverWire(operator, { type: 'oh.daemon.users.create', displayName: 'Carol' });
    expect(created.payload?.ok).toBe(true);
    const listed = await callOverWire(operator, { type: 'oh.daemon.users.list' });
    const users = listed.payload?.users as Array<{ displayName: string; userId: string; mayCreateWorkspaces: boolean }>;
    expect(users.map((u) => u.displayName)).toContain('Carol');

    // The workspace.create grant toggles over the wire and round-trips
    // through the list projection (fresh directory users start without).
    const carol = users.find((u) => u.displayName === 'Carol');
    expect(carol?.mayCreateWorkspaces).toBe(false);
    const granted = await callOverWire(operator, {
      type: 'oh.daemon.users.setCreateWorkspaces',
      userId: carol?.userId,
      allowed: true,
    });
    expect(granted.payload).toEqual({ ok: true, updated: true });
    const relisted = await callOverWire(operator, { type: 'oh.daemon.users.list' });
    const relistedUsers = relisted.payload?.users as Array<{ displayName: string; mayCreateWorkspaces: boolean }>;
    expect(relistedUsers.find((u) => u.displayName === 'Carol')?.mayCreateWorkspaces).toBe(true);

    // Every enforcement decision is audited as the operator.
    const record = await ensureSyntheticIdentity({ hostKind: 'daemon' });
    const allows = audits.filter((a) => a.capability === 'daemon.admin' && a.decision.allow);
    expect(allows.length).toBe(baseline + 4);
    expect(new Set(allows.map((a) => a.actorUserId))).toEqual(new Set([record.user.id]));
  });

  it("a directory user's admin call is denied in-band with the uniform message, audited, and queryable; the probe answers false silently", async () => {
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const client = await connectAs(port, viewer, 'ext-bob');

    const baseline = audits.filter((a) => a.capability === 'daemon.admin').length;
    const probe = await callOverWire(client, { type: 'oh.daemon.admin.status' });
    expect(probe.payload).toEqual({ admin: false });
    // Probe deny is silent — a directory user's every connect would
    // otherwise bury real deny rows in noise.
    expect(audits.filter((a) => a.capability === 'daemon.admin').length).toBe(baseline);

    const denied = await callOverWire(client, { type: 'oh.daemon.users.list' });
    expect(denied.__error).toBe(ADMIN_DENIED_MESSAGE);
    expect(denied.payload).toBeUndefined();
    // Deny never tears the socket down.
    expect(client.readyState).toBe(WebSocket.OPEN);

    const deny = audits.find((a) => a.capability === 'daemon.admin' && !a.decision.allow);
    expect(deny?.actorUserId).toBe(viewer.user.id);
    expect(deny?.decision.reason).toBe('not-daemon-admin');
    // Slice-4 posture holds: the deny is a QUERYABLE audit row.
    const rows = queryAuditEntries(auditDb, { allow: false, capability: 'daemon.admin' });
    expect(rows.map((r) => r.actorUserId)).toContain(viewer.user.id);
  });

  it('telemetry consumer verbs ride the same daemon.admin gate — a directory user is denied, an operator reaches the inventory', async () => {
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');
    const viewerClient = await connectAs(port, viewer, 'ext-bob');

    // The telemetry attach path (tab inventory, Debug-mode arming) is
    // admin-plane surface: a non-admin authenticated peer must not be
    // able to enumerate or arm another browser's streams over the wire.
    const deniedTabs = await callOverWire(viewerClient, { type: 'oh.daemon.telemetry.tabs.list' });
    expect(deniedTabs.__error).toBe(ADMIN_DENIED_MESSAGE);
    expect(deniedTabs.payload).toBeUndefined();
    const deniedDebug = await callOverWire(viewerClient, {
      type: 'oh.daemon.telemetry.debug.control',
      nodeId: 'ext-bob',
      command: 'status',
    });
    expect(deniedDebug.__error).toBe(ADMIN_DENIED_MESSAGE);

    const allowed = await callOverWire(operator, { type: 'oh.daemon.telemetry.tabs.list' });
    expect(allowed.payload).toEqual({ peers: [] });
  });

  it('an operator deactivates a connected directory user over the wire — tokens revoked, live socket evicted', async () => {
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    const rig = await startServerWithAdminPlane(port);
    server = rig;
    const operator = await connectOperator(port, 'web-operator');
    const viewerClient = await connectAs(port, viewer, 'ext-bob');

    const closed = new Promise<void>((resolve) => {
      viewerClient.once('close', () => resolve());
    });
    const result = await callOverWire(operator, { type: 'oh.daemon.users.deactivate', userId: viewer.user.id });
    expect(result.payload?.ok).toBe(true);
    await closed;
    // The client-side close can land before the server's own close
    // bookkeeping runs — the count converges, it isn't ordered.
    await vi.waitFor(() => expect(rig.connectedCount()).toBe(1));
  });

  it('tokens.list projects the ledger to an operator — revoked rows kept, hash excluded; a directory user gets the uniform deny', async () => {
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');
    const viewerClient = await connectAs(port, viewer, 'ext-bob');

    // Mint-then-revoke over the wire so the projection carries a
    // revoked row beside the two live connection tokens.
    const minted = await callOverWire(operator, { type: 'oh.daemon.tokens.mint', label: 'retired device' });
    expect(minted.payload?.ok).toBe(true);
    const revoked = await callOverWire(operator, { type: 'oh.daemon.tokens.revoke', tokenId: minted.payload?.tokenId });
    expect(revoked.payload?.ok).toBe(true);

    const listed = await callOverWire(operator, { type: 'oh.daemon.tokens.list' });
    const rows = listed.payload?.tokens as Array<Record<string, unknown>>;
    expect(rows.map((r) => r.label)).toEqual(
      expect.arrayContaining(['operator device', 'Bob device', 'retired device']),
    );
    const retired = rows.find((r) => r.label === 'retired device');
    expect(retired?.revokedAt).not.toBeNull();
    const bobRow = rows.find((r) => r.label === 'Bob device');
    expect(bobRow?.userId).toBe(viewer.user.id);
    // The secret hash never crosses the projection.
    expect(rows.every((r) => !('tokenHash' in r))).toBe(true);
    // Kind crosses it: wire mints are operator apiTokens; a session
    // mint projects as session so surfaces can group without sniffing.
    expect(retired?.kind).toBe('apiToken');
    await mintDaemonAuthToken({ label: 'sso:bob@openheaders.io', userId: viewer.user.id, kind: 'session' });
    const relisted = await callOverWire(operator, { type: 'oh.daemon.tokens.list' });
    const relistedRows = relisted.payload?.tokens as Array<Record<string, unknown>>;
    expect(relistedRows.find((r) => r.label === 'sso:bob@openheaders.io')?.kind).toBe('session');

    const denied = await callOverWire(viewerClient, { type: 'oh.daemon.tokens.list' });
    expect(denied.__error).toBe(ADMIN_DENIED_MESSAGE);
    expect(denied.payload).toBeUndefined();
  });

  it('audit.query projects the log to an operator — filters, distinguishable admission rows, keyset pages; a directory user gets the uniform deny', async () => {
    const viewer = await addUserWithGrant('Bob', 'viewer');
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');
    const viewerClient = await connectAs(port, viewer, 'ext-bob');

    // Mint an enforcement deny row: the viewer touches an admin channel.
    const denied = await callOverWire(viewerClient, { type: 'oh.daemon.users.list' });
    expect(denied.__error).toBe(ADMIN_DENIED_MESSAGE);

    // Deny-filtered query, the way the console's Decision=Deny filter
    // reads it — the viewer's enforcement deny is a queryable row.
    const denyPage = await callOverWire(operator, {
      type: 'oh.daemon.audit.query',
      allow: false,
      capability: 'daemon.admin',
    });
    const denyRows = denyPage.payload?.entries as Array<{ actorUserId: string; decision: { reason?: string } }>;
    expect(denyRows.map((r) => r.actorUserId)).toContain(viewer.user.id);
    expect(denyRows.find((r) => r.actorUserId === viewer.user.id)?.decision.reason).toBe('not-daemon-admin');

    // The two connects each stamped a `daemon.admission` allow —
    // present and distinguishable from enforcement by capability alone.
    const admissionPage = await callOverWire(operator, {
      type: 'oh.daemon.audit.query',
      capability: 'daemon.admission',
    });
    const admissionRows = admissionPage.payload?.entries as Array<{
      id: string;
      actorUserId: string;
      capability: string;
      decision: { allow: boolean };
    }>;
    expect(admissionRows.length).toBe(2);
    expect(admissionRows.every((r) => r.decision.allow)).toBe(true);
    expect(admissionRows.map((r) => r.actorUserId)).toContain(viewer.user.id);

    // Actor filter parity with `ohd audit --actor`.
    const actorPage = await callOverWire(operator, {
      type: 'oh.daemon.audit.query',
      actorUserId: viewer.user.id,
    });
    const actorRows = actorPage.payload?.entries as Array<{ actorUserId: string }>;
    expect(actorRows.length).toBeGreaterThan(0);
    expect(actorRows.every((r) => r.actorUserId === viewer.user.id)).toBe(true);

    // Keyset pagination: limit=1 pages walk the full result set with no
    // loss and no repeats, then the cursor drains to null.
    const seen: string[] = [];
    let after: Record<string, unknown> | null = null;
    for (;;) {
      const page = await callOverWire(operator, {
        type: 'oh.daemon.audit.query',
        capability: 'daemon.admission',
        limit: 1,
        ...(after ? { after } : {}),
      });
      const entries = page.payload?.entries as Array<{ id: string }>;
      seen.push(...entries.map((e) => e.id));
      after = (page.payload?.nextCursor as Record<string, unknown> | null) ?? null;
      if (after === null) break;
    }
    expect(seen).toEqual(admissionRows.map((r) => r.id));
    expect(new Set(seen).size).toBe(seen.length);

    // A directory user's query gets the plane's uniform deny.
    const deniedQuery = await callOverWire(viewerClient, { type: 'oh.daemon.audit.query' });
    expect(deniedQuery.__error).toBe(ADMIN_DENIED_MESSAGE);
    expect(deniedQuery.payload).toBeUndefined();
  });

  it('an unowned oh.daemon.* channel stays silently ignored', async () => {
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');

    const got: string[] = [];
    operator.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (typeof msg.type === 'string' && msg.type.endsWith(':response')) got.push(msg.type);
    });
    operator.send(JSON.stringify({ type: 'oh.daemon.nonexistent' }));
    const probe = await callOverWire(operator, { type: 'oh.daemon.admin.status' });
    expect(probe.payload).toEqual({ admin: true });
    expect(got).toEqual(['oh.daemon.admin.status:response']);
  });
});

// ── Slice 3 — grant-time workspace offer to connected sockets ───────

describe('grant-time workspace offer — a zero-grant peer learns a granted workspace live', () => {
  afterEach(() => {
    setWorkspaceOrgResolver(null);
    disposeGlobal();
    resetWorkspaceStore();
  });

  it("an operator grant over the admin plane replays the workspace row to the granted user's open socket only", async () => {
    __initGlobalSyncServiceForTests({ log: new InMemoryMutationLog() });
    // The boot spine installs this in production; without it the
    // `__global__` envelopes stamp the pre-bootstrap sentinel org and
    // the delta stream's org filter drops them.
    setWorkspaceOrgResolver(() => daemonOrgId);
    await bootstrapWorkspaceStore();
    await bridgeExtensionWorkspaceSyncEngine();
    const team = await createWorkspace({ name: 'Team A', kind: 'team' });

    const alice = await addUserWithGrant('Alice', null);
    const mallory = await addUserWithGrant('Mallory', null);
    const port = await freePort();
    server = await startServerWithAdminPlane(port);
    const operator = await connectOperator(port, 'web-operator');
    const aliceClient = await connectAs(port, alice, 'ext-alice');
    const malloryClient = await connectAs(port, mallory, 'ext-mallory');

    const malloryGot: string[] = [];
    malloryClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_MUTATION_TYPE || msg.type === 'test.sentinel') malloryGot.push(msg.type);
    });
    const aliceRow = new Promise<MutationEnvelope>((resolve) => {
      aliceClient.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === SYNC_MUTATION_TYPE && msg.workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
          resolve(msg.envelope);
        }
      });
    });

    const granted = await callOverWire(operator, {
      type: 'oh.daemon.users.grant',
      userId: alice.user.id,
      workspaceId: team.id,
      role: 'viewer',
    });
    expect(granted.payload?.ok).toBe(true);

    expect(workspaceListRowIdForMutation(await aliceRow)).toBe(team.id);
    const malSentinel = new Promise<void>((resolve) => {
      malloryClient.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'test.sentinel') resolve();
      });
    });
    server.broadcastFrame({ type: 'test.sentinel' });
    await malSentinel;
    expect(malloryGot).toEqual(['test.sentinel']);
  });

  it('the offer re-judges the fresh snapshot: no grant, a deactivated user, or no connected peer ⇒ nothing rides', async () => {
    const globalLog = new InMemoryMutationLog();
    await globalLog.appendAll([makeGlobalRowEnvelope('m-row-a', 'ws-a', 1_000)]);
    __initGlobalSyncServiceForTests({ log: globalLog });

    const alice = await addUserWithGrant('Alice', null);
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const aliceClient = await connectAs(port, alice, 'ext-alice');
    const aliceGot: string[] = [];
    aliceClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === SYNC_MUTATION_TYPE || msg.type === 'test.sentinel') aliceGot.push(msg.type);
    });

    // Ungranted workspace — the fresh resolution refuses the row.
    expect(await offerWorkspaceRowsToUserPeers(alice.user.id, ['ws-a'], () => server)).toBe(0);
    // No connected peer for the user — early exit before any read.
    expect(await offerWorkspaceRowsToUserPeers('no-such-user', ['ws-a'], () => server)).toBe(0);
    // Granted but deactivated — the snapshot no longer resolves.
    await grantWorkspaceRole({ principalId: alice.principal.id, workspaceId: 'ws-a', role: 'viewer' });
    await deactivateDaemonUser(alice.user.id);
    expect(await offerWorkspaceRowsToUserPeers(alice.user.id, ['ws-a'], () => server)).toBe(0);

    const sentinel = new Promise<void>((resolve) => {
      aliceClient.on('message', (raw) => {
        if (JSON.parse(raw.toString()).type === 'test.sentinel') resolve();
      });
    });
    server.broadcastFrame({ type: 'test.sentinel' });
    await sentinel;
    expect(aliceGot).toEqual(['test.sentinel']);
  });
});
