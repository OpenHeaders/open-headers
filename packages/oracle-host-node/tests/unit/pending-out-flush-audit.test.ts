/**
 * The audit append reentrancy (the workspace-list scope plan §7) — a
 * replayed join on one SQLite handle.
 *
 * The S0 join flushed 1,167 queued envelopes and logged `audit log
 * append failed` once per row: the SQLite drain yielded off an open
 * better-sqlite3 iterator, the flush ran the outbound gate per row, the
 * gate's authz layer emitted an audit entry, and the sink's `append`
 * ran its transaction on the same connection — refused while a
 * statement iterates. This rig drains a populated `SqlitePendingOutQueue`
 * through the real outbound plane's flush with the real
 * `SqliteAuditLog` sink installed on the same handle, in the exact
 * shape the boot spine installs it, and asserts zero failures, every
 * row sent in order and acked, and one audit row per flushed envelope.
 * A control leg drives the same flush through an open-iterator drain to
 * show the rig detects the hazard.
 */

import {
  clearIdentitySnapshot,
  ensureSyntheticIdentity,
  recordJoinedOrg,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { hostLogger, setHostLogger } from '@openheaders/core/logger';
import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import type { MutationEnvelope } from '@openheaders/core/sync';
import type { BackendConnection, Org } from '@openheaders/core/types';
import { createOutboundMutationPlane } from '@openheaders/oracle/sync/client/mutation-outbound-plane';
import { __resetOutboundGateForTests } from '@openheaders/oracle/sync/outbound-gate';
import type { PendingOutQueue } from '@openheaders/oracle/sync/pending-out-queue';
import { queryAuditEntries, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import {
  ensurePendingOutQueueSchema,
  SqlitePendingOutQueue,
} from '@openheaders/oracle-host-node/sync/sqlite-pending-out-queue';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';
import { createHostStorageFake } from './_host-storage-fake';

const NOW = '2026-10-27T09:00:00.000Z';
const BACKEND_ID = '01900000-0000-7000-8000-00000000feed';
const OTHER_BACKEND_ID = '01900000-0000-7000-8000-00000000beef';
const SERVER_ORG: Org = { id: 'org-server', name: 'OpenHeaders Server', hostKind: 'daemon', isPrivate: false };
const WS_ID = 'ws-server';
const ROWS = 600;

let db: Database.Database;
let queue: SqlitePendingOutQueue;
let auditFailures: unknown[] = [];
let warnings: string[] = [];

const backendRecord = (id: string): BackendConnection => ({
  id,
  label: '',
  url: 'ws://127.0.0.1:8137',
  authToken: '',
  autoConnect: true,
  enabled: true,
  addedAt: NOW,
  lastConnectedAt: null,
});

const envelope = (i: number): MutationEnvelope => ({
  mutationId: `m-${String(i).padStart(4, '0')}`,
  hlc: { physicalMs: 1_000 + i, logical: 0, nodeId: 'desktop-ctx' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: WS_ID,
  orgId: SERVER_ORG.id,
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: `r-${i}`, path: 'name', value: `seed ${i}` },
});

/** The boot spine's sink, verbatim in shape: append, then log a failure. */
function installSpineAuditSink(auditLog: SqliteAuditLog): void {
  setAuditSink((entry) => {
    void auditLog.append(entry).catch((err: unknown) => {
      auditFailures.push(err);
      hostLogger.warn('boot-spine', 'audit log append failed', err);
    });
  });
}

/** The pre-fix drain: rows yielded off the open iterator. Everything else delegates. */
function openIteratorDrain(real: SqlitePendingOutQueue): PendingOutQueue {
  const drainStmt = db.prepare(
    `SELECT envelope_json FROM pending_out_queue WHERE remote_id = ? ORDER BY hlc_key ASC, mutation_id ASC`,
  );
  return {
    enqueue: (remoteId, env) => real.enqueue(remoteId, env),
    async *drain(remoteId) {
      for (const row of drainStmt.iterate(remoteId) as IterableIterator<{ envelope_json: string }>) {
        yield JSON.parse(row.envelope_json) as MutationEnvelope;
      }
    },
    ack: (remoteId, mutationId) => real.ack(remoteId, mutationId),
    ackAll: (remoteId, mutationIds) => real.ackAll(remoteId, mutationIds),
    has: (remoteId, mutationId) => real.has(remoteId, mutationId),
    size: (remoteId) => real.size(remoteId),
  };
}

beforeEach(async () => {
  auditFailures = [];
  warnings = [];
  setHostLogger({
    error() {},
    warn(_scope, message) {
      warnings.push(String(message));
    },
    info() {},
    debug() {},
  });
  db = openSqliteDatabase(':memory:');
  ensurePendingOutQueueSchema(db);
  queue = new SqlitePendingOutQueue(db);
  // The desktop's identity with the server's Org consumed through a
  // backend record: the gate's tenancy layer passes the envelopes and
  // its authz layer judges — and audits — every one of them.
  clearIdentitySnapshot();
  setHostStorage(createHostStorageFake());
  await ensureSyntheticIdentity({ hostKind: 'desktop', now: NOW });
  await hostStorage.set(OH.backends, [backendRecord(BACKEND_ID), backendRecord(OTHER_BACKEND_ID)]);
  await recordJoinedOrg(SERVER_ORG, BACKEND_ID);
  await refreshIdentitySnapshotFromHostStorage();
  __resetOutboundGateForTests();
  for (let i = 0; i < ROWS; i++) await queue.enqueue(BACKEND_ID, envelope(i));
});

afterEach(() => {
  resetAuditSink();
  __resetOutboundGateForTests();
  clearIdentitySnapshot();
  db.close();
});

describe('a replayed join: the pending-out flush with the audit sink on the same handle', () => {
  it('flushes every queued row in HLC order, acks all, audits each, and never fails an append', async () => {
    const auditLog = new SqliteAuditLog(db);
    installSpineAuditSink(auditLog);
    const sent: string[] = [];
    const plane = createOutboundMutationPlane({
      resolveBackendId: () => BACKEND_ID,
      send: (_backendId, frame) => {
        sent.push((frame as { envelope: MutationEnvelope }).envelope.mutationId);
        return true;
      },
      isConnected: () => true,
    });
    plane.setPendingOutQueue(queue);

    await plane.flush(BACKEND_ID);

    expect(auditFailures).toEqual([]);
    expect(warnings.filter((w) => w.includes('audit log append failed'))).toEqual([]);
    expect(sent).toHaveLength(ROWS);
    expect(sent).toEqual([...sent].sort());
    expect(await queue.size(BACKEND_ID)).toBe(0);
    const audited = queryAuditEntries(db, { capability: 'workspace.write', workspaceId: WS_ID });
    expect(audited).toHaveLength(ROWS);
    expect(audited.every((row) => row.decision.allow)).toBe(true);
  });

  it('re-routes rows whose Org re-bound to another backend without failing the drain', async () => {
    const auditLog = new SqliteAuditLog(db);
    installSpineAuditSink(auditLog);
    const plane = createOutboundMutationPlane({
      resolveBackendId: () => OTHER_BACKEND_ID,
      send: () => true,
      isConnected: () => true,
    });
    plane.setPendingOutQueue(queue);

    await plane.flush(BACKEND_ID);

    expect(auditFailures).toEqual([]);
    expect(warnings.filter((w) => w.includes('flush failed'))).toEqual([]);
    expect(await queue.size(BACKEND_ID)).toBe(0);
    expect(await queue.size(OTHER_BACKEND_ID)).toBe(ROWS);
  });

  it('control: the same flush over an open-iterator drain fails every audit append (the S0 shape)', async () => {
    const auditLog = new SqliteAuditLog(db);
    installSpineAuditSink(auditLog);
    const plane = createOutboundMutationPlane({
      resolveBackendId: () => BACKEND_ID,
      send: () => true,
      isConnected: () => true,
    });
    plane.setPendingOutQueue(openIteratorDrain(queue));

    await plane.flush(BACKEND_ID);

    expect(auditFailures).toHaveLength(ROWS);
    expect(auditFailures.every((err) => String(err).includes('busy executing a query'))).toBe(true);
    expect(warnings.filter((w) => w.includes('audit log append failed'))).toHaveLength(ROWS);
    expect(queryAuditEntries(db, { capability: 'workspace.write' })).toHaveLength(0);
  });
});
