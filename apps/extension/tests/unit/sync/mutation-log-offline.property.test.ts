/**
 * P3 — Property-based tests for the local append-only mutation log
 * (the offline buffer the oracle reads from for handshake streaming
 * and catch-up reads).
 *
 * The mutation log is the durable record of every mutation the local
 * host has accepted. Under random enqueue orderings, dedup pressure,
 * and watermark-based reads, the contract is:
 *
 *   - Append is idempotent on mutationId.
 *   - readSince(null) always yields entries in HLC-string ascending
 *     order regardless of append order.
 *   - readSince(sinceKey) yields exactly the envelopes with HLC strictly
 *     greater than sinceKey.
 *   - hasMutation tracks append + truncate consistently.
 *   - truncateBefore drops exactly entries with HLC < beforeKey and
 *     keeps the rest in order, with no orphan seen-set entries.
 *   - appendAll is equivalent to a sequence of append calls (same
 *     resulting log, same dedup).
 *
 * Together these cover the handshake-streaming + dedup pillars in
 * `docs/DATA_PLANE_TOPOLOGIES.md §11.4` (HLC ordering) and
 * `§11.7` (mutationId dedup).
 */
import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { stressNumRuns } from './property-stress';

const NODE_POOL = ['a', 'b', 'c'] as const;
type NodeId = (typeof NODE_POOL)[number];

interface EnvSpec {
  readonly mutationId: string;
  readonly nodeId: NodeId;
  readonly physicalMs: number;
  readonly logical: number;
}

const envSpecArb: fc.Arbitrary<EnvSpec> = fc
  .tuple(
    fc.constantFrom(...NODE_POOL),
    fc.integer({ min: 1, max: 5_000 }),
    fc.integer({ min: 0, max: 7 }),
    fc.integer({ min: 0, max: 1_000_000 }),
  )
  .map(([nodeId, ms, logical, salt]) => ({
    nodeId,
    physicalMs: ms,
    logical,
    mutationId: `m-${nodeId}-${ms}-${logical}-${salt}`,
  }));

const uniqueSpecsArb: fc.Arbitrary<EnvSpec[]> = fc
  .array(envSpecArb, { minLength: 0, maxLength: 15 })
  .map((arr) => {
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const out: EnvSpec[] = [];
    for (const s of arr) {
      const key = `${s.nodeId}:${s.physicalMs}:${s.logical}`;
      if (seenIds.has(s.mutationId) || seenKeys.has(key)) continue;
      seenIds.add(s.mutationId);
      seenKeys.add(key);
      out.push(s);
    }
    return out;
  });

const toEnvelope = (s: EnvSpec): MutationEnvelope => ({
  mutationId: s.mutationId,
  hlc: { physicalMs: s.physicalMs, logical: s.logical, nodeId: s.nodeId },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body: { kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: s.mutationId },
});

const keyOf = (s: EnvSpec): string => hlcToString({ physicalMs: s.physicalMs, logical: s.logical, nodeId: s.nodeId });

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

describe('mutation-log — property: FIFO by HLC regardless of append order', () => {
  it('readSince(null) yields entries in HLC-string ascending order for any permutation of appends', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, fc.integer({ min: 0, max: 999_999 }), async (specs, shuffleSeed) => {
        const log = new InMemoryMutationLog();
        // Shuffle the specs deterministically by seed.
        const shuffled = [...specs].sort((a, b) => {
          const ha = hlcToString({ physicalMs: a.physicalMs + shuffleSeed, logical: 0, nodeId: a.mutationId });
          const hb = hlcToString({ physicalMs: b.physicalMs + shuffleSeed, logical: 0, nodeId: b.mutationId });
          return ha < hb ? -1 : ha > hb ? 1 : 0;
        });
        for (const s of shuffled) await log.append(toEnvelope(s));

        const read = await collect(log.readSince(null));
        const readKeys = read.map((e) => hlcToString(e.hlc));
        const sortedKeys = [...readKeys].sort();
        expect(readKeys).toEqual(sortedKeys);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('mutation-log — property: append is idempotent on mutationId', () => {
  it('appending the same envelope twice leaves the log unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, async (specs) => {
        const log = new InMemoryMutationLog();
        for (const s of specs) await log.append(toEnvelope(s));
        // Re-append every spec.
        for (const s of specs) await log.append(toEnvelope(s));
        const read = await collect(log.readSince(null));
        expect(read.length).toBe(specs.length);
        const ids = new Set(read.map((e) => e.mutationId));
        expect(ids.size).toBe(specs.length);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('mutation-log — property: hasMutation tracks appends + truncations', () => {
  it('hasMutation is true for every appended envelope and false for truncated entries', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, async (specs) => {
        const log = new InMemoryMutationLog();
        for (const s of specs) await log.append(toEnvelope(s));
        for (const s of specs) expect(await log.hasMutation(s.mutationId)).toBe(true);

        if (specs.length === 0) return;
        // Pick a cut point: truncate everything strictly less than the
        // median HLC key.
        const sortedKeys = specs.map(keyOf).sort();
        const cut = sortedKeys[Math.floor(sortedKeys.length / 2)];
        await log.truncateBefore(cut);

        for (const s of specs) {
          const expected = keyOf(s) >= cut;
          expect(await log.hasMutation(s.mutationId)).toBe(expected);
        }
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('mutation-log — property: readSince watermark cutoff', () => {
  it('readSince(sinceKey) yields exactly entries with HLC strictly greater than sinceKey', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, fc.integer({ min: 0, max: 5_000 }), async (specs, sinceMs) => {
        const log = new InMemoryMutationLog();
        for (const s of specs) await log.append(toEnvelope(s));

        const sinceKey = hlcToString({ physicalMs: sinceMs, logical: 0, nodeId: 'a' });
        const read = await collect(log.readSince(sinceKey));
        for (const env of read) {
          expect(hlcToString(env.hlc) > sinceKey).toBe(true);
        }
        // Conversely: every spec with key > sinceKey must appear.
        const expected = specs.filter((s) => keyOf(s) > sinceKey).map((s) => s.mutationId);
        const got = read.map((e) => e.mutationId);
        expect(new Set(got)).toEqual(new Set(expected));
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('mutation-log — property: truncateBefore preserves tail order', () => {
  it('after truncate, the surviving entries appear in HLC ascending order with the right cutoff', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, fc.integer({ min: 0, max: 5_000 }), async (specs, beforeMs) => {
        const log = new InMemoryMutationLog();
        for (const s of specs) await log.append(toEnvelope(s));

        const beforeKey = hlcToString({ physicalMs: beforeMs, logical: 0, nodeId: 'a' });
        await log.truncateBefore(beforeKey);

        const survivors = await collect(log.readSince(null));
        for (const env of survivors) {
          expect(hlcToString(env.hlc) >= beforeKey).toBe(true);
        }
        const keys = survivors.map((e) => hlcToString(e.hlc));
        expect(keys).toEqual([...keys].sort());
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});

describe('mutation-log — property: appendAll equivalent to sequential append', () => {
  it('appendAll and serial append produce identical readSince results', async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSpecsArb, async (specs) => {
        const a = new InMemoryMutationLog();
        const b = new InMemoryMutationLog();
        const envs = specs.map(toEnvelope);
        await a.appendAll(envs);
        for (const env of envs) await b.append(env);

        const ra = (await collect(a.readSince(null))).map((e) => e.mutationId);
        const rb = (await collect(b.readSince(null))).map((e) => e.mutationId);
        expect(ra).toEqual(rb);
      }),
      { numRuns: stressNumRuns(60) },
    );
  });
});
