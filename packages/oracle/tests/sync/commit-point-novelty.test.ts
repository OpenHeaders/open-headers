/**
 * Novelty at the commit point (the workspace-list scope plan, Part 2).
 *
 * The oracle decides whether an envelope is new against the durable
 * mutation log, inside the apply lock, and derives the side-effect
 * intents from the envelopes it commits. A replayed batch — the same
 * ids arriving again from any path — commits nothing: no store write,
 * no log row, no intent, no broadcast, no revision bump; its HLCs
 * still fold into the sequencer. A mixed batch commits its novel
 * subset and reports the rest as duplicates.
 */

import {
  type HLC,
  type MutationBatch,
  type MutatorContext,
  mintBatch,
  newBatchId,
  RECOMPILE_DNR,
  RULE_ENTITY_TYPE,
  toggleEnabled,
} from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

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
}

function makeHarness(): Harness {
  const log = new InMemoryMutationLog();
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const broadcastIds: string[] = [];
  const observed: HLC[] = [];
  broadcast.subscribe((e) => broadcastIds.push(e.envelope.mutationId));
  const oracle = new EntityOracle({
    workspaceId: wsId,
    lock,
    log,
    intents,
    broadcast,
    onBatchApplied: (hlc) => observed.push(hlc),
  });
  return { oracle, log, intents, broadcastIds, observed };
}

async function logRows(log: InMemoryMutationLog): Promise<number> {
  let rows = 0;
  for await (const _ of log.readSince(null)) rows += 1;
  return rows;
}

const enabledOf = (h: Harness, uid: string): boolean | undefined =>
  (h.oracle.materializeOne(RULE_ENTITY_TYPE, uid)?.data as { enabled?: boolean } | undefined)?.enabled;

describe('EntityOracle commit-point novelty', () => {
  it('a replayed batch commits nothing: store, log, intents, broadcast and revision stay put; the HLC is observed', async () => {
    const h = makeHarness();
    await h.oracle.apply(createRule(500, 'r1'));
    const first = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(first.batch);
    const later = toggleEnabled(ctx(2_000), { ruleUid: 'r1', enabled: false });
    await h.oracle.apply(later.batch);
    expect(enabledOf(h, 'r1')).toBe(false);
    const revision = h.oracle.revision;
    const rows = await logRows(h.log);
    const intents = await h.intents.list();
    const broadcasts = h.broadcastIds.length;

    // The replay carries the first toggle's id under a NEWER HLC: a
    // store write would win LWW and flip the field back, so the field
    // staying put proves the store never saw the envelope.
    const replay: MutationBatch = {
      batchId: newBatchId(),
      mutations: first.batch.mutations.map((env) => ({ ...env, hlc: { ...env.hlc, physicalMs: 3_000 } })),
    };
    const result = await h.oracle.apply(replay);

    expect(result.ok).toBe(true);
    expect(result.outcomes.map((o) => o.outcome.status)).toEqual(['duplicate']);
    expect(enabledOf(h, 'r1')).toBe(false);
    expect(h.oracle.revision).toBe(revision);
    expect(await logRows(h.log)).toBe(rows);
    expect(await h.intents.list()).toEqual(intents);
    expect(h.broadcastIds).toHaveLength(broadcasts);
    expect(h.observed[h.observed.length - 1]?.physicalMs).toBe(3_000);
  });

  it('a mixed batch commits only its novel envelopes and derives intents from those alone', async () => {
    const h = makeHarness();
    await h.oracle.apply(createRule(500, 'r1'));
    await h.oracle.apply(createRule(600, 'r2'));
    const known = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(known.batch);
    await h.intents.clear();
    const revision = h.oracle.revision;
    const rows = await logRows(h.log);
    h.broadcastIds.length = 0;

    const novel = toggleEnabled(ctx(2_000), { ruleUid: 'r2', enabled: true });
    const mixed: MutationBatch = {
      batchId: newBatchId(),
      mutations: [...known.batch.mutations, ...novel.batch.mutations],
    };
    const result = await h.oracle.apply(mixed);

    expect(result.ok).toBe(true);
    expect(result.outcomes.map((o) => o.outcome.status)).toEqual(['duplicate', 'applied']);
    expect(enabledOf(h, 'r2')).toBe(true);
    expect(h.oracle.revision).toBe(revision + 1);
    expect(await logRows(h.log)).toBe(rows + 1);
    expect(await h.intents.list()).toEqual([{ kind: RECOMPILE_DNR, key: 'r2', hlc: novel.batch.mutations[0].hlc }]);
    expect(h.broadcastIds).toEqual([novel.batch.mutations[0].mutationId]);
  });

  it('derives the intents at the commit point whatever the origin; the caller supplies none', async () => {
    const h = makeHarness();
    await h.oracle.apply(createRule(500, 'r1'));
    await h.intents.clear();
    const toggle = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(toggle.batch, 'inbound');
    expect(await h.intents.list()).toEqual([{ kind: RECOMPILE_DNR, key: 'r1', hlc: toggle.batch.mutations[0].hlc }]);
  });
});
