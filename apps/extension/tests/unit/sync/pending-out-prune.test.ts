/**
 * Phase C C16 — prune pending-out by peer state vector.
 */

import {
  DEFAULT_REMOTE_ID,
  InMemoryPendingOutQueue,
  prunePendingOutByPeerVector,
} from '@openheaders/oracle/sync';
import type { MutationEnvelope, StateVector } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';

const env = (id: string, ms: number, nodeId = 'n0'): MutationEnvelope => ({
  mutationId: id,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: id },
});

describe('prunePendingOutByPeerVector', () => {
  it('drops envelopes the peer already has (peer.hlc >= env.hlc per nodeId)', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-a-1', 1_000, 'a'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-a-2', 2_000, 'a'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-b-1', 500, 'b'));

    const peer: StateVector = {
      a: { physicalMs: 1_500, logical: 0, nodeId: 'a' },
      b: { physicalMs: 1_000, logical: 0, nodeId: 'b' },
    };

    const result = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
    expect(result.pruned).toBe(2);
    expect(result.survived).toBe(1);
    expect(await q.size(DEFAULT_REMOTE_ID)).toBe(1);
    expect(await q.has(DEFAULT_REMOTE_ID, 'm-a-2')).toBe(true);
  });

  it('keeps every envelope when peer is missing all writer nodes', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-1', 1_000, 'a'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-2', 2_000, 'b'));

    const result = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, {});
    expect(result.pruned).toBe(0);
    expect(result.survived).toBe(2);
  });

  it('drops every envelope when peer is fully caught up', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-1', 1_000, 'a'));
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-2', 2_000, 'a'));

    const peer: StateVector = { a: { physicalMs: 5_000, logical: 0, nodeId: 'a' } };
    const result = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
    expect(result.pruned).toBe(2);
    expect(await q.size(DEFAULT_REMOTE_ID)).toBe(0);
  });

  it('honors the strict-or-equal cutoff (peer.hlc == env.hlc → drop)', async () => {
    const q = new InMemoryPendingOutQueue();
    await q.enqueue(DEFAULT_REMOTE_ID, env('m-1', 1_000, 'a'));

    const peer: StateVector = { a: { physicalMs: 1_000, logical: 0, nodeId: 'a' } };
    const result = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
    expect(result.pruned).toBe(1);
    expect(result.survived).toBe(0);
  });

  it('no-op on an empty queue', async () => {
    const q = new InMemoryPendingOutQueue();
    const result = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, {
      a: { physicalMs: 1_000, logical: 0, nodeId: 'a' },
    });
    expect(result.pruned).toBe(0);
    expect(result.survived).toBe(0);
  });
});
