/**
 * `oh.*` host-RPC servicing — the vault.get op's OAuth leg: an expired
 * bundle refreshes at the token endpoint (rebuilt from the store's
 * config sidecar) before its access token answers the script, exactly
 * the executor's attach discipline; a failed or config-less refresh is
 * lenient and answers the stale token. String secrets and the never-
 * throw error envelope are pinned alongside.
 */

import type { ScriptHostRequest } from '@openheaders/core/scripts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  vault: vi.fn(() => ({ schemaVersion: 5, secrets: [] as Array<Record<string, unknown>> })),
  getTokenBundle: vi.fn(async (_ref: string, _wsId?: string): Promise<unknown> => null),
  getRefreshConfig: vi.fn(async (_ref: string, _wsId?: string): Promise<unknown> => null),
  putTokenBundle: vi.fn(async (): Promise<void> => {}),
}));

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getEnvironments: () => [],
  getVault: () => h.vault(),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: (ref: string, wsId?: string) => h.getTokenBundle(ref, wsId),
  getRefreshConfig: (ref: string, wsId?: string) => h.getRefreshConfig(ref, wsId),
  putTokenBundle: (...args: unknown[]) => h.putTokenBundle(...(args as [])),
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: () => null,
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
}));
vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: () => [],
}));
vi.mock('@openheaders/oracle/sync', () => ({
  makeOracleInverseAccess: () => ({}),
  rememberPriorForMutation: () => {},
}));
vi.mock('@openheaders/oracle/sync/service', () => ({
  applySyncRequest: async () => ({ ok: true }),
  getOracleForWorkspace: () => null,
  nextSwMutatorContext: () => null,
}));
vi.mock('../../../src/daemon/execute-request-rpc', () => ({
  handleExecuteRequestRpc: async () => ({ success: false, error: 'not under test' }),
}));

import { __resetRateLimiterForTests } from '@openheaders/oracle/live/request-exec/rate-limiter';
import { handleScriptHostRequest } from '../../../src/daemon/script-host-rpc';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function vaultGet(ref: string): ScriptHostRequest {
  return { op: 'vault.get', ref, executionId: 'e1', rpcId: 'r1' } as ScriptHostRequest;
}

function bundle(overrides: Record<string, unknown> = {}) {
  return {
    accessToken: 'at-stale',
    refreshToken: 'rt-1',
    tokenType: 'Bearer',
    expiresAt: Date.now() - 1000,
    issuedAt: Date.now() - 3_600_000,
    scope: '',
    ...overrides,
  };
}

const sidecarConfig = {
  type: 'oauth2',
  credentialRef: 'cred-1',
  flow: 'authorization-code-pkce',
  tokenEndpoint: 'https://auth.openheaders.io/token',
  clientId: 'client-1',
  scopes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimiterForTests();
  h.vault.mockReturnValue({ schemaVersion: 5, secrets: [] });
  h.getTokenBundle.mockResolvedValue(null);
  h.getRefreshConfig.mockResolvedValue(null);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: 'at-fresh' }), { status: 200 }));
});

describe('handleScriptHostRequest — vault.get', () => {
  it('answers a string vault secret verbatim', async () => {
    h.vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [{ uid: 's1', kind: 'string', name: 'api-key', value: 'k-1' }],
    });
    await expect(handleScriptHostRequest(vaultGet('api-key'))).resolves.toMatchObject({ ok: true, value: 'k-1' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired OAuth bundle from the config sidecar before answering', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    h.getRefreshConfig.mockResolvedValue(sidecarConfig);
    const reply = await handleScriptHostRequest(vaultGet('cred-1'));
    expect(reply).toMatchObject({ ok: true, value: 'at-fresh' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.openheaders.io/token');
    expect(h.putTokenBundle).toHaveBeenCalledOnce();
  });

  it('answers the stale token when the refresh fails — lenient, never an error reply', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    h.getRefreshConfig.mockResolvedValue(sidecarConfig);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-stale' });
  });

  it('answers the stale token when no config sidecar exists to rebuild the POST', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-stale' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the refresh for an unexpired bundle', async () => {
    h.getTokenBundle.mockResolvedValue(bundle({ accessToken: 'at-live', expiresAt: Date.now() + 3_600_000 }));
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-live' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers null for an unknown ref', async () => {
    await expect(handleScriptHostRequest(vaultGet('missing'))).resolves.toMatchObject({ ok: true, value: null });
  });
});
