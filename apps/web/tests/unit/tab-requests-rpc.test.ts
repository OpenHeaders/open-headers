/**
 * The web tab's own HTTP send and gRPC call (Phase W) — the tab's seam
 * into the shared routes: the tab owns exactly the send, the call, its
 * two riders, the Stop and the jar trio; every send rides the
 * delegating transport toward the serving daemon with the tab's jar
 * and the read workspace as the gate's subject, whatever place the
 * frame names; every call leases the delegating gRPC transport toward
 * the same daemon; the live frames fan out on the in-tab broadcast;
 * the script chain and the hooks resolve through the one host-neutral
 * capability gate (the tab's Safe sandbox, registered at boot); a
 * Send, a Query and an Invoke reach the shared routes with the tab's
 * seams; the Stop answers from the in-tab registry alone; the riders
 * answer from the active-stream registry; the jar trio answers from
 * the tab's own jars.
 */

import type { GrpcStreamEventWire, RequestStreamEventWire } from '@openheaders/core/bridge';
import type { Request } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-tab' as string | null,
  stopped: false,
  transports: [] as unknown[],
  grpcLeases: [] as { wire: unknown; workspaceId: string }[],
  routed: [] as { route: string; message: unknown; host: unknown }[],
  streamSends: [] as { sendId: string; messageText: string }[],
  streamEnds: [] as string[],
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
vi.mock('@openheaders/oracle/live/grpc-route/host', () => ({
  delegatedGrpcTransportLease: (wire: unknown, workspaceId: string) => {
    h.grpcLeases.push({ wire, workspaceId });
    return { transport: {}, executedOn: () => null };
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
vi.mock('@openheaders/oracle/live/grpc-route/route', () => ({
  executeGrpcRequestRoute: async (message: unknown, host: unknown) => {
    h.routed.push({ route: 'grpc', message, host });
    return { success: true };
  },
}));
vi.mock('@openheaders/oracle/live/grpc-exec/stream-plane', () => ({
  sendActiveGrpcStreamMessage: (sendId: string, messageText: string) => {
    h.streamSends.push({ sendId, messageText });
    return { success: true };
  },
  endActiveGrpcClientStream: (sendId: string) => {
    h.streamEnds.push(sendId);
    return true;
  },
}));

import { cookieJarFor, resetCookieJars } from '@openheaders/oracle/live/request-exec/cookie-jar';
import {
  resolveInteractiveScriptRunner,
  resolveSessionScriptHost,
} from '@openheaders/oracle/live/script-host/capability';
import { webDelegatedGrpcWire, webDelegatedWire } from '@/host/delegated-wire';
import {
  dispatchTabRequestsRpc,
  isTabRequestsChannel,
  webGrpcRouteHost,
  webRequestRouteHost,
} from '@/host/tab-requests-rpc';
import { subscribeLocal } from '@/host/web-broadcast';
import { setWireRpcSender } from '@/host/wire-rpc';

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
    h.grpcLeases = [];
    h.routed = [];
    h.streamSends = [];
    h.streamEnds = [];
    resetCookieJars();
    setWireRpcSender((message) => {
      sent.push(message);
      return true;
    });
  });

  it('owns exactly the send, the call and its two riders, the Stop and the jar trio', () => {
    for (const type of [
      'executeRequest',
      'executeGraphqlRequest',
      'executeGrpcRequest',
      'sendGrpcStreamMessage',
      'endGrpcClientStream',
      'abortRequestSend',
      'getCookieJarSummary',
      'clearCookieJar',
      'deleteCookieJarEntry',
    ]) {
      expect(isTabRequestsChannel(type)).toBe(true);
    }
    expect(isTabRequestsChannel('executeWebSocketRequest')).toBe(false);
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

  it('leases every call the delegating gRPC transport toward the serving daemon, the OAuth renewal through the HTTP leg with the tab jar', () => {
    webGrpcRouteHost.transportFor(undefined, 'ws-tab');
    webGrpcRouteHost.transportFor('some-other-backend', 'ws-peer');
    expect(h.grpcLeases).toEqual([
      { wire: webDelegatedGrpcWire, workspaceId: 'ws-tab' },
      { wire: webDelegatedGrpcWire, workspaceId: 'ws-peer' },
    ]);
    webGrpcRouteHost.refreshTransportFor?.('ws-tab');
    expect(h.transports).toEqual([{ wire: webDelegatedWire, workspaceId: 'ws-tab', jars: cookieJarFor }]);
    expect(webGrpcRouteHost.resolveScriptHost).toBe(resolveSessionScriptHost);
  });

  it('fans the live frames out on the in-tab broadcasts, and resolves the script chain through the shared capability gate', () => {
    const frames: unknown[] = [];
    const releaseRequest = subscribeLocal('requestStreamEvent', (event) => frames.push(event));
    const frame: RequestStreamEventWire = { sendId: 's-1', seq: 0, kind: 'done' };
    webRequestRouteHost.emitStreamEvent(frame);
    expect(frames).toEqual([frame]);
    releaseRequest();
    const grpcFrames: unknown[] = [];
    const releaseGrpc = subscribeLocal('grpcStreamEvent', (event) => grpcFrames.push(event));
    const grpcFrame: GrpcStreamEventWire = { sendId: 's-2', seq: 0, kind: 'end', atMs: 1 };
    webGrpcRouteHost.emitStreamEvent(grpcFrame);
    expect(grpcFrames).toEqual([grpcFrame]);
    releaseGrpc();
    expect(webRequestRouteHost.resolveScriptRunner).toBe(resolveInteractiveScriptRunner);
  });

  it('routes a Send, a Query and an Invoke to the shared routes with the tab seams', async () => {
    const send = await dispatchTabRequestsRpc('executeRequest', {
      type: 'executeRequest',
      draft: REQUEST,
      sendId: 's-1',
    });
    const query = await dispatchTabRequestsRpc('executeGraphqlRequest', {
      type: 'executeGraphqlRequest',
      sendId: 's-2',
    });
    const invoke = await dispatchTabRequestsRpc('executeGrpcRequest', {
      type: 'executeGrpcRequest',
      sendId: 's-3',
    });
    expect(send).toEqual({ success: true });
    expect(query).toEqual({ success: true });
    expect(invoke).toEqual({ success: true });
    expect(h.routed.map((r) => r.route)).toEqual(['request', 'graphql', 'grpc']);
    expect(h.routed[0].host).toBe(webRequestRouteHost);
    expect(h.routed[1].host).toBe(webRequestRouteHost);
    expect(h.routed[2].host).toBe(webGrpcRouteHost);
    expect((h.routed[0].message as { draft: Request }).draft).toBe(REQUEST);
  });

  it('answers the gRPC riders from the active-stream registry and refuses a rider missing its id', async () => {
    expect(
      await dispatchTabRequestsRpc('sendGrpcStreamMessage', {
        type: 'sendGrpcStreamMessage',
        sendId: 's-3',
        messageText: '{}',
      }),
    ).toEqual({ success: true });
    expect(await dispatchTabRequestsRpc('endGrpcClientStream', { type: 'endGrpcClientStream', sendId: 's-3' })).toEqual(
      { success: true },
    );
    expect(h.streamSends).toEqual([{ sendId: 's-3', messageText: '{}' }]);
    expect(h.streamEnds).toEqual(['s-3']);
    expect(await dispatchTabRequestsRpc('sendGrpcStreamMessage', { type: 'sendGrpcStreamMessage' })).toEqual({
      success: false,
      error: 'No stream id or message provided',
    });
    expect(await dispatchTabRequestsRpc('endGrpcClientStream', { type: 'endGrpcClientStream' })).toEqual({
      success: false,
    });
  });

  it('stops an in-tab send or call from the shared registry alone, and never forwards a miss', async () => {
    h.stopped = true;
    expect(await dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend', sendId: 's-1' })).toEqual({
      success: true,
    });
    h.stopped = false;
    expect(await dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend', sendId: 's-2' })).toEqual({
      success: false,
    });
    expect(await dispatchTabRequestsRpc('abortRequestSend', { type: 'abortRequestSend' })).toEqual({ success: false });
    expect(sent).toHaveLength(0);
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
