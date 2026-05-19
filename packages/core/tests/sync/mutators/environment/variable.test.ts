import { describe, expect, it } from 'vitest';
import type { Variable } from '../../../../src/types/variable';
import {
  ENV_VARS_PATH,
  ENVIRONMENT_ENTITY_TYPE,
  ENVIRONMENT_MUTATOR_VERSION,
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeEnvVar,
  setEnvVar,
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

describe('setEnvVar', () => {
  it('emits an addToSet at variables with itemId = variable.uid', () => {
    const variable = v();
    const intent = setEnvVar(ctx(), { envId: 'env-prod', variable });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(ENVIRONMENT_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-prod',
      path: ENV_VARS_PATH,
      itemId: 'var-aaaa',
      item: variable,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: 'env-prod', hlc: ctx().hlc },
    ]);
  });

  it('honors explicit orderKey when provided + carries the full variable record', () => {
    const variable = v({ uid: 'var-bbbb', name: 'API_KEY', value: 'k', type: 'secret' });
    const intent = setEnvVar(ctx(), { envId: 'env-prod', variable, orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'var-bbbb',
      item: variable,
      orderKey: 'm',
    });
  });

  it('shares a batchId across multiple mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setEnvVar(c, { envId: 'e', variable: v() });
    expect(a.batch.batchId).toBe('batch-shared');
  });

  it('rename is a re-emit at the same uid with a new name (no separate primitive)', () => {
    const renamed = v({ name: 'BASE_URL' });
    const intent = setEnvVar(ctx(), { envId: 'env-prod', variable: renamed });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'var-aaaa',
      item: { uid: 'var-aaaa', name: 'BASE_URL' },
    });
  });
});

describe('removeEnvVar', () => {
  it('emits removeFromSet with itemId = uid', () => {
    const intent = removeEnvVar(ctx(), { envId: 'env-prod', uid: 'var-aaaa' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: ENVIRONMENT_ENTITY_TYPE,
      id: 'env-prod',
      path: ENV_VARS_PATH,
      itemId: 'var-aaaa',
    });
  });
});
