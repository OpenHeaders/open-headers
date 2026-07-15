import { describe, expect, it } from 'vitest';
import { type MutatorContext, REQUEST_COLLECTION_ENTITY_TYPE, setRequestCollectionScripts } from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestCollectionScripts', () => {
  it('emits a setField per slot carrying the source', () => {
    const intent = setRequestCollectionScripts(ctx(), {
      collectionUid: 'rcol-auth',
      updates: [
        { path: 'preRequestScript', value: 'await oh.variables.set("token", "abc");' },
        { path: 'postResponseScript', value: 'await oh.test("ok", oh.response.status === 200);' },
      ],
    });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-auth',
      path: 'preRequestScript',
      value: 'await oh.variables.set("token", "abc");',
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'setField',
      path: 'postResponseScript',
    });
    // Both slots land atomically — one batch id across the mutations.
    expect(intent.batch.mutations[0].hlc).toBeDefined();
    expect(intent.sideEffects).toEqual([]);
  });

  it('emits an unsetField when clearing a slot (field absent ↔ no script)', () => {
    const intent = setRequestCollectionScripts(ctx(), {
      collectionUid: 'rcol-auth',
      updates: [{ path: 'postResponseScript', value: undefined }],
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
