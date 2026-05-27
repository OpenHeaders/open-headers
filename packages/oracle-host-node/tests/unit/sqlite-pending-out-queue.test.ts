/**
 * Phase C C14 — SQLite-backed pending-out queue.
 *
 * Exercises the same contract as the in-memory ref (`InMemoryPendingOutQueue`)
 * against an in-memory SQLite database. The schema-create helper is
 * idempotent, so we can call it on a fresh `:memory:` DB inline.
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  SqlitePendingOutQueue,
  ensurePendingOutQueueSchema,
} from '@openheaders/oracle-host-node/sync/sqlite-pending-out-queue';

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
  db = new Database(':memory:');
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
