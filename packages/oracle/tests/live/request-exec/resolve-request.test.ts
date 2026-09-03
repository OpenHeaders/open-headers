/**
 * resolveRequest — the inherited settings leg over the REAL resolver
 * and a real tree oracle (only the entity-store leaves are mocked):
 * an ancestor's knob reaches the resolved request when the request
 * leaves it absent, the request's own knob shadows it, the proxy trio
 * rides as one unit with its vault credential, an inherited SNI
 * template resolves through the scope and gates like the request's
 * own, the inherited cookie jar keys on the workspace, and the
 * attribution names the ancestor-supplied knobs in the HTTP key order
 * — absent when nothing came from above.
 */

import type { Collection, Environment, Folder, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRequest, UnresolvedRequestError } from '../../../src/live/request-exec/resolve-request';
import { treeOracleFrom } from './tree-oracle';

// ── Entity-store leaves (the only host-state the resolver reads) ──────

const wsVars = vi.fn<() => WorkspaceVariables>(() => ({ schemaVersion: 5, variables: [] }));
const vault = vi.fn<() => Vault>(() => ({ schemaVersion: 5, secrets: [] }));
const environments = vi.fn<() => Environment[]>(() => []);

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => environments(),
  getEnvironmentsForWorkspace: () => environments(),
  getVault: () => vault(),
  getVaultForWorkspace: () => vault(),
  getWorkspaceVariables: () => wsVars(),
  getWorkspaceVariablesForWorkspace: () => wsVars(),
}));
const requestCollections = vi.fn<() => Collection[]>(() => []);
const requestFolders = vi.fn<() => Folder[]>(() => []);

vi.mock('../../../src/entity/request-store', () => ({
  getRequest: () => null,
  getRequestInWorkspace: () => null,
  getRequestCollections: () => requestCollections(),
  getRequestCollectionsForWorkspace: () => requestCollections(),
  getRequestFolders: () => requestFolders(),
  getRequestFoldersForWorkspace: () => requestFolders(),
}));
// The ancestor walk reads the tree index off the workspace oracle —
// built from the mocked lists above, every folder slotted under the
// parent its path names; the request nets by its stored path.
vi.mock('../../../src/sync/service/accessors', () => ({
  getOracleForCurrentWorkspace: () => treeOracleFrom(requestCollections(), requestFolders()).oracle,
  getOracleForWorkspace: () => treeOracleFrom(requestCollections(), requestFolders()).oracle,
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
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: async () => null,
}));
vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
  peekActiveWorkspaceId: () => 'ws-active',
}));
vi.mock('../../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => [],
}));

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    uid: 'rcol0001',
    path: 'requests/api-rcol0001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

function makeFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    schemaVersion: 5,
    uid: 'rfold001',
    path: 'requests/api-rcol0001/auth-rfold001',
    name: 'Auth',
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/api-rcol0001/auth-rfold001/ping-req00001',
    name: 'Ping',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function seed(collection: Collection, folder: Folder): void {
  requestCollections.mockReturnValue([collection]);
  requestFolders.mockReturnValue([folder]);
}

beforeEach(() => {
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
  wsVars.mockReturnValue({ schemaVersion: 5, variables: [] });
  vault.mockReturnValue({ schemaVersion: 5, secrets: [] });
});

describe('resolveRequest — inherited settings', () => {
  it("an ancestor's knob reaches the resolved request; the innermost level wins; the attribution rides in key order", async () => {
    seed(
      makeCollection({ settings: { timeoutMs: 30_000, sslVerification: false, followRedirects: false } }),
      makeFolder({ settings: { timeoutMs: 5_000 } }),
    );
    const { resolved } = await resolveRequest(makeRequest(), {});
    expect(resolved.timeoutMs).toBe(5_000);
    expect(resolved.sslVerification).toBe(false);
    expect(resolved.followRedirects).toBe(false);
    expect(resolved.inheritedSettings).toEqual([
      { key: 'sslVerification', level: 'collection', uid: 'rcol0001', name: 'API' },
      { key: 'followRedirects', level: 'collection', uid: 'rcol0001', name: 'API' },
      { key: 'timeoutMs', level: 'folder', uid: 'rfold001', name: 'Auth' },
    ]);
  });

  it("the request's own knob shadows every ancestor's, whatever its value, and is never attributed", async () => {
    seed(makeCollection({ settings: { timeoutMs: 30_000, sslVerification: false } }), makeFolder());
    const { resolved } = await resolveRequest(makeRequest({ timeoutMs: 1_000, sslVerification: true }), {});
    expect(resolved.timeoutMs).toBe(1_000);
    expect(resolved.sslVerification).toBe(true);
    expect(resolved.inheritedSettings).toBeUndefined();
  });

  it('the proxy trio rides as one unit from the level that sets the mode, its credential resolved from the vault', async () => {
    vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [{ uid: 'sec00001', name: 'corp-proxy', kind: 'string', value: 'jdoe:s3cret' }],
    });
    seed(
      makeCollection({
        settings: { proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080', proxyCredentialRef: 'corp-proxy' },
      }),
      makeFolder(),
    );
    const { resolved } = await resolveRequest(makeRequest(), {});
    expect(resolved.proxyMode).toBe('url');
    expect(resolved.proxyUrl).toBe('http://proxy.openheaders.io:8080');
    expect(resolved.proxyCredentialRef).toBe('corp-proxy');
    expect(resolved.proxyCredential).toBe('jdoe:s3cret');
    expect(resolved.inheritedSettings?.map((s) => s.key)).toEqual(['proxyMode', 'proxyUrl', 'proxyCredentialRef']);
  });

  it("a request's own `direct` mode shadows the collection's proxy route whole — no URL leaks down", async () => {
    seed(
      makeCollection({ settings: { proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080' } }),
      makeFolder(),
    );
    const { resolved } = await resolveRequest(makeRequest({ proxyMode: 'direct' }), {});
    expect(resolved.proxyMode).toBe('direct');
    expect(resolved.proxyUrl).toBeUndefined();
    expect(resolved.inheritedSettings).toBeUndefined();
  });

  it('an inherited SNI template resolves through the scope like the URL', async () => {
    wsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: 'var00001', name: 'EDGE', value: 'edge-eu', type: 'default' }],
    });
    seed(makeCollection({ settings: { sniServerName: '{{EDGE}}.openheaders.io' } }), makeFolder());
    const { resolved } = await resolveRequest(makeRequest(), {});
    expect(resolved.sniServerName).toBe('edge-eu.openheaders.io');
    expect(resolved.inheritedSettings).toEqual([
      { key: 'sniServerName', level: 'collection', uid: 'rcol0001', name: 'API' },
    ]);
  });

  it('an inherited SNI template nobody defines fails the resolvability gate — nothing literal ships', async () => {
    seed(makeCollection({ settings: { sniServerName: '{{EDGE}}.openheaders.io' } }), makeFolder());
    await expect(resolveRequest(makeRequest(), {})).rejects.toBeInstanceOf(UnresolvedRequestError);
  });

  it('an inherited cookie jar keys on the workspace the run resolved against', async () => {
    seed(makeCollection({ settings: { cookieJar: true } }), makeFolder());
    const { resolved } = await resolveRequest(makeRequest(), {});
    expect(resolved.cookieJarKey).toBe('ws-active');
    const pinned = await resolveRequest(makeRequest(), { workspaceId: 'ws-1' });
    expect(pinned.resolved.cookieJarKey).toBe('ws-1');
  });

  it('a request with no ancestors resolves its own knobs, unattributed', async () => {
    const { resolved } = await resolveRequest(makeRequest({ uid: 'req00009', path: 'scratch/x', timeoutMs: 700 }), {});
    expect(resolved.timeoutMs).toBe(700);
    expect(resolved.inheritedSettings).toBeUndefined();
  });
});
