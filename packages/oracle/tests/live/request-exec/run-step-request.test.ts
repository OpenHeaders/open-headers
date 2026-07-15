/**
 * runStepRequest — end-to-end chain-step orchestration over the REAL
 * resolver + wire executor (only the entity-store leaves are mocked).
 * This is the integration the chain adapter + both host transports sit
 * on, so it proves the moved resolve logic still resolves variables,
 * folds auth, and gates TOTP reuse on the desktop's code path.
 */

import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import type { Collection, Environment, Folder, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runStepRequest } from '../../../src/live/request-exec/run-step-request';
import type { StepScriptInput, StepScriptRunner } from '../../../src/live/request-exec/script-hooks';
import type { RequestTransport, TransportRequest, TransportResponse } from '../../../src/live/request-exec/transport';

// ── Entity-store leaves (the only host-state the resolver reads) ──────

const wsVars = vi.fn<() => WorkspaceVariables>(() => ({ schemaVersion: 5, variables: [] }));
const vault = vi.fn<() => Vault>(() => ({ schemaVersion: 5, secrets: [] }));
const checkCooldownMock = vi.fn(() => ({ inCooldown: false }) as { inCooldown: boolean; remainingSeconds?: number });
const recordUsageMock = vi.fn();
const environments = vi.fn<() => Environment[]>(() => []);
const activeEnvironmentId = vi.fn<() => string | null>(() => null);

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => activeEnvironmentId(),
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
vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
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
  environments.mockReturnValue([]);
  activeEnvironmentId.mockReturnValue(null);
  checkCooldownMock.mockReturnValue({ inCooldown: false });
  recordUsageMock.mockReset();
  requestCollections.mockReturnValue([]);
  requestFolders.mockReturnValue([]);
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

  it('resolves a cookieJar opt-in to the workspace-keyed jar on the seam', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ cookieJar: true }), opts(transport));
    expect(sent().cookieJarKey).toBe('ws-1');

    const bare = captureTransport();
    await runStepRequest(makeRequest(), opts(bare.transport));
    expect(bare.sent().cookieJarKey).toBeUndefined();
  });
});

describe('runStepRequest — unpinned (runtime-Active) run', () => {
  const unpinned = (transport: RequestTransport) => ({ workspaceId: null, environmentId: null, transport });

  it('resolves against the Active-bound mirrors and executes', async () => {
    wsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: '1abc6d8c', name: 'HOST', value: 'api.openheaders.io', type: 'default' }],
    });
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{HOST}}/ping' }), unpinned(transport));
    expect(snap.error).toBeNull();
    expect(sent().url).toBe('https://api.openheaders.io/ping');
  });

  it('stamps an unpinned cookieJar opt-in with the runtime-Active workspace id', async () => {
    const { transport, sent } = captureTransport();
    await runStepRequest(makeRequest({ cookieJar: true }), unpinned(transport));
    expect(sent().cookieJarKey).toBe('ws-active');
  });

  it('defers to the active-environment pointer when environmentId is undefined', async () => {
    environments.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'env-active',
        name: 'Active',
        variables: [{ uid: 'v1', name: 'HOST', value: 'active.openheaders.io', type: 'default' }],
      },
    ]);
    activeEnvironmentId.mockReturnValue('env-active');
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{HOST}}/ping' }), {
      workspaceId: null,
      environmentId: undefined,
      transport,
    });
    expect(snap.error).toBeNull();
    expect(sent().url).toBe('https://active.openheaders.io/ping');
  });

  it('an explicit null runs with NO environment even though the pointer names one', async () => {
    environments.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'env-active',
        name: 'Active',
        variables: [{ uid: 'v1', name: 'HOST', value: 'active.openheaders.io', type: 'default' }],
      },
    ]);
    activeEnvironmentId.mockReturnValue('env-active');
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{HOST}}/ping' }), {
      workspaceId: null,
      environmentId: null,
      transport,
    });
    expect(snap.error).toMatch(/unresolved variables/i);
    expect(calls()).toBe(0);
  });

  it('an explicit environment string overrides the pointer on the unpinned run', async () => {
    environments.mockReturnValue([
      {
        schemaVersion: 5,
        uid: 'env-active',
        name: 'Active',
        variables: [{ uid: 'v1', name: 'HOST', value: 'active.openheaders.io', type: 'default' }],
      },
      {
        schemaVersion: 5,
        uid: 'env-other',
        name: 'Other',
        variables: [{ uid: 'v2', name: 'HOST', value: 'other.openheaders.io', type: 'default' }],
      },
    ]);
    activeEnvironmentId.mockReturnValue('env-active');
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(makeRequest({ url: 'https://{{HOST}}/ping' }), {
      workspaceId: null,
      environmentId: 'env-other',
      transport,
    });
    expect(snap.error).toBeNull();
    expect(sent().url).toBe('https://other.openheaders.io/ping');
  });

  it('partitions the TOTP cooldown by the runtime-Active workspace id', async () => {
    vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [
        {
          uid: 'totp0001',
          kind: 'totp',
          name: 'otp',
          seed: 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
      ],
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(
      makeRequest({ headers: [{ uid: 'h1', key: 'X-OTP', value: '{{vault.otp}}' }] }),
      unpinned(transport),
    );
    expect(snap.error).toBeNull();
    expect(checkCooldownMock).toHaveBeenCalledWith('ws-active', 'otp', expect.any(String));
    expect(recordUsageMock).toHaveBeenCalledWith('ws-active', 'otp', expect.any(String), 30);
  });
});

describe('runStepRequest — step script hooks', () => {
  const scriptResult = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
    executionId: 'exec-test',
    succeeded: true,
    assertions: [],
    consoleLog: [],
    durationMs: 1,
    ...over,
  });

  function captureRunner(results: Partial<Record<'pre-request' | 'post-response', ScriptExecutionResult>>): {
    runner: StepScriptRunner;
    inputs: StepScriptInput[];
  } {
    const inputs: StepScriptInput[] = [];
    const runner: StepScriptRunner = async (input) => {
      inputs.push(input);
      return results[input.kind] ?? scriptResult();
    };
    return { runner, inputs };
  }

  const scripted = (over: Partial<Request> = {}) =>
    makeRequest({ preRequestScript: 'pre();', postResponseScript: 'post();', ...over });

  it('runs no scripts without an injected runner, even when the request carries them', async () => {
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(scripted(), opts(transport));
    expect(snap.error).toBeNull();
    expect(calls()).toBe(1);
    expect(snap.scripts).toBeNull();
  });

  it('runs both hooks with the resolved request when the runner is injected', async () => {
    const { runner, inputs } = captureRunner({});
    const { transport } = captureTransport();
    const snap = await runStepRequest(scripted({ url: 'https://api.openheaders.io/ping?a=1' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(snap.error).toBeNull();
    expect(inputs.map((i) => i.kind)).toEqual(['pre-request', 'post-response']);
    expect(inputs[0].request.url).toBe('https://api.openheaders.io/ping?a=1');
    expect(inputs[0].request.params).toEqual([{ key: 'a', value: '1' }]);
    expect(inputs[1].response?.status).toBe(200);
    expect(snap.scripts?.preRequest?.succeeded).toBe(true);
    expect(snap.scripts?.postResponse?.succeeded).toBe(true);
  });

  it('skips a hook whose script source is absent', async () => {
    const { runner, inputs } = captureRunner({});
    const { transport } = captureTransport();
    await runStepRequest(makeRequest({ postResponseScript: 'post();' }), { ...opts(transport), scriptRunner: runner });
    expect(inputs.map((i) => i.kind)).toEqual(['post-response']);
  });

  it('applies a pre-request header mutation before the wire', async () => {
    const { runner } = captureRunner({
      'pre-request': scriptResult({ mutation: { headers: [{ key: 'X-Signed', value: 'yes' }] } }),
    });
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toBeNull();
    expect(sent().headers).toEqual([{ key: 'X-Signed', value: 'yes' }]);
  });

  it('a params mutation replaces the resolved URL query wholesale', async () => {
    const { runner } = captureRunner({
      'pre-request': scriptResult({ mutation: { params: [{ key: 'b', value: '2' }] } }),
    });
    const { transport, sent } = captureTransport();
    await runStepRequest(scripted({ url: 'https://api.openheaders.io/ping?a=1' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(sent().url).toBe('https://api.openheaders.io/ping?b=2');
  });

  it('a pre-request script error fails the run before the wire', async () => {
    const { runner } = captureRunner({
      'pre-request': scriptResult({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
    });
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toMatch(/Pre-request script failed: boom/);
    expect(calls()).toBe(0);
    expect(snap.scripts?.preRequest?.succeeded).toBe(false);
  });

  it('a post-response script error fails the run but keeps the response for observability', async () => {
    const { runner } = captureRunner({
      'post-response': scriptResult({ succeeded: false, error: { name: 'Error', message: 'crash' } }),
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toMatch(/Post-response script failed: crash/);
    expect(snap.status).toBe(200);
  });

  it('a failed assertion fails the run with the assertion name + message', async () => {
    const { runner } = captureRunner({
      'post-response': scriptResult({
        assertions: [
          { name: 'status is 200', passed: true },
          { name: 'total matches', passed: false, message: 'expected 99.99, got 0' },
        ],
      }),
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toBe('Assertion failed: total matches — expected 99.99, got 0');
    expect(snap.scripts?.postResponse?.assertions).toHaveLength(2);
  });

  it('passing assertions leave the run successful with outcomes attached', async () => {
    const { runner } = captureRunner({
      'post-response': scriptResult({ assertions: [{ name: 'status is 200', passed: true }] }),
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toBeNull();
    expect(snap.scripts?.postResponse?.assertions).toEqual([{ name: 'status is 200', passed: true }]);
  });

  it('a binary wire body reaches the post-response script marked bodyEncoding: base64', async () => {
    const { runner, inputs } = captureRunner({});
    const binaryTransport: RequestTransport = {
      async send(req): Promise<TransportResponse> {
        return {
          status: 200,
          statusText: 'OK',
          url: req.url,
          headers: [{ key: 'content-type', value: 'image/png' }],
          body: 'iVBORw0KGgo=',
          bodyEncoding: 'base64',
          bodyTruncated: false,
          bodyBytes: 8,
        };
      },
    };
    const snap = await runStepRequest(scripted(), { ...opts(binaryTransport), scriptRunner: runner });
    expect(snap.error).toBeNull();
    const post = inputs.find((i) => i.kind === 'post-response');
    expect(post?.response?.body).toBe('iVBORw0KGgo=');
    expect(post?.response?.bodyEncoding).toBe('base64');
  });

  it('a text wire body reaches the post-response script with no bodyEncoding marker', async () => {
    const { runner, inputs } = captureRunner({});
    const { transport } = captureTransport();
    await runStepRequest(scripted(), { ...opts(transport), scriptRunner: runner });
    const post = inputs.find((i) => i.kind === 'post-response');
    expect(post?.response?.bodyEncoding).toBeUndefined();
  });

  it('skips the post-response hook when the wire fetch failed', async () => {
    const { runner, inputs } = captureRunner({});
    const failing: RequestTransport = {
      async send() {
        throw new Error('network down');
      },
    };
    const snap = await runStepRequest(scripted(), { ...opts(failing), scriptRunner: runner });
    expect(snap.error).toMatch(/network down/);
    expect(inputs.map((i) => i.kind)).toEqual(['pre-request']);
  });
});

describe('runStepRequest — ancestor script chain', () => {
  const scriptResult = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
    executionId: 'exec-test',
    succeeded: true,
    assertions: [],
    consoleLog: [],
    durationMs: 1,
    ...over,
  });

  /** Runner keyed by script SOURCE so each chain level gets its own result. */
  function sourceRunner(bySource: Record<string, ScriptExecutionResult>): {
    runner: StepScriptRunner;
    inputs: StepScriptInput[];
  } {
    const inputs: StepScriptInput[] = [];
    const runner: StepScriptRunner = async (input) => {
      inputs.push(input);
      return bySource[input.source] ?? scriptResult();
    };
    return { runner, inputs };
  }

  const chainCollection = (over: Partial<Collection> = {}): Collection => ({
    schemaVersion: 5,
    uid: 'rcol0001',
    path: 'requests/default',
    name: 'Default',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...over,
  });

  const chainFolder = (over: Partial<Folder> = {}): Folder => ({
    schemaVersion: 5,
    uid: 'rfold001',
    path: 'requests/default/tokens-rfold001',
    name: 'Tokens',
    ...over,
  });

  const nestedRequest = (over: Partial<Request> = {}) =>
    makeRequest({ path: 'requests/default/tokens-rfold001/r1', ...over });

  it('composes pre scripts ancestor-first: collection → folder → request', async () => {
    requestCollections.mockReturnValue([chainCollection({ preRequestScript: 'colPre();' })]);
    requestFolders.mockReturnValue([chainFolder({ preRequestScript: 'foldPre();' })]);
    const { runner, inputs } = sourceRunner({});
    const { transport } = captureTransport();
    const snap = await runStepRequest(nestedRequest({ preRequestScript: 'reqPre();' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(snap.error).toBeNull();
    expect(inputs.map((i) => i.source)).toEqual(['colPre();', 'foldPre();', 'reqPre();']);
    expect(snap.scripts?.preRequest?.succeeded).toBe(true);
  });

  it('runs a collection script even when the request carries none of its own', async () => {
    requestCollections.mockReturnValue([chainCollection({ preRequestScript: 'colPre();' })]);
    const { runner, inputs } = sourceRunner({});
    const { transport } = captureTransport();
    const snap = await runStepRequest(nestedRequest(), { ...opts(transport), scriptRunner: runner });
    expect(snap.error).toBeNull();
    expect(inputs.map((i) => i.source)).toEqual(['colPre();']);
    expect(snap.scripts?.preRequest?.succeeded).toBe(true);
  });

  it('an ancestor pre mutation feeds the next level and reaches the wire', async () => {
    requestCollections.mockReturnValue([chainCollection({ preRequestScript: 'colPre();' })]);
    const { transport, sent } = captureTransport();
    const { runner, inputs } = sourceRunner({
      'colPre();': scriptResult({ mutation: { headers: [{ key: 'X-From-Collection', value: 'yes' }] } }),
    });
    await runStepRequest(nestedRequest({ preRequestScript: 'reqPre();' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    // The request-level script observed the collection's header.
    const reqInput = inputs.find((i) => i.source === 'reqPre();');
    expect(reqInput?.request.headers).toEqual([{ key: 'X-From-Collection', value: 'yes' }]);
    expect(sent().headers).toEqual([{ key: 'X-From-Collection', value: 'yes' }]);
  });

  it('a failing collection pre stops the strict chain, names the level, and skips the wire', async () => {
    requestCollections.mockReturnValue([chainCollection({ preRequestScript: 'colPre();' })]);
    const { runner, inputs } = sourceRunner({
      'colPre();': scriptResult({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
    });
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(nestedRequest({ preRequestScript: 'reqPre();' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(snap.error).toBe("Pre-request script failed: Collection 'Default': boom");
    expect(inputs.map((i) => i.source)).toEqual(['colPre();']);
    expect(calls()).toBe(0);
  });

  it('post assertions concatenate across levels and an ancestor failure fails the run', async () => {
    requestCollections.mockReturnValue([chainCollection({ postResponseScript: 'colPost();' })]);
    const { runner } = sourceRunner({
      'colPost();': scriptResult({ assertions: [{ name: 'collection check', passed: false, message: 'nope' }] }),
      'reqPost();': scriptResult({ assertions: [{ name: 'request check', passed: true }] }),
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(nestedRequest({ postResponseScript: 'reqPost();' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(snap.error).toBe('Assertion failed: collection check — nope');
    expect(snap.scripts?.postResponse?.assertions).toHaveLength(2);
  });

  it('prefixes console entries with the level label when multiple levels contribute', async () => {
    requestCollections.mockReturnValue([chainCollection({ preRequestScript: 'colPre();' })]);
    const { runner } = sourceRunner({
      'colPre();': scriptResult({ consoleLog: [{ level: 'log', args: ['hello'], timeMs: 1 }] }),
      'reqPre();': scriptResult({ consoleLog: [{ level: 'log', args: ['world'], timeMs: 1 }] }),
    });
    const { transport } = captureTransport();
    const snap = await runStepRequest(nestedRequest({ preRequestScript: 'reqPre();' }), {
      ...opts(transport),
      scriptRunner: runner,
    });
    expect(snap.scripts?.preRequest?.consoleLog).toEqual([
      { level: 'log', args: ["[Collection 'Default']", 'hello'], timeMs: 1 },
      { level: 'log', args: ['[Request]', 'world'], timeMs: 1 },
    ]);
  });
});

describe('runStepRequest — ancestor auth inheritance', () => {
  const chainCollection = (over: Partial<Collection> = {}): Collection => ({
    schemaVersion: 5,
    uid: 'rcol0001',
    path: 'requests/default',
    name: 'Default',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...over,
  });

  const chainFolder = (over: Partial<Folder> = {}): Folder => ({
    schemaVersion: 5,
    uid: 'rfold001',
    path: 'requests/default/tokens-rfold001',
    name: 'Tokens',
    ...over,
  });

  const nestedRequest = (over: Partial<Request> = {}) =>
    makeRequest({ path: 'requests/default/tokens-rfold001/r1', auth: { type: 'inherit' }, ...over });

  const authHeader = (req: TransportRequest) => req.headers.find((h) => h.key === 'Authorization');

  it('an inherit request sends the collection-level bearer', async () => {
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(nestedRequest(), opts(transport));
    expect(snap.error).toBeNull();
    expect(authHeader(sent())).toEqual({ key: 'Authorization', value: 'Bearer tok-col' });
  });

  it('folder auth shadows collection auth (innermost carrier wins)', async () => {
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([chainFolder({ auth: { type: 'bearer', token: 'tok-folder' } })]);
    const { transport, sent } = captureTransport();
    await runStepRequest(nestedRequest(), opts(transport));
    expect(authHeader(sent())).toEqual({ key: 'Authorization', value: 'Bearer tok-folder' });
  });

  it("a folder-level `none` shadows the collection's bearer — no header ships", async () => {
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    requestFolders.mockReturnValue([chainFolder({ auth: { type: 'none' } })]);
    const { transport, sent } = captureTransport();
    await runStepRequest(nestedRequest(), opts(transport));
    expect(authHeader(sent())).toBeUndefined();
  });

  it('explicit request auth wins outright over ancestor carriers', async () => {
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: 'tok-col' } })]);
    const { transport, sent } = captureTransport();
    await runStepRequest(nestedRequest({ auth: { type: 'bearer', token: 'tok-own' } }), opts(transport));
    expect(authHeader(sent())).toEqual({ key: 'Authorization', value: 'Bearer tok-own' });
  });

  it('a chain with no carrier degrades to none (pre-D2 behavior)', async () => {
    requestCollections.mockReturnValue([chainCollection()]);
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(nestedRequest(), opts(transport));
    expect(snap.error).toBeNull();
    expect(authHeader(sent())).toBeUndefined();
  });

  it('templates inside the inherited config resolve against the request scope', async () => {
    wsVars.mockReturnValue({
      schemaVersion: 5,
      variables: [{ uid: '1abc6d8c', name: 'auth_token', value: 'tok-var', type: 'default' }],
    });
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: '{{auth_token}}' } })]);
    const { transport, sent } = captureTransport();
    const snap = await runStepRequest(nestedRequest(), opts(transport));
    expect(snap.error).toBeNull();
    expect(authHeader(sent())).toEqual({ key: 'Authorization', value: 'Bearer tok-var' });
  });

  it('an unresolvable template inside the inherited config trips the resolvability gate', async () => {
    requestCollections.mockReturnValue([chainCollection({ auth: { type: 'bearer', token: '{{auth_token}}' } })]);
    const { transport, calls } = captureTransport();
    const snap = await runStepRequest(nestedRequest(), opts(transport));
    expect(snap.error).toMatch(/unresolved variables/);
    expect(calls()).toBe(0);
  });
});
