import { describe, expect, it } from 'vitest';
import {
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_SPEC_LINK_PATH,
  setRequestCollectionSpecLink,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestCollectionSpecLink', () => {
  it('emits one whole-object setField at the specLink path', () => {
    const intent = setRequestCollectionSpecLink(ctx(), {
      collectionUid: 'rcol-api',
      specLink: { specUid: 'spec1234', sourceHash: 'sha256:abc' },
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-api',
      path: REQUEST_COLLECTION_SPEC_LINK_PATH,
      value: { specUid: 'spec1234', sourceHash: 'sha256:abc' },
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField when clearing (field absent ↔ not spec-generated)', () => {
    const intent = setRequestCollectionSpecLink(ctx(), {
      collectionUid: 'rcol-api',
      specLink: undefined,
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'unsetField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-api',
      path: REQUEST_COLLECTION_SPEC_LINK_PATH,
    });
    expect(intent.batch.mutations[0].body).not.toHaveProperty('value');
    expect(intent.sideEffects).toEqual([]);
  });
});
