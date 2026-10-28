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
  SYNC_WELCOME_TYPE,
} from '@openheaders/core/protocol';
import { setHostStorage } from '@openheaders/core/storage';
import {
  type MutationBatch,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
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
import { __resetMutationStreamBridgeForTests, applyInboundMutationEnvelope } from '@openheaders/oracle/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import type { LockAcquirer } from '@openheaders/oracle/sync/oracle';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { singleProcessLockRuntime } from '../../src/daemon/single-process-lock-runtime';
import { type OracleWsServer, startOracleWsServer } from '../../src/host-runtime/ws-server';
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
let log: InMemoryMutationLog;
let lockEvents: Array<Omit<LogEntry, 'timestamp'>> = [];
let holdMs = HOLD_MS;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The production lock adapter's shape, slowed: real `withLock` over the daemon's FIFO runtime. */
const slowLock: LockAcquirer = (workspaceId, type, id, fn) =>
  withLock(
    entityLockName(workspaceId, type, id),
    async () => {
      await sleep(holdMs);
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
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  } as unknown as Rule;
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
  setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
});

beforeEach(async () => {
  server = null;
  clients.length = 0;
  lockEvents = [];
  holdMs = HOLD_MS;
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
