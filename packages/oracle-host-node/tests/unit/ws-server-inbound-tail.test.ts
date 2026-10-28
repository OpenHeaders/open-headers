/**
 * The hub's per-socket inbound tail (the workspace-list scope audit
 * §2.3), over a real bound socket.
 *
 * The hub used to dispatch every socket frame in its own detached
 * async call, so one peer's reconnect flush raced every apply of one
 * entity onto one FIFO lock; past the lock's acquisition timeout each
 * late apply threw, the error reply had no consumer, and the client
 * had acked at send. The connection handler now chains a socket's
 * apply-family frames on one tail in arrival order.
 *
 * The rig swaps the service's lock for the real `withLock` over the
 * daemon's single-process FIFO runtime, holding each apply for a few
 * tens of milliseconds under a short acquisition timeout, so the
 * contention the audit describes is reproducible in under a second:
 *
 *   - the FIX leg sends a burst of writes on ONE entity down one
 *     socket and expects every one applied, answered in send order,
 *     with no timeout recorded;
 *   - the CONTROL leg fires the same burst straight into the inbound
 *     bridge concurrently — the detached dispatch's exact shape — and
 *     expects the timeouts the tail removes (the rig detects the
 *     hazard it guards);
 *   - the CLOSE leg proves a frame queued behind a slow apply is
 *     dropped when its socket closes, never dispatched without claims;
 *   - the PING leg proves the heartbeat stays off the tail.
 *
 * The SQLite legs (slice 14) put the real `SqliteMutationLog` behind
 * the service over a `:memory:` handle seeded past one read page. A
 * client's reconnect flush precedes its next scope's STATE_VECTOR on
 * the same socket, so the tailed applies interleave with the
 * responder's catch-up walk at microtask granularity on one handle;
 * the log's reads page by keyset and never hold a statement open across
 * a yield, so every apply lands. The CONTROL wraps the log's `readSince`
 * in the retired open-iterator shape and expects the "busy" throws; a
 * third leg lands the hub's own local apply mid-walk through the
 * production responder.
 */

import { createServer } from 'node:net';
import {
  clearIdentitySnapshot,
  createDaemonUser,
  ensureSyntheticIdentity,
  grantWorkspaceRole,
  mintDaemonAuthToken,
  refreshIdentitySnapshotFromHostStorage,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import {
  PROTOCOL_VERSION,
  SYNC_HELLO_TYPE,
  SYNC_MUTATION_BATCH_TYPE,
  SYNC_MUTATION_TYPE,
  SYNC_STATE_VECTOR_TYPE,
  SYNC_SYNCED_TYPE,
  SYNC_WELCOME_TYPE,
  type SyncMutationMessage,
  type SyncSnapshotMessage,
  type SyncStateVectorMessage,
  type SyncSyncedMessage,
} from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import {
  type MutationBatch,
  type MutationEnvelope,
  type MutatorContext,
  mintBatch,
  RULE_ENTITY_TYPE,
  type StateVector,
} from '@openheaders/core/sync';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { DaemonUserRecord, LogEntry, Rule } from '@openheaders/core/types';
import {
  entityLockName,
  LockTimeoutError,
  setLockObserver,
  setLockRuntime,
  withLock,
} from '@openheaders/oracle/coordination';
import {
  __resetMutationStreamBridgeForTests,
  applyInboundMutationEnvelope,
  respondToStateVector,
} from '@openheaders/oracle/sync';
import { InMemoryMutationLog, type MutationLog } from '@openheaders/oracle/sync/mutation-log';
import type { LockAcquirer } from '@openheaders/oracle/sync/oracle';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import {
  ensureMutationLogSchema,
  MUTATION_LOG_PAGE_SIZE,
  SqliteMutationLog,
} from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { singleProcessLockRuntime } from '../../src/daemon/single-process-lock-runtime';
import { type OracleWsServer, startOracleWsServer } from '../../src/host-runtime/ws-server';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';
import { createHostStorageFake } from './_host-storage-fake';

const IDENTITY = { role: 'desktop' as const, nodeId: 'host-node-1', agent: '@openheaders/desktop@test' };
const WS_ID = 'ws-tail';
const RULE_UID = 'aaaaaaaa';
const BURST = 40;
/** Each apply holds its entity lock this long — the queue the tail dissolves. */
const HOLD_MS = 20;
/** Short acquisition timeout so the control leg's queue overruns it within the burst. */
const LOCK_TIMEOUT_MS = 200;

let server: OracleWsServer | null = null;
const clients: WebSocket[] = [];
let daemonOrgId = '';
let log: MutationLog;
let lockEvents: Array<Omit<LogEntry, 'timestamp'>> = [];
let holdMs = HOLD_MS;
/** When set, an apply inside its lock waits for this before it runs — the SQLite legs' "mid-walk" signal. */
let holdUntil: Promise<void> | null = null;
let warnings: string[] = [];

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The production lock adapter's shape: real `withLock` over the daemon's
 * FIFO runtime. The contention legs slow it by `holdMs`; the SQLite legs
 * park it on `holdUntil` instead, so the apply reaches the handle in the
 * same microtask flow as the walk that resolves the signal.
 */
const slowLock: LockAcquirer = (workspaceId, type, id, fn) =>
  withLock(
    entityLockName(workspaceId, type, id),
    async () => {
      if (holdMs > 0) await sleep(holdMs);
      if (holdUntil) await holdUntil;
      return fn();
    },
    { timeoutMs: LOCK_TIMEOUT_MS, op: 'tail-rig' },
  );

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

async function addEditor(): Promise<DaemonUserRecord> {
  const created = await createDaemonUser({ displayName: 'Alice' });
  if (!created.ok) throw new Error('directory create failed');
  await grantWorkspaceRole({ principalId: created.record.principal.id, workspaceId: WS_ID, role: 'editor' });
  return created.record;
}

async function connectAs(port: number, record: DaemonUserRecord): Promise<WebSocket> {
  const bound = await mintDaemonAuthToken({ label: 'alice laptop', userId: record.user.id });
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
      nodeId: 'ext-node-1',
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
    conditions: [{ uid: 'cnd00001', type: 'url-filter', values: ['https://openheaders.io/*'] }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'override', value: '1' }],
      responseHeaders: [],
    },
  } as Rule;
}

function seedBatch(ms: number): MutationBatch {
  const ctx: MutatorContext = {
    workspaceId: WS_ID,
    orgId: daemonOrgId,
    hlc: { physicalMs: ms, logical: 0, nodeId: 'ext-node-1' },
    surfaceId: 's',
    deviceId: 'peer-device',
  };
  return seedRule(makeRule(RULE_UID), ctx);
}

/** The i-th rename of the one rule — one entity, one lock, forty frames. */
function rename(i: number): MutationEnvelope {
  return {
    mutationId: `m-${String(i).padStart(4, '0')}`,
    hlc: { physicalMs: 10_000 + i, logical: 0, nodeId: 'ext-node-1' },
    origin: { surfaceId: 's', deviceId: 'peer-device' },
    workspaceId: WS_ID,
    orgId: daemonOrgId,
    mutatorVersion: 1,
    body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: RULE_UID, path: 'name', value: `n-${i}` },
  };
}

function mutationFrame(envelope: MutationEnvelope): string {
  return JSON.stringify({ type: SYNC_MUTATION_TYPE, workspaceId: WS_ID, envelope });
}

/** Seed the rule through the socket and await its reply so the burst only renames. */
async function seedThroughSocket(client: WebSocket): Promise<void> {
  const responded = new Promise<void>((resolve) => {
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === `${SYNC_MUTATION_BATCH_TYPE}:response`) resolve();
    });
  });
  client.send(JSON.stringify({ type: SYNC_MUTATION_BATCH_TYPE, workspaceId: WS_ID, batch: seedBatch(1_000) }));
  await responded;
}

async function knownCount(ids: readonly string[]): Promise<number> {
  return (await log.knownMutationIds(ids)).size;
}

beforeAll(() => {
  setHostLogger({
    error() {},
    warn(_scope, message, ...rest) {
      warnings.push([message, ...rest.map((r) => (r instanceof Error ? r.message : String(r)))].join(' '));
    },
    info() {},
    debug() {},
  });
});

beforeEach(async () => {
  server = null;
  clients.length = 0;
  lockEvents = [];
  warnings = [];
  holdMs = HOLD_MS;
  holdUntil = null;
  setLockRuntime(singleProcessLockRuntime);
  setLockObserver((entry) => {
    lockEvents.push(entry);
  });
  setHostStorage(createHostStorageFake());
  const record = await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-10-28T00:00:00.000Z' });
  daemonOrgId = record.org.id;
  await refreshIdentitySnapshotFromHostStorage();
  log = new InMemoryMutationLog();
  __initSyncServiceForTests(WS_ID, { log, lock: slowLock });
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
  setLockObserver(null);
  setLockRuntime(null);
  clearIdentitySnapshot();
});

describe('the hub serializes a socket’s apply-family frames on one tail', () => {
  it('a burst of writes on one entity all apply, answered in send order, with no lock timeout', async () => {
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);
    await seedThroughSocket(client);

    const envelopes = Array.from({ length: BURST }, (_, i) => rename(i));
    const replies: Array<{ ok?: boolean; error?: string }> = [];
    const allAnswered = new Promise<void>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== `${SYNC_MUTATION_TYPE}:response`) return;
        replies.push(msg.__error !== undefined ? { error: String(msg.__error) } : { ok: msg.payload?.ok });
        if (replies.length === BURST) resolve();
      });
    });
    for (const env of envelopes) client.send(mutationFrame(env));
    await allAnswered;

    expect(replies.every((r) => r.ok === true)).toBe(true);
    expect(replies.some((r) => r.error !== undefined)).toBe(false);
    expect(lockEvents.filter((e) => e.op === 'lock/timeout')).toHaveLength(0);
    expect(await knownCount(envelopes.map((e) => e.mutationId))).toBe(BURST);
    const rule = getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, RULE_UID);
    expect(rule?.data).toMatchObject({ name: `n-${BURST - 1}` });
  });

  it('CONTROL: the same burst dispatched concurrently — the detached shape — overruns the lock timeout and loses writes', async () => {
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);
    await seedThroughSocket(client);

    const envelopes = Array.from({ length: BURST }, (_, i) => rename(i));
    const settled = await Promise.allSettled(envelopes.map((env) => applyInboundMutationEnvelope(env)));

    const timedOut = settled.filter((s) => s.status === 'rejected' && s.reason instanceof LockTimeoutError);
    expect(timedOut.length).toBeGreaterThan(0);
    expect(lockEvents.filter((e) => e.op === 'lock/timeout').length).toBe(timedOut.length);
    const applied = await knownCount(envelopes.map((e) => e.mutationId));
    expect(applied).toBe(BURST - timedOut.length);
    expect(applied).toBeLessThan(BURST);
  });

  it('a frame queued behind a slow apply is dropped when its socket closes, never dispatched without claims', async () => {
    holdMs = 150;
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);
    await seedThroughSocket(client);

    const envelopes = Array.from({ length: 5 }, (_, i) => rename(i));
    const disconnected = new Promise<void>((resolve) => {
      const unsubscribe = server?.subscribePeerChange((event) => {
        if (event.kind === 'disconnect') {
          unsubscribe?.();
          resolve();
        }
      });
    });
    for (const env of envelopes) client.send(mutationFrame(env));
    client.close();
    await disconnected;
    // The head of the tail is mid-apply at the close; let it and the
    // queued links run their course before reading the log.
    await sleep(holdMs * 6);

    expect(await knownCount([envelopes[0].mutationId])).toBe(1);
    expect(await knownCount(envelopes.slice(1).map((e) => e.mutationId))).toBe(0);
  });

  it('a ping sent mid-burst is answered before the tail drains — the heartbeat stays off the tail', async () => {
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);
    await seedThroughSocket(client);

    const order: string[] = [];
    const drained = new Promise<void>((resolve) => {
      client.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'pong') order.push('pong');
        if (msg.type === `${SYNC_MUTATION_TYPE}:response`) {
          order.push('reply');
          if (order.filter((o) => o === 'reply').length === BURST) resolve();
        }
      });
    });
    for (let i = 0; i < BURST; i++) client.send(mutationFrame(rename(i)));
    client.send(JSON.stringify({ type: 'ping', t: 1 }));
    await drained;

    expect(order.indexOf('pong')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('pong')).toBeLessThan(order.lastIndexOf('reply'));
  });
});

// ── The SQLite legs (slice 14) ──────────────────────────────────────

/** The seed node's rows: past one page, so every catch-up walk crosses a page boundary. */
const SEED_ROWS = MUTATION_LOG_PAGE_SIZE + 300;
const SEED_NODE = 'seed-node';
const FLUSH = 10;

/** The i-th seeded rename under the seed node, in the far past of the burst. */
function seeded(i: number): MutationEnvelope {
  return {
    mutationId: `seed-${String(i).padStart(4, '0')}`,
    hlc: { physicalMs: 2_000 + i, logical: 0, nodeId: SEED_NODE },
    origin: { surfaceId: 's', deviceId: 'seed-device' },
    workspaceId: WS_ID,
    orgId: daemonOrgId,
    mutatorVersion: 1,
    body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: RULE_UID, path: 'name', value: `seed-${i}` },
  };
}

/**
 * The reconnecting client's vector: its own node covered through the
 * burst, the seed node unknown — so the hub answers with the seed's
 * delta (under the snapshot ceiling, over one page) and never streams
 * the burst back.
 */
const peerVector = (): StateVector => ({ 'ext-node-1': { physicalMs: 20_000, logical: 0, nodeId: 'ext-node-1' } });

function stateVectorFrame(): SyncStateVectorMessage {
  return { type: SYNC_STATE_VECTOR_TYPE, workspaceId: WS_ID, perNodeMaxHlc: peerVector() };
}

/**
 * The service's log for a SQLite leg: `readSince` is the read under
 * test, and the first row of the first walk resolves the signal the
 * parked applies wait on, so they reach the handle while the walk is
 * open. Everything else delegates to the real log.
 */
function walkSignallingLog(
  real: SqliteMutationLog,
  readSince: (since: string | null) => AsyncIterable<MutationEnvelope>,
  signal: () => void,
): MutationLog {
  let signalled = false;
  return {
    append: (env) => real.append(env),
    appendAll: (envs) => real.appendAll(envs),
    async *readSince(since) {
      for await (const env of readSince(since)) {
        if (!signalled) {
          signalled = true;
          signal();
        }
        yield env;
      }
    },
    readAll: () => real.readAll(),
    hasMutation: (id) => real.hasMutation(id),
    knownMutationIds: (ids) => real.knownMutationIds(ids),
    truncateBefore: (key) => real.truncateBefore(key),
    purgeOrg: (orgId) => real.purgeOrg(orgId),
  };
}

/** The retired read: rows yielded off an open statement iterator — the shape slice 14 removed. */
function openIteratorRead(db: Database.Database): (since: string | null) => AsyncIterable<MutationEnvelope> {
  const stmt = db.prepare(
    `SELECT envelope_json FROM mutation_log WHERE scope = ? AND branch IN ('', ?) ORDER BY hlc_key ASC, mutation_id ASC`,
  );
  return async function* () {
    for (const row of stmt.iterate(WS_ID, '') as IterableIterator<{ envelope_json: string }>) {
      yield JSON.parse(row.envelope_json) as MutationEnvelope;
    }
  };
}

interface FlushOutcome {
  replies: Array<{ ok?: boolean; error?: string }>;
  streamed: string[];
  synced: SyncSyncedMessage;
}

/**
 * The client's exact reconnect order on one socket: the flush's apply
 * frames, then the scope's STATE_VECTOR. Resolves once every apply is
 * answered and SYNCED is on the wire.
 */
async function flushThenCatchUp(client: WebSocket, burst: MutationEnvelope[]): Promise<FlushOutcome> {
  const replies: FlushOutcome['replies'] = [];
  const streamed: string[] = [];
  let synced: SyncSyncedMessage | null = null;
  const done = new Promise<void>((resolve) => {
    const settle = () => {
      if (synced !== null && replies.length === burst.length) resolve();
    };
    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === `${SYNC_MUTATION_TYPE}:response`) {
        replies.push(msg.__error !== undefined ? { error: String(msg.__error) } : { ok: msg.payload?.ok });
        settle();
      } else if (msg.type === SYNC_MUTATION_TYPE) {
        streamed.push((msg as SyncMutationMessage).envelope.mutationId);
      } else if (msg.type === SYNC_SYNCED_TYPE) {
        synced = msg as SyncSyncedMessage;
        settle();
      }
    });
  });
  for (const env of burst) client.send(mutationFrame(env));
  client.send(JSON.stringify(stateVectorFrame()));
  await done;
  if (synced === null) throw new Error('SYNCED never arrived');
  return { replies, streamed, synced };
}

describe('the hub’s catch-up walk tolerates a tailed flush on the same SQLite handle', () => {
  let db: Database.Database;
  let sqliteLog: SqliteMutationLog;

  /** Boot the service on the SQLite log, with applies parked until the walk's first row. */
  function bootWithRead(readSince: (since: string | null) => AsyncIterable<MutationEnvelope>): void {
    let release: () => void = () => {};
    holdUntil = new Promise<void>((resolve) => {
      release = resolve;
    });
    log = walkSignallingLog(sqliteLog, readSince, () => release());
    __initSyncServiceForTests(WS_ID, { log, lock: slowLock });
    __resetMutationStreamBridgeForTests();
  }

  beforeEach(async () => {
    holdMs = 0;
    db = openSqliteDatabase(':memory:');
    ensureMutationLogSchema(db);
    sqliteLog = new SqliteMutationLog(db, WS_ID);
    await sqliteLog.appendAll(seedBatch(1_000).mutations);
    await sqliteLog.appendAll(Array.from({ length: SEED_ROWS }, (_, i) => seeded(i)));
    bootWithRead((since) => sqliteLog.readSince(since));
  });

  afterEach(() => {
    disposeSyncService();
    db.close();
  });

  it('a flush followed by the scope’s STATE_VECTOR on one socket: every apply lands, the walk streams whole, zero warnings', async () => {
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);

    const burst = Array.from({ length: FLUSH }, (_, i) => rename(i));
    const outcome = await flushThenCatchUp(client, burst);

    expect(outcome.replies).toHaveLength(FLUSH);
    expect(outcome.replies.every((r) => r.ok === true)).toBe(true);
    expect(await knownCount(burst.map((e) => e.mutationId))).toBe(FLUSH);
    expect(outcome.streamed).toEqual(Array.from({ length: SEED_ROWS }, (_, i) => seeded(i).mutationId));
    expect(outcome.synced.stateVectorAfter['ext-node-1']?.physicalMs).toBe(10_000 + FLUSH - 1);
    expect(outcome.synced.stateVectorAfter[SEED_NODE]?.physicalMs).toBe(2_000 + SEED_ROWS - 1);
    expect(warnings).toEqual([]);
    const rule = getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, RULE_UID);
    expect(rule?.data).toMatchObject({ name: `n-${FLUSH - 1}` });
  });

  it('CONTROL: the same socket order over the retired open-iterator read loses applies to the busy connection', async () => {
    bootWithRead(openIteratorRead(db));
    const editor = await addEditor();
    const port = await freePort();
    server = await startOracleWsServer({ host: '127.0.0.1', port, handshakeIdentity: IDENTITY });
    const client = await connectAs(port, editor);

    const burst = Array.from({ length: FLUSH }, (_, i) => rename(i));
    const outcome = await flushThenCatchUp(client, burst);

    const refused = outcome.replies.filter((r) => r.error !== undefined && /busy executing a query/.test(r.error));
    expect(refused.length).toBeGreaterThan(0);
    expect(warnings.filter((w) => /busy executing a query/.test(w)).length).toBe(refused.length);
    expect(await knownCount(burst.map((e) => e.mutationId))).toBe(FLUSH - refused.length);
  });

  it('the hub’s own local apply landing mid-walk commits, through the production responder', async () => {
    holdUntil = null;
    const frames: Array<SyncSnapshotMessage | SyncMutationMessage | SyncSyncedMessage> = [];
    const local: { apply: Promise<{ ok: boolean }> | null; mutationId: string } = { apply: null, mutationId: '' };
    const reply = {
      send(frame: SyncSnapshotMessage | SyncMutationMessage | SyncSyncedMessage): boolean {
        frames.push(frame);
        if (frame.type === SYNC_MUTATION_TYPE && local.apply === null) {
          const ctx: MutatorContext = {
            workspaceId: WS_ID,
            orgId: daemonOrgId,
            hlc: { physicalMs: 30_000, logical: 0, nodeId: IDENTITY.nodeId },
            surfaceId: 'hub',
            deviceId: 'hub-device',
          };
          const batch = mintBatch(ctx, [
            { kind: 'setField', type: RULE_ENTITY_TYPE, id: RULE_UID, path: 'name', value: 'local-mid-walk' },
          ]);
          local.mutationId = batch.mutations[0].mutationId;
          local.apply = applySyncRequest({ type: 'oh.sync.apply', batch }) as Promise<{ ok: boolean }>;
        }
        return true;
      },
    };

    const result = await respondToStateVector(stateVectorFrame(), reply);
    if (local.apply === null) throw new Error('the walk streamed nothing');
    const ack = await local.apply;

    expect(ack.ok).toBe(true);
    expect(result.sentSnapshot).toBe(false);
    // The hub's row landed above the walk's cursor, so a later page
    // streamed it: the seed whole, then the local write.
    expect(result.deltasSent).toBe(SEED_ROWS + 1);
    const streamed = frames.filter((f): f is SyncMutationMessage => f.type === SYNC_MUTATION_TYPE);
    expect(streamed[streamed.length - 1]?.envelope.mutationId).toBe(local.mutationId);
    expect(result.syncedSent).toBe(true);
    expect(result.stateVectorAfter[IDENTITY.nodeId]?.physicalMs).toBe(30_000);
    expect(warnings).toEqual([]);
    const rule = getOracleForCurrentWorkspace()?.materializeOne(RULE_ENTITY_TYPE, RULE_UID);
    expect(rule?.data).toMatchObject({ name: 'local-mid-walk' });
  });
});
