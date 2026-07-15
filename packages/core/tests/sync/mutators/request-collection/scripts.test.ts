import { describe, expect, it } from 'vitest';
import { type MutatorContext, REQUEST_COLLECTION_ENTITY_TYPE, setRequestCollectionScript } from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestCollectionScript', () => {
  it('emits a setField at the script path carrying the source', () => {
    const intent = setRequestCollectionScript(ctx(), {
      collectionUid: 'rcol-auth',
      path: 'preRequestScript',
      value: 'await oh.variables.set("token", "abc");',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-auth',
      path: 'preRequestScript',
      value: 'await oh.variables.set("token", "abc");',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField when clearing the slot (field absent ↔ no script)', () => {
    const intent = setRequestCollectionScript(ctx(), {
      collectionUid: 'rcol-auth',
      path: 'postResponseScript',
      value: undefined,
    });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'unsetField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-auth',
      path: 'postResponseScript',
    });
    expect(intent.batch.mutations[0].body).not.toHaveProperty('value');
    expect(intent.sideEffects).toEqual([]);
  });
});
