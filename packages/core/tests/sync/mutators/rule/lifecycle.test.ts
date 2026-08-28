import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  createRule,
  deleteRule,
  deriveSideEffectsForEnvelope,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type MutatorContext,
  moveRule,
  RULE_ENTITY_TYPE,
  RULE_MUTATOR_VERSION,
  ruleChild,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const collection = { type: COLLECTION_ENTITY_TYPE, uid: 'col-1' } as const;
const folder = { type: FOLDER_ENTITY_TYPE, uid: 'fold-1' } as const;

describe('createRule', () => {
  it('mints the create + the parent items slot tagged with the rule kind', () => {
    const payload = { schemaVersion: 5, path: 'rules/col/probe-r1', pathSegment: 'probe-r1', name: 'Probe' };
    const intent = createRule(ctx(), { ruleUid: 'r-1', parent: collection, payload, orderKey: 'mm' });
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([RULE_MUTATOR_VERSION, RULE_MUTATOR_VERSION]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: RULE_ENTITY_TYPE, id: 'r-1', payload },
      {
        kind: 'addToSet',
        type: COLLECTION_ENTITY_TYPE,
        id: 'col-1',
        path: FOLDER_ITEMS_PATH,
        itemId: 'r-1',
        item: { uid: 'r-1', type: RULE_ENTITY_TYPE },
        orderKey: 'mm',
      },
    ]);
    // Mint == derive: the rule create and its slot both recompile DNR, keyed by the rule.
    expect(intent.sideEffects).toEqual(intent.batch.mutations.flatMap(deriveSideEffectsForEnvelope));
    expect(intent.sideEffects.map((e) => e.key)).toEqual(['r-1', 'r-1']);
  });

  it('the exported child verbs mint the same slot the seed builders append', () => {
    expect(ruleChild.slotAdd('r-1', folder, 'k')).toEqual({
      kind: 'addToSet',
      type: FOLDER_ENTITY_TYPE,
      id: 'fold-1',
      path: FOLDER_ITEMS_PATH,
      itemId: 'r-1',
      item: { uid: 'r-1', type: RULE_ENTITY_TYPE },
      orderKey: 'k',
    });
  });
});

describe('deleteRule', () => {
  it('emits the parent slot tombstone + the entity tombstone', () => {
    const intent = deleteRule(ctx(), { ruleUid: 'r-1', parent: folder });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'removeFromSet', type: FOLDER_ENTITY_TYPE, id: 'fold-1', path: FOLDER_ITEMS_PATH, itemId: 'r-1' },
      { kind: 'delete', type: RULE_ENTITY_TYPE, id: 'r-1' },
    ]);
  });
});

describe('moveRule', () => {
  it('same-parent reorder is one moveBefore on the items set', () => {
    const intent = moveRule(ctx(), { ruleUid: 'r-1', newParent: collection, orderKey: 'qz' });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'moveBefore',
        type: COLLECTION_ENTITY_TYPE,
        id: 'col-1',
        path: FOLDER_ITEMS_PATH,
        itemId: 'r-1',
        orderKey: 'qz',
      },
    ]);
  });

  it('reparent from a collection into a folder is one atomic remove + add', () => {
    const intent = moveRule(ctx({ batchId: 'b-move' }), {
      ruleUid: 'r-1',
      oldParent: collection,
      newParent: folder,
      orderKey: 'm',
    });
    expect(intent.batch.batchId).toBe('b-move');
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'removeFromSet', type: COLLECTION_ENTITY_TYPE, id: 'col-1', path: FOLDER_ITEMS_PATH, itemId: 'r-1' },
      {
        kind: 'addToSet',
        type: FOLDER_ENTITY_TYPE,
        id: 'fold-1',
        path: FOLDER_ITEMS_PATH,
        itemId: 'r-1',
        item: { uid: 'r-1', type: RULE_ENTITY_TYPE },
        orderKey: 'm',
      },
    ]);
  });
});
