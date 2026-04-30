import { describe, expect, it } from 'vitest';
import {
  EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACE_MUTATOR_VERSION,
  EXTENSION_WORKSPACES_SET_PATH,
  type ExtensionWorkspaceSlot,
  moveExtensionWorkspaceBefore,
  type MutatorContext,
  removeExtensionWorkspace,
  setActiveExtensionWorkspace,
  setExtensionWorkspace,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: '__global__',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const slot = (overrides: Partial<ExtensionWorkspaceSlot> = {}): ExtensionWorkspaceSlot => ({
  id: 'ws-abc',
  kind: 'personal',
  name: 'Workspace A',
  color: 'blue',
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  ...overrides,
});

describe('setExtensionWorkspace', () => {
  it('emits one addToSet on the singleton with itemId = workspace id', () => {
    const intent = setExtensionWorkspace(ctx(), { slot: slot(), orderKey: 'm' });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(EXTENSION_WORKSPACE_MUTATOR_VERSION);
    expect(env.body).toMatchObject({
      kind: 'addToSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: 'ws-abc',
      item: slot(),
      orderKey: 'm',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it('preserves optional fields when present', () => {
    const fancy = slot({ icon: 'rocket', description: 'Notes', source: { desktopWorkspaceId: 'd-1' } });
    const intent = setExtensionWorkspace(ctx(), { slot: fancy, orderKey: 'n' });
    expect(intent.batch.mutations[0].body).toMatchObject({ item: fancy });
  });
});

describe('removeExtensionWorkspace', () => {
  it('emits a single removeFromSet keyed by workspace id', () => {
    const intent = removeExtensionWorkspace(ctx(), { id: 'ws-gone' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'removeFromSet',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: 'ws-gone',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('moveExtensionWorkspaceBefore', () => {
  it('emits a single moveBefore with envelope-resident orderKey', () => {
    const intent = moveExtensionWorkspaceBefore(ctx(), { id: 'ws-1', orderKey: 'g' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACES_SET_PATH,
      itemId: 'ws-1',
      orderKey: 'g',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setActiveExtensionWorkspace', () => {
  it('emits a single setField on the activeId path', () => {
    const intent = setActiveExtensionWorkspace(ctx(), { id: 'ws-active' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      type: EXTENSION_WORKSPACE_ENTITY_TYPE,
      id: EXTENSION_WORKSPACE_ID,
      path: EXTENSION_WORKSPACE_ACTIVE_ID_PATH,
      value: 'ws-active',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('shared batchId via context', () => {
  it('threads the supplied batchId across delete + active-pointer pair', () => {
    const shared = ctx({ batchId: 'B7' });
    const remove = removeExtensionWorkspace(shared, { id: 'ws-1' });
    const active = setActiveExtensionWorkspace(shared, { id: 'ws-2' });
    expect(remove.batch.batchId).toBe('B7');
    expect(active.batch.batchId).toBe('B7');
  });
});
