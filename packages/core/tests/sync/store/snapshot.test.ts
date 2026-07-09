/**
 * `InMemoryDocumentStore.snapshot` / `.restore` — the rollback
 * primitive consumed by the local oracle's all-or-nothing batch
 * application (§11.2). Tests pin down: snapshots are a deep clone,
 * restoration is total (no field bleeds through), and dedup state
 * also rolls back so a re-applied envelope re-applies cleanly.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope, newMutationId } from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number, mutationId = newMutationId()): MutationEnvelope => ({
  mutationId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 1,
  body,
});

describe('document store snapshot / restore', () => {
  it('snapshot is a deep copy — mutating the original does not bleed into the snapshot', () => {
    const store = new InMemoryDocumentStore();
    // Materialization is create-gated — entities exist observably only
    // after their create applies.
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a' } }, 1_000));
    const snap = store.snapshot();
    store.apply(env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'b' }, 2_000));
    expect((store.materializeAll()[0].data as { name: string }).name).toBe('b');
    store.restore(snap);
    expect((store.materializeAll()[0].data as { name: string }).name).toBe('a');
  });

  it('restore drops dedup ids that were added after the snapshot, allowing re-apply', () => {
    const store = new InMemoryDocumentStore();
    const first = env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'pre' }, 1_000);
    store.apply(first);
    const snap = store.snapshot();
    const next = env({ kind: 'setField', type: 'rule', id: 'r1', path: 'name', value: 'post' }, 2_000);
    expect(store.apply(next).status).toBe('applied');
    store.restore(snap);
    // Replaying the post-snapshot envelope succeeds — its dedup id
    // was rolled back along with its state delta.
    expect(store.apply(next).status).toBe('applied');
  });

  it('restore wipes new entities created after the snapshot', () => {
    const store = new InMemoryDocumentStore();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r1', payload: { name: 'a' } }, 1_000));
    const snap = store.snapshot();
    store.apply(env({ kind: 'create', type: 'rule', id: 'r2', payload: { name: 'b' } }, 2_000));
    expect(store.materializeAll()).toHaveLength(2);
    store.restore(snap);
    expect(store.materializeAll()).toHaveLength(1);
  });
});
