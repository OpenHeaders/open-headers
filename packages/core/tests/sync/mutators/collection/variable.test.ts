import { describe, expect, it } from 'vitest';
import type { Variable } from '../../../../src/types/variable';
import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_MUTATOR_VERSION,
  COLLECTION_VARS_PATH,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeCollectionVar,
  setCollectionVar,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const v = (overrides: Partial<Variable> = {}): Variable => ({
  uid: 'var-aaaa',
  name: 'API_URL',
  value: 'https://openheaders.io',
  type: 'default',
  ...overrides,
});

describe('setCollectionVar', () => {
  it('emits an addToSet at variables with itemId = variable.uid', () => {
    const variable = v();
    const intent = setCollectionVar(ctx(), { collectionUid: 'coll-prod', variable });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-prod',
      path: COLLECTION_VARS_PATH,
      itemId: 'var-aaaa',
      item: variable,
    });
    expect(intent.sideEffects).toEqual([{ kind: INVALIDATE_RESOLVER, key: 'coll-prod', hlc: ctx().hlc }]);
  });

  it('honors explicit orderKey when provided', () => {
    const variable = v({ uid: 'var-bbbb', name: 'API_KEY', value: 'k', type: 'secret' });
    const intent = setCollectionVar(ctx(), { collectionUid: 'coll-prod', variable, orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'var-bbbb',
      item: variable,
      orderKey: 'm',
    });
  });

  it('shares a batchId across multiple mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setCollectionVar(c, { collectionUid: 'c', variable: v() });
    expect(a.batch.batchId).toBe('batch-shared');
  });

  it('rename is a re-emit at the same uid with a new name', () => {
    const renamed = v({ name: 'BASE_URL' });
    const intent = setCollectionVar(ctx(), { collectionUid: 'coll-prod', variable: renamed });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'var-aaaa',
      item: { uid: 'var-aaaa', name: 'BASE_URL' },
    });
  });
});

describe('removeCollectionVar', () => {
  it('emits removeFromSet with itemId = uid', () => {
    const intent = removeCollectionVar(ctx(), { collectionUid: 'coll-prod', uid: 'var-aaaa' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: COLLECTION_ENTITY_TYPE,
      id: 'coll-prod',
      path: COLLECTION_VARS_PATH,
      itemId: 'var-aaaa',
    });
  });
});
