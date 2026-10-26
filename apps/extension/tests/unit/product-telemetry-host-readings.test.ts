/**
 * The extension's readings for the state block (the telemetry v2 plan
 * §3) read the slots the popup writes: the runtime-active workspace's
 * rule projection (`wsKeys(active).rules`, the S31 pin), the saved
 * requests across every workspace and protocol, the connection records
 * (the desktop app's own loopback wire is pairing, anything else is a
 * server) and the directory grants this host holds — with the workspace
 * list and the active pointer from the workspace store, never from its
 * storage mirror (a fresh install's first flush runs before the mirror
 * is written). The plan is `free` on every extension by construction.
 */

import { type HostStorage, OH, setHostStorage, wsKeys } from '@openheaders/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, unknown> = {};
let workspaceList: Array<{ id: string }> = [];
let activeWorkspace: string | null = null;

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  listWorkspaces: () => workspaceList,
  peekActiveWorkspaceId: () => activeWorkspace,
}));

beforeEach(() => {
  store = {};
  workspaceList = [];
  activeWorkspace = null;
  const fake: Partial<HostStorage> = {
    get: vi.fn(async (spec: { key: string }) => store[spec.key]) as HostStorage['get'],
  };
  setHostStorage(fake as HostStorage);
});

async function loadModule() {
  return import('../../src/background/modules/product-telemetry');
}

describe('readHostState', () => {
  it('counts the active workspace rule projection, the saved requests across workspaces, and the list', async () => {
    const { readHostState } = await loadModule();
    workspaceList = [{ id: 'ws-a' }, { id: 'ws-b' }];
    activeWorkspace = 'ws-b';
    store[wsKeys('ws-a').rules.key] = [{ id: 'r1' }];
    store[wsKeys('ws-b').rules.key] = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }];
    store[wsKeys('ws-a').requests.key] = [{ uid: 'q1' }, { uid: 'q2' }];
    store[wsKeys('ws-b').grpcRequests.key] = [{ uid: 'g1' }];
    store[wsKeys('ws-b').mqttRequests.key] = [{ uid: 'm1' }];
    expect(await readHostState()).toEqual({
      rules: 3,
      requests: 4,
      workspaces: 2,
      sync: 'local',
      role: 'none',
      team: 1,
      plan: 'free',
    });
  });

  it('falls back to the first listed workspace when the store has no active pointer', async () => {
    const { readHostState } = await loadModule();
    workspaceList = [{ id: 'ws-a' }];
    store[wsKeys('ws-a').rules.key] = [{ id: 'r1' }];
    expect(await readHostState()).toMatchObject({ rules: 1, requests: 0, workspaces: 1 });
  });

  it('reads the list from the store and not its storage mirror, so a fresh install never reads zero workspaces', async () => {
    const { readHostState } = await loadModule();
    workspaceList = [{ id: 'ws-default' }];
    activeWorkspace = 'ws-default';
    expect(store[OH.workspaces.key]).toBeUndefined();
    expect(await readHostState()).toMatchObject({ rules: 0, requests: 0, workspaces: 1 });
  });

  it('omits the scale before the store is bootstrapped instead of reading it as zero', async () => {
    const { readHostState } = await loadModule();
    expect(await readHostState()).toEqual({ sync: 'local', role: 'none', team: 1, plan: 'free' });
  });

  it("reads local with only the desktop app's loopback wire, server once any record points elsewhere, and then knows no role", async () => {
    const { readHostState } = await loadModule();
    store[OH.backends.key] = [{ url: 'ws://127.0.0.1:8137' }, { url: 'ws://localhost:8137' }];
    expect(await readHostState()).toMatchObject({ sync: 'local', role: 'none', team: 1 });
    store[OH.backends.key] = [{ url: 'ws://127.0.0.1:8137' }, { url: 'wss://sync.openheaders.io' }];
    const joined = await readHostState();
    expect(joined.sync).toBe('server');
    expect(joined.role).toBeUndefined();
    expect(joined.team).toBeUndefined();
    store[OH.backends.key] = [{ url: 'ws://127.0.0.1:9000' }];
    expect((await readHostState()).sync).toBe('server');
  });

  it('reads owner and the largest workspace from the directory grants it holds, even when a server is joined too', async () => {
    const { readHostState } = await loadModule();
    store[OH.backends.key] = [{ url: 'wss://sync.openheaders.io' }];
    store[OH.workspaceRoleAssignments.key] = [
      { id: 'w1', principalId: 'p-self', workspaceId: 'ws-a', role: 'owner' },
      { id: 'w2', principalId: 'p-self', workspaceId: 'ws-b', role: 'owner' },
      { id: 'w3', principalId: 'p-ann', workspaceId: 'ws-a', role: 'editor' },
      { id: 'w4', principalId: 'p-bob', workspaceId: 'ws-a', role: 'viewer' },
      { id: 'w5', principalId: 'p-ann', workspaceId: 'ws-b', role: 'viewer' },
    ];
    expect(await readHostState()).toMatchObject({ sync: 'server', role: 'owner', team: 3 });
  });
});
