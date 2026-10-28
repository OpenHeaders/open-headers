/**
 * Boot by replay (the workspace-list scope plan, Part 3).
 *
 * `EntityOracle.hydrate` applies a scope's stored envelopes in the
 * order given without committing anything: no log row, no intent, no
 * broadcast, one revision bump, the highest HLC folded into the
 * sequencer, the applied set primed so a redelivery of any replayed id
 * is a duplicate. No lock is taken — the owning service's hydration
 * gate is what every writer awaits, and the loop is one synchronous
 * block.
 */

import {
  type HLC,
  type MutationBatch,
  type MutationEnvelope,
  type MutatorContext,
  mintBatch,
  newBatchId,
  RULE_ENTITY_TYPE,
  toggleEnabled,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

const wsId = 'ws-hydrate';

const ctx = (physicalMs: number, nodeId = 'node-a'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

const createRule = (ms: number, uid: string): MutationBatch =>
  mintBatch(ctx(ms, 'node-seed'), [
    { kind: 'create', type: RULE_ENTITY_TYPE, id: uid, payload: { uid, name: uid, type: 'header', enabled: false } },
  ]);

interface Harness {
  oracle: EntityOracle;
  log: InMemoryMutationLog;
  intents: InMemoryPendingIntents;
  broadcastIds: string[];
  observed: HLC[];
  locks: string[];
}

function makeHarness(log = new InMemoryMutationLog()): Harness {
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const broadcastIds: string[] = [];
  const observed: HLC[] = [];
  const locks: string[] = [];
  const lock: LockAcquirer = async (_ws, type, id, fn) => {
    locks.push(`${type}:${id}`);
    return fn();
  };
  broadcast.subscribe((e) => broadcastIds.push(e.envelope.mutationId));
  const oracle = new EntityOracle({
    workspaceId: wsId,
    lock,
    log,
    intents,
    broadcast,
    onBatchApplied: (hlc) => observed.push(hlc),
  });
  return { oracle, log, intents, broadcastIds, observed, locks };
}

async function collect(log: InMemoryMutationLog): Promise<MutationEnvelope[]> {
  const out: MutationEnvelope[] = [];
  for await (const env of log.readSince(null)) out.push(env);
  return out;
}

const enabledOf = (h: Harness, uid: string): boolean | undefined =>
  (h.oracle.materializeOne(RULE_ENTITY_TYPE, uid)?.data as { enabled?: boolean } | undefined)?.enabled;

/** A log written by one process lifetime: two rules, one toggled twice. */
async function writeHistory(): Promise<InMemoryMutationLog> {
  const writer = makeHarness();
  await writer.oracle.apply(createRule(500, 'r1'));
  await writer.oracle.apply(createRule(600, 'r2'));
  await writer.oracle.apply(toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true }).batch);
  await writer.oracle.apply(toggleEnabled(ctx(2_000), { ruleUid: 'r1', enabled: false }).batch);
  return writer.log;
}

describe('EntityOracle.hydrate', () => {
  it('replays the log into a fresh store without committing: no row, no intent, no broadcast, one revision', async () => {
    const log = await writeHistory();
    const rows = await collect(log);
    const h = makeHarness(log);

    const replayed = await h.oracle.hydrate(log.readSince(null));

    expect(replayed).toBe(rows.length);
    expect(h.oracle.materializeAll().map((m) => m.id)).toEqual(['r1', 'r2']);
    expect(enabledOf(h, 'r1')).toBe(false);
    expect(h.oracle.revision).toBe(1);
    expect(await collect(log)).toEqual(rows);
    expect(await h.intents.list()).toEqual([]);
    expect(h.broadcastIds).toEqual([]);
  });

  it('readAll is the replay read: the whole scope in stored order, the shape hydrateOracleFromLog consumes', async () => {
    const log = await writeHistory();
    const rows = await collect(log);
    const h = makeHarness(log);

    const all: MutationEnvelope[] = [];
    for await (const env of log.readAll()) all.push(env);
    expect(all).toEqual(rows);

    expect(await h.oracle.hydrate(log.readAll())).toBe(rows.length);
    expect(enabledOf(h, 'r1')).toBe(false);
  });

  it('folds the highest replayed HLC into the sequencer once', async () => {
    const log = await writeHistory();
    const h = makeHarness(log);
    await h.oracle.hydrate(log.readSince(null));
    expect(h.observed).toHaveLength(1);
    expect(h.observed[0].physicalMs).toBe(2_000);
  });

  it('primes the applied set: a redelivery of a replayed envelope is a duplicate that touches nothing', async () => {
    const log = await writeHistory();
    const rows = await collect(log);
    const h = makeHarness(log);
    await h.oracle.hydrate(rows);
    const revision = h.oracle.revision;

    // The first toggle under a newer HLC would win LWW if the store saw it.
    const first = rows.find((env) => env.body.kind === 'setField' && env.hlc.physicalMs === 1_000);
    if (!first) throw new Error('history lacks the first toggle');
    const replay: MutationBatch = {
      batchId: newBatchId(),
      mutations: [{ ...first, hlc: { ...first.hlc, physicalMs: 3_000 } }],
    };
    const result = await h.oracle.apply(replay);

    expect(result.outcomes.map((o) => o.outcome.status)).toEqual(['duplicate']);
    expect(enabledOf(h, 'r1')).toBe(false);
    expect(h.oracle.revision).toBe(revision);
    expect(await collect(log)).toEqual(rows);
    expect(h.broadcastIds).toEqual([]);
  });

  it('applies in the order given: a leaf replayed ahead of its create converges once the create lands', async () => {
    const log = await writeHistory();
    const rows = await collect(log);
    const create = rows.find((env) => env.body.kind === 'create' && env.body.id === 'r1');
    const reordered = [...rows.filter((env) => env !== create), create as MutationEnvelope];
    const h = makeHarness(log);

    await h.oracle.hydrate(reordered);

    expect(h.oracle.materializeAll().map((m) => m.id)).toEqual(['r1', 'r2']);
    expect(enabledOf(h, 'r1')).toBe(false);
  });

  it('takes no lock: the owning gate serializes the replay against every writer', async () => {
    const log = await writeHistory();
    const h = makeHarness(log);
    await h.oracle.hydrate(log.readSince(null));
    expect(h.locks).toEqual([]);
    expect(h.oracle.hasEntityOfType(RULE_ENTITY_TYPE)).toBe(true);
    expect(h.oracle.hasEntityOfType('vault')).toBe(false);
  });

  it('a local write after the replay still takes its entity lock', async () => {
    const log = await writeHistory();
    const h = makeHarness(log);
    await h.oracle.hydrate(log.readSince(null));
    await h.oracle.apply(toggleEnabled(ctx(2_500), { ruleUid: 'r2', enabled: true }).batch);
    expect(h.locks).toEqual([`${RULE_ENTITY_TYPE}:r2`]);
  });

  it('an empty log replays nothing: no lock, no revision, no observation', async () => {
    const h = makeHarness();
    expect(await h.oracle.hydrate(h.log.readSince(null))).toBe(0);
    expect(h.oracle.revision).toBe(0);
    expect(h.locks).toEqual([]);
    expect(h.observed).toEqual([]);
  });

  it('a local write after the replay mints past the log and commits as usual', async () => {
    const log = await writeHistory();
    const rows = await collect(log);
    const h = makeHarness(log);
    await h.oracle.hydrate(log.readSince(null));

    const next = toggleEnabled(ctx(2_500), { ruleUid: 'r2', enabled: true });
    const result = await h.oracle.apply(next.batch);

    expect(result.ok).toBe(true);
    expect(enabledOf(h, 'r2')).toBe(true);
    expect((await collect(log)).length).toBe(rows.length + 1);
    expect(h.broadcastIds).toEqual([next.batch.mutations[0].mutationId]);
    expect(h.oracle.revision).toBe(2);
  });
});
