/**
 * Coalescing contract for the in-memory PendingIntents reference impl
 * (R6 test surface). Two enqueues for the same `(kind, key)` collapse
 * to the higher-HLC intent (§18.1).
 */

import type { SideEffectIntent } from '@openheaders/core/sync';
import { describe, expect, it } from 'vitest';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';

const intent = (kind: string, key: string, ms: number): SideEffectIntent => ({
  kind,
  key,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
});

describe('InMemoryPendingIntents', () => {
  it('coalesces two enqueues for the same (kind, key) keeping the higher HLC', async () => {
    const store = new InMemoryPendingIntents();
    await store.enqueue(intent('recompile-dnr', 'r1', 2_000));
    await store.enqueue(intent('recompile-dnr', 'r1', 1_000));
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].hlc.physicalMs).toBe(2_000);
  });

  it('treats different `key`s as independent entries', async () => {
    const store = new InMemoryPendingIntents();
    await store.enqueue(intent('recompile-dnr', 'r1', 1_000));
    await store.enqueue(intent('recompile-dnr', 'r2', 1_000));
    const list = await store.list();
    expect(list.map((i) => i.key)).toEqual(['r1', 'r2']);
  });

  it('drain removes the entry and returns it', async () => {
    const store = new InMemoryPendingIntents();
    await store.enqueue(intent('recompile-dnr', 'r1', 1_000));
    const drained = await store.drain('recompile-dnr', 'r1');
    expect(drained?.key).toBe('r1');
    expect(await store.list()).toHaveLength(0);
  });

  it('drain on an empty key returns null', async () => {
    const store = new InMemoryPendingIntents();
    expect(await store.drain('recompile-dnr', 'absent')).toBeNull();
  });

  it('clear wipes everything', async () => {
    const store = new InMemoryPendingIntents();
    await store.enqueueAll([intent('a', '1', 1), intent('b', '2', 2)]);
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });
});
