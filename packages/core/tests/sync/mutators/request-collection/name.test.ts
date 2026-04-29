import { describe, expect, it } from 'vitest';
import {
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  renameRequestCollection,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('renameRequestCollection', () => {
  it('emits a setField at `name` carrying the new name', () => {
    const intent = renameRequestCollection(ctx(), {
      collectionUid: 'rcol-prod',
      name: 'Production requests',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(REQUEST_COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-prod',
      path: 'name',
      value: 'Production requests',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('routes to the request-collection entity type, distinct from rule collections', () => {
    const intent = renameRequestCollection(ctx(), { collectionUid: 'rcol-1', name: 'X' });
    expect(intent.batch.mutations[0].body.type).toBe('request-collection');
  });

  it('shares one batchId across the (single-mutation) batch', () => {
    const intent = renameRequestCollection(ctx({ batchId: 'b-rename' }), {
      collectionUid: 'rcol-1',
      name: 'Renamed',
    });
    expect(intent.batch.batchId).toBe('b-rename');
  });
});
