import { describe, expect, it } from 'vitest';
import {
  INVALIDATE_RESOLVER,
  type MutatorContext,
  removeWorkspaceVar,
  renameWorkspaceVar,
  setWorkspaceVar,
  setWorkspaceVarType,
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_MUTATOR_VERSION,
  WORKSPACE_VARIABLES_PATH,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setWorkspaceVar', () => {
  it('emits an addToSet on the singleton id with itemId = name', () => {
    const intent = setWorkspaceVar(ctx(), { name: 'API_URL', value: 'https://openheaders.io' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(WORKSPACE_VARIABLES_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'API_URL',
      item: { name: 'API_URL', value: 'https://openheaders.io', type: 'default' },
    });
    expect(intent.sideEffects).toEqual([
      { kind: INVALIDATE_RESOLVER, key: WORKSPACE_VARIABLES_ID, hlc: ctx().hlc },
    ]);
  });

  it('honors explicit type + orderKey', () => {
    const intent = setWorkspaceVar(ctx(), { name: 'TOKEN', value: 'abc', type: 'secret', orderKey: 'm' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
      orderKey: 'm',
    });
  });

  it('shares a batchId across mutations when ctx.batchId is set', () => {
    const c = ctx({ batchId: 'batch-shared' });
    const a = setWorkspaceVar(c, { name: 'A', value: '1' });
    expect(a.batch.batchId).toBe('batch-shared');
  });
});

describe('removeWorkspaceVar', () => {
  it('emits removeFromSet with itemId = name', () => {
    const intent = removeWorkspaceVar(ctx(), { name: 'API_URL' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: WORKSPACE_VARIABLES_ENTITY_TYPE,
      id: WORKSPACE_VARIABLES_ID,
      path: WORKSPACE_VARIABLES_PATH,
      itemId: 'API_URL',
    });
  });
});

describe('renameWorkspaceVar', () => {
  it('emits an atomic batch — removeFromSet(old) + addToSet(new) under one batchId', () => {
    const intent = renameWorkspaceVar(ctx(), {
      oldName: 'API_URL',
      newName: 'BASE_URL',
      value: 'https://openheaders.io',
    });
    expect(intent.batch.mutations).toHaveLength(2);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      itemId: 'API_URL',
      path: WORKSPACE_VARIABLES_PATH,
    });
    expect(intent.batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'BASE_URL',
      path: WORKSPACE_VARIABLES_PATH,
      item: { name: 'BASE_URL', value: 'https://openheaders.io', type: 'default' },
    });
  });

  it('is a no-op (empty batch) when oldName === newName', () => {
    const intent = renameWorkspaceVar(ctx(), { oldName: 'X', newName: 'X', value: 'v' });
    expect(intent.batch.mutations).toHaveLength(0);
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setWorkspaceVarType', () => {
  it('replaces the whole record via addToSet (LWW per itemId)', () => {
    const intent = setWorkspaceVarType(ctx(), { name: 'TOKEN', value: 'abc', type: 'secret' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      itemId: 'TOKEN',
      item: { name: 'TOKEN', value: 'abc', type: 'secret' },
    });
  });
});
