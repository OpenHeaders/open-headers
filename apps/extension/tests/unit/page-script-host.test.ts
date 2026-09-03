// @vitest-environment jsdom
/**
 * The workbench page's script host — the session hooks' `oh.*`
 * servicing off the renderer scope the editor publishes: variables
 * through the scope's resolver, `variables.set` through the workspace
 * write client under the page host's surface id, `vault.get` off the
 * scope's vault (string secrets) or the workspace's OAuth token store
 * (a credentialRef's access token), `sendRequest` through the
 * bridge's `executeRequest`, `session.send` into the page-local
 * active-session registry as a SCRIPT-origin write; the host answers
 * `null` where the manifest declares no sandbox page (Firefox).
 */

import type { ScriptHostRequest } from '@openheaders/core/scripts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  bridgeCall: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: false, error: 'not under test' })),
  varSet: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ ok: true })),
  sessionSend: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: true })),
  sessionPublish: vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ success: true })),
  tokenBundle: vi.fn(async (..._args: unknown[]): Promise<unknown> => null),
  manifest: { sandbox: { pages: ['sandbox.html'] } } as { sandbox?: { pages?: string[] } },
}));

vi.mock('@openheaders/core/bridge', () => ({
  hostBridge: { call: (...args: unknown[]) => h.bridgeCall(...args) },
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => h.tokenBundle(...args),
}));
vi.mock('@openheaders/ui/shared/sync/workspace-variables-write-client', () => ({
  applyWorkspaceVarSet: (...args: unknown[]) => h.varSet(...args),
}));
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
vi.mock('@/types/browser', () => ({
  getBrowserAPI: () => ({
    runtime: { getManifest: () => h.manifest, getURL: (p: string) => `chrome-extension://x/${p}` },
  }),
}));

import {
  getPageScriptHost,
  handlePageScriptHostRequest,
  pageScriptHostAvailable,
  setPageScriptScope,
} from '@/host/page-script-host';

const envelope = { executionId: 'e1', rpcId: 'r1' };

beforeEach(() => {
  vi.clearAllMocks();
  h.manifest = { sandbox: { pages: ['sandbox.html'] } };
  setPageScriptScope({
    workspaceId: 'ws1',
    resolveVariable: (name) => (name === 'base' ? 'https://api.openheaders.io' : null),
    workspaceVariables: {
      schemaVersion: 5,
      variables: [{ uid: 'var00001', name: 'token', value: 'old', type: 'default' }],
    },
    vault: {
      schemaVersion: 5,
      secrets: [
        { uid: 'sec00001', kind: 'string', name: 'api_key', value: 'k-1' },
        { uid: 'sec00002', kind: 'totp', name: 'otp', seed: 'JBSWY3DP', algorithm: 'SHA1', digits: 6, period: 30 },
      ],
    },
    packages: [{ name: 'util', source: 'module.exports = {};' }],
  });
});

describe('availability', () => {
  it('answers a host where the manifest declares the sandbox page, null where it does not', () => {
    expect(pageScriptHostAvailable()).toBe(true);
    expect(getPageScriptHost()?.mode).toBe('safe');
    h.manifest = {};
    expect(pageScriptHostAvailable()).toBe(false);
    expect(getPageScriptHost()).toBeNull();
  });
});

describe('the oh.* host RPCs', () => {
  it('variables.get resolves through the scope, null when unset', async () => {
    const hit = await handlePageScriptHostRequest({ ...envelope, op: 'variables.get', name: 'base' });
    expect(hit).toEqual({ ...envelope, ok: true, value: 'https://api.openheaders.io' });
    const miss = await handlePageScriptHostRequest({ ...envelope, op: 'variables.get', name: 'nope' });
    expect(miss).toMatchObject({ ok: true, value: null });
  });

  it('variables.set writes the workspace scope keeping an existing row uid, under the page host surface', async () => {
    const reply = await handlePageScriptHostRequest({ ...envelope, op: 'variables.set', name: 'token', value: 'new' });
    expect(reply).toMatchObject({ ok: true, value: null });
    expect(h.varSet).toHaveBeenCalledWith(
      { variable: { uid: 'var00001', name: 'token', value: 'new', type: 'default' } },
      { workspaceId: 'ws1', surfaceId: 'page-script-host' },
    );
    h.varSet.mockResolvedValueOnce({ ok: false, reason: 'other', message: 'rejected' });
    const refused = await handlePageScriptHostRequest({ ...envelope, op: 'variables.set', name: 'x', value: '1' });
    expect(refused).toMatchObject({ ok: false, error: 'oh.variables.set: rejected' });
  });

  it('vault.get answers a string secret without touching the token store', async () => {
    expect(await handlePageScriptHostRequest({ ...envelope, op: 'vault.get', ref: 'api_key' })).toMatchObject({
      value: 'k-1',
    });
    expect(h.tokenBundle).not.toHaveBeenCalled();
  });

  it("vault.get reads any other ref as an OAuth credential off the workspace's token store — its access token", async () => {
    h.tokenBundle.mockResolvedValueOnce({ accessToken: 'at-1', tokenType: 'Bearer', obtainedAt: 1 });
    expect(await handlePageScriptHostRequest({ ...envelope, op: 'vault.get', ref: 'github-oauth' })).toMatchObject({
      value: 'at-1',
    });
    expect(h.tokenBundle).toHaveBeenCalledWith('github-oauth', 'ws1');
    // A TOTP entry is request-time, not script-time — and no bundle
    // sits under its name either.
    expect(await handlePageScriptHostRequest({ ...envelope, op: 'vault.get', ref: 'otp' })).toMatchObject({
      value: null,
    });
    expect(h.tokenBundle).toHaveBeenLastCalledWith('otp', 'ws1');
  });

  it('vault.get answers null for an OAuth ref when the scope names no workspace — nothing to read', async () => {
    setPageScriptScope({
      workspaceId: null,
      resolveVariable: () => null,
      workspaceVariables: { schemaVersion: 5, variables: [] },
      vault: { schemaVersion: 5, secrets: [] },
      packages: [],
    });
    expect(await handlePageScriptHostRequest({ ...envelope, op: 'vault.get', ref: 'github-oauth' })).toMatchObject({
      value: null,
    });
    expect(h.tokenBundle).not.toHaveBeenCalled();
  });

  it('sendRequest dispatches a draft through the bridge and projects the snapshot', async () => {
    h.bridgeCall.mockResolvedValueOnce({
      success: true,
      snapshot: {
        status: 201,
        statusText: 'Created',
        url: 'https://api.openheaders.io/v1/items',
        headers: [{ key: 'content-type', value: 'application/json' }],
        body: '{"id":1}',
        durationMs: 7,
      },
    });
    const reply = await handlePageScriptHostRequest({
      ...envelope,
      op: 'sendRequest',
      request: {
        method: 'POST',
        url: 'https://api.openheaders.io/v1/items',
        headers: [],
        params: [],
        body: { type: 'none' },
      },
    });
    expect(reply).toMatchObject({
      ok: true,
      value: { status: 201, statusText: 'Created', body: '{"id":1}', durationMs: 7 },
    });
    const [channel, payload] = h.bridgeCall.mock.calls[0] as [string, { draft: { method: string; url: string } }];
    expect(channel).toBe('executeRequest');
    expect(payload.draft).toMatchObject({
      method: 'POST',
      url: 'https://api.openheaders.io/v1/items',
      auth: { type: 'none' },
    });
  });

  it('session.send routes into the page-local session registry as a script-origin write', async () => {
    const reply = await handlePageScriptHostRequest({
      ...envelope,
      op: 'session.send',
      sessionId: 'send-1',
      messageText: 'pong',
    });
    expect(reply).toMatchObject({ ok: true, value: { success: true } });
    expect(h.sessionSend).toHaveBeenCalledWith('send-1', 'pong', undefined, undefined, 'script');
  });

  it('session.publish routes into the page-local MQTT registry as a script-origin publish, rows given identities', async () => {
    const reply = await handlePageScriptHostRequest({
      ...envelope,
      op: 'session.publish',
      sessionId: 'send-2',
      message: {
        topic: 'probe/ack',
        payload: 'ok',
        qos: 1,
        properties: { userProperties: [{ key: 'k', value: 'v' }] },
      },
    });
    expect(reply).toMatchObject({ ok: true, value: { success: true } });
    const [sendId, wire, origin] = h.sessionPublish.mock.calls[0] as [
      string,
      {
        topic: string;
        payload: string;
        qos: number;
        properties: { userProperties: Array<{ uid: string; key: string; value: string }> };
      },
      string,
    ];
    expect(sendId).toBe('send-2');
    expect(origin).toBe('script');
    expect(wire).toMatchObject({ topic: 'probe/ack', payload: 'ok', qos: 1 });
    expect(wire.properties.userProperties[0]).toMatchObject({ key: 'k', value: 'v' });
    expect(typeof wire.properties.userProperties[0]?.uid).toBe('string');
  });

  it('never throws — a scope-less call folds into an error reply', async () => {
    setPageScriptScope({
      workspaceId: null,
      resolveVariable: () => null,
      workspaceVariables: { schemaVersion: 5, variables: [] },
      vault: { schemaVersion: 5, secrets: [] },
      packages: [],
    });
    const reply = await handlePageScriptHostRequest({ ...envelope, op: 'variables.set', name: 'x', value: '1' });
    expect(reply).toMatchObject({ ok: false, error: 'oh.variables.set: no workspace to write to' });
  });
});

describe('the sandbox iframe transport', () => {
  it('mounts the manifest sandbox page hidden in the document on the first hook run', async () => {
    // jsdom stamps no `source` on a posted message, so the transport's
    // own-frame check (the offscreen document's law) cannot pass here;
    // the broker ⇄ runtime round trip is the core broker's and the
    // sandbox runtime's pinned contract — this pin stops at the mount.
    const host = getPageScriptHost();
    if (host === null) throw new Error('host unavailable');
    void host.run({
      kind: 'ws-on-message',
      source: `console.log(oh.message.text);`,
      sessionId: 'send-iframe',
      hook: {
        kind: 'ws-on-message',
        message: { direction: 'down', text: 'hi', dataBase64: 'aGk=', binary: false, index: 0 },
      },
    });
    const iframe = await vi.waitFor(() => {
      const el = document.querySelector<HTMLIFrameElement>('iframe[data-testid="oh-page-script-sandbox"]');
      if (el === null) throw new Error('iframe not mounted yet');
      return el;
    });
    expect(iframe.src).toBe('chrome-extension://x/sandbox.html');
    expect(iframe.hidden).toBe(true);
    expect(document.querySelectorAll('iframe[data-testid="oh-page-script-sandbox"]')).toHaveLength(1);
    host.endSession('send-iframe');
  });
});
