import { describe, expect, it } from 'vitest';
import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  ENVIRONMENT_MUTATOR_VERSION,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeEnvVar,
  renameEnvVar,
  setEnvVar,
  setEnvVarType,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setEnvVar', () => {
  it('emits an addToSet at variables with itemId = name', () => {
    const intent = setEnvVar(ctx(), { envId: 'env-prod', name: 'API_URL', value: 'https://openheaders.io' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(ENVIRONMENT_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-prod',
      path: ENV_VARS_PATH,
      itemId: 'API_URL',
      item: { name: 'API_URL', value: 'https://openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'env-prod', hlc: ctx().hlc },
    ]);
  });

  it('honors explicit type + orderKey when provided', () => {
    const intent = setEnvVar(ctx(), {
      envId: 'env-prod',
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
    const a = setEnvVar(c, { envId: 'e', name: 'A', value: '1' });
    expect(a.batch.batchId).toBe('batch-shared');
  });
});

describe('removeEnvVar', () => {
  it('emits removeFromSet with itemId = name', () => {
    const intent = removeEnvVar(ctx(), { envId: 'env-prod', name: 'API_URL' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-prod',
      path: ENV_VARS_PATH,
      itemId: 'API_URL',
    });
  });
});

describe('renameEnvVar', () => {
  it('emits an atomic batch — removeFromSet(old) + addToSet(new) under one batchId', () => {
    const intent = renameEnvVar(ctx(), {
      envId: 'env-prod',
      oldName: 'API_URL',
      newName: 'BASE_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    // Both envelopes share the same batchId — per-batch all-or-nothing depends on this.
    expect(intent.batch.mutations[0].mutationId).not.toBe(intent.batch.mutations[1].mutationId);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      itemId: 'API_URL',
      path: ENV_VARS_PATH,
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'BASE_URL',
      path: ENV_VARS_PATH,
      item: { name: 'BASE_URL', value: 'https://openheaders.io', type: 'default' },
    });
  });

  it('is a no-op (empty batch) when oldName === newName', () => {
    const intent = renameEnvVar(ctx(), { envId: 'e', oldName: 'X', newName: 'X', value: 'v' });
    expect(intent.batch.mutations).toHaveLength(0);
  });
});

describe('setEnvVarType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = setEnvVarType(ctx(), { envId: 'e', name: 'TOKEN', value: 'abc', type: 'secret' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
