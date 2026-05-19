import { describe, expect, it } from 'vitest';
import type { Variable } from '../../../../src/types/variable';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_MUTATOR_VERSION,
  REQUEST_COLLECTION_VARS_PATH,
  removeRequestCollectionVar,
  setRequestCollectionVar,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 5_000, logical: 1, nodeId: 'node-y' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const v = (overrides: Partial<Variable> = {}): Variable => ({
  uid: 'var-aaaa',
  name: 'BASE_URL',
  value: 'https://api.openheaders.io',
  type: 'default',
  ...overrides,
});

describe('setRequestCollectionVar', () => {
  it('emits an addToSet at the request-collection variables path with itemId = uid', () => {
    const variable = v();
    const intent = setRequestCollectionVar(ctx(), { requestCollectionUid: 'rcol-prod', variable });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(REQUEST_COLLECTION_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      id: 'rcol-prod',
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: 'var-aaaa',
      item: variable,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'rcol-prod', hlc: ctx().hlc },
    ]);
  });

  it('rename is a re-emit at the same uid with a new name', () => {
    const renamed = v({ name: 'API_BASE' });
    const intent = setRequestCollectionVar(ctx(), { requestCollectionUid: 'rcol-prod', variable: renamed });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'var-aaaa',
      item: { uid: 'var-aaaa', name: 'API_BASE' },
    });
  });
});

describe('removeRequestCollectionVar', () => {
  it('emits a removeFromSet with itemId = uid', () => {
    const intent = removeRequestCollectionVar(ctx(), { requestCollectionUid: 'rcol-prod', uid: 'var-aaaa' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: REQUEST_COLLECTION_ENTITY_TYPE,
      path: REQUEST_COLLECTION_VARS_PATH,
      itemId: 'var-aaaa',
    });
  });
});
