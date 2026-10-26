import { describe, expect, it } from 'vitest';
import {
  ACTIVE_WORKSPACE_ENTITY_TYPE,
  ACTIVE_WORKSPACE_ID,
  ACTIVE_WORKSPACE_MUTATOR_VERSION,
  ACTIVE_WORKSPACE_PATH,
  deriveActiveWorkspaceSideEffects,
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  isHostLocalEntityType,
  isHostLocalMutation,
  type MutatorContext,
  SWAP_PER_WORKSPACE_STORES,
  setActiveWorkspace,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('setActiveWorkspace', () => {
  it('emits a single setField on the pointer singleton at path "workspaceId"', () => {
    const intent = setActiveWorkspace(ctx(), { id: 'ws-active' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(ACTIVE_WORKSPACE_MUTATOR_VERSION);
    expect(env.workspaceId).toBe(EXTENSION_WORKSPACE_GLOBAL_SCOPE);
    expect(env.body).toMatchObject({
      kind: 'setField',
      type: ACTIVE_WORKSPACE_ENTITY_TYPE,
      id: ACTIVE_WORKSPACE_ID,
      path: ACTIVE_WORKSPACE_PATH,
      value: 'ws-active',
    });
  });

  it('derives one SWAP_PER_WORKSPACE_STORES intent keyed by the pointer singleton', () => {
    const c = ctx();
    const intent = setActiveWorkspace(c, { id: 'ws-active' });
    expect(intent.sideEffects).toEqual([{ kind: SWAP_PER_WORKSPACE_STORES, key: ACTIVE_WORKSPACE_ID, hlc: c.hlc }]);
    expect(intent.batch.mutations.flatMap(deriveActiveWorkspaceSideEffects)).toEqual(intent.sideEffects);
  });

  it('is host-local — the pointer never crosses a wire in either direction', () => {
    const intent = setActiveWorkspace(ctx(), { id: 'ws-active' });
    expect(isHostLocalEntityType(ACTIVE_WORKSPACE_ENTITY_TYPE)).toBe(true);
    expect(isHostLocalMutation(intent.batch.mutations[0])).toBe(true);
  });

  it('honors caller-supplied batchId', () => {
    const intent = setActiveWorkspace(ctx({ batchId: 'B-9' }), { id: 'ws-active' });
    expect(intent.batch.batchId).toBe('B-9');
  });
});
