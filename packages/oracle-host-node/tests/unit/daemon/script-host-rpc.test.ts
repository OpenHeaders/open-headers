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
  executeRequestRpc: vi.fn(async (_input: unknown): Promise<unknown> => ({ success: false, error: 'not under test' })),
  transportSend: vi.fn(async (_req: unknown): Promise<unknown> => null),
  sessionSend: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: true })),
  sessionPublish: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: true })),
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
  handleExecuteRequestRpc: (input: unknown) => h.executeRequestRpc(input),
}));
// The refresh POST rides the module's node transport (the egress-
// coverage slice) — stub the seam so no real dial leaves the test.
vi.mock('../../../src/live/node-request-transport', () => ({
  createNodeRequestTransport: () => ({ send: (req: unknown) => h.transportSend(req) }),
}));

import { __resetRateLimiterForTests } from '@openheaders/oracle/live/request-exec/rate-limiter';
import { handleScriptHostRequest } from '../../../src/daemon/script-host-rpc';

function tokenJson(json: Record<string, unknown>, status = 200) {
  const body = JSON.stringify(json);
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    url: 'https://auth.openheaders.io/token',
    headers: [],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
  };
}

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
  h.executeRequestRpc.mockResolvedValue({ success: false, error: 'not under test' });
  h.transportSend.mockResolvedValue(tokenJson({ access_token: 'at-fresh' }));
});

describe('handleScriptHostRequest — vault.get', () => {
  it('answers a string vault secret verbatim', async () => {
    h.vault.mockReturnValue({
      schemaVersion: 5,
      secrets: [{ uid: 's1', kind: 'string', name: 'api-key', value: 'k-1' }],
    });
    await expect(handleScriptHostRequest(vaultGet('api-key'))).resolves.toMatchObject({ ok: true, value: 'k-1' });
    expect(h.transportSend).not.toHaveBeenCalled();
  });

  it('refreshes an expired OAuth bundle from the config sidecar before answering', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    h.getRefreshConfig.mockResolvedValue(sidecarConfig);
    const reply = await handleScriptHostRequest(vaultGet('cred-1'));
    expect(reply).toMatchObject({ ok: true, value: 'at-fresh' });
    expect(h.transportSend).toHaveBeenCalledOnce();
    expect((h.transportSend.mock.calls[0][0] as { url: string }).url).toBe('https://auth.openheaders.io/token');
    expect(h.putTokenBundle).toHaveBeenCalledOnce();
  });

  it('answers the stale token when the refresh fails — lenient, never an error reply', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    h.getRefreshConfig.mockResolvedValue(sidecarConfig);
    h.transportSend.mockResolvedValue(tokenJson({ error: 'invalid_grant' }, 400));
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-stale' });
  });

  it('answers the stale token when no config sidecar exists to rebuild the POST', async () => {
    h.getTokenBundle.mockResolvedValue(bundle());
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-stale' });
    expect(h.transportSend).not.toHaveBeenCalled();
  });

  it('skips the refresh for an unexpired bundle', async () => {
    h.getTokenBundle.mockResolvedValue(bundle({ accessToken: 'at-live', expiresAt: Date.now() + 3_600_000 }));
    await expect(handleScriptHostRequest(vaultGet('cred-1'))).resolves.toMatchObject({ ok: true, value: 'at-live' });
    expect(h.transportSend).not.toHaveBeenCalled();
  });

  it('answers null for an unknown ref', async () => {
    await expect(handleScriptHostRequest(vaultGet('missing'))).resolves.toMatchObject({ ok: true, value: null });
  });
});

describe('handleScriptHostRequest — sendRequest', () => {
  function sendRequest(): ScriptHostRequest {
    return {
      op: 'sendRequest',
      executionId: 'e1',
      rpcId: 'r1',
      request: {
        method: 'GET',
        url: 'https://api.openheaders.io/logo',
        headers: [],
        params: [],
        body: { type: 'none' },
      },
    } as ScriptHostRequest;
  }

  it('carries a binary body to the script marked bodyEncoding: base64', async () => {
    h.executeRequestRpc.mockResolvedValue({
      success: true,
      snapshot: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/logo',
        headers: [{ key: 'content-type', value: 'image/png' }],
        body: 'iVBORw0KGgo=',
        bodyEncoding: 'base64',
        bodyTruncated: false,
        bodyBytes: 8,
        durationMs: 5,
        error: null,
        scripts: null,
      },
    });
    const reply = await handleScriptHostRequest(sendRequest());
    expect(reply).toMatchObject({ ok: true, value: { body: 'iVBORw0KGgo=', bodyEncoding: 'base64' } });
  });

  it('leaves a text body unmarked', async () => {
    h.executeRequestRpc.mockResolvedValue({
      success: true,
      snapshot: {
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/ping',
        headers: [],
        body: '{"ok":true}',
        bodyTruncated: false,
        bodyBytes: 11,
        durationMs: 5,
        error: null,
        scripts: null,
      },
    });
    const reply = await handleScriptHostRequest(sendRequest());
    expect(reply.ok).toBe(true);
    if (reply.ok) expect((reply.value as { bodyEncoding?: string }).bodyEncoding).toBeUndefined();
  });
});

// ── session.send — a session hook's reply into its own session ──────

vi.mock('@openheaders/oracle/live/ws-exec/session-plane', () => ({
  sendActiveWsSessionMessage: (...args: unknown[]) => h.sessionSend(...args),
}));
vi.mock('@openheaders/oracle/live/mqtt-exec/session-plane', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/oracle/live/mqtt-exec/session-plane')>();
  return {
    scriptPublishToWire: actual.scriptPublishToWire,
    publishActiveMqttMessage: (...args: unknown[]) => h.sessionPublish(...args),
  };
});

// ── session.publish — an MQTT hook's reply into its own session ─────

describe('session.publish', () => {
  it('routes to the active MQTT session as a script-origin publish, the rows given identities', async () => {
    h.sessionPublish.mockResolvedValue({ success: true });
    const reply = await handleScriptHostRequest({
      op: 'session.publish',
      executionId: 'e3',
      rpcId: 'r3',
      sessionId: 'send-2',
      message: {
        topic: 'probe/ack',
        payload: 'ok',
        qos: 1,
        properties: { userProperties: [{ key: 'k', value: 'v' }] },
      },
    });
    expect(reply).toEqual({ executionId: 'e3', rpcId: 'r3', ok: true, value: { success: true } });
    const [sendId, wire, origin] = h.sessionPublish.mock.calls[0] as [
      string,
      { topic: string; properties: { userProperties: Array<{ uid: string; key: string }> } },
      string,
    ];
    expect(sendId).toBe('send-2');
    expect(origin).toBe('script');
    expect(wire).toMatchObject({ topic: 'probe/ack', payload: 'ok', qos: 1 });
    expect(typeof wire.properties.userProperties[0]?.uid).toBe('string');
  });

  it('a refused publish answers ok with the rider reason — the script reads it as a throw', async () => {
    h.sessionPublish.mockResolvedValue({ success: false, error: 'No open MQTT session with this id.' });
    const reply = await handleScriptHostRequest({
      op: 'session.publish',
      executionId: 'e4',
      rpcId: 'r4',
      sessionId: 'gone',
      message: { topic: 'x', payload: 'y' },
    });
    expect(reply).toMatchObject({ ok: true, value: { success: false, error: 'No open MQTT session with this id.' } });
  });
});

describe('session.send', () => {
  it('routes to the active WebSocket session as a script-origin write and answers the rider verdict', async () => {
    h.sessionSend.mockResolvedValue({ success: true });
    const reply = await handleScriptHostRequest({
      op: 'session.send',
      executionId: 'e1',
      rpcId: 'r1',
      sessionId: 'send-1',
      messageText: '["hello", 1]',
      socketio: { eventName: 'echo', expectAck: true },
    });
    expect(reply).toEqual({ executionId: 'e1', rpcId: 'r1', ok: true, value: { success: true } });
    expect(h.sessionSend).toHaveBeenCalledWith(
      'send-1',
      '["hello", 1]',
      { eventName: 'echo', expectAck: true },
      undefined,
      'script',
    );
  });

  it('a refused send answers ok with the rider reason — the script reads it as a throw', async () => {
    h.sessionSend.mockResolvedValue({ success: false, error: 'No open WebSocket session with this id.' });
    const reply = await handleScriptHostRequest({
      op: 'session.send',
      executionId: 'e2',
      rpcId: 'r2',
      sessionId: 'gone',
      messageText: 'x',
      binary: { encoding: 'base64' },
    });
    expect(reply).toMatchObject({
      ok: true,
      value: { success: false, error: 'No open WebSocket session with this id.' },
    });
    expect(h.sessionSend).toHaveBeenLastCalledWith('gone', 'x', undefined, { encoding: 'base64' }, 'script');
  });
});
