/**
 * P1 — Property-based tests for the state-vector handshake responder.
 *
 * Generates randomized catch-up scenarios (varied local history across
 * multiple nodes, random peer state-vectors, mid-stream cutoffs) and
 * asserts invariants the fixed-scenario suite cannot reach by
 * enumeration:
 *
 *   - Frame accounting: total frames === (sentSnapshot ? 1 : 0)
 *     + deltasSent + (syncedSent ? 1 : 0)
 *   - Snapshot-first ordering: when a snapshot is sent, it is the
 *     first frame on the wire
 *   - SYNCED-tail invariant: an uncapped reply terminates with SYNCED
 *   - Cutoff respect: when the reply caps at N, exactly N frames land
 *     and syncedSent is reported truthfully
 *   - Caught-up peer: a peerVector that dominates local history yields
 *     zero deltas and no snapshot
 *   - Cold peer (empty vector) with local history forces snapshot path
 *   - Reconnect idempotency: re-running the responder with the same
 *     peerVector produces an identical frame-type sequence (the
 *     property a packet-loss reconnect relies on)
 *   - State-vector dominance: result.stateVectorAfter dominates the
 *     peer's vector componentwise for every node the local log has
 *     seen
 */
import { compareHlc, type MutatorContext, type StateVector } from '@openheaders/core/sync';
import {
  SYNC_MUTATION_TYPE,
  SYNC_SNAPSHOT_TYPE,
  SYNC_SYNCED_TYPE,
  type SyncMutationMessage,
  type SyncSnapshotMessage,
  type SyncSyncedMessage,
} from '@openheaders/core/protocol';
import { seedRule } from '@openheaders/core/sync-builders/rule-projection';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { respondToStateVector } from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  applySyncRequest,
  dispose as disposeSyncService,
} from '@openheaders/oracle/sync/service';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const wsId = 'ws-prop';
const NODE_POOL = ['sw', 'desktop', 'peer-a'] as const;
type NodeId = (typeof NODE_POOL)[number];

type AnyFrame = SyncSnapshotMessage | SyncMutationMessage | SyncSyncedMessage;

interface Mutation {
  readonly nodeId: NodeId;
  readonly physicalMs: number;
}

const mutationArb: fc.Arbitrary<Mutation> = fc.record({
  nodeId: fc.constantFrom(...NODE_POOL),
  physicalMs: fc.integer({ min: 1, max: 1_000_000 }),
});

const mutationsArb: fc.Arbitrary<Mutation[]> = fc.array(mutationArb, { minLength: 0, maxLength: 8 });

const ctx = (m: Mutation): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: m.physicalMs, logical: 0, nodeId: m.nodeId },
  surfaceId: 's',
  deviceId: 'd0',
});

const makeRule = (name: string): Rule =>
  ({
    schemaVersion: 5,
    uid: generateUid(),
    path: `rules/x/${name}`,
    type: 'header',
    name,
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

function makeReply(closeAfter: number | null) {
  const frames: AnyFrame[] = [];
  const limit = closeAfter ?? Number.POSITIVE_INFINITY;
  return {
    reply: {
      send: (frame: AnyFrame) => {
        if (frames.length >= limit) return false;
        frames.push(frame);
        return true;
      },
    },
    frames,
  };
}

async function seedMutations(mutations: Mutation[]): Promise<void> {
  for (const m of mutations) {
    const batch = seedRule(makeRule(`r-${m.nodeId}-${m.physicalMs}`), ctx(m));
    await applySyncRequest({ type: 'oh.sync.apply', batch, sideEffects: [] });
  }
}

function frameTypes(frames: AnyFrame[]): string[] {
  return frames.map((f) => f.type);
}

function dominatesAll(after: StateVector, peer: StateVector): boolean {
  for (const [nodeId, hlc] of Object.entries(peer)) {
    const a = after[nodeId];
    if (!a) return false;
    if (compareHlc(a, hlc) < 0) return false;
  }
  return true;
}

beforeEach(() => {
  __initSyncServiceForTests(wsId);
});

afterEach(() => {
  disposeSyncService();
});

describe('respondToStateVector — property: frame accounting + ordering', () => {
  it('total frames decompose into snapshot + deltas + synced', async () => {
    await fc.assert(
      fc.asyncProperty(mutationsArb, async (mutations) => {
        disposeSyncService();
        __initSyncServiceForTests(wsId);
        await seedMutations(mutations);

        const { reply, frames } = makeReply(null);
        const result = await respondToStateVector(
          { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: {} },
          reply,
        );

        const expected = (result.sentSnapshot ? 1 : 0) + result.deltasSent + (result.syncedSent ? 1 : 0);
        expect(frames.length).toBe(expected);

        if (result.sentSnapshot) {
          expect(frames[0]?.type).toBe(SYNC_SNAPSHOT_TYPE);
        }
        if (result.syncedSent) {
          expect(frames[frames.length - 1]?.type).toBe(SYNC_SYNCED_TYPE);
        }
        const mutationFrames = frames.filter((f) => f.type === SYNC_MUTATION_TYPE);
        expect(mutationFrames.length).toBe(result.deltasSent);
      }),
      { numRuns: 60 },
    );
  });
});

describe('respondToStateVector — property: cutoff respected', () => {
  it('with closeAfter=N caps frames at N and reports syncedSent honestly', async () => {
    await fc.assert(
      fc.asyncProperty(
        mutationsArb.filter((m) => m.length >= 1),
        fc.integer({ min: 0, max: 10 }),
        async (mutations, cutoff) => {
          disposeSyncService();
          __initSyncServiceForTests(wsId);
          await seedMutations(mutations);

          const { reply, frames } = makeReply(cutoff);
          const result = await respondToStateVector(
            { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: {} },
            reply,
            { thresholds: { maxDeltaCount: 100, maxDeltaBytes: null } },
          );

          expect(frames.length).toBeLessThanOrEqual(cutoff);
          if (result.syncedSent) {
            expect(frames[frames.length - 1]?.type).toBe(SYNC_SYNCED_TYPE);
          } else {
            // No SYNCED frame should appear when syncedSent=false.
            expect(frameTypes(frames)).not.toContain(SYNC_SYNCED_TYPE);
          }
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('respondToStateVector — property: caught-up peer', () => {
  it('a peer vector that dominates local history yields only SYNCED', async () => {
    await fc.assert(
      fc.asyncProperty(mutationsArb, async (mutations) => {
        disposeSyncService();
        __initSyncServiceForTests(wsId);
        await seedMutations(mutations);

        // Build a peer vector that dominates every local node entry.
        const peerVector: StateVector = {};
        for (const node of NODE_POOL) {
          peerVector[node] = { physicalMs: 9_999_999, logical: 999, nodeId: node };
        }

        const { reply, frames } = makeReply(null);
        const result = await respondToStateVector(
          { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
          reply,
        );

        expect(result.sentSnapshot).toBe(false);
        expect(result.deltasSent).toBe(0);
        expect(result.syncedSent).toBe(true);
        expect(frames).toHaveLength(1);
        expect(frames[0]?.type).toBe(SYNC_SYNCED_TYPE);
      }),
      { numRuns: 40 },
    );
  });
});

describe('respondToStateVector — property: cold peer forces snapshot', () => {
  it('empty peer vector with non-empty local history sends a snapshot first', async () => {
    await fc.assert(
      fc.asyncProperty(
        mutationsArb.filter((m) => m.length >= 1),
        async (mutations) => {
          disposeSyncService();
          __initSyncServiceForTests(wsId);
          await seedMutations(mutations);

          const { reply, frames } = makeReply(null);
          const result = await respondToStateVector(
            { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: {} },
            reply,
          );

          expect(result.sentSnapshot).toBe(true);
          expect(frames[0]?.type).toBe(SYNC_SNAPSHOT_TYPE);
          expect(result.syncedSent).toBe(true);
          expect(frames[frames.length - 1]?.type).toBe(SYNC_SYNCED_TYPE);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('respondToStateVector — property: reconnect idempotency', () => {
  it('two consecutive responses with the same peer vector produce the same frame sequence', async () => {
    await fc.assert(
      fc.asyncProperty(mutationsArb, async (mutations) => {
        disposeSyncService();
        __initSyncServiceForTests(wsId);
        await seedMutations(mutations);

        const peerVector: StateVector = {
          'other-node': { physicalMs: 1, logical: 0, nodeId: 'other-node' },
        };

        const a = makeReply(null);
        const r1 = await respondToStateVector(
          { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
          a.reply,
          { thresholds: { maxDeltaCount: 100, maxDeltaBytes: null } },
        );

        const b = makeReply(null);
        const r2 = await respondToStateVector(
          { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
          b.reply,
          { thresholds: { maxDeltaCount: 100, maxDeltaBytes: null } },
        );

        expect(r2.sentSnapshot).toBe(r1.sentSnapshot);
        expect(r2.deltasSent).toBe(r1.deltasSent);
        expect(r2.syncedSent).toBe(r1.syncedSent);
        expect(frameTypes(b.frames)).toEqual(frameTypes(a.frames));
      }),
      { numRuns: 40 },
    );
  });
});

describe('respondToStateVector — property: state-vector dominance', () => {
  it('stateVectorAfter dominates the peer vector for every advertised node', async () => {
    await fc.assert(
      fc.asyncProperty(mutationsArb, async (mutations) => {
        disposeSyncService();
        __initSyncServiceForTests(wsId);
        await seedMutations(mutations);

        // Build a partial peer vector: pick a random subset of pool
        // nodes with random low HLC values so locally-seeded nodes
        // dominate.
        const peerVector: StateVector = {};
        for (const node of NODE_POOL) {
          if (Math.random() < 0.5) {
            peerVector[node] = { physicalMs: 1, logical: 0, nodeId: node };
          }
        }

        const { reply } = makeReply(null);
        const result = await respondToStateVector(
          { type: 'oh.sync.stateVector', workspaceId: wsId, perNodeMaxHlc: peerVector },
          reply,
        );

        // Every node the peer advertised that the local log has also
        // seen MUST be dominated by stateVectorAfter. For peer-only
        // nodes (unknown to local), the after-vector simply omits
        // them — that's outside the responder's contract.
        const seenLocally = new Set(mutations.map((m) => m.nodeId));
        const restricted: StateVector = {};
        for (const [k, v] of Object.entries(peerVector)) {
          if (seenLocally.has(k as NodeId)) restricted[k] = v;
        }
        expect(dominatesAll(result.stateVectorAfter, restricted)).toBe(true);
      }),
      { numRuns: 40 },
    );
  });
});
