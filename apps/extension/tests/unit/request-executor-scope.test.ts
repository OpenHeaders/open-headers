/**
 * The worker's resolver scope for a send that names its workspace: the
 * environment it resolves in is that workspace's active one unless the
 * dispatch names another, and the live scope reads the same environment
 * the env scope does.
 */

import type { Environment, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { type LiveRegistry, resolveTemplate } from '@openheaders/core/variables';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const activePointer = vi.fn<(workspaceId: string) => Promise<string | null>>(async () => null);
const liveRegistryFor = vi.fn<(workspaceId: string, environmentId: string | null) => LiveRegistry>(() => new Map());

const STAGING: Environment = {
  schemaVersion: 5,
  uid: 'env00001',
  name: 'Staging',
  variables: [{ uid: 'var00001', name: 'HOST', value: 'staging.openheaders.io', type: 'default' }],
};
const PRODUCTION: Environment = {
  schemaVersion: 5,
  uid: 'env00002',
  name: 'Production',
  variables: [{ uid: 'var00002', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
};
const EMPTY_VAULT: Vault = { schemaVersion: 5, secrets: [] };
const NO_VARIABLES: WorkspaceVariables = { schemaVersion: 5, variables: [] };

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getActiveEnvironmentIdForWorkspace: (workspaceId: string) => activePointer(workspaceId),
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => [],
  getEnvironmentsForWorkspace: () => [STAGING, PRODUCTION],
  getVault: () => EMPTY_VAULT,
  getVaultForWorkspace: () => EMPTY_VAULT,
  getWorkspaceVariables: () => NO_VARIABLES,
  getWorkspaceVariablesForWorkspace: () => NO_VARIABLES,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/files-store', () => ({
  listFiles: async () => [],
}));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: (workspaceId: string, environmentId: string | null) =>
    liveRegistryFor(workspaceId, environmentId),
}));

import { buildResolver } from '@/background/modules/request-executor/scope';

async function resolved(environmentId?: string | null): Promise<string> {
  const { resolver } = await buildResolver('ws-1', undefined, undefined, environmentId);
  const context = { environmentId };
  return resolveTemplate(
    'https://{{env.HOST}}/ping?token={{live.token}}',
    (name) => resolver.resolve(name, context),
    (name, namespace) => resolver.resolveScopedWithDiagnostics(name, namespace, context),
  ).result;
}

beforeEach(() => {
  activePointer.mockImplementation(async () => 'env00001');
  liveRegistryFor.mockImplementation((_workspaceId, environmentId) =>
    environmentId === null
      ? new Map()
      : new Map([['token', { value: `token-of-${environmentId}`, workflowUid: 'wf000001' }]]),
  );
});

describe('the scope of a send that names its workspace', () => {
  it("resolves in that workspace's active environment when the send names none", async () => {
    expect(await resolved()).toBe('https://staging.openheaders.io/ping?token=token-of-env00001');
    expect(activePointer).toHaveBeenCalledWith('ws-1');
  });

  it('resolves both scopes in the environment the dispatch names, over the active one', async () => {
    expect(await resolved('env00002')).toBe('https://api.openheaders.io/ping?token=token-of-env00002');
  });

  it('resolves in no environment when the dispatch says none, whatever the active one is', async () => {
    expect(await resolved(null)).toBe('https://{{env.HOST}}/ping?token={{live.token}}');
  });
});
