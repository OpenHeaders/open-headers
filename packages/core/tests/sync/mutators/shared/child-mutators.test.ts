import { describe, expect, it } from 'vitest';
import {
  type MutatorContext,
  makeChildMutators,
  mintBatch,
  RULE_ENTITY_TYPE,
  RULE_MUTATOR_VERSION,
} from '../../../../src/sync';

interface Parent {
  type: 'collection' | 'folder';
  uid: string;
}

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const child = makeChildMutators<Parent, { uid: string; type: string }>({
  entityType: RULE_ENTITY_TYPE,
  childrenPath: 'items',
  slot: (uid) => ({ uid, type: RULE_ENTITY_TYPE }),
  mintBatch,
});

const collection: Parent = { type: 'collection', uid: 'col-1' };
const folder: Parent = { type: 'folder', uid: 'fold-1' };

describe('makeChildMutators — slot bodies', () => {
  it('slotAdd targets the parent set with the binding slot marker and the caller key', () => {
    expect(child.slotAdd('r-1', collection, 'mm')).toEqual({
      kind: 'addToSet',
      type: 'collection',
      id: 'col-1',
      path: 'items',
      itemId: 'r-1',
      item: { uid: 'r-1', type: RULE_ENTITY_TYPE },
      orderKey: 'mm',
    });
  });

  it('slotRemove tombstones the parent set member', () => {
    expect(child.slotRemove('r-1', folder)).toEqual({
      kind: 'removeFromSet',
      type: 'folder',
      id: 'fold-1',
      path: 'items',
      itemId: 'r-1',
    });
  });
});

describe('makeChildMutators — create', () => {
  it('mints the entity create followed by the parent slot under one batch', () => {
    const intent = child.create(ctx({ batchId: 'b-create' }), {
      childUid: 'r-1',
      parent: collection,
      payload: { name: 'Probe' },
      orderKey: 'mm',
    });
    expect(intent.batch.batchId).toBe('b-create');
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([RULE_MUTATOR_VERSION, RULE_MUTATOR_VERSION]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: RULE_ENTITY_TYPE, id: 'r-1', payload: { name: 'Probe' } },
      child.slotAdd('r-1', collection, 'mm'),
    ]);
    expect(intent.sideEffects).toEqual([]);
  });

  it('a keyless create leaves the slot on the seed key', () => {
    const intent = child.create(ctx(), { childUid: 'r-1', parent: collection, payload: {} });
    expect((intent.batch.mutations[1].body as { orderKey?: string }).orderKey).toBeUndefined();
  });
});

describe('makeChildMutators — delete', () => {
  it('emits the slot tombstone before the entity tombstone', () => {
    const intent = child.delete(ctx(), { childUid: 'r-1', parent: folder });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      child.slotRemove('r-1', folder),
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: 'r-1' },
    ]);
  });
});

describe('makeChildMutators — move', () => {
  it('same parent (explicit or omitted) is one moveBefore on the set', () => {
    for (const oldParent of [collection, undefined]) {
      const intent = child.move(ctx(), { childUid: 'r-1', newParent: collection, oldParent, orderKey: 'qz' });
      expect(intent.batch.mutations.map((m) => m.body)).toEqual([
        { kind: 'moveBefore', type: 'collection', id: 'col-1', path: 'items', itemId: 'r-1', orderKey: 'qz' },
      ]);
    }
  });

  it('a reparent is remove-from-old + add-to-new in one atomic batch', () => {
    const intent = child.move(ctx({ batchId: 'b-move' }), {
      childUid: 'r-1',
      oldParent: collection,
      newParent: folder,
      orderKey: 'k',
    });
    expect(intent.batch.batchId).toBe('b-move');
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      child.slotRemove('r-1', collection),
      child.slotAdd('r-1', folder, 'k'),
    ]);
  });

  it('ticks the HLC per envelope so a batch never carries two equal stamps', () => {
    const intent = child.move(ctx(), { childUid: 'r-1', oldParent: collection, newParent: folder, orderKey: 'k' });
    const [first, second] = intent.batch.mutations.map((m) => m.hlc);
    expect(second.logical).toBeGreaterThan(first.logical);
  });
});
