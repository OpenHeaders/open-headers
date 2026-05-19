import { describe, expect, it } from 'vitest';
import { COLLECTION_ENTITY_TYPE, type MutatorContext, renameCollection } from '../../../../src/sync';

const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

describe('renameCollection', () => {
  it('emits a setField at `name` carrying the new name', () => {
    const intent = renameCollection(ctx(), { collectionUid: 'coll-prod', name: 'Production' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-prod',
      path: 'name',
      value: 'Production',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});
