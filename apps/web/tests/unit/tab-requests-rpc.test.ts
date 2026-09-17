/**
 * The web tab's own HTTP send (Phase W) — the tab's seam into the
 * shared request route: the tab owns exactly the send, its Stop and
 * the jar trio; every send rides the delegating transport toward the
 * serving daemon with the tab's jar and the read workspace as the
 * gate's subject, whatever place the frame names; the live frames fan
 * out on the in-tab broadcast; the script chain resolves through the
 * one host-neutral capability gate (the tab's Safe sandbox, registered
 * at boot); a Send and a Query reach the
 * shared route with the tab's seam; the Stop hits the in-tab registry
 * first and forwards a miss up the wire; the jar trio answers from the
 * tab's own jars.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-tab' as string | null,
  stopped: false,
  transports: [] as unknown[],
  routed: [] as { route: string; message: unknown; host: unknown }[],
}));

vi.mock('@openheaders/oracle/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('@openheaders/oracle/live/request-exec/send-stream', () => ({
  stopActiveSend: () => h.stopped,
}));
vi.mock('@openheaders/oracle/live/request-exec/delegating-transport', () => ({
  createDelegatingRequestTransport: (options: unknown) => {
    h.transports.push(options);
    return { send: async () => ({}) };
  },
}));
vi.mock('@openheaders/oracle/live/request-route/route', () => ({
  executeRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'request', message, host });
    return { success: true };
  },
  executeGraphqlRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'graphql', message, host });
    return { success: true };
  },
}));

import { cookieJarFor, resetCookieJars } from '@openheaders/oracle/live/request-exec/cookie-jar';
import { resolveInteractiveScriptRunner } from '@openheaders/oracle/live/script-host/capability';
import { webDelegatedWire } from '@/host/delegated-wire';
import { dispatchTabRequestsRpc, isTabRequestsChannel, webRequestRouteHost } from '@/host/tab-requests-rpc';
import { subscribeLocal } from '@/host/web-broadcast';
import { handleWireRpcResponseFrame, setWireRpcSender } from '@/host/wire-rpc';

const REQUEST: Request = {
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
};

describe('tab-requests-rpc', () => {
  let sent: Record<string, unknown>[];

  beforeEach(() => {
    sent = [];
    h.activeWorkspaceId = 'ws-tab';
    h.stopped = false;
    h.transports = [];
    h.routed = [];
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

  it('hands every send the delegating transport toward the serving daemon with the tab jar, whatever place the frame names', () => {
    webRequestRouteHost.transportFor(undefined, 'ws-tab');
    webRequestRouteHost.transportFor('some-other-backend', 'ws-peer');
    expect(h.transports).toEqual([
      { wire: webDelegatedWire, workspaceId: 'ws-tab', jars: cookieJarFor },
      { wire: webDelegatedWire, workspaceId: 'ws-peer', jars: cookieJarFor },
    ]);
  });

  it('fans the live frames out on the in-tab broadcast, and resolves the script chain through the shared capability gate', () => {
    const frames: unknown[] = [];
    const release = subscribeLocal('requestStreamEvent', (event) => frames.push(event));
    const frame: RequestStreamEventWire = { sendId: 's-1', seq: 0, kind: 'done' };
    webRequestRouteHost.emitStreamEvent(frame);
    expect(frames).toEqual([frame]);
    release();
    expect(webRequestRouteHost.resolveScriptRunner).toBe(resolveInteractiveScriptRunner);
  });

  it('routes a Send and a Query to the shared route with the tab seam', async () => {
    const send = await dispatchTabRequestsRpc('executeRequest', {
      type: 'executeRequest',
      draft: REQUEST,
      sendId: 's-1',
    });
    const query = await dispatchTabRequestsRpc('executeGraphqlRequest', {
      type: 'executeGraphqlRequest',
      sendId: 's-2',
    });
    expect(send).toEqual({ success: true });
    expect(query).toEqual({ success: true });
    expect(h.routed.map((r) => r.route)).toEqual(['request', 'graphql']);
    for (const r of h.routed) expect(r.host).toBe(webRequestRouteHost);
    expect((h.routed[0].message as { draft: Request }).draft).toBe(REQUEST);
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
