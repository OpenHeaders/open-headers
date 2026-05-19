import { describe, expect, it } from 'vitest';
import type { Variable } from '../../../../src/types/variable';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeWorkspaceVar,
  setWorkspaceVar,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_MUTATOR_VERSION,
  WORKSPACE_VARIABLES_PATH,
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

describe('setWorkspaceVar', () => {
  it('emits an addToSet on the singleton id with itemId = uid', () => {
    const variable = v();
    const intent = setWorkspaceVar(ctx(), { variable });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(WORKSPACE_VARIABLES_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'var-aaaa',
      item: variable,
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: WORKSPACE_VARIABLES_ID, hlc: ctx().hlc },
    ]);
  });

  it('honors explicit orderKey', () => {
    const variable = v({ uid: 'var-bbbb', name: 'TOKEN', value: 'abc', type: 'secret' });
    const intent = setWorkspaceVar(ctx(), { variable, orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'var-bbbb',
      item: variable,
      orderKey: 'm',
    });
  });

  it('shares a batchId across mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setWorkspaceVar(c, { variable: v() });
    expect(a.batch.batchId).toBe('batch-shared');
  });

  it('rename is a re-emit at the same uid with a new name', () => {
    const renamed = v({ name: 'BASE_URL' });
    const intent = setWorkspaceVar(ctx(), { variable: renamed });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'var-aaaa',
      item: { uid: 'var-aaaa', name: 'BASE_URL' },
    });
  });
});

describe('removeWorkspaceVar', () => {
  it('emits removeFromSet with itemId = uid', () => {
    const intent = removeWorkspaceVar(ctx(), { uid: 'var-aaaa' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'var-aaaa',
    });
  });
});
