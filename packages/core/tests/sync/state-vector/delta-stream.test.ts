import { describe, expect, it } from 'vitest';

import {
  filterEnvelopesAgainstPeer,
  filterEnvelopesAgainstPeerAsync,
  type MutationEnvelope,
  type StateVector,
} from '../../../src/sync';

function envAt(nodeId: string, physicalMs: number, logical = 0): MutationEnvelope {
  return {
    mutationId: `m-${nodeId}-${physicalMs}-${logical}`,
    hlc: { physicalMs, logical, nodeId },
    origin: { surfaceId: 's', deviceId: 'd' },
    workspaceId: 'w',
    mutatorVersion: 1,
    body: { kind: 'delete', type: 'rule', id: 'r' },
  };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

async function* asAsync<T>(items: Iterable<T>): AsyncGenerator<T> {
  for (const x of items) yield x;
}

const log: MutationEnvelope[] = [
  envAt('a', 100, 0),
  envAt('a', 100, 5),
  envAt('a', 200, 0),
  envAt('b', 50, 0),
  envAt('b', 75, 0),
  envAt('c', 999, 0),
];

describe('filterEnvelopesAgainstPeer', () => {
  it('yields everything when peer is the empty vector', () => {
    const out = [...filterEnvelopesAgainstPeer(log, {})];
    expect(out.map((e) => e.mutationId)).toEqual(log.map((e) => e.mutationId));
  });

  it('yields nothing when peer is fully caught up', () => {
    const peer: StateVector = {
      a: { physicalMs: 200, logical: 0, nodeId: 'a' },
      b: { physicalMs: 75, logical: 0, nodeId: 'b' },
      c: { physicalMs: 999, logical: 0, nodeId: 'c' },
    };
    expect([...filterEnvelopesAgainstPeer(log, peer)]).toEqual([]);
  });

  it('yields the strict suffix on a behind-on-one-node peer', () => {
    const peer: StateVector = {
      a: { physicalMs: 100, logical: 5, nodeId: 'a' },
      b: { physicalMs: 75, logical: 0, nodeId: 'b' },
      c: { physicalMs: 999, logical: 0, nodeId: 'c' },
    };
    const out = [...filterEnvelopesAgainstPeer(log, peer)];
    expect(out.map((e) => e.mutationId)).toEqual(['m-a-200-0']);
  });

  it('yields all envelopes for a node missing from peer', () => {
    const peer: StateVector = {
      a: { physicalMs: 999, logical: 0, nodeId: 'a' },
      b: { physicalMs: 999, logical: 0, nodeId: 'b' },
    };
    const out = [...filterEnvelopesAgainstPeer(log, peer)];
    expect(out.map((e) => e.mutationId)).toEqual(['m-c-999-0']);
  });

  it('does not yield envelopes at the exact peer HLC (strict >)', () => {
    const peer: StateVector = {
      a: { physicalMs: 200, logical: 0, nodeId: 'a' },
      b: { physicalMs: 75, logical: 0, nodeId: 'b' },
      c: { physicalMs: 999, logical: 0, nodeId: 'c' },
    };
    expect([...filterEnvelopesAgainstPeer(log, peer)]).toEqual([]);
  });
});

describe('filterEnvelopesAgainstPeerAsync', () => {
  it('streams the same result as the sync flavor', async () => {
    const peer: StateVector = { a: { physicalMs: 100, logical: 5, nodeId: 'a' } };
    const sync = [...filterEnvelopesAgainstPeer(log, peer)].map((e) => e.mutationId);
    const async_ = (await collect(filterEnvelopesAgainstPeerAsync(asAsync(log), peer))).map((e) => e.mutationId);
    expect(async_).toEqual(sync);
  });
});
