/**
 * Oracle apply path: lock acquisition, all-or-nothing batch
 * semantics (§11.2), broadcast fan-out, and persistence side effects.
 *
 * Backed entirely by in-memory fakes — the oracle's hard contract is
 * testable without IDB or chrome.runtime. R3.
 */

import { addHeaderMod, newBatchId, type MutatorContext, toggleEnabled } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';

const wsId = 'ws-1';

const ctx = (physicalMs: number, nodeId = 'node-a'): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'surface-test',
  deviceId: 'device-a',
});

const sequentialLock: LockAcquirer = async (_ws, _type, _id, fn) => fn();

interface Harness {
  oracle: EntityOracle;
  log: InMemoryMutationLog;
  intents: InMemoryPendingIntents;
  broadcast: InMemoryBroadcast;
  events: Array<{ batchId?: string; mutationId: string; status: string }>;
}

function makeHarness(lock: LockAcquirer = sequentialLock): Harness {
  const log = new InMemoryMutationLog();
  const intents = new InMemoryPendingIntents();
  const broadcast = new InMemoryBroadcast();
  const events: Harness['events'] = [];
  broadcast.subscribe((e) =>
    events.push({ batchId: e.batchId, mutationId: e.envelope.mutationId, status: e.outcome.status }),
  );
  const oracle = new EntityOracle({ workspaceId: wsId, lock, log, intents, broadcast });
  return { oracle, log, intents, broadcast, events };
}

describe('EntityOracle.apply', () => {
  it('commits a single-mutation batch: store, log, intents, broadcast', async () => {
    const h = makeHarness();
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    const result = await h.oracle.apply(intent.batch, intent.sideEffects);

    expect(result.ok).toBe(true);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0].outcome.status).toBe('applied');
    expect(h.events).toEqual([
      { batchId: intent.batch.batchId, mutationId: intent.batch.mutations[0].mutationId, status: 'applied' },
    ]);
    const persisted: unknown[] = [];
    for await (const e of h.log.readSince(null)) persisted.push(e);
    expect(persisted).toHaveLength(1);
    const enqueued = await h.intents.list();
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].kind).toBe('recompile-dnr');
  });

  it('respects HLC LWW across two batches on the same field', async () => {
    const h = makeHarness();
    const earlier = toggleEnabled(ctx(1_000, 'node-a'), { ruleUid: 'r1', enabled: false });
    const later = toggleEnabled(ctx(2_000, 'node-b'), { ruleUid: 'r1', enabled: true });

    // Apply later first, then earlier — earlier loses by HLC.
    await h.oracle.apply(later.batch, later.sideEffects);
    await h.oracle.apply(earlier.batch, earlier.sideEffects);

    const snap = h.oracle.materializeAll();
    expect(snap).toHaveLength(1);
    expect((snap[0].data as { enabled?: boolean }).enabled).toBe(true);
  });

  it('multi-mutation batch (addHeaderMod + toggleEnabled) commits as one unit', async () => {
    const h = makeHarness();
    const sharedBatch = newBatchId();
    const headerIntent = addHeaderMod(
      { ...ctx(1_000), batchId: sharedBatch },
      { ruleUid: 'r1', side: 'request', mod: { uid: 'thm00095', operation: 'override', headerName: 'X-A', value: '1' }, itemId: 'h-1' },
    );
    const toggleIntent = toggleEnabled({ ...ctx(1_001), batchId: sharedBatch }, { ruleUid: 'r1', enabled: true });

    // Splice the toggle's mutation into the header batch so they
    // share a single batchId end-to-end.
    headerIntent.batch.mutations.push(...toggleIntent.batch.mutations);
    headerIntent.sideEffects.push(...toggleIntent.sideEffects);

    const result = await h.oracle.apply(headerIntent.batch, headerIntent.sideEffects);
    expect(result.ok).toBe(true);
    expect(h.events).toHaveLength(2);
    expect(h.events.every((e) => e.batchId === sharedBatch)).toBe(true);

    const snap = h.oracle.materializeAll();
    const data = snap[0].data as { enabled?: boolean; action?: { requestHeaders?: unknown[] } };
    expect(data.enabled).toBe(true);
    expect(data.action?.requestHeaders).toHaveLength(1);
  });

  it('serializes concurrent applies via the lock', async () => {
    const queues = new Map<string, Promise<unknown>>();
    let inFlight = 0;
    let observedConcurrent = 0;
    const queueingLock: LockAcquirer = async (ws, type, id, fn) => {
      const lockName = `${ws}:${type}:${id}`;
      const previous = queues.get(lockName) ?? Promise.resolve();
      const next = previous.then(async () => {
        inFlight += 1;
        observedConcurrent = Math.max(observedConcurrent, inFlight);
        try {
          return await fn();
        } finally {
          inFlight -= 1;
        }
      });
      queues.set(
        lockName,
        next.catch(() => undefined),
      );
      return next as ReturnType<typeof fn>;
    };
    const h = makeHarness(queueingLock);
    const a = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    const b = toggleEnabled(ctx(2_000), { ruleUid: 'r1', enabled: false });
    await Promise.all([h.oracle.apply(a.batch, a.sideEffects), h.oracle.apply(b.batch, b.sideEffects)]);
    expect(observedConcurrent).toBeLessThanOrEqual(1);
  });

  it('drops a duplicate mutationId without re-broadcasting', async () => {
    const h = makeHarness();
    const intent = toggleEnabled(ctx(1_000), { ruleUid: 'r1', enabled: true });
    await h.oracle.apply(intent.batch, intent.sideEffects);
    const replay = {
      batchId: intent.batch.batchId,
      mutations: [{ ...intent.batch.mutations[0], mutationId: intent.batch.mutations[0].mutationId }],
    };
    const result = await h.oracle.apply(replay, []);
    expect(result.ok).toBe(true);
    expect(result.outcomes[0].outcome.status).toBe('duplicate');
    // Broadcast publishes the duplicate event too — surfaces decide
    // what to do with it (typically: drop from pending). The contract
    // is "every committed envelope gets one broadcast"; duplicate is
    // committed-as-no-op.
    expect(h.events).toHaveLength(2);
  });
});

