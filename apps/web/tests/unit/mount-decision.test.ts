/**
 * Mount-decision helpers — the seed policy the web host moved out of
 * bootstrap (A4: `seedOnEmpty: false`) and onto the mount decision. A
 * never-joined browser seeds exactly once through the ordinary create
 * path; a joined tab never seeds; and the Workbench's active-workspace
 * assumption is restored by promoting the first workspace in sort
 * order when adoption left the pointer unset or dangling.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokenModule = vi.hoisted(() => ({
  hasDaemonToken: vi.fn(() => false),
}));
vi.mock('@/host/daemon-token', () => tokenModule);

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const store = vi.hoisted(() => {
  const state = {
    workspaces: [] as Array<{ id: string; name: string }>,
    active: null as string | null,
  };
  return {
    state,
    DEFAULT_WORKSPACE_NAME: 'Workspace',
    DEFAULT_WORKSPACE_COLOR: 'neutral',
    createWorkspace: vi.fn(async (input: { name: string }) => {
      const ws = { id: `ws-${state.workspaces.length + 1}`, name: input.name };
      state.workspaces.push(ws);
      return ws;
    }),
    setActiveWorkspaceById: vi.fn(async (id: string) => {
      state.active = id;
    }),
    listWorkspaces: vi.fn(() => [...state.workspaces]),
    peekActiveWorkspaceId: vi.fn(() => state.active),
  };
});
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => store);

import {
  hasUsableActiveWorkspace,
  promoteFirstWorkspaceWhenUnset,
  seedLocalWorkspaceIfNeverJoined,
} from '@/host/mount-decision';

beforeEach(() => {
  store.state.workspaces = [];
  store.state.active = null;
  store.createWorkspace.mockClear();
  store.setActiveWorkspaceById.mockClear();
  tokenModule.hasDaemonToken.mockReturnValue(false);
});

describe('seedLocalWorkspaceIfNeverJoined', () => {
  it('seeds the default workspace and sets it active on a never-joined empty store', async () => {
    await seedLocalWorkspaceIfNeverJoined();
    expect(store.createWorkspace).toHaveBeenCalledWith({ name: 'Workspace', color: 'neutral' });
    expect(store.state.workspaces).toHaveLength(1);
    expect(store.state.active).toBe(store.state.workspaces[0].id);
  });

  it('never seeds on a joined tab — a stored session means the server owns the workspaces', async () => {
    tokenModule.hasDaemonToken.mockReturnValue(true);
    await seedLocalWorkspaceIfNeverJoined();
    expect(store.createWorkspace).not.toHaveBeenCalled();
    expect(store.state.workspaces).toHaveLength(0);
  });

  it('never seeds over existing local workspaces', async () => {
    store.state.workspaces = [{ id: 'ws-existing', name: 'Home' }];
    store.state.active = 'ws-existing';
    await seedLocalWorkspaceIfNeverJoined();
    expect(store.createWorkspace).not.toHaveBeenCalled();
  });
});

describe('promoteFirstWorkspaceWhenUnset', () => {
  it('promotes the first workspace in sort order when the pointer is null', async () => {
    store.state.workspaces = [
      { id: 'ws-a', name: 'A' },
      { id: 'ws-b', name: 'B' },
    ];
    await promoteFirstWorkspaceWhenUnset();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledWith('ws-a');
    expect(store.state.active).toBe('ws-a');
  });

  it('promotes when the pointer dangles at a workspace no longer in the list', async () => {
    store.state.workspaces = [{ id: 'ws-b', name: 'B' }];
    store.state.active = 'ws-gone';
    await promoteFirstWorkspaceWhenUnset();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledWith('ws-b');
  });

  it('is a no-op when a live workspace is already active', async () => {
    store.state.workspaces = [{ id: 'ws-a', name: 'A' }];
    store.state.active = 'ws-a';
    await promoteFirstWorkspaceWhenUnset();
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
  });

  it('is a no-op on an empty list — the awaiting-access screen owns that state', async () => {
    await promoteFirstWorkspaceWhenUnset();
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
  });
});

describe('hasUsableActiveWorkspace', () => {
  it('is false for a null pointer, false for a dangling one, true for a live one', () => {
    expect(hasUsableActiveWorkspace()).toBe(false);
    store.state.workspaces = [{ id: 'ws-a', name: 'A' }];
    store.state.active = 'ws-gone';
    expect(hasUsableActiveWorkspace()).toBe(false);
    store.state.active = 'ws-a';
    expect(hasUsableActiveWorkspace()).toBe(true);
  });
});
