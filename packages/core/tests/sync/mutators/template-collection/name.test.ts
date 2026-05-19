import { describe, expect, it } from 'vitest';
import {
  type MutatorContext,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_MUTATOR_VERSION,
  renameTemplateCollection,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('renameTemplateCollection', () => {
  it('emits a setField at `name` carrying the new name', () => {
    const intent = renameTemplateCollection(ctx(), {
      collectionUid: 'tcol-prod',
      name: 'Production templates',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(TEMPLATE_COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'setField',
      type: TEMPLATE_COLLECTION_ENTITY_TYPE,
      id: 'tcol-prod',
      path: 'name',
      value: 'Production templates',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('routes to the template-collection entity type, distinct from rule + request collections', () => {
    const intent = renameTemplateCollection(ctx(), { collectionUid: 'tcol-1', name: 'X' });
    expect(intent.batch.mutations[0].body.type).toBe('template-collection');
  });

  it('shares one batchId across the (single-mutation) batch', () => {
    const intent = renameTemplateCollection(ctx({ batchId: 'b-rename' }), {
      collectionUid: 'tcol-1',
      name: 'Renamed',
    });
    expect(intent.batch.batchId).toBe('b-rename');
  });
});
