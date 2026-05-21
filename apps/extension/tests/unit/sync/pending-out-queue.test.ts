/**
 * Phase C C13 — pending-out queue contract.
 *
 * Same shape as `mutation-log.test.ts`: the in-memory impl pins the
 * append + drain-in-HLC-order + idempotent enqueue contract; the IDB
 * impl is exercised E2E (the repo deliberately avoids
 * fake-indexeddb).
 */

import { DEFAULT_REMOTE_ID, InMemoryPendingOutQueue } from '@openheaders/oracle/sync';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';

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

describe('InMemoryPendingOutQueue', () => {
  it('enqueue + drain returns envelopes oldest-first by HLC', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m3', 3_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m2', 2_000));
    const all = await collect(q.drain(DEFAULT_REMOTE_ID));
    expect(all.map((e) => e.mutationId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('enqueue is idempotent on duplicate mutationId', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000));
    expect(await q.size(DEFAULT_REMOTE_ID)).toBe(1);
  });

  it('ack removes one envelope; drain skips it', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m2', 2_000));
    await q.ack(DEFAULT_REMOTE_ID, 'm1');
    expect(await q.has(DEFAULT_REMOTE_ID, 'm1')).toBe(false);
    expect((await collect(q.drain(DEFAULT_REMOTE_ID))).map((e) => e.mutationId)).toEqual(['m2']);
  });

  it('ackAll removes a list in one call', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m2', 2_000));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m3', 3_000));
    await q.ackAll(DEFAULT_REMOTE_ID, ['m1', 'm3', 'missing']);
    expect(await q.size(DEFAULT_REMOTE_ID)).toBe(1);
    expect(await q.has(DEFAULT_REMOTE_ID, 'm2')).toBe(true);
  });

  it('isolates per-remote queues', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue('backend', env('m1', 1_000));
    await q.enqueue('daemon-lan', env('m2', 2_000));
    expect(await q.size('backend')).toBe(1);
    expect(await q.size('daemon-lan')).toBe(1);
    await q.ack('backend', 'm1');
    expect(await q.size('backend')).toBe(0);
    expect(await q.size('daemon-lan')).toBe(1);
  });

  it('drain is empty for an unseen remote', async () => {
    const q = new InMemoryPendingOutQueue();
    expect(await collect(q.drain('never'))).toEqual([]);
    expect(await q.size('never')).toBe(0);
  });

  it('drain across multiple workspaces under one remote preserves HLC order', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m1', 1_000, 'n0', 'ws-a'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m2', 500, 'n0', 'ws-b'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m3', 2_000, 'n0', 'ws-a'));
    const ids = (await collect(q.drain(DEFAULT_REMOTE_ID))).map((e) => e.mutationId);
    expect(ids).toEqual(['m2', 'm1', 'm3']);
  });
});
