/**
 * The web tab's own HTTP send (Phase W) — the handlers' laws: the tab
 * owns exactly the send, its Stop and the jar trio; a Send resolves
 * IN the tab through the step runner over the delegating transport
 * toward the serving daemon with the tab's jar and the caller's send
 * id for the live frames; the daemon's rule for the environment
 * tri-state (an explicit null pins the active workspace env-free, an
 * absent pointer runs unpinned); a GraphQL Query compiles ONCE into
 * the same run; a tab with no active workspace, or a missing entity,
 * answers an error SNAPSHOT; the Stop hits the in-tab registry first
 * and forwards a miss up the wire; the jar trio answers from the
 * tab's own jars.
 */

import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-tab' as string | null,
  request: null as Request | null,
  graphqlRequests: [] as unknown[],
  stopped: false,
  runs: [] as unknown[],
  transports: [] as unknown[],
}));

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: (uid: string) => (h.request?.uid === uid ? h.request : undefined),
}));
vi.mock('@openheaders/oracle/storage', () => ({
  hostStorage: { getValidatedArray: async () => h.graphqlRequests },
  wsKeys: (workspaceId: string) => ({ graphqlRequests: `${workspaceId}:graphqlRequests` }),
}));
vi.mock('@openheaders/oracle/live/request-exec/send-stream', () => ({
  stopActiveSend: () => h.stopped,
}));
vi.mock('@openheaders/oracle/live/request-exec/oauth-refresh', () => ({
  buildRefreshOAuthHook: () => async () => null,
}));
vi.mock('@openheaders/oracle/live/request-exec/delegating-transport', () => ({
  createDelegatingRequestTransport: (options: unknown) => {
    h.transports.push(options);
    return { send: async () => ({}) };
  },
}));
vi.mock('@openheaders/oracle/live/request-exec/run-step-request', () => ({
  runStepRequest: async (request: Request, options: unknown) => {
    h.runs.push({ request, options });
    return { status: 200, error: null, url: request.url };
  },
}));

import { cookieJarFor, resetCookieJars } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { webDelegatedWire } from '@/host/delegated-wire';
import { dispatchTabRequestsRpc, isTabRequestsChannel } from '@/host/tab-requests-rpc';
import { handleWireRpcResponseFrame, setWireRpcSender } from '@/host/wire-rpc';

const REQUEST = {
  schemaVersion: 5,
  uid: 'req0001',
  path: 'requests/items-req0001',
  name: 'Items',
  method: 'GET',
  url: 'https://api.openheaders.io/items',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none' },
} as unknown as Request;

type Run = { request: Request; options: Record<string, unknown> };
type TransportOptions = { wire: unknown; workspaceId: string; jars?: unknown };

describe('tab-requests-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeEach(() => {
    sent = [];
    h.activeWorkspaceId = 'ws-tab';
    h.request = REQUEST;
    h.graphqlRequests = [];
    h.stopped = false;
    h.runs = [];
    h.transports = [];
    resetCookieJars();
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it('owns exactly the send, its Stop and the jar trio', () => {
    for (const type of [
      'executeRequest',
      'executeGraphqlRequest',
      'abortRequestSend',
      'getCookieJarSummary',
      'clearCookieJar',
      'deleteCookieJarEntry',
    ]) {
      expect(isTabRequestsChannel(type)).toBe(true);
    }
    expect(isTabRequestsChannel('executeGrpcRequest')).toBe(false);
    expect(isTabRequestsChannel(undefined)).toBe(false);
  });

  it('runs a Send in the tab over the delegating transport toward the daemon, with the tab jar and the caller send id', async () => {
    const result = await dispatchTabRequestsRpc('executeRequest', {
      type: 'executeRequest',
      draft: REQUEST,
      sendId: 'send-1',
    });
    expect(result).toEqual({ success: true, snapshot: { status: 200, error: null, url: REQUEST.url } });
    const transport = h.transports[0] as TransportOptions;
    expect(transport.wire).toBe(webDelegatedWire);
    expect(transport.workspaceId).toBe('ws-tab');
    expect(transport.jars).toBe(cookieJarFor);
    const run = h.runs[0] as Run;
    expect(run.request).toBe(REQUEST);
    // Unpinned against the Active-bound mirrors; the pointer defers.
    expect(run.options.workspaceId).toBeNull();
    expect(run.options.environmentId).toBeUndefined();
    expect((run.options.stream as { sendId: string }).sendId).toBe('send-1');
  });

  it('loads a saved request by uid, and answers an error snapshot for a missing one', async () => {
    await dispatchTabRequestsRpc('executeRequest', { type: 'executeRequest', requestUid: 'req0001' });
    expect((h.runs[0] as Run).request).toBe(REQUEST);
    const missing = (await dispatchTabRequestsRpc('executeRequest', {
      type: 'executeRequest',
      requestUid: 'nope',
    })) as {
      success: boolean;
      snapshot: { error: string | null };
    };
    expect(missing.success).toBe(true);
    expect(missing.snapshot.error).toBe('Request nope not found');
    expect(await dispatchTabRequestsRpc('executeRequest', { type: 'executeRequest' })).toEqual({
      success: false,
      error: 'No request or draft provided',
    });
  });

  it('an explicit No-environment pins the active workspace env-free; a tab with no active workspace answers honestly', async () => {
    await dispatchTabRequestsRpc('executeRequest', { type: 'executeRequest', draft: REQUEST, environmentId: null });
    const pinned = h.runs[0] as Run;
    expect(pinned.options.workspaceId).toBe('ws-tab');
    expect(pinned.options.environmentId).toBeNull();
    h.activeWorkspaceId = null;
    const result = (await dispatchTabRequestsRpc('executeRequest', { type: 'executeRequest', draft: REQUEST })) as {
      success: boolean;
      snapshot: { error: string | null };
    };
    expect(result.success).toBe(true);
    expect(result.snapshot.error).toBe('No active workspace');
    expect(h.runs).toHaveLength(1);
  });

  it('compiles a GraphQL Query once into the same run, by draft or by uid', async () => {
    const entity = {
      schemaVersion: 5,
      uid: 'gqrq0001',
      path: 'requests/viewer-gqrq0001',
      name: 'Viewer',
      url: 'https://api.openheaders.io/graphql',
      query: 'query Viewer { viewer { id } }',
      headers: [],
      auth: { type: 'inherit' },
    };
    await dispatchTabRequestsRpc('executeGraphqlRequest', { type: 'executeGraphqlRequest', draft: entity });
    const compiled = (h.runs[0] as Run).request;
    expect(compiled.method).toBe('POST');
    expect(compiled.uid).toBe('gqrq0001');
    h.graphqlRequests = [entity];
    await dispatchTabRequestsRpc('executeGraphqlRequest', {
      type: 'executeGraphqlRequest',
      graphqlRequestUid: 'gqrq0001',
    });
    expect((h.runs[1] as Run).request.uid).toBe('gqrq0001');
    const missing = (await dispatchTabRequestsRpc('executeGraphqlRequest', {
      type: 'executeGraphqlRequest',
      graphqlRequestUid: 'nope',
    })) as { snapshot: { error: string | null } };
    expect(missing.snapshot.error).toBe('GraphQL request nope not found');
  });

  it('stops an in-tab send first, and forwards a miss up the wire for a forwarded invoke', async () => {
    h.stopped = true;
    expect(await dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend', sendId: 's-1' })).toEqual({
      success: true,
    });
    expect(sent).toHaveLength(0);
    h.stopped = false;
    const forwarded = dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend', sendId: 's-2' });
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: 'abortRequestSend', sendId: 's-2' });
    handleWireRpcResponseFrame({ type: 'abortRequestSend:response', payload: { success: true } });
    await expect(forwarded).resolves.toEqual({ success: true });
    expect(await dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend' })).toEqual({ success: false });
  });

  it('answers the jar trio from the tab own jars — the stated workspace, else the active one', async () => {
    cookieJarFor('ws-tab').store('https://api.openheaders.io/', [{ name: 'sid', value: 'abc' }]);
    cookieJarFor('ws-other').store('https://api.openheaders.io/', [{ name: 'other', value: '1' }]);
    const active = (await dispatchTabRequestsRpc('getCookieJarSummary', { type: 'getCookieJarSummary' })) as {
      cookies: { name: string }[];
    };
    expect(active.cookies.map((c) => c.name)).toEqual(['sid']);
    const stated = (await dispatchTabRequestsRpc('getCookieJarSummary', {
      type: 'getCookieJarSummary',
      workspaceId: 'ws-other',
    })) as { cookies: { name: string }[] };
    expect(stated.cookies.map((c) => c.name)).toEqual(['other']);
    await dispatchTabRequestsRpc('deleteCookieJarEntry', {
      type: 'deleteCookieJarEntry',
      name: 'sid',
      domain: 'api.openheaders.io',
      path: '/',
    });
    expect(cookieJarFor('ws-tab').list()).toEqual([]);
    await dispatchTabRequestsRpc('clearCookieJar', { type: 'clearCookieJar', workspaceId: 'ws-other' });
    expect(cookieJarFor('ws-other').list()).toEqual([]);
    expect(sent).toHaveLength(0);
  });
});
