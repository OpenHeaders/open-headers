/**
 * The host-neutral session route over a fake host seam — the laws
 * every session host inherits: the frame's place reaches the seam by
 * explicit backend id (absent = the host's own socket) with the read
 * workspace as the gate's subject, and the lease's stamp lands on the
 * snapshot; the pin rules verbatim (unpinned on the active workspace,
 * pinned on a foreign one — a forwarded session — and on an explicit
 * No-environment); the script host and the OAuth renewal are the
 * seam's; a host without an active workspace and no stated one
 * answers an error snapshot; `sendId` is required; uid over draft, a
 * missing uid an error snapshot; a GraphQL compile refusal an error
 * snapshot; the riders answer from the registries by plane.
 */

import type { GraphqlRequest, MqttRequest, WebSocketRequest } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  activeWorkspaceId: 'ws-active' as string | null,
  slots: new Map<string, unknown[]>(),
  wsRuns: [] as { request: unknown; options: Record<string, unknown> }[],
  mqttRuns: [] as { request: unknown; options: Record<string, unknown> }[],
  refreshHooks: [] as { workspaceId: string | undefined; transport: unknown }[],
}));

vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  peekActiveWorkspaceId: () => h.activeWorkspaceId,
}));
vi.mock('../../../src/storage', () => ({
  wsKeys: (workspaceId: string) => ({
    websocketRequests: `${workspaceId}:websocketRequests`,
    mqttRequests: `${workspaceId}:mqttRequests`,
    graphqlRequests: `${workspaceId}:graphqlRequests`,
  }),
  hostStorage: { getValidatedArray: async (key: string) => h.slots.get(key) ?? [] },
}));
vi.mock('../../../src/live/ws-exec/execute', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/live/ws-exec/execute')>();
  return {
    ...actual,
    executeWsSession: async (request: unknown, options: Record<string, unknown>) => {
      h.wsRuns.push({ request, options });
      return { ...actual.errorWsSnapshot('stub'), outcome: { kind: 'connected' } };
    },
  };
});
vi.mock('../../../src/live/mqtt-exec/execute', async (importActual) => {
  const actual = await importActual<typeof import('../../../src/live/mqtt-exec/execute')>();
  return {
    ...actual,
    executeMqttSession: async (request: unknown, options: Record<string, unknown>) => {
      h.mqttRuns.push({ request, options });
      return { ...actual.errorMqttSnapshot('stub'), outcome: { kind: 'connected' } };
    },
  };
});
vi.mock('../../../src/live/request-exec/oauth-refresh', () => ({
  buildRefreshOAuthHook: (workspaceId: string | undefined, transport: unknown) => {
    h.refreshHooks.push({ workspaceId, transport });
    return async () => null;
  },
}));

import { executeRouteScope, pinExecuteScope } from '../../../src/live/execute-route-scope';
import type { MqttByteTransport } from '../../../src/live/mqtt-exec/transport';
import type { RequestTransport } from '../../../src/live/request-exec/transport';
import {
  ownTransportLease,
  type SessionRouteHost,
  type SessionTransportLease,
} from '../../../src/live/session-route/host';
import { executeMqttRequestRoute } from '../../../src/live/session-route/mqtt-route';
import {
  dispatchSessionRider,
  isMqttSessionRiderChannel,
  isSessionRiderChannel,
  isWsSessionRiderChannel,
} from '../../../src/live/session-route/riders';
import {
  executeGraphqlSubscriptionRoute,
  executeWebSocketRequestRoute,
} from '../../../src/live/session-route/ws-route';
import type { WsTransport } from '../../../src/live/ws-exec/transport';

const OWN_WS: WsTransport = { connect: () => ({ send: () => {}, close: () => {} }) };
const OWN_MQTT: MqttByteTransport = { connect: () => ({ write: () => {}, end: () => {} }) };
const REFRESH: RequestTransport = {
  send: async () => {
    throw new Error('the renewal leg is never dialed here');
  },
};
const STAMP = { kind: 'backend' as const, name: 'workbox' };

function wsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'wsrq0001',
    path: 'requests/live-wsrq0001',
    name: 'Live',
    url: 'wss://events.openheaders.io/live',
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

function mqttRequest(): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqrq0001',
    path: 'requests/broker-mqrq0001',
    name: 'Broker',
    url: 'mqtts://broker.openheaders.io:8883',
    clientId: 'oh-probe',
    topic: 'probe/echo',
    payload: 'hello',
    topics: [],
    savedMessages: [],
    userProperties: [],
    auth: { type: 'none' },
  };
}

/** A seam that records what the route asked of it and stamps a
 *  delegated lease when the frame names a place. */
function fakeHost(): SessionRouteHost & {
  leases: { kind: 'ws' | 'mqtt'; placeBackendId: string | undefined; workspaceId: string }[];
  scriptAsks: { workspaceId: string; forwarded: boolean }[];
  refreshAsks: string[];
} {
  const host = {
    leases: [] as { kind: 'ws' | 'mqtt'; placeBackendId: string | undefined; workspaceId: string }[],
    scriptAsks: [] as { workspaceId: string; forwarded: boolean }[],
    refreshAsks: [] as string[],
    wsTransportFor(placeBackendId: string | undefined, workspaceId: string): SessionTransportLease<WsTransport> {
      host.leases.push({ kind: 'ws', placeBackendId, workspaceId });
      return placeBackendId !== undefined ? { transport: OWN_WS, executedOn: () => STAMP } : ownTransportLease(OWN_WS);
    },
    mqttTransportFor(
      placeBackendId: string | undefined,
      workspaceId: string,
    ): SessionTransportLease<MqttByteTransport> {
      host.leases.push({ kind: 'mqtt', placeBackendId, workspaceId });
      return placeBackendId !== undefined
        ? { transport: OWN_MQTT, executedOn: () => STAMP }
        : ownTransportLease(OWN_MQTT);
    },
    async resolveScriptHost(input: { workspaceId: string; forwarded: boolean }) {
      host.scriptAsks.push(input);
      return null;
    },
    refreshTransportFor(workspaceId: string): RequestTransport {
      host.refreshAsks.push(workspaceId);
      return REFRESH;
    },
    emitWsStreamEvent: () => {},
    emitMqttStreamEvent: () => {},
  };
  return host;
}

beforeEach(() => {
  h.activeWorkspaceId = 'ws-active';
  h.slots.clear();
  h.wsRuns = [];
  h.mqttRuns = [];
  h.refreshHooks = [];
});

describe('the session route — the host seam', () => {
  it("leases the host's own socket for a frame naming no place, and stamps nothing", async () => {
    const host = fakeHost();
    const result = await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-1' }, host);
    expect(result.success).toBe(true);
    expect(result.snapshot?.executedOn).toBeUndefined();
    expect(host.leases).toEqual([{ kind: 'ws', placeBackendId: undefined, workspaceId: 'ws-active' }]);
    expect(h.wsRuns[0].options.transport).toBe(OWN_WS);
    expect(h.wsRuns[0].options.sendId).toBe('s-1');
    expect(h.wsRuns[0].options.emitStreamEvent).toBe(host.emitWsStreamEvent);
  });

  it('hands the frame’s explicit place to the seam with the read workspace, and stamps who answered', async () => {
    const host = fakeHost();
    const ws = await executeWebSocketRequestRoute(
      { draft: wsRequest(), sendId: 's-2', executionPlace: { backendId: 'srv-1' } },
      host,
    );
    expect(ws.snapshot?.executedOn).toEqual(STAMP);
    const mqtt = await executeMqttRequestRoute(
      { draft: mqttRequest(), sendId: 's-3', executionPlace: { backendId: 'srv-1' }, workspaceId: 'ws-other' },
      host,
    );
    expect(mqtt.snapshot?.executedOn).toEqual(STAMP);
    expect(host.leases).toEqual([
      { kind: 'ws', placeBackendId: 'srv-1', workspaceId: 'ws-active' },
      { kind: 'mqtt', placeBackendId: 'srv-1', workspaceId: 'ws-other' },
    ]);
    // A blank id is no place.
    await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-4', executionPlace: { backendId: '' } }, host);
    expect(host.leases[2].placeBackendId).toBeUndefined();
  });

  it("asks the seam for the script host by the read workspace and the forwarded flag, and renews OAuth through the seam's transport", async () => {
    const host = fakeHost();
    await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-5' }, host);
    await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-6', workspaceId: 'ws-peer' }, host);
    expect(host.scriptAsks).toEqual([
      { workspaceId: 'ws-active', forwarded: false },
      { workspaceId: 'ws-peer', forwarded: true },
    ]);
    expect(host.refreshAsks).toEqual(['ws-active', 'ws-peer']);
    expect(h.refreshHooks).toEqual([
      { workspaceId: undefined, transport: REFRESH },
      { workspaceId: 'ws-peer', transport: REFRESH },
    ]);
    expect(h.wsRuns[0].options.refreshOAuth).toBeTypeOf('function');
    expect(h.wsRuns[0].options.scriptHost).toBeUndefined();
  });

  it('a seam without a script host or a refresh leg runs the session scriptless with the stored bundle', async () => {
    const host = fakeHost();
    const bare: SessionRouteHost = {
      wsTransportFor: host.wsTransportFor,
      mqttTransportFor: host.mqttTransportFor,
      emitWsStreamEvent: host.emitWsStreamEvent,
      emitMqttStreamEvent: host.emitMqttStreamEvent,
    };
    await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-7' }, bare);
    await executeMqttRequestRoute({ draft: mqttRequest(), sendId: 's-8' }, bare);
    expect(h.wsRuns[0].options.scriptHost).toBeUndefined();
    expect(h.wsRuns[0].options.refreshOAuth).toBeUndefined();
    expect(h.mqttRuns[0].options.scriptHost).toBeUndefined();
    expect(h.refreshHooks).toEqual([]);
  });
});

describe('the session route — the pin rules', () => {
  it('runs unpinned on the active workspace, pinned on a foreign one, and pinned env-free on an explicit No environment', () => {
    expect(pinExecuteScope(executeRouteScope({}))).toEqual({
      workspaceId: null,
      readWorkspaceId: 'ws-active',
      forwarded: false,
    });
    expect(pinExecuteScope(executeRouteScope({ workspaceId: 'ws-active', environmentId: 'env-1' }))).toEqual({
      workspaceId: null,
      readWorkspaceId: 'ws-active',
      forwarded: false,
    });
    expect(pinExecuteScope(executeRouteScope({ workspaceId: 'ws-peer' }))).toEqual({
      workspaceId: 'ws-peer',
      readWorkspaceId: 'ws-peer',
      forwarded: true,
    });
    expect(pinExecuteScope(executeRouteScope({ environmentId: null }))).toEqual({
      workspaceId: 'ws-active',
      readWorkspaceId: 'ws-active',
      forwarded: false,
    });
    h.activeWorkspaceId = null;
    expect(pinExecuteScope(executeRouteScope({}))).toBeNull();
    expect(pinExecuteScope(executeRouteScope({ workspaceId: 'ws-peer' }))?.readWorkspaceId).toBe('ws-peer');
  });

  it('the executor receives the pinned workspace and the environment tri-state verbatim', async () => {
    const host = fakeHost();
    await executeMqttRequestRoute({ draft: mqttRequest(), sendId: 's-9', environmentId: null }, host);
    expect(h.mqttRuns[0].options.workspaceId).toBe('ws-active');
    expect(h.mqttRuns[0].options.environmentId).toBeNull();
    await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-10', environmentId: 'env-2' }, host);
    expect(h.wsRuns[0].options.workspaceId).toBeNull();
    expect(h.wsRuns[0].options.environmentId).toBe('env-2');
  });

  it('a host with no active workspace and no stated one answers an error snapshot on every route', async () => {
    h.activeWorkspaceId = null;
    const host = fakeHost();
    for (const result of [
      await executeWebSocketRequestRoute({ draft: wsRequest(), sendId: 's-11' }, host),
      await executeMqttRequestRoute({ draft: mqttRequest(), sendId: 's-12' }, host),
      await executeGraphqlSubscriptionRoute({ draft: graphqlRequest(), sendId: 's-13' }, host),
    ]) {
      expect(result.success).toBe(true);
      expect(result.snapshot?.outcome).toEqual({ kind: 'failed', error: 'No active workspace' });
    }
    expect(host.leases).toEqual([]);
  });
});

function graphqlRequest(): GraphqlRequest {
  return {
    schemaVersion: 5,
    uid: 'gqrq0001',
    path: 'requests/feed-gqrq0001',
    name: 'Feed',
    url: 'https://api.openheaders.io/graphql',
    query: 'subscription Feed { feed { id } }',
    headers: [],
    auth: { type: 'inherit' },
  };
}

describe('the session route — the contract', () => {
  it('requires a sendId and answers missing input with success: false', async () => {
    const host = fakeHost();
    expect(await executeWebSocketRequestRoute({ draft: wsRequest() }, host)).toEqual({
      success: false,
      error: 'No sendId provided — a session needs one',
    });
    expect(await executeMqttRequestRoute({ sendId: 's-14' }, host)).toEqual({
      success: false,
      error: 'No MQTT request or draft provided',
    });
    expect(await executeGraphqlSubscriptionRoute({ sendId: 's-15' }, host)).toEqual({
      success: false,
      error: 'No GraphQL request or draft provided',
    });
  });

  it('prefers the stored entity over a draft, reading the requested workspace; a missing uid is an error snapshot', async () => {
    const host = fakeHost();
    h.slots.set('ws-peer:websocketRequests', [wsRequest({ url: 'wss://stored.openheaders.io' })]);
    await executeWebSocketRequestRoute(
      {
        webSocketRequestUid: 'wsrq0001',
        draft: wsRequest({ url: 'wss://draft.openheaders.io' }),
        sendId: 's-16',
        workspaceId: 'ws-peer',
      },
      host,
    );
    expect((h.wsRuns[0].request as WebSocketRequest).url).toBe('wss://stored.openheaders.io');
    const missing = await executeMqttRequestRoute({ mqttRequestUid: 'gone', sendId: 's-17' }, host);
    expect(missing.snapshot?.outcome).toEqual({ kind: 'failed', error: 'MQTT request gone not found' });
    expect(h.mqttRuns).toEqual([]);
  });

  it('compiles a GraphQL subscription into the WebSocket session it rides; a compile refusal is an error snapshot', async () => {
    const host = fakeHost();
    const ok = await executeGraphqlSubscriptionRoute({ draft: graphqlRequest(), sendId: 's-18' }, host);
    expect(ok.success).toBe(true);
    expect((h.wsRuns[0].request as WebSocketRequest).uid).toBe('gqrq0001');
    expect(h.wsRuns[0].options.graphql).toBeDefined();
    const refused = await executeGraphqlSubscriptionRoute(
      { draft: { ...graphqlRequest(), url: 'ftp://api.openheaders.io/graphql' }, sendId: 's-19' },
      host,
    );
    expect(refused.success).toBe(true);
    expect(refused.snapshot?.outcome.kind).toBe('failed');
    expect(h.wsRuns).toHaveLength(1);
  });
});

describe('the session riders', () => {
  it('names the seven channels by plane', () => {
    expect(isWsSessionRiderChannel('sendWsMessage')).toBe(true);
    expect(isWsSessionRiderChannel('publishMqttMessage')).toBe(false);
    expect(isMqttSessionRiderChannel('setMqttSubscription')).toBe(true);
    expect(isSessionRiderChannel('reconnectMqttSessionNow')).toBe(true);
    expect(isSessionRiderChannel('executeWebSocketRequest')).toBe(false);
    expect(isSessionRiderChannel(null)).toBe(false);
  });

  it('answers an unknown session and missing input honestly', async () => {
    expect(await dispatchSessionRider('sendWsMessage', { sendId: 'gone', messageText: 'hi' })).toEqual({
      success: false,
      error: 'No open WebSocket session with this id.',
    });
    expect(await dispatchSessionRider('sendWsMessage', { sendId: 'gone' })).toEqual({
      success: false,
      error: 'No session id or message provided',
    });
    expect(await dispatchSessionRider('closeWsSession', { sendId: 'gone' })).toEqual({ success: false });
    expect(await dispatchSessionRider('reconnectWsSessionNow', {})).toEqual({ success: false });
    expect(await dispatchSessionRider('publishMqttMessage', { sendId: 'gone' })).toEqual({
      success: false,
      error: 'No session id or message provided',
    });
    expect(await dispatchSessionRider('setMqttSubscription', { sendId: 'gone', subscription: {} })).toEqual({
      success: false,
      error: 'No open MQTT session with this id.',
    });
    expect(await dispatchSessionRider('closeMqttSession', { sendId: 'gone' })).toEqual({ success: false });
    expect(await dispatchSessionRider('reconnectMqttSessionNow', { sendId: 'gone' })).toEqual({ success: false });
  });
});
