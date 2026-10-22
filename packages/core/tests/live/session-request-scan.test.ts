/**
 * The session-kind + GraphQL template scans — one collector per wire
 * kind, each mirroring its executor's field list: a disabled row never
 * counts, the version and flavor lenses gate what the kind's wire
 * carries, and the grouped and flat readings agree.
 */

import { describe, expect, it } from 'vitest';
import { toHttpRequest } from '../../src/graphql/compile';
import {
  collectGraphqlRequestTemplateStrings,
  collectGraphqlTemplateGroups,
} from '../../src/live/graphql-request-scan';
import { collectGrpcRequestTemplateStrings, collectGrpcTemplateGroups } from '../../src/live/grpc-request-scan';
import { collectMqttRequestTemplateStrings, collectMqttTemplateGroups } from '../../src/live/mqtt-request-scan';
import { collectRequestTemplateStrings } from '../../src/live/request-scan';
import {
  collectWebSocketRequestTemplateStrings,
  collectWebSocketTemplateGroups,
} from '../../src/live/websocket-request-scan';
import type { GraphqlRequest, GrpcRequest, MqttRequest, WebSocketRequest } from '../../src/types';
import { buildEmptyGraphqlRequest } from '../../src/utils/graphql-request-defaults';
import { buildEmptyGrpcRequest } from '../../src/utils/grpc-request-defaults';
import { buildEmptyMqttRequest } from '../../src/utils/mqtt-request-defaults';
import { buildEmptyWebSocketRequest } from '../../src/utils/websocket-request-defaults';

function makeMqtt(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    ...buildEmptyMqttRequest({ uid: 'mqttreq01', path: 'requests/telemetry', name: 'Telemetry' }),
    url: 'mqtt://broker.openheaders.io:1883/{{env.TENANT}}',
    topic: 'sensors/{{env.ROOM}}/temp',
    payload: '{"id": "{{vault.DEVICE_ID}}"}',
    publishProperties: { contentType: '{{env.CONTENT_TYPE}}', userProperties: [] },
    topics: [
      {
        uid: 'topic0001',
        topicFilter: 'alerts/{{env.ROOM}}/#',
        userProperties: [{ uid: 'tpup0001', key: 'k', value: '{{env.SUB_PROP}}' }],
      },
      { uid: 'topic0002', topicFilter: 'muted/{{env.MUTED}}', subscribe: false },
      { uid: 'topic0003', topicFilter: '   ' },
    ],
    userProperties: [
      { uid: 'cnup0001', key: 'region', value: '{{env.REGION}}', enabled: true },
      { uid: 'cnup0002', key: 'off', value: '{{env.OFF}}', enabled: false },
    ],
    auth: { type: 'basic', username: '{{env.USER}}', password: '{{vault.PASS}}' },
    lastWill: {
      topic: 'status/{{env.ROOM}}',
      payload: 'offline',
      properties: { responseTopic: '{{env.WILL_REPLY}}', userProperties: [] },
    },
    clientId: 'oh-{{env.CLIENT}}',
    sniServerName: '{{env.SNI}}',
    alpnProtocol: '{{env.ALPN}}',
    ...overrides,
  };
}

describe('collectMqttTemplateGroups', () => {
  it('groups the executor field list — Connect, subscribe and the publish compose', () => {
    const groups = collectMqttTemplateGroups(makeMqtt());
    expect(groups.url).toEqual(['mqtt://broker.openheaders.io:1883/{{env.TENANT}}']);
    expect(groups.auth).toEqual(['{{env.USER}}', '{{vault.PASS}}']);
    expect(groups.userProperties).toEqual(['region', '{{env.REGION}}']);
    expect(groups.lastWill).toEqual(['status/{{env.ROOM}}', 'offline', '{{env.WILL_REPLY}}']);
    expect(groups.topics).toEqual(['alerts/{{env.ROOM}}/#', 'k', '{{env.SUB_PROP}}']);
    expect(groups.message).toEqual([
      'sensors/{{env.ROOM}}/temp',
      '{"id": "{{vault.DEVICE_ID}}"}',
      '{{env.CONTENT_TYPE}}',
    ]);
    expect(groups.settings).toEqual(['oh-{{env.CLIENT}}', '{{env.SNI}}', '{{env.ALPN}}']);
  });

  it('drops the 5.0-only surfaces on a 3.1.1 request', () => {
    const groups = collectMqttTemplateGroups(makeMqtt({ protocolVersion: '3.1.1' }));
    expect(groups.userProperties).toEqual([]);
    expect(groups.topics).toEqual(['alerts/{{env.ROOM}}/#']);
    expect(groups.lastWill).toEqual(['status/{{env.ROOM}}', 'offline']);
    expect(groups.message).toEqual(['sensors/{{env.ROOM}}/temp', '{"id": "{{vault.DEVICE_ID}}"}']);
  });

  it('holds a will without a topic off the wire', () => {
    const groups = collectMqttTemplateGroups(makeMqtt({ lastWill: { topic: '', payload: '{{env.NEVER_SENT}}' } }));
    expect(groups.lastWill).toEqual([]);
  });

  it('flattens in wire order', () => {
    const groups = collectMqttTemplateGroups(makeMqtt());
    expect(collectMqttRequestTemplateStrings(makeMqtt())).toEqual([
      ...groups.url,
      ...groups.auth,
      ...groups.userProperties,
      ...groups.lastWill,
      ...groups.topics,
      ...groups.message,
      ...groups.settings,
    ]);
  });
});

function makeWs(flavor: WebSocketRequest['flavor'], overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    ...buildEmptyWebSocketRequest({ uid: 'wsreq0001', path: 'requests/feed', name: 'Feed', flavor }),
    url: 'wss://ws.openheaders.io/{{env.CHANNEL}}',
    headers: [
      { uid: 'wshd0001', key: 'X-Tenant', value: '{{env.TENANT}}', enabled: true },
      { uid: 'wshd0002', key: 'X-Off', value: '{{env.OFF}}', enabled: false },
    ],
    params: [{ uid: 'wsqp0001', key: 'token', value: '{{vault.TOKEN}}', enabled: true }],
    auth: { type: 'bearer', token: '{{vault.BEARER}}' },
    message: '{"hello": "{{env.NAME}}"}',
    eventName: '{{env.EVENT}}',
    namespace: '/{{env.NS}}',
    handshakePath: '/{{env.HS}}/',
    heartbeatMessage: 'ping-{{env.HB}}',
    sniServerName: '{{env.SNI}}',
    ...overrides,
  };
}

describe('collectWebSocketTemplateGroups', () => {
  it('reads the raw flavor — the heartbeat rides, the Socket.IO fields do not', () => {
    const groups = collectWebSocketTemplateGroups(makeWs('raw'));
    expect(groups.url).toEqual(['wss://ws.openheaders.io/{{env.CHANNEL}}']);
    expect(groups.headers).toEqual(['X-Tenant', '{{env.TENANT}}']);
    expect(groups.params).toEqual(['token', '{{vault.TOKEN}}']);
    expect(groups.auth).toEqual(['{{vault.BEARER}}']);
    expect(groups.message).toEqual(['{"hello": "{{env.NAME}}"}']);
    expect(groups.settings).toEqual(['ping-{{env.HB}}', '{{env.SNI}}']);
  });

  it('reads the socketio flavor — the namespace, handshake path and event name ride, the heartbeat does not', () => {
    const groups = collectWebSocketTemplateGroups(makeWs('socketio'));
    expect(groups.url).toEqual(['wss://ws.openheaders.io/{{env.CHANNEL}}', '/{{env.NS}}', '/{{env.HS}}/']);
    expect(groups.message).toEqual(['{"hello": "{{env.NAME}}"}', '{{env.EVENT}}']);
    expect(groups.settings).toEqual(['{{env.SNI}}']);
  });

  it('flattens in wire order', () => {
    const groups = collectWebSocketTemplateGroups(makeWs('socketio'));
    expect(collectWebSocketRequestTemplateStrings(makeWs('socketio'))).toEqual([
      ...groups.url,
      ...groups.headers,
      ...groups.params,
      ...groups.auth,
      ...groups.message,
      ...groups.settings,
    ]);
  });
});

function makeGrpc(overrides: Partial<GrpcRequest> = {}): GrpcRequest {
  return {
    ...buildEmptyGrpcRequest({ uid: 'grpcreq01', path: 'requests/greet', name: 'Greet' }),
    url: 'grpc.openheaders.io:{{env.PORT}}',
    authority: '{{env.AUTHORITY}}',
    metadata: [
      { uid: 'grmd0001', key: 'x-api-key', value: '{{vault.KEY}}', enabled: true },
      { uid: 'grmd0002', key: 'x-off', value: '{{env.OFF}}', enabled: false },
    ],
    auth: { type: 'bearer', token: '{{vault.BEARER}}' },
    message: '{"name": "{{env.NAME}}"}',
    sniServerName: '{{env.SNI}}',
    ...overrides,
  };
}

describe('collectGrpcTemplateGroups', () => {
  it('groups the executor field list — target, metadata, credential, message, SNI', () => {
    const groups = collectGrpcTemplateGroups(makeGrpc());
    expect(groups.url).toEqual(['grpc.openheaders.io:{{env.PORT}}', '{{env.AUTHORITY}}']);
    expect(groups.metadata).toEqual(['x-api-key', '{{vault.KEY}}']);
    expect(groups.auth).toEqual(['{{vault.BEARER}}']);
    expect(groups.message).toEqual(['{"name": "{{env.NAME}}"}']);
    expect(groups.settings).toEqual(['{{env.SNI}}']);
    expect(collectGrpcRequestTemplateStrings(makeGrpc())).toEqual([
      ...groups.url,
      ...groups.metadata,
      ...groups.auth,
      ...groups.message,
      ...groups.settings,
    ]);
  });
});

function makeGraphql(overrides: Partial<GraphqlRequest> = {}): GraphqlRequest {
  return {
    ...buildEmptyGraphqlRequest({ uid: 'gqlreq001', path: 'requests/users', name: 'Users' }),
    url: 'https://api.openheaders.io/{{env.GRAPH}}',
    query: 'query Users($id: ID!) { user(id: $id) { name } }',
    variables: '{"id": "{{env.USER_ID}}"}',
    headers: [
      { uid: 'gqhd0001', key: 'X-Tenant', value: '{{env.TENANT}}', enabled: true },
      { uid: 'gqhd0002', key: 'X-Off', value: '{{env.OFF}}', enabled: false },
    ],
    auth: { type: 'api-key', key: 'X-Key', value: '{{vault.KEY}}', in: 'header' },
    sniServerName: '{{env.SNI}}',
    ...overrides,
  };
}

describe('collectGraphqlTemplateGroups', () => {
  it('groups the compile field list — endpoint, headers, auth, document + variables, SNI', () => {
    const groups = collectGraphqlTemplateGroups(makeGraphql());
    expect(groups.url).toEqual(['https://api.openheaders.io/{{env.GRAPH}}']);
    expect(groups.headers).toEqual(['X-Tenant', '{{env.TENANT}}']);
    expect(groups.auth).toEqual(['X-Key', '{{vault.KEY}}']);
    expect(groups.query).toEqual(['query Users($id: ID!) { user(id: $id) { name } }', '{"id": "{{env.USER_ID}}"}']);
    expect(groups.settings).toEqual(['{{env.SNI}}']);
  });

  it('names the same set the HTTP scan reads off the compiled POST', () => {
    const entity = makeGraphql();
    const compiled = collectRequestTemplateStrings(toHttpRequest(entity));
    expect([...collectGraphqlRequestTemplateStrings(entity)].sort()).toEqual([...compiled].sort());
  });
});
