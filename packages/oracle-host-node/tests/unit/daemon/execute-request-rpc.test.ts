/**
 * Workbench `executeRequest` route — the daemon's user-facing Send over
 * the REAL `runStepRequest` + resolver (only the entity-store leaves are
 * mocked) with an injected fake transport. Pins the handler contract:
 * snapshot passthrough, uid-vs-draft precedence, error mapping (error
 * snapshots resolve `success: true`; missing input and unexpected
 * throws resolve `success: false`), the unresolved-variable and TOTP
 * cooldown gates, and the runtime-Active cookie-jar key stamp.
 */

import type { Request, Vault } from '@openheaders/core/types';
import type {
  RequestTransport,
  TransportRequest,
  TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  vault: vi.fn((): Vault => ({ schemaVersion: 5, secrets: [] })),
  getRequest: vi.fn((_uid: string): Request | null => null),
  checkCooldown: vi.fn(() => ({ inCooldown: false }) as { inCooldown: boolean; remainingSeconds?: number }),
  recordUsage: vi.fn(),
}));

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => [],
  getEnvironmentsForWorkspace: () => [],
  getVault: () => h.vault(),
  getVaultForWorkspace: () => h.vault(),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
  getWorkspaceVariablesForWorkspace: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: (uid: string) => h.getRequest(uid),
  getRequestInWorkspace: () => null,
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
  getFileBlob: async () => null,
  listFiles: async () => [],
}));
vi.mock('@openheaders/oracle/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: async () => null,
}));
vi.mock('@openheaders/oracle/entity/totp-cooldown-store', () => ({
  checkCooldown: (...args: unknown[]) => h.checkCooldown(...(args as [])),
  recordUsage: (...args: unknown[]) => h.recordUsage(...args),
}));
vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
}));

import { handleExecuteRequestRpc } from '../../../src/daemon/execute-request-rpc';

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

beforeEach(() => {
  vi.clearAllMocks();
  h.vault.mockReturnValue({ schemaVersion: 5, secrets: [] });
  h.getRequest.mockReturnValue(null);
  h.checkCooldown.mockReturnValue({ inCooldown: false });
});

describe('handleExecuteRequestRpc — draft path', () => {
  it('executes the draft and passes the snapshot through', async () => {
    const { transport, sent } = captureTransport();
    const result = await handleExecuteRequestRpc({ draft: makeRequest() }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.status).toBe(200);
    expect(result.snapshot?.error).toBeNull();
    expect(sent().url).toBe('https://api.openheaders.io/ping');
  });

  it('stamps a cookieJar opt-in with the runtime-Active workspace id', async () => {
    const { transport, sent } = captureTransport();
    await handleExecuteRequestRpc({ draft: makeRequest({ cookieJar: true }) }, transport);
    expect(sent().cookieJarKey).toBe('ws-active');
  });

  it('returns an unresolved-variable error snapshot without touching the wire', async () => {
    const { transport, calls } = captureTransport();
    const result = await handleExecuteRequestRpc({ draft: makeRequest({ url: 'https://{{MISSING}}/x' }) }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toMatch(/unresolved variables/i);
    expect(calls()).toBe(0);
  });

  it('returns a TOTP cooldown error snapshot without touching the wire', async () => {
    h.vault.mockReturnValue({
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
    h.checkCooldown.mockReturnValue({ inCooldown: true, remainingSeconds: 12 });
    const { transport, calls } = captureTransport();
    const result = await handleExecuteRequestRpc(
      { draft: makeRequest({ headers: [{ uid: 'h1', key: 'X-OTP', value: '{{vault.otp}}' }] }) },
      transport,
    );
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toMatch(/wait 12s/);
    expect(calls()).toBe(0);
  });

  it('maps a transport failure to an error snapshot, not a rejection', async () => {
    const transport: RequestTransport = {
      send: async () => {
        throw new Error('socket hang up');
      },
    };
    const result = await handleExecuteRequestRpc({ draft: makeRequest() }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toBe('socket hang up');
  });
});

describe('handleExecuteRequestRpc — workspace scoping', () => {
  it('runs unpinned when the stamped workspace IS the runtime-Active one', async () => {
    const { transport, sent } = captureTransport();
    const result = await handleExecuteRequestRpc(
      { draft: makeRequest({ cookieJar: true }), workspaceId: 'ws-active' },
      transport,
    );
    expect(result.success).toBe(true);
    // The unpinned jar-key stamp — the Active-bound mirror path.
    expect(sent().cookieJarKey).toBe('ws-active');
  });

  it('runs pinned when the stamped workspace differs — per-workspace scopes and jar key', async () => {
    const { transport, sent } = captureTransport();
    const result = await handleExecuteRequestRpc(
      { draft: makeRequest({ cookieJar: true }), workspaceId: 'ws-other' },
      transport,
    );
    expect(result.success).toBe(true);
    expect(sent().cookieJarKey).toBe('ws-other');
  });
});

describe('handleExecuteRequestRpc — uid path', () => {
  it('loads the saved request by uid and executes it', async () => {
    h.getRequest.mockReturnValue(makeRequest({ uid: 'saved-1', url: 'https://api.openheaders.io/saved' }));
    const { transport, sent } = captureTransport();
    const result = await handleExecuteRequestRpc({ requestUid: 'saved-1' }, transport);
    expect(h.getRequest).toHaveBeenCalledWith('saved-1');
    expect(result.success).toBe(true);
    expect(sent().url).toBe('https://api.openheaders.io/saved');
  });

  it('takes precedence over a draft when both are provided', async () => {
    h.getRequest.mockReturnValue(makeRequest({ uid: 'saved-1', url: 'https://api.openheaders.io/saved' }));
    const { transport, sent } = captureTransport();
    await handleExecuteRequestRpc(
      { requestUid: 'saved-1', draft: makeRequest({ url: 'https://api.openheaders.io/draft' }) },
      transport,
    );
    expect(sent().url).toBe('https://api.openheaders.io/saved');
  });

  it('returns a not-found error snapshot for an unknown uid', async () => {
    const { transport, calls } = captureTransport();
    const result = await handleExecuteRequestRpc({ requestUid: 'missing' }, transport);
    expect(result.success).toBe(true);
    expect(result.snapshot?.error).toBe('Request missing not found');
    expect(calls()).toBe(0);
  });
});

describe('handleExecuteRequestRpc — input errors', () => {
  it('rejects a message with neither uid nor draft', async () => {
    const { transport, calls } = captureTransport();
    const result = await handleExecuteRequestRpc({}, transport);
    expect(result).toEqual({ success: false, error: 'No request or draft provided' });
    expect(calls()).toBe(0);
  });
});
