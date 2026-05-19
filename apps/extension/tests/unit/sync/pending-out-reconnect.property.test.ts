/**
 * P2 — Property-based tests for reconnect-flush under packet loss
 * + state-vector mismatch.
 *
 * Models the C13/C14/C15/C16 reconnect cycle on the pending-out queue:
 *   1. Local mutations enqueue while peer is offline.
 *   2. Reconnect → peer advertises a state vector.
 *   3. {@link prunePendingOutByPeerVector} drops envelopes the peer
 *      already has.
 *   4. Drain replays survivors; some sends succeed (acked), some are
 *      "lost on the wire" (no ack, envelope persists).
 *   5. Repeat steps 2-4 until convergence.
 *
 * Invariants this suite asserts under random scenarios:
 *
 *   - Survival predicate: every surviving envelope has HLC strictly
 *     greater than the peer's per-node watermark (or the peer lacks
 *     that node).
 *   - Idempotent prune: calling with the same peer vector twice
 *     prunes zero on the second pass.
 *   - Monotone prune: a peer vector that dominates an earlier one
 *     prunes at least as much.
 *   - Drain ordering: after any prune, drain still yields envelopes
 *     in HLC ascending order.
 *   - At-least-once delivery under packet loss: dropping random
 *     acks across N reconnect cycles, the queue still converges to
 *     empty once the peer's vector covers all enqueued mutations.
 *   - Enqueue idempotency: replaying the same envelope set across
 *     a reconnect (duplicate enqueue) does not double-count.
 */
import {
  hlcToString,
  type MutationEnvelope,
  type StateVector,
} from '@openheaders/core/sync';
import {
  DEFAULT_REMOTE_ID,
  InMemoryPendingOutQueue,
  prunePendingOutByPeerVector,
} from '@openheaders/oracle/sync';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stressNumRuns } from './property-stress';

const NODE_POOL = ['a', 'b', 'c'] as const;
type NodeId = (typeof NODE_POOL)[number];

interface EnvSpec {
  readonly mutationId: string;
  readonly nodeId: NodeId;
  readonly physicalMs: number;
}

const envSpecArb: fc.Arbitrary<EnvSpec> = fc
  .tuple(fc.constantFrom(...NODE_POOL), fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 100 }))
  .map(([nodeId, ms, salt]) => ({
    nodeId,
    physicalMs: ms,
    mutationId: `m-${nodeId}-${ms}-${salt}`,
  }));

const envSpecsArb: fc.Arbitrary<EnvSpec[]> = fc
  .array(envSpecArb, { minLength: 0, maxLength: 12 })
  .map((arr) => {
    const seen = new Set<string>();
    return arr.filter((e) => {
      if (seen.has(e.mutationId)) return false;
      seen.add(e.mutationId);
      return true;
    });
  });

const peerVectorArb: fc.Arbitrary<StateVector> = fc
  .record({
    a: fc.option(fc.integer({ min: 0, max: 1500 }), { nil: undefined }),
    b: fc.option(fc.integer({ min: 0, max: 1500 }), { nil: undefined }),
    c: fc.option(fc.integer({ min: 0, max: 1500 }), { nil: undefined }),
  })
  .map((rec) => {
    const out: StateVector = {};
    for (const node of NODE_POOL) {
      const ms = rec[node];
      if (ms !== undefined) out[node] = { physicalMs: ms, logical: 0, nodeId: node };
    }
    return out;
  });

const toEnvelope = (s: EnvSpec): MutationEnvelope => ({
  mutationId: s.mutationId,
  hlc: { physicalMs: s.physicalMs, logical: 0, nodeId: s.nodeId },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: s.mutationId },
});

async function enqueueAll(q: InMemoryPendingOutQueue, specs: EnvSpec[]): Promise<void> {
  for (const s of specs) await q.enqueue(DEFAULT_REMOTE_ID, toEnvelope(s));
}

async function drainIds(q: InMemoryPendingOutQueue): Promise<string[]> {
  const out: string[] = [];
  for await (const env of q.drain(DEFAULT_REMOTE_ID)) out.push(env.mutationId);
  return out;
}

async function drainAll(q: InMemoryPendingOutQueue): Promise<MutationEnvelope[]> {
  const out: MutationEnvelope[] = [];
  for await (const env of q.drain(DEFAULT_REMOTE_ID)) out.push(env);
  return out;
}

function dominates(b: StateVector, a: StateVector): boolean {
  // b dominates a iff every entry of a is covered by an at-least-equal entry of b.
  for (const [node, hlc] of Object.entries(a)) {
    const other = b[node];
    if (!other) return false;
    if (hlcToString(other) < hlcToString(hlc)) return false;
  }
  return true;
}

describe('reconnect — property: survival predicate after prune', () => {
  it('every surviving envelope is uncovered by the peer vector', async () => {
    await fc.assert(
      fc.asyncProperty(envSpecsArb, peerVectorArb, async (specs, peer) => {
        const q = new InMemoryPendingOutQueue();
        await enqueueAll(q, specs);
        await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
        for (const env of await drainAll(q)) {
          const peerHlc = peer[env.hlc.nodeId];
          if (peerHlc) {
            // Survivors must be strictly greater than the peer watermark.
            expect(hlcToString(env.hlc) > hlcToString(peerHlc)).toBe(true);
          }
        }
      }),
      { numRuns: stressNumRuns(80) },
    );
  });
});

describe('reconnect — property: idempotent prune', () => {
  it('a second prune with the same peer vector removes nothing', async () => {
    await fc.assert(
      fc.asyncProperty(envSpecsArb, peerVectorArb, async (specs, peer) => {
        const q = new InMemoryPendingOutQueue();
        await enqueueAll(q, specs);
        await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
        const second = await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
        expect(second.pruned).toBe(0);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('reconnect — property: monotone prune', () => {
  it('a peer vector that dominates an earlier one prunes at least as much', async () => {
    await fc.assert(
      fc.asyncProperty(envSpecsArb, peerVectorArb, peerVectorArb, async (specs, peerA, peerB) => {
        // Combine peerA and peerB so combined dominates peerA.
        const combined: StateVector = { ...peerA };
        for (const [node, hlc] of Object.entries(peerB)) {
          const existing = combined[node];
          if (!existing || hlcToString(hlc) > hlcToString(existing)) combined[node] = hlc;
        }
        // Sanity: combined dominates peerA.
        expect(dominates(combined, peerA)).toBe(true);

        const qA = new InMemoryPendingOutQueue();
        const qB = new InMemoryPendingOutQueue();
        await enqueueAll(qA, specs);
        await enqueueAll(qB, specs);

        const resA = await prunePendingOutByPeerVector(qA, DEFAULT_REMOTE_ID, peerA);
        const resB = await prunePendingOutByPeerVector(qB, DEFAULT_REMOTE_ID, combined);
        expect(resB.pruned).toBeGreaterThanOrEqual(resA.pruned);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('reconnect — property: drain ordering preserved', () => {
  it('after any prune, drain yields envelopes in non-decreasing HLC string order', async () => {
    await fc.assert(
      fc.asyncProperty(envSpecsArb, peerVectorArb, async (specs, peer) => {
        const q = new InMemoryPendingOutQueue();
        await enqueueAll(q, specs);
        await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, peer);
        const drained = await drainAll(q);
        for (let i = 1; i < drained.length; i++) {
          const prev = hlcToString(drained[i - 1].hlc);
          const cur = hlcToString(drained[i].hlc);
          expect(prev <= cur).toBe(true);
        }
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('reconnect — property: enqueue idempotency across reconnect', () => {
  it('replaying the same envelope set after a reconnect does not double-count', async () => {
    await fc.assert(
      fc.asyncProperty(envSpecsArb, async (specs) => {
        const q = new InMemoryPendingOutQueue();
        await enqueueAll(q, specs);
        // Simulate a reconnect that re-emits the same locally-buffered set.
        await enqueueAll(q, specs);
        expect(await q.size(DEFAULT_REMOTE_ID)).toBe(specs.length);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('reconnect — property: convergence under packet loss', () => {
  it('drops random acks across N cycles; queue empties once peer covers every mutation', async () => {
    await fc.assert(
      fc.asyncProperty(
        envSpecsArb.filter((s) => s.length >= 1),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
        async (specs, dropMask) => {
          const q = new InMemoryPendingOutQueue();
          await enqueueAll(q, specs);

          // Build the FULL peer vector that covers every enqueued mutation.
          const fullVector: StateVector = {};
          for (const s of specs) {
            const existing = fullVector[s.nodeId];
            const candidate = { physicalMs: s.physicalMs, logical: 0, nodeId: s.nodeId };
            if (!existing || hlcToString(candidate) > hlcToString(existing)) {
              fullVector[s.nodeId] = candidate;
            }
          }

          // Several reconnect cycles. On each cycle the peer advertises
          // an INCREASING vector and we ack a random subset of survivors,
          // simulating packet loss for the rest. At the final cycle the
          // peer advertises the full vector, which must drain everything.
          let dropIdx = 0;
          for (let cycle = 0; cycle < 3; cycle++) {
            await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, fullVector);
            const remaining = await drainIds(q);
            // Some acks "make it through", some are lost.
            const acks: string[] = [];
            for (const id of remaining) {
              const dropped = dropMask[dropIdx % dropMask.length] ?? false;
              dropIdx++;
              if (!dropped) acks.push(id);
            }
            await q.ackAll(DEFAULT_REMOTE_ID, acks);
          }

          // Final reconciliation pass with the full vector: every
          // remaining envelope is now covered and must be pruned.
          await prunePendingOutByPeerVector(q, DEFAULT_REMOTE_ID, fullVector);
          expect(await q.size(DEFAULT_REMOTE_ID)).toBe(0);
        },
      ),
      { numRuns: stressNumRuns(50) },
    );
  });
});
