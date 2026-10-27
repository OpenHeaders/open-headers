/**
 * Phase C C14 — SQLite-backed pending-out queue.
 *
 * Exercises the same contract as the in-memory ref (`InMemoryPendingOutQueue`)
 * against an in-memory SQLite database. The schema-create helper is
 * idempotent, so we can call it on a fresh `:memory:` DB inline.
 */

import type { MutationEnvelope } from '@openheaders/core/sync';
import { SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import {
  ensurePendingOutQueueSchema,
  SqlitePendingOutQueue,
} from '@openheaders/oracle-host-node/sync/sqlite-pending-out-queue';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSqliteDatabase } from '../../src/sync/sqlite-database';

let db: Database.Database;
let q: SqlitePendingOutQueue;

const env = (id: string, ms: number, nodeId = 'n0', workspaceId = 'ws-1'): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId,
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: id },
});

const collect = async (it: AsyncIterable<MutationEnvelope>): Promise<MutationEnvelope[]> => {
  const out: MutationEnvelope[] = [];
  for await (const e of it) out.push(e);
  return out;
};

beforeEach(() => {
  db = openSqliteDatabase(':memory:');
  ensurePendingOutQueueSchema(db);
  q = new SqlitePendingOutQueue(db);
});

afterEach(() => {
  db.close();
});

describe('SqlitePendingOutQueue', () => {
  it('drain returns envelopes oldest-first by HLC', async () => {
    await q.enqueue('backend', env('m1', 1_000));
    await q.enqueue('backend', env('m3', 3_000));
    await q.enqueue('backend', env('m2', 2_000));
    const all = await collect(q.drain('backend'));
    expect(all.map((e) => e.mutationId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('enqueue is idempotent (unique index on remote_id+mutation_id)', async () => {
    await q.enqueue('backend', env('m1', 1_000));
    await q.enqueue('backend', env('m1', 1_000));
    expect(await q.size('backend')).toBe(1);
  });

  it('ack + ackAll remove individual + batched ids', async () => {
    await q.enqueue('backend', env('m1', 1_000));
    await q.enqueue('backend', env('m2', 2_000));
    await q.enqueue('backend', env('m3', 3_000));
    await q.ack('backend', 'm2');
    expect(await q.has('backend', 'm2')).toBe(false);
    await q.ackAll('backend', ['m1', 'missing']);
    expect((await collect(q.drain('backend'))).map((e) => e.mutationId)).toEqual(['m3']);
  });

  it('isolates per-remote queues', async () => {
    await q.enqueue('backend', env('m1', 1_000));
    await q.enqueue('daemon-lan', env('m2', 2_000));
    expect(await q.size('backend')).toBe(1);
    expect(await q.size('daemon-lan')).toBe(1);
    await q.ack('backend', 'm1');
    expect(await q.size('backend')).toBe(0);
    expect(await q.size('daemon-lan')).toBe(1);
  });

  it('drain across workspaces under one remote preserves HLC order', async () => {
    await q.enqueue('backend', env('m1', 1_000, 'n0', 'ws-a'));
    await q.enqueue('backend', env('m2', 500, 'n0', 'ws-b'));
    await q.enqueue('backend', env('m3', 2_000, 'n0', 'ws-a'));
    const ids = (await collect(q.drain('backend'))).map((e) => e.mutationId);
    expect(ids).toEqual(['m2', 'm1', 'm3']);
  });
});

describe('SqlitePendingOutQueue — a drain is a snapshot (the audit append reentrancy, plan §7)', () => {
  const seed = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) await q.enqueue('backend', env(`m${String(i).padStart(4, '0')}`, 1_000 + i));
  };

  it('a consumer that appends to the audit log on the same handle per row completes with every row audited', async () => {
    const audit = new SqliteAuditLog(db);
    await seed(300);
    const drained: string[] = [];
    for await (const e of q.drain('backend')) {
      await audit.append({
        orgId: e.orgId,
        actorUserId: 'user-local',
        capability: 'workspace.write',
        workspaceId: e.workspaceId,
        decision: { allow: true },
        occurredAt: '2026-10-27T09:00:00.000Z',
      });
      drained.push(e.mutationId);
    }
    expect(drained).toHaveLength(300);
    expect(drained).toEqual([...drained].sort());
    expect(await audit.list('org-test')).toHaveLength(300);
  });

  it('a consumer that acks each row as it goes completes and leaves the queue empty', async () => {
    await seed(50);
    let drained = 0;
    for await (const e of q.drain('backend')) {
      await q.ack('backend', e.mutationId);
      drained++;
    }
    expect(drained).toBe(50);
    expect(await q.size('backend')).toBe(0);
  });

  it('a consumer that re-routes each row to another remote per row completes', async () => {
    await seed(50);
    for await (const e of q.drain('backend')) {
      await q.enqueue('backend-other', e);
      await q.ack('backend', e.mutationId);
    }
    expect(await q.size('backend')).toBe(0);
    expect(await q.size('backend-other')).toBe(50);
  });

  it('rows enqueued during a drain surface on the next drain only', async () => {
    await seed(3);
    const first: string[] = [];
    for await (const e of q.drain('backend')) {
      first.push(e.mutationId);
      if (first.length === 1) await q.enqueue('backend', env('late', 10));
    }
    expect(first).toEqual(['m0000', 'm0001', 'm0002']);
    expect((await collect(q.drain('backend'))).map((e) => e.mutationId)).toEqual(['late', 'm0000', 'm0001', 'm0002']);
  });
});
