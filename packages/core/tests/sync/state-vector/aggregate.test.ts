import { describe, expect, it } from 'vitest';

import {
  advanceStateVector,
  diffStateVectors,
  foldStateVector,
  mergeStateVectors,
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

describe('foldStateVector', () => {
  it('returns the empty vector for an empty input', () => {
    expect(foldStateVector([])).toEqual({});
  });

  it('keeps the per-nodeId maximum across many envelopes', () => {
    const vec = foldStateVector([
      envAt('a', 100, 0),
      envAt('a', 100, 3),
      envAt('a', 50, 9),
      envAt('b', 200, 0),
      envAt('b', 200, 1),
    ]);
    expect(vec).toEqual({
      a: { physicalMs: 100, logical: 3, nodeId: 'a' },
      b: { physicalMs: 200, logical: 1, nodeId: 'b' },
    });
  });

  it('is order-independent', () => {
    const envelopes = [envAt('a', 100, 0), envAt('a', 100, 5), envAt('a', 200, 0), envAt('b', 50, 0)];
    const ascending = foldStateVector(envelopes);
    const descending = foldStateVector([...envelopes].reverse());
    expect(ascending).toEqual(descending);
  });
});

describe('advanceStateVector', () => {
  it('seeds a previously-unseen nodeId', () => {
    const next = advanceStateVector({}, envAt('a', 5, 0));
    expect(next).toEqual({ a: { physicalMs: 5, logical: 0, nodeId: 'a' } });
  });

  it('returns the same reference when the candidate is not higher', () => {
    const prev: StateVector = { a: { physicalMs: 100, logical: 2, nodeId: 'a' } };
    const same = advanceStateVector(prev, envAt('a', 100, 1));
    expect(same).toBe(prev);
  });

  it('replaces with a strictly higher HLC', () => {
    const prev: StateVector = { a: { physicalMs: 100, logical: 0, nodeId: 'a' } };
    const next = advanceStateVector(prev, envAt('a', 100, 5));
    expect(next).not.toBe(prev);
    expect(next.a).toEqual({ physicalMs: 100, logical: 5, nodeId: 'a' });
  });

  it('does not mutate the input', () => {
    const prev: StateVector = { a: { physicalMs: 1, logical: 0, nodeId: 'a' } };
    const frozen = JSON.parse(JSON.stringify(prev));
    advanceStateVector(prev, envAt('a', 100, 0));
    advanceStateVector(prev, envAt('b', 1, 0));
    expect(prev).toEqual(frozen);
  });
});

describe('mergeStateVectors', () => {
  it('takes the per-nodeId max of both sides', () => {
    const a: StateVector = {
      x: { physicalMs: 100, logical: 0, nodeId: 'x' },
      y: { physicalMs: 50, logical: 0, nodeId: 'y' },
    };
    const b: StateVector = {
      x: { physicalMs: 200, logical: 0, nodeId: 'x' },
      z: { physicalMs: 10, logical: 0, nodeId: 'z' },
    };
    expect(mergeStateVectors(a, b)).toEqual({
      x: { physicalMs: 200, logical: 0, nodeId: 'x' },
      y: { physicalMs: 50, logical: 0, nodeId: 'y' },
      z: { physicalMs: 10, logical: 0, nodeId: 'z' },
    });
  });

  it('is commutative', () => {
    const a: StateVector = { x: { physicalMs: 100, logical: 0, nodeId: 'x' } };
    const b: StateVector = { x: { physicalMs: 200, logical: 0, nodeId: 'x' } };
    expect(mergeStateVectors(a, b)).toEqual(mergeStateVectors(b, a));
  });
});

describe('diffStateVectors', () => {
  it('reports nodes peer is missing entirely', () => {
    const local: StateVector = {
      a: { physicalMs: 100, logical: 0, nodeId: 'a' },
      b: { physicalMs: 50, logical: 0, nodeId: 'b' },
    };
    const peer: StateVector = { a: { physicalMs: 100, logical: 0, nodeId: 'a' } };
    expect(diffStateVectors(local, peer)).toEqual([{ nodeId: 'b', sinceHlc: null }]);
  });

  it('reports nodes peer is behind on', () => {
    const local: StateVector = { a: { physicalMs: 100, logical: 5, nodeId: 'a' } };
    const peer: StateVector = { a: { physicalMs: 100, logical: 2, nodeId: 'a' } };
    expect(diffStateVectors(local, peer)).toEqual([
      { nodeId: 'a', sinceHlc: { physicalMs: 100, logical: 2, nodeId: 'a' } },
    ]);
  });

  it('returns an empty diff when peer is caught up or ahead', () => {
    const local: StateVector = { a: { physicalMs: 100, logical: 0, nodeId: 'a' } };
    const equal: StateVector = { a: { physicalMs: 100, logical: 0, nodeId: 'a' } };
    const ahead: StateVector = { a: { physicalMs: 200, logical: 0, nodeId: 'a' } };
    expect(diffStateVectors(local, equal)).toEqual([]);
    expect(diffStateVectors(local, ahead)).toEqual([]);
  });
});
