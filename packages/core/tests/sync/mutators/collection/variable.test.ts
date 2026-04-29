import { describe, expect, it } from 'vitest';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_MUTATOR_VERSION,
  COLLECTION_VARS_PATH,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeCollectionVar,
  renameCollectionVar,
  setCollectionVar,
  setCollectionVarType,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setCollectionVar', () => {
  it('emits an addToSet at variables with itemId = name', () => {
    const intent = setCollectionVar(ctx(), {
      collectionUid: 'coll-prod',
      name: 'API_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-prod',
      path: COLLECTION_VARS_PATH,
      itemId: 'API_URL',
      item: { name: 'API_URL', value: 'https://openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'coll-prod', hlc: ctx().hlc }]);
  });

  it('honors explicit type + orderKey when provided', () => {
    const intent = setCollectionVar(ctx(), {
      collectionUid: 'coll-prod',
      name: 'API_KEY',
      value: 'k',
      type: 'secret',
      orderKey: 'm',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'API_KEY',
      item: { name: 'API_KEY', value: 'k', type: 'secret' },
      orderKey: 'm',
    });
  });

  it('shares a batchId across multiple mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setCollectionVar(c, { collectionUid: 'c', name: 'A', value: '1' });
    expect(a.batch.batchId).toBe('batch-shared');
  });
});

describe('removeCollectionVar', () => {
  it('emits removeFromSet with itemId = name', () => {
    const intent = removeCollectionVar(ctx(), { collectionUid: 'coll-prod', name: 'API_URL' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-prod',
      path: COLLECTION_VARS_PATH,
      itemId: 'API_URL',
    });
  });
});

describe('renameCollectionVar', () => {
  it('emits an atomic batch — removeFromSet(old) + addToSet(new) under one batchId', () => {
    const intent = renameCollectionVar(ctx(), {
      collectionUid: 'coll-prod',
      oldName: 'API_URL',
      newName: 'BASE_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].mutationId).not.toBe(intent.batch.mutations[1].mutationId);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      itemId: 'API_URL',
      path: COLLECTION_VARS_PATH,
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'BASE_URL',
      path: COLLECTION_VARS_PATH,
      item: { name: 'BASE_URL', value: 'https://openheaders.io', type: 'default' },
    });
  });

  it('is a no-op (empty batch) when oldName === newName', () => {
    const intent = renameCollectionVar(ctx(), { collectionUid: 'c', oldName: 'X', newName: 'X', value: 'v' });
    expect(intent.batch.mutations).toHaveLength(0);
  });
});

describe('setCollectionVarType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = setCollectionVarType(ctx(), { collectionUid: 'c', name: 'TOKEN', value: 'abc', type: 'secret' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
