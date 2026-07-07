/**
 * Coverage for the runtime MCP tools — workspace create/switch and
 * environment switch. The harness boots the real global sync service
 * (in-memory persistence) plus the workspace-coord runner wired the
 * same way `bootSyncEngine` wires it, so a switch exercises the actual
 * setActive batch → coordinator swap → environment-store hydration
 * chain, not a fake.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  bridgeEnvironmentSyncEngine,
  getActiveEnvironmentId,
  getLoadedWorkspaceId,
  hydrateEnvironmentsFromStorage,
  __resetForTests as resetEnvironmentStore,
} from '@openheaders/oracle/entity/environment-store';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import {
  __initGlobalSyncServiceForTests,
  attachGlobalWorkspaceCoordRunner,
  disposeGlobal,
} from '@openheaders/oracle/sync/global-service';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  getOracleForWorkspace,
  setRuntimeActive,
  snapshotCollectionPostStates,
  snapshotRequestCollectionPostStates,
} from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  listWorkspaces,
  peekActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { swapPerWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import { createRuntimeToolDefinitions } from '../../src/mcp/tools/runtime-tools';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const CTX = { tokenId: 'token-1' };

const tools = new Map<string, McpToolDefinition>(
  [...createRuntimeToolDefinitions(), ...createWriteToolDefinitions()].map((t) => [t.name, t]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler(args, CTX) as Promise<Record<string, unknown>>;
}

interface WorkspaceRow {
  id: string;
  name: string;
  active: boolean;
  loaded: boolean;
}

beforeEach(async () => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  resetWorkspaceStore();
  resetEnvironmentStore();
  setOracleHostHooks({ getActiveWorkspaceId, peekActiveWorkspaceId });

  // Same boot spine as `bootSyncEngine`, on in-memory test deps.
  __initGlobalSyncServiceForTests();
  await bootstrapWorkspaces();
  await bridgeExtensionWorkspaceSyncEngine();
  __initSyncServiceForTests(getActiveWorkspaceId());
  await hydrateEnvironmentsFromStorage();
  await bridgeEnvironmentSyncEngine();
  attachGlobalWorkspaceCoordRunner({
    getActiveWorkspaceId: peekActiveWorkspaceId,
    swap: async (newId) => {
      await swapPerWorkspaceStores(newId);
      await setRuntimeActive(newId);
      await bridgeEnvironmentSyncEngine();
    },
    purge: async () => {},
  });
});

afterEach(() => {
  disposeGlobal();
  disposeSyncService();
  resetWorkspaceStore();
  resetEnvironmentStore();
});

describe('workspaces_create', () => {
  it('creates a background workspace and reports honest loaded state', async () => {
    const before = getActiveWorkspaceId();
    const result = (await call('workspaces_create', { name: 'Second' })) as {
      activeWorkspaceId: string;
      workspace: WorkspaceRow;
    };
    expect(result.workspace.name).toBe('Second');
    expect(result.workspace.active).toBe(false);
    expect(result.workspace.loaded).toBe(false);
    expect(result.activeWorkspaceId).toBe(before);
    expect(listWorkspaces().some((ws) => ws.id === result.workspace.id)).toBe(true);
  });

  it('activate: true switches to the new workspace before returning', async () => {
    const result = (await call('workspaces_create', { name: 'Second', activate: true })) as {
      activeWorkspaceId: string;
      workspace: WorkspaceRow;
    };
    expect(result.workspace.active).toBe(true);
    expect(result.workspace.loaded).toBe(true);
    expect(result.activeWorkspaceId).toBe(result.workspace.id);
    expect(getLoadedWorkspaceId()).toBe(result.workspace.id);
  });
});

describe('workspaces_switch', () => {
  it('flips the active workspace and settles the per-workspace store swap', async () => {
    const first = getActiveWorkspaceId();
    const created = (await call('workspaces_create', { name: 'Second' })) as { workspace: WorkspaceRow };

    const result = (await call('workspaces_switch', { workspaceId: created.workspace.id })) as {
      activeWorkspaceId: string;
      previousWorkspaceId: string;
      workspace: WorkspaceRow;
    };
    expect(result.previousWorkspaceId).toBe(first);
    expect(result.activeWorkspaceId).toBe(created.workspace.id);
    expect(result.workspace.active).toBe(true);
    expect(result.workspace.loaded).toBe(true);
    expect(peekActiveWorkspaceId()).toBe(created.workspace.id);
    expect(getLoadedWorkspaceId()).toBe(created.workspace.id);
    expect(getOracleForWorkspace(created.workspace.id)).not.toBeNull();
  });

  it('is a no-op when the workspace is already active', async () => {
    const active = getActiveWorkspaceId();
    const result = (await call('workspaces_switch', { workspaceId: active })) as {
      activeWorkspaceId: string;
      previousWorkspaceId: string;
    };
    expect(result.activeWorkspaceId).toBe(active);
    expect(result.previousWorkspaceId).toBe(active);
  });

  it('errors on an unknown workspace id', async () => {
    await expect(call('workspaces_switch', { workspaceId: 'ghost' })).rejects.toThrow(/workspaces_list/);
  });
});

describe('environments_switch', () => {
  it('switches the active environment and back to "No environment"', async () => {
    const created = (await call('environments_create', { name: 'Staging' })) as {
      environment: { uid: string };
    };

    const switched = (await call('environments_switch', { environmentId: created.environment.uid })) as {
      activeEnvironmentId: string;
      environment: { uid: string; name: string };
    };
    expect(switched.activeEnvironmentId).toBe(created.environment.uid);
    expect(switched.environment.name).toBe('Staging');
    expect(getActiveEnvironmentId()).toBe(created.environment.uid);

    const cleared = (await call('environments_switch', { environmentId: null })) as {
      activeEnvironmentId: string | null;
      environment: null;
    };
    expect(cleared.activeEnvironmentId).toBeNull();
    expect(cleared.environment).toBeNull();
    expect(getActiveEnvironmentId()).toBeNull();
  });

  it('errors on an unknown environment uid', async () => {
    await expect(call('environments_switch', { environmentId: 'ghost' })).rejects.toThrow(/environments_list/);
  });

  it('rejects a background workspace with a pointer at workspaces_switch', async () => {
    const created = (await call('workspaces_create', { name: 'Second' })) as { workspace: WorkspaceRow };
    // Materialize the background workspace so the loaded-gate passes and
    // the runtime-active gate is what rejects.
    const active = getActiveWorkspaceId();
    await call('workspaces_switch', { workspaceId: created.workspace.id });
    await call('workspaces_switch', { workspaceId: active });
    await expect(
      call('environments_switch', { workspaceId: created.workspace.id, environmentId: null }),
    ).rejects.toThrow(/workspaces_switch/);
  });
});

describe('variables_set (collection scope)', () => {
  it('upserts into a rule collection scope by collectionId', async () => {
    const rule = (await call('rules_create', {
      rule: {
        name: 'Header rule',
        type: 'header',
        enabled: true,
        conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Api-Key', value: '{{apiKey}}' }],
          responseHeaders: [],
        },
      },
    })) as { rule: { path: string } };
    expect(rule.rule.path.startsWith('rules/')).toBe(true);

    // The ensure-on-demand default collection was minted by rules_create.
    const workspaceId = getActiveWorkspaceId();
    const [collection] = snapshotCollectionPostStates(workspaceId);

    const first = (await call('variables_set', {
      collectionId: collection.collection.uid,
      name: 'apiKey',
      value: 'abc',
    })) as { scope: string; collection: { uid: string }; variable: { updated: boolean } };
    expect(first.scope).toBe('collection:rules');
    expect(first.collection.uid).toBe(collection.collection.uid);
    expect(first.variable.updated).toBe(false);

    const second = (await call('variables_set', {
      collectionId: collection.collection.uid,
      name: 'apiKey',
      value: 'xyz',
    })) as { variable: { updated: boolean } };
    expect(second.variable.updated).toBe(true);

    const [after] = snapshotCollectionPostStates(workspaceId);
    const rows = after.collection.variables.filter((row) => row.name === 'apiKey');
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('xyz');
  });

  it('upserts into a request collection scope by collectionId', async () => {
    await call('requests_save', { request: { name: 'Echo', url: 'https://api.openheaders.io/echo' } });
    const workspaceId = getActiveWorkspaceId();
    const [collection] = snapshotRequestCollectionPostStates(workspaceId);

    const result = (await call('variables_set', {
      collectionId: collection.collection.uid,
      name: 'baseUrl',
      value: 'https://api.openheaders.io',
    })) as { scope: string };
    expect(result.scope).toBe('collection:requests');

    const [after] = snapshotRequestCollectionPostStates(workspaceId);
    expect(after.collection.variables.map((row) => row.name)).toContain('baseUrl');
  });

  it('errors on an unknown collectionId', async () => {
    await expect(call('variables_set', { collectionId: 'ghost', name: 'x', value: 'y' })).rejects.toThrow(
      McpToolInputError,
    );
  });
});
