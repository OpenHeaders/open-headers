/**
 * A run's resolver for a template outside a request — over the REAL
 * resolver with the entity stores mocked: the scopes a workflow has
 * answer, the run's captures are read by reference, a collection's
 * variable is out of reach, and a reference nothing answers throws with
 * its line.
 */

import type { Collection, Environment, WorkspaceVariables } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const wsVars = vi.fn<() => WorkspaceVariables>(() => ({ schemaVersion: 5, variables: [] }));
const environments = vi.fn<() => Environment[]>(() => []);
const requestCollections = vi.fn<() => Collection[]>(() => []);

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => environments(),
  getEnvironmentsForWorkspace: () => environments(),
  getVault: () => ({ schemaVersion: 5, secrets: [] }),
  getVaultForWorkspace: () => ({ schemaVersion: 5, secrets: [] }),
  getWorkspaceVariables: () => wsVars(),
  getWorkspaceVariablesForWorkspace: () => wsVars(),
}));
vi.mock('../../../src/entity/request-store', () => ({
  getRequestCollections: () => requestCollections(),
  getRequestCollectionsForWorkspace: () => requestCollections(),
}));
vi.mock('../../../src/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/files-store', () => ({
  getFileBlob: async () => null,
  listFiles: async () => [],
}));
vi.mock('../../../src/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));

import { createChainTemplateResolver } from '../../../src/live/request-exec/chain-template-resolver';

const CONTEXT = { workflowUid: 'wfdevice', workspaceId: 'ws-devices', environmentId: 'env00001' };

beforeEach(() => {
  wsVars.mockReturnValue({
    schemaVersion: 5,
    variables: [{ uid: 'var00001', name: 'DEVICE', value: 'dev-1', type: 'default' }],
  });
  environments.mockReturnValue([
    {
      schemaVersion: 5,
      uid: 'env00001',
      name: 'Staging',
      variables: [{ uid: 'var00002', name: 'OWNER', value: 'John Doe', type: 'default' }],
    },
  ]);
  requestCollections.mockReturnValue([]);
});

describe('a run’s resolver for a template outside a request', () => {
  it('resolves over the workspace, the run’s environment and the run’s captures', async () => {
    const resolve = createChainTemplateResolver();
    const captures = new Map([['reboot', new Map([['command', 'reboot']])]]);

    expect(await resolve('devices/{{DEVICE}}/status', captures, CONTEXT)).toBe('devices/dev-1/status');
    expect(await resolve('{{env.OWNER}} sent {{step.reboot.command}}', captures, CONTEXT)).toBe('John Doe sent reboot');
  });

  it('reads a capture made after its first template', async () => {
    const resolve = createChainTemplateResolver();
    const captures = new Map<string, Map<string, string>>();
    await resolve('{{DEVICE}}', captures, CONTEXT);

    captures.set('rename', new Map([['name', 'n-1']]));

    expect(await resolve('{{step.rename.name}}', captures, CONTEXT)).toBe('n-1');
  });

  it('has no collection in reach', async () => {
    requestCollections.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'rcol0001',
        path: 'requests/devices-rcol0001',
        name: 'Devices',
        variables: [{ uid: 'var00003', name: 'FLEET', value: 'north', type: 'default' }],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
      },
    ]);
    const resolve = createChainTemplateResolver();

    await expect(resolve('{{FLEET}}', new Map(), CONTEXT)).rejects.toThrow(
      '{{FLEET}}: Not found in vault, environment, collection, or workspace. Define it in one of those scopes.',
    );
  });

  it('throws with the line of every reference nothing answers', async () => {
    const resolve = createChainTemplateResolver();

    await expect(resolve('{{step.reboot.id}} for {{env.MISSING}}', new Map(), CONTEXT)).rejects.toThrow(
      '{{step.reboot.id}}: Step id or capture name not found in this workflow run. Check the workflow step configuration. ' +
        '{{env.MISSING}}: Set this variable in Environments → active environment (or in the default environment as a fallback).',
    );
  });
});
