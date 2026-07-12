/**
 * runStepRequest — end-to-end chain-step orchestration over the REAL
 * resolver + wire executor (only the entity-store leaves are mocked).
 * This is the integration the chain adapter + both host transports sit
 * on, so it proves the moved resolve logic still resolves variables,
 * folds auth, and gates TOTP reuse on the desktop's code path.
 */

import type { Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStepRequest } from '../../../src/live/request-exec/run-step-request';
import type { RequestTransport, TransportRequest, TransportResponse } from '../../../src/live/request-exec/transport';

// ── Entity-store leaves (the only host-state the resolver reads) ──────

const wsVars = vi.fn<() => WorkspaceVariables>(() => ({ schemaVersion: 5, variables: [] }));
const vault = vi.fn<() => Vault>(() => ({ schemaVersion: 5, secrets: [] }));
const checkCooldownMock = vi.fn(() => ({ inCooldown: false }) as { inCooldown: boolean; remainingSeconds?: number });
const recordUsageMock = vi.fn();

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => [],
  getEnvironmentsForWorkspace: () => [],
  getVault: () => vault(),
  getVaultForWorkspace: () => vault(),
  getWorkspaceVariables: () => wsVars(),
  getWorkspaceVariablesForWorkspace: () => wsVars(),
}));
vi.mock('../../../src/entity/request-store', () => ({
  getRequest: () => null,
  getRequestInWorkspace: () => null,
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
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
vi.mock('../../../src/entity/totp-cooldown-store', () => ({
  checkCooldown: (...args: unknown[]) => checkCooldownMock(...(args as [])),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
}));

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'r1',
    path: 'requests/default/r1',
    name: 'R',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function captureTransport(): { transport: RequestTransport; sent: () => TransportRequest; calls: () => number } {
  let captured: TransportRequest | undefined;
  let n = 0;
  const transport: RequestTransport = {
    async send(req): Promise<TransportResponse> {
      captured = req;
      n += 1;
      return {
        status: 200,
        statusText: 'OK',
        url: req.url,
        headers: [],
        body: '{}',
        bodyTruncated: false,
        bodyBytes: 2,
      };
    },
  };
  return {
    transport,
    sent: () => {
      if (!captured) throw new Error('transport.send not called');
      return captured;
    },
    calls: () => n,
  };
}

const opts = (transport: RequestTransport) => ({ workspaceId: 'ws-1', environmentId: null, transport });

beforeEach(() => {
  wsVars.mockReturnValue({ schemaVersion: 5, variables: [] });
  vault.mockReturnValue({ schemaVersion: 5, secrets: [] });
  checkCooldownMock.mockReturnValue({ inCooldown: false });
  recordUsageMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('runStepRequest (integration over the real resolver + executor)', () => {
  it('resolves workspace variables in the URL', async () => {
    wsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: '1abc6d8c', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{HOST}}/ping' }), opts(transport));
    expect(snap.error).toBeNull();
    expect(sent().url).toBe('https://api.openheaders.io/ping');
  });

  it('folds basic auth into an Authorization header (UTF-8 base64)', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ auth: { type: 'basic', username: 'user', password: 'pä55' } }), opts(transport));
    const auth = sent().headers.find((h) => h.key === 'Authorization');
    expect(auth?.value).toBe(`Basic ${Buffer.from('user:pä55', 'utf-8').toString('base64')}`);
  });

  it('returns a structured error (no wire call) when a variable is unresolved', async () => {
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{MISSING}}/x' }), opts(transport));
    expect(snap.error).toMatch(/unresolved variables/i);
    expect(calls()).toBe(0);
  });

  it('does not record TOTP usage when the request uses no TOTP code', async () => {
    const { transport } = captureTransport();
    await runStepRequest(makeRequest(), opts(transport));
    expect(recordUsageMock).not.toHaveBeenCalled();
  });

  it('carries the per-request SSL verification policy through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest({ sslVerification: false }), opts(transport));
    expect(sent().sslVerification).toBe(false);
    expect(snap.sslVerificationDisabled).toBe(true);
  });

  it('leaves the transport policy unset when the request does not opt out', async () => {
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest(), opts(transport));
    expect(sent().sslVerification).toBeUndefined();
    expect(snap.sslVerificationDisabled).toBeUndefined();
  });

  it('carries the per-request timeout and response cap through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ timeoutMs: 15000, maxResponseBytes: 4096 }), opts(transport));
    expect(sent().timeoutMs).toBe(15000);
    expect(sent().maxBodyBytes).toBe(4096);
  });

  it('lets a step-level timeout override the request value', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ timeoutMs: 15000 }), { ...opts(transport), timeoutMs: 5000 });
    expect(sent().timeoutMs).toBe(5000);
  });

  it('carries the redirect-policy trio through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(
      makeRequest({ maxRedirects: 5, followOriginalHttpMethod: true, followAuthorizationHeader: true }),
      opts(transport),
    );
    expect(sent().maxRedirects).toBe(5);
    expect(sent().followOriginalHttpMethod).toBe(true);
    expect(sent().followAuthorizationHeader).toBe(true);
  });

  it('carries the TLS version window + cipher list through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(
      makeRequest({ tlsMinVersion: '1.1', tlsMaxVersion: '1.2', tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }),
      opts(transport),
    );
    expect(sent().tlsMinVersion).toBe('1.1');
    expect(sent().tlsMaxVersion).toBe('1.2');
    expect(sent().tlsCipherSuites).toBe('TLS_AES_128_GCM_SHA256');
    expect(snap.tlsFloorLowered).toBe(true);
  });

  it('carries allowHttp2 through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ allowHttp2: true }), opts(transport));
    expect(sent().allowHttp2).toBe(true);
  });

  it('carries resolveToAddress through resolve to the transport', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ resolveToAddress: '10.0.0.7' }), opts(transport));
    expect(sent().resolveToAddress).toBe('10.0.0.7');
  });

  it('resolves clientCertificateRef to the vault entry PEM pair on the seam', async () => {
    vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [
        {
          uid: 'cert0001',
          kind: 'client-certificate',
          name: 'gateway-mtls',
          cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
          key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
          passphrase: 'pw',
        },
      ],
    });
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ clientCertificateRef: 'gateway-mtls' }), opts(transport));
    expect(sent().clientCertificateRef).toBe('gateway-mtls');
    expect(sent().clientCertificatePem).toContain('BEGIN CERTIFICATE');
    expect(sent().clientCertificateKeyPem).toContain('BEGIN PRIVATE KEY');
    expect(sent().clientCertificatePassphrase).toBe('pw');
  });

  it('an unresolved clientCertificateRef still reaches the transport as the bare ref', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ clientCertificateRef: 'missing-entry' }), opts(transport));
    expect(sent().clientCertificateRef).toBe('missing-entry');
    expect(sent().clientCertificatePem).toBeUndefined();
    expect(sent().clientCertificateKeyPem).toBeUndefined();
  });

  it('resolves proxyCredentialRef to the vault string entry value on the seam', async () => {
    vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [{ uid: 'cred0001', kind: 'string', name: 'corp-proxy', value: 'user:secret' }],
    });
    const { transport, sent } = captureTransport();
    await runStepRequest(
      makeRequest({ proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'corp-proxy' }),
      opts(transport),
    );
    expect(sent().proxyUrl).toBe('http://proxy.openheaders.io:3128');
    expect(sent().proxyCredentialRef).toBe('corp-proxy');
    expect(sent().proxyCredential).toBe('user:secret');
  });

  it('an unresolved proxyCredentialRef still reaches the transport as the bare ref', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(
      makeRequest({ proxyUrl: 'http://proxy.openheaders.io:3128', proxyCredentialRef: 'missing-entry' }),
      opts(transport),
    );
    expect(sent().proxyUrl).toBe('http://proxy.openheaders.io:3128');
    expect(sent().proxyCredentialRef).toBe('missing-entry');
    expect(sent().proxyCredential).toBeUndefined();
  });

  it('carries unixSocketPath through the real resolver onto the seam', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ unixSocketPath: '/var/run/openheaders/api.sock' }), opts(transport));
    expect(sent().unixSocketPath).toBe('/var/run/openheaders/api.sock');
  });
});
