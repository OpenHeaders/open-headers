import { describe, expect, it } from 'vitest';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  REQUEST_COLLECTION_VARS_PATH,
  removeRequestCollectionVar,
  renameRequestCollectionVar,
  setRequestCollectionVar,
  setRequestCollectionVarType,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setRequestCollectionVar', () => {
  it('emits an addToSet at the request-collection variables path', () => {
    const intent = setRequestCollectionVar(ctx(), {
      requestCollectionUid: 'rcol-prod',
      name: 'BASE_URL',
      value: 'https://api.openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(REQUEST_COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-prod',
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: 'BASE_URL',
      item: { name: 'BASE_URL', value: 'https://api.openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'rcol-prod', hlc: ctx().hlc },
    ]);
  });
});

describe('removeRequestCollectionVar', () => {
  it('emits a removeFromSet with itemId = name', () => {
    const intent = removeRequestCollectionVar(ctx(), {
      requestCollectionUid: 'rcol-prod',
      name: 'BASE_URL',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: 'BASE_URL',
    });
  });
});

describe('renameRequestCollectionVar', () => {
  it('emits a 2-mutation batch (remove old + add new)', () => {
    const intent = renameRequestCollectionVar(ctx(), {
      requestCollectionUid: 'rcol-1',
      oldName: 'A',
      newName: 'B',
      value: 'v',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].body).toMatchObject({ kind: 'removeFromSet', itemId: 'A' });
    expect(intent.batch.mutations[1].body).toMatchObject({ kind: 'addToSet', itemId: 'B' });
  });

  it('returns an empty batch when oldName === newName', () => {
    const intent = renameRequestCollectionVar(ctx(), {
      requestCollectionUid: 'rcol-1',
      oldName: 'X',
      newName: 'X',
      value: 'v',
    });
    expect(intent.batch.mutations).toHaveLength(0);
  });
});

describe('setRequestCollectionVarType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = setRequestCollectionVarType(ctx(), {
      requestCollectionUid: 'rcol-1',
      name: 'TOKEN',
      value: 'abc',
      type: 'secret',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
