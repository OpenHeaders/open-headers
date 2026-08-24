/**
 * Join → adopt decision (A10): the WELCOME pointer is a hint, not the
 * target. Pins: the hint adopts when it syncs down; a hint the user
 * cannot read falls back — once the `__global__` catch-up has SYNCED —
 * to the first consumed workspace in sort order; a zero-grant join
 * stays armed so the first live grant adopts in place; exactly one
 * adoption per arm; and the fan-out priority is the hint until
 * adoption, the adopted workspace after.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const identity = vi.hoisted(() => ({
  bindings: new Map<string, string>(),
}));
vi.mock('@openheaders/core/identity', () => ({
  getOrgBackendBindings: () => identity.bindings,
}));

const store = vi.hoisted(() => {
  const state = {
    workspaces: [] as Array<{ id: string; orgId: string }>,
    active: null as string | null,
  };
  return {
    state,
    getWorkspace: vi.fn((id: string) => state.workspaces.find((w) => w.id === id) ?? null),
    listWorkspaces: vi.fn(() => [...state.workspaces]),
    setActiveWorkspaceById: vi.fn(async (id: string) => {
      state.active = id;
    }),
  };
});
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => store);

import { WEB_DAEMON_BACKEND_ID } from '@/host/web-backend-id';
import { consumedWorkspaceIds, createWireAdoption } from '@/host/wire-adoption';

const SERVER_ORG = 'org-server';
const LOCAL_ORG = 'org-local';

function addWorkspace(id: string, orgId = SERVER_ORG): void {
  store.state.workspaces.push({ id, orgId });
}

beforeEach(() => {
  store.state.workspaces = [];
  store.state.active = null;
  store.setActiveWorkspaceById.mockClear();
  identity.bindings = new Map([[SERVER_ORG, WEB_DAEMON_BACKEND_ID]]);
});

describe('consumedWorkspaceIds', () => {
  it('lists only workspaces whose Org is bound to the serving daemon, in sort order', () => {
    addWorkspace('ws-a');
    addWorkspace('ws-local', LOCAL_ORG);
    addWorkspace('ws-b');
    expect(consumedWorkspaceIds()).toEqual(['ws-a', 'ws-b']);
  });
});

describe('createWireAdoption', () => {
  it('adopts the hint when it syncs down', () => {
    const adoption = createWireAdoption();
    adoption.arm('ws-hint');
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
    addWorkspace('ws-hint');
    adoption.recheck();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledWith('ws-hint');
  });

  it('falls back to the first consumed workspace once __global__ has synced and the hint never arrived', () => {
    const adoption = createWireAdoption();
    adoption.arm('ws-not-granted');
    addWorkspace('ws-b');
    adoption.recheck();
    // The hint gets the whole catch-up to arrive before the fallback.
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
    adoption.markGlobalSynced();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledWith('ws-b');
  });

  it('never falls back onto a workspace outside the daemon binding', () => {
    const adoption = createWireAdoption();
    adoption.arm(null);
    addWorkspace('ws-local', LOCAL_ORG);
    adoption.markGlobalSynced();
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
  });

  it('stays armed on a zero-grant join and adopts the first live grant in place', () => {
    const adoption = createWireAdoption();
    adoption.arm(null);
    adoption.markGlobalSynced();
    expect(store.setActiveWorkspaceById).not.toHaveBeenCalled();
    addWorkspace('ws-granted-later');
    adoption.recheck();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledWith('ws-granted-later');
  });

  it('disarms after one adoption — later store changes never re-adopt', () => {
    const adoption = createWireAdoption();
    adoption.arm('ws-hint');
    addWorkspace('ws-hint');
    adoption.recheck();
    addWorkspace('ws-other');
    adoption.markGlobalSynced();
    adoption.recheck();
    expect(store.setActiveWorkspaceById).toHaveBeenCalledTimes(1);
  });

  it('sequences the hint first before adoption and the adopted workspace after', () => {
    const adoption = createWireAdoption();
    expect(adoption.priorityWorkspaceId()).toBeNull();
    adoption.arm('ws-hint');
    expect(adoption.priorityWorkspaceId()).toBe('ws-hint');
    addWorkspace('ws-b');
    adoption.markGlobalSynced();
    expect(adoption.priorityWorkspaceId()).toBe('ws-b');
  });
});
