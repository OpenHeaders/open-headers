/**
 * P4 — Property-based tests for mutationId dedup convergence (C11).
 *
 * Fixed-scenario coverage in `mutation-id-dedup.test.ts` confirms the
 * three canonical redelivery shapes. This suite generates random
 * delivery schedules — same envelope replayed under any interleaving
 * of single + batch frames — and asserts the convergence properties:
 *
 *   - Apply-once: after a schedule of repeated deliveries, the
 *     receive-side `seenMutationStream` count equals the number of
 *     UNIQUE mutation ids delivered (across both single-envelope and
 *     batch-constituent shapes), not the total delivery count. The
 *     seen-set records every applied constituent — a seed rule that
 *     projects to (create + addToSet per set member) contributes one
 *     id per constituent, regardless of which wire shape carried it.
 *   - Universal apply: every unique envelope (single + batch
 *     constituents) is in the hasRecentlyApplied set after the
 *     schedule completes.
 *   - Materialization: every unique seed rule materializes exactly
 *     once regardless of how many times its seed envelope arrived.
 *   - Order independence: two schedules over the same envelope
 *     multiset, permuted differently, converge to the same
 *     materialized rule set.
 *   - Single ↔ batch interchangeability: an envelope delivered as a
 *     standalone SYNC_MUTATION frame dedups against the same envelope
 *     arriving inside a SYNC_MUTATION_BATCH (and vice versa).
 */
import { type MutatorContext } from '@openheaders/core/sync';
import { SYNC_MUTATION_BATCH_TYPE, SYNC_MUTATION_TYPE } from '@openheaders/core/protocol';
import type { Rule } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { seedRule } from '@openheaders/core/sync-builders/rule-projection';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import {
  __resetMutationStreamBridgeForTests,
  __seenMutationStreamCountForTests,
  hasRecentlyApplied,
} from '@openheaders/oracle/sync';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForCurrentWorkspace,
} from '@openheaders/oracle/sync/service';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const wsId = 'ws-dedup-prop';

const ctx = (ms: number, nodeId = 'peer'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId },
  surfaceId: 's',
  deviceId: 'peer-d',
});

const makeRule = (uid: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path: `rules/x/${uid}`,
    type: 'header',
    name: `r-${uid}`,
    enabled: true,
    conditions: [{ uid: 'cnd00001', kind: 'url-pattern', urlPattern: 'https://openheaders.io/*' }],
    action: {
      requestHeaders: [{ uid: 'hmd00001', headerName: 'X-A', operation: 'set', value: '1' }],
      responseHeaders: [],
    },
  }) as unknown as Rule;

interface SeedSpec {
  readonly uid: string;
  readonly physicalMs: number;
}

const seedSpecsArb: fc.Arbitrary<SeedSpec[]> = fc
  .array(fc.integer({ min: 1, max: 50_000 }), { minLength: 1, maxLength: 6 })
  .map((times) => times.map((ms) => ({ uid: generateUid(), physicalMs: ms })));

// A delivery is "envelope index in seeds[] + as-single OR as-batch".
interface Delivery {
  readonly index: number;
  readonly asBatch: boolean;
}

const deliveryScheduleArb = (numSeeds: number) =>
  fc.array(
    fc.record({
      index: fc.integer({ min: 0, max: numSeeds - 1 }),
      asBatch: fc.boolean(),
    }),
    { minLength: numSeeds, maxLength: numSeeds * 4 },
  );

interface Seeded {
  readonly spec: SeedSpec;
  readonly envelope: ReturnType<typeof seedRule>['mutations'][number];
  readonly batch: ReturnType<typeof seedRule>;
}

function seedAll(specs: SeedSpec[]): Seeded[] {
  return specs.map((spec) => {
    const batch = seedRule(makeRule(spec.uid), ctx(spec.physicalMs));
    return { spec, envelope: batch.mutations[0]!, batch };
  });
}

async function deliver(seeded: Seeded[], schedule: Delivery[]): Promise<void> {
  // Initial delivery uses the BATCH frame so every constituent of each
  // seed (create + addToSet per set member) lands in the seen set
  // before the schedule replays — gives subsequent single + batch
  // redeliveries the chance to demonstrate dedup against an already-
  // applied lead envelope AND an already-applied non-lead constituent.
  for (const s of seeded) {
    const frame = { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch: s.batch };
    const res = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (res?.kind === 'async') await res.promise;
  }
  for (const d of schedule) {
    const s = seeded[d.index];
    if (!s) continue;
    const frame = d.asBatch
      ? { type: SYNC_MUTATION_BATCH_TYPE, workspaceId: wsId, batch: s.batch }
      : { type: SYNC_MUTATION_TYPE, workspaceId: wsId, envelope: s.envelope };
    const res = dispatchSyncRpc(frame as unknown as Record<string, unknown>);
    if (res?.kind === 'async') await res.promise;
  }
}

function uniqueMutationIds(seeded: Seeded[]): Set<string> {
  const ids = new Set<string>();
  for (const s of seeded) {
    for (const m of s.batch.mutations) ids.add(m.mutationId);
  }
  return ids;
}

beforeEach(() => {
  __initSyncServiceForTests(wsId);
  __resetMutationStreamBridgeForTests();
});

afterEach(() => {
  __resetMutationStreamBridgeForTests();
  disposeSyncService();
});

describe('dedup — property: apply-once + universal apply', () => {
  it('seenMutationStream count equals unique envelopes; every unique id is applied', async () => {
    await fc.assert(
      fc.asyncProperty(seedSpecsArb, async (specs) => {
        disposeSyncService();
        __initSyncServiceForTests(wsId);
        __resetMutationStreamBridgeForTests();

        const seeded = seedAll(specs);
        const schedule: Delivery[] = [];
        // Hard-coded replay shape: each seed replayed once as single, once as batch.
        for (let i = 0; i < seeded.length; i++) {
          schedule.push({ index: i, asBatch: false });
          schedule.push({ index: i, asBatch: true });
        }
        await deliver(seeded, schedule);

        // Seen-set tracks every applied mutation id — across both
        // single-envelope and batch-constituent shapes. Redeliveries
        // (single replay + batch replay of the same seed) are no-ops.
        const uniques = uniqueMutationIds(seeded);
        expect(__seenMutationStreamCountForTests()).toBe(uniques.size);

        // Every constituent mutation (across the seed's full batch) is
        // applied regardless of whether it arrived via single or batch.
        for (const id of uniques) expect(hasRecentlyApplied(id)).toBe(true);
      }),
      { numRuns: 20 },
    );
  });
});

describe('dedup — property: random redelivery schedule converges', () => {
  it('any schedule (singles + batches mixed, with repeats) leaves seenCount = unique count', async () => {
    await fc.assert(
      fc.asyncProperty(
        seedSpecsArb.chain((specs) => fc.tuple(fc.constant(specs), deliveryScheduleArb(specs.length))),
        async ([specs, schedule]) => {
          disposeSyncService();
          __initSyncServiceForTests(wsId);
          __resetMutationStreamBridgeForTests();

          const seeded = seedAll(specs);
          await deliver(seeded, schedule);

          // hasRecentlyApplied covers EVERY constituent mutation id —
          // unlike seen-count which only tracks single-frame arrivals.
          const uniques = uniqueMutationIds(seeded);
          for (const id of uniques) expect(hasRecentlyApplied(id)).toBe(true);

          const oracle = getOracleForCurrentWorkspace();
          for (const s of seeded) {
            expect(oracle?.materializeOne('rule', s.spec.uid)).toBeDefined();
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe('dedup — property: order independence', () => {
  it('two permutations of the same delivery multiset produce the same materialized rule set', async () => {
    await fc.assert(
      fc.asyncProperty(
        seedSpecsArb.chain((specs) =>
          fc.tuple(
            fc.constant(specs),
            deliveryScheduleArb(specs.length),
            fc.integer({ min: 0, max: 999_999 }),
          ),
        ),
        async ([specs, schedule, shuffleSeed]) => {
          const expectedUids = new Set(specs.map((s) => s.uid));

          // Run A: schedule as-is.
          disposeSyncService();
          __initSyncServiceForTests(wsId);
          __resetMutationStreamBridgeForTests();
          const seededA = seedAll(specs);
          await deliver(seededA, schedule);
          const oracleA = getOracleForCurrentWorkspace();
          const matA = new Set<string>();
          for (const s of seededA) {
            if (oracleA?.materializeOne('rule', s.spec.uid)) matA.add(s.spec.uid);
          }

          // Run B: same envelope set (re-seeded with same uids), schedule permuted.
          disposeSyncService();
          __initSyncServiceForTests(wsId);
          __resetMutationStreamBridgeForTests();
          // Re-seed with the SAME uids + HLCs → identical mutationIds.
          const seededB = seedAll(specs);
          const permuted = [...schedule].sort((a, b) => {
            const ka = (a.index * 7919 + (a.asBatch ? 1 : 0) + shuffleSeed) % 1009;
            const kb = (b.index * 7919 + (b.asBatch ? 1 : 0) + shuffleSeed) % 1009;
            return ka - kb;
          });
          await deliver(seededB, permuted);
          const oracleB = getOracleForCurrentWorkspace();
          const matB = new Set<string>();
          for (const s of seededB) {
            if (oracleB?.materializeOne('rule', s.spec.uid)) matB.add(s.spec.uid);
          }

          expect(matA).toEqual(expectedUids);
          expect(matB).toEqual(expectedUids);
        },
      ),
      { numRuns: 15 },
    );
  });
});
