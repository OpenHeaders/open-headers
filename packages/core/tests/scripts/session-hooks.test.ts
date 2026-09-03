/**
 * Runner core — the WebSocket hook families' `oh` surface: Before
 * connect's dial view and mutators fold into ONE connect mutation (the
 * HTTP mutation's law — a reverted edit reports none), Before send
 * rewrites or drops, On message replies through the `session.send`
 * host op, After close reads the end record; `oh.session` is shared
 * across the families of one session, and package bodies see the
 * hook's own surface.
 */

import type {
  GrpcInvokeSnapshot,
  MqttConnectSnapshot,
  ScriptExecutionRequest,
  ScriptHostRequest,
  ScriptHostResponse,
  SessionHookInput,
  WsConnectSnapshot,
} from '@openheaders/core/scripts';
import { endScriptSession, executeScript } from '@openheaders/core/scripts/runner';
import { describe, expect, it } from 'vitest';

const CONNECT: WsConnectSnapshot = {
  url: 'wss://events.openheaders.io/live?tenant=acme',
  headers: [{ key: 'X-Client', value: 'oh' }],
  params: [{ key: 'tenant', value: 'acme' }],
  subprotocols: ['chat.v1'],
  attempt: 0,
};

const OUTBOUND: SessionHookInput = {
  kind: 'ws-before-send',
  message: { direction: 'up', text: '{"op":"ping"}', binary: false, index: 3 },
};

const INBOUND: SessionHookInput = {
  kind: 'ws-on-message',
  message: { direction: 'down', text: 'ping', dataBase64: 'cGluZw==', binary: false, index: 4 },
};

const CLOSE: SessionHookInput = {
  kind: 'ws-after-close',
  close: {
    code: 1000,
    reason: 'done',
    wasClean: true,
    stopped: false,
    messages: 5,
    droppedMessages: 0,
    durationMs: 42,
  },
};

let executions = 0;

async function runHook(
  source: string,
  hook: SessionHookInput,
  options: {
    sessionId?: string;
    packages?: Array<{ name: string; source: string }>;
    hostRequests?: ScriptHostRequest[];
  } = {},
) {
  executions += 1;
  const req: ScriptExecutionRequest = {
    executionId: `exec-${executions}`,
    kind: hook.kind,
    source,
    sessionId: options.sessionId ?? `session-${executions}`,
    hook,
    ...(options.packages !== undefined ? { packages: options.packages } : {}),
  };
  const result = await executeScript(req, {
    sendHostRequest: async (request: ScriptHostRequest): Promise<ScriptHostResponse> => {
      options.hostRequests?.push(request);
      return {
        executionId: request.executionId,
        rpcId: request.rpcId,
        ok: true,
        value: request.op === 'session.send' || request.op === 'session.publish' ? { success: true } : null,
      };
    },
  });
  if (options.sessionId === undefined) endScriptSession(req.sessionId);
  return result;
}

const logged = (result: Awaited<ReturnType<typeof runHook>>): string[] =>
  result.consoleLog.map((e) => e.args.join(' '));

describe('ws-before-connect', () => {
  it('exposes the dial view and folds the mutators into one connect mutation', async () => {
    const result = await runHook(
      `console.log(oh.connect.url, oh.connect.attempt, oh.connect.subprotocols.join(','));
       oh.setQueryParam('token', 't1');
       oh.setHeader('x-client', 'scripted');
       oh.setSubprotocols(['chat.v2']);
       console.log(oh.connect.headers.map((h) => h.key + '=' + h.value).join(';'));`,
      { kind: 'ws-before-connect', connect: CONNECT },
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['wss://events.openheaders.io/live?tenant=acme 0 chat.v1', 'x-client=scripted']);
    expect(result.sessionMutation).toEqual({
      kind: 'ws-connect',
      url: undefined,
      headers: [{ key: 'x-client', value: 'scripted' }],
      params: [
        { key: 'tenant', value: 'acme' },
        { key: 'token', value: 't1' },
      ],
      subprotocols: ['chat.v2'],
    });
    expect(result.mutation).toBeUndefined();
  });

  it('a reverted edit reports no mutation', async () => {
    const result = await runHook(
      `oh.setHeader('X-Extra', '1'); oh.removeHeader('x-extra'); oh.setUrl(oh.connect.url);`,
      { kind: 'ws-before-connect', connect: CONNECT },
    );
    expect(result.succeeded).toBe(true);
    expect(result.sessionMutation).toBeUndefined();
  });

  it('has no HTTP surface — oh.request is undefined, oh.setBody is not a function', async () => {
    const result = await runHook(`console.log(typeof oh.request, typeof oh.setBody, typeof oh.setUrl);`, {
      kind: 'ws-before-connect',
      connect: CONNECT,
    });
    expect(logged(result)).toEqual(['undefined undefined function']);
  });
});

describe('ws-before-send', () => {
  it('rewrites the outgoing text and the event name', async () => {
    const result = await runHook(
      `const payload = JSON.parse(oh.message.text); payload.ts = 1; oh.setMessage(JSON.stringify(payload)); oh.setEvent('ping:v2');
       console.log(oh.message.text, oh.message.eventName, oh.message.index);`,
      OUTBOUND,
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['{"op":"ping","ts":1} ping:v2 3']);
    expect(result.sessionMutation).toEqual({ kind: 'ws-send', text: '{"op":"ping","ts":1}', eventName: 'ping:v2' });
  });

  it('drop is a mutation of its own — a message set back to itself still drops', async () => {
    const result = await runHook(
      `oh.setMessage('x'); oh.setMessage(oh.message.text === 'x' ? '{"op":"ping"}' : 'y'); oh.drop();`,
      OUTBOUND,
    );
    expect(result.succeeded).toBe(true);
    expect(result.sessionMutation).toEqual({ kind: 'ws-send', text: undefined, eventName: undefined, drop: true });
  });

  it('an untouched message reports no mutation', async () => {
    const result = await runHook(`console.log(oh.message.direction);`, OUTBOUND);
    expect(result.sessionMutation).toBeUndefined();
  });
});

describe('ws-on-message', () => {
  it('replies through the session.send host op — text, binary and a Socket.IO event', async () => {
    const hostRequests: ScriptHostRequest[] = [];
    const result = await runHook(
      `await oh.send('pong'); await oh.sendBinary('AQID'); await oh.emit('ack', [{ index: oh.message.index }], { expectAck: true });`,
      INBOUND,
      { sessionId: 'session-reply', hostRequests },
    );
    endScriptSession('session-reply');
    expect(result.succeeded).toBe(true);
    expect(
      hostRequests.map((r) => (r.op === 'session.send' ? [r.sessionId, r.messageText, r.socketio, r.binary] : r.op)),
    ).toEqual([
      ['session-reply', 'pong', undefined, undefined],
      ['session-reply', 'AQID', undefined, { encoding: 'base64' }],
      ['session-reply', '[{"index":4}]', { eventName: 'ack', expectAck: true }, undefined],
    ]);
  });

  it('a refused send throws into the script with the rider reason', async () => {
    executions += 1;
    const result = await executeScript(
      {
        executionId: `exec-${executions}`,
        kind: 'ws-on-message',
        source: `try { await oh.send('x'); } catch (err) { console.log(err.message); }`,
        sessionId: 'session-refused',
        hook: INBOUND,
      },
      {
        sendHostRequest: async (request) => ({
          executionId: request.executionId,
          rpcId: request.rpcId,
          ok: true,
          value: { success: false, error: 'The session is not open.' },
        }),
      },
    );
    endScriptSession('session-refused');
    expect(logged(result)).toEqual(['oh.send failed: The session is not open.']);
  });

  it('registers assertions against the frame', async () => {
    const result = await runHook(
      `await oh.test('is ping', () => oh.expect(oh.message.text).toBe('ping'));
       await oh.test('is binary', () => oh.expect(oh.message.binary).toBeTruthy());`,
      INBOUND,
    );
    expect(result.assertions.map((a) => [a.name, a.passed])).toEqual([
      ['is ping', true],
      ['is binary', false],
    ]);
  });
});

describe('ws-after-close', () => {
  it('reads the end record and asserts on it', async () => {
    const result = await runHook(
      `console.log(oh.close.code, oh.close.reason, oh.close.messages, oh.close.stopped);
       await oh.test('clean', () => oh.expect(oh.close.code).toBe(1000));`,
      CLOSE,
    );
    expect(logged(result)).toEqual(['1000 done 5 false']);
    expect(result.assertions).toEqual([{ name: 'clean', passed: true, durationMs: expect.any(Number) }]);
  });
});

describe('the session across families', () => {
  it('shares oh.session from Before connect to On message to After close', async () => {
    await runHook(`oh.session.nonce = 'n1';`, { kind: 'ws-before-connect', connect: CONNECT }, { sessionId: 's-x' });
    await runHook(`oh.session.count = (oh.session.count ?? 0) + 1;`, INBOUND, { sessionId: 's-x' });
    const result = await runHook(`console.log(oh.session.nonce, oh.session.count);`, CLOSE, { sessionId: 's-x' });
    endScriptSession('s-x');
    expect(logged(result)).toEqual(['n1 1']);
  });

  it('a package body sees the hook surface and the session', async () => {
    const result = await runHook(
      `const util = oh.require('util'); console.log(util.where());`,
      { kind: 'ws-before-connect', connect: CONNECT },
      {
        packages: [
          { name: 'util', source: `module.exports = { where: () => oh.connect.url + ' ' + typeof oh.session };` },
        ],
      },
    );
    expect(logged(result)).toEqual(['wss://events.openheaders.io/live?tenant=acme object']);
  });
});

// ── The MQTT family ─────────────────────────────────────────────────

const MQTT_CONNECT: MqttConnectSnapshot = {
  url: 'mqtt://broker.openheaders.io:1883',
  protocolVersion: '5.0',
  clientId: 'oh-generated',
  username: '',
  password: '',
  will: null,
  subscriptions: [{ topicFilter: 'probe/echo/reply', qos: 1 }],
  userProperties: [{ key: 'tenant', value: 'acme' }],
  attempt: 0,
};

const MQTT_OUTBOUND: SessionHookInput = {
  kind: 'mqtt-before-publish',
  message: {
    direction: 'up',
    topic: 'probe/echo',
    payload: '{"op":"ping"}',
    format: 'json',
    qos: 0,
    retain: false,
    properties: { contentType: 'application/json' },
    index: 2,
  },
};

const MQTT_INBOUND: SessionHookInput = {
  kind: 'mqtt-on-message',
  message: {
    direction: 'down',
    topic: 'probe/echo/reply',
    payloadBase64: 'cGluZw==',
    text: 'ping',
    qos: 1,
    retain: false,
    dup: false,
    properties: { responseTopic: 'probe/ack', correlationData: 'c-1' },
    index: 3,
  },
};

const MQTT_CLOSE: SessionHookInput = {
  kind: 'mqtt-after-close',
  close: {
    end: { by: 'client' },
    connack: { sessionPresent: false, reasonCode: 0 },
    stopped: false,
    published: 2,
    received: 3,
    droppedMessages: 0,
    durationMs: 42,
  },
};

describe('mqtt-before-connect', () => {
  it('exposes the CONNECT view and folds the mutators into one connect mutation', async () => {
    const result = await runHook(
      `console.log(oh.connect.clientId, oh.connect.protocolVersion, oh.connect.subscriptions.length, oh.connect.attempt);
       oh.setClientId('device-7');
       oh.setUsername('device');
       oh.setPassword('s3cret');
       oh.addSubscription('devices/+/status', { qos: 1, noLocal: true });
       oh.setUserProperty('client', 'openheaders');
       oh.setWill({ topic: 'devices/7/status', payload: 'offline', retain: true });
       console.log(oh.connect.will.payloadBase64, oh.connect.userProperties.length);`,
      { kind: 'mqtt-before-connect', connect: MQTT_CONNECT },
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['oh-generated 5.0 1 0', 'b2ZmbGluZQ== 2']);
    expect(result.sessionMutation).toEqual({
      kind: 'mqtt-connect',
      clientId: 'device-7',
      username: 'device',
      password: 's3cret',
      will: { topic: 'devices/7/status', payloadBase64: 'b2ZmbGluZQ==', qos: 0, retain: true },
      subscriptions: [
        { topicFilter: 'probe/echo/reply', qos: 1 },
        { topicFilter: 'devices/+/status', qos: 1, noLocal: true },
      ],
      userProperties: [
        { key: 'tenant', value: 'acme' },
        { key: 'client', value: 'openheaders' },
      ],
    });
  });

  it('a reverted edit reports no mutation; dropping the will is an explicit null', async () => {
    const reverted = await runHook(
      `oh.setUserProperty('x', '1'); oh.removeUserProperty('x'); oh.removeSubscription('nope'); oh.setClientId(oh.connect.clientId);`,
      { kind: 'mqtt-before-connect', connect: MQTT_CONNECT },
    );
    expect(reverted.sessionMutation).toBeUndefined();
    const dropped = await runHook(`oh.setWill(null);`, {
      kind: 'mqtt-before-connect',
      connect: { ...MQTT_CONNECT, will: { topic: 't', payloadBase64: 'eA==', qos: 0, retain: false } },
    });
    expect(dropped.sessionMutation).toEqual({
      kind: 'mqtt-connect',
      clientId: undefined,
      username: undefined,
      password: undefined,
      will: null,
      subscriptions: undefined,
      userProperties: undefined,
    });
  });

  it('has no WebSocket surface — oh.setSubprotocols is undefined', async () => {
    const result = await runHook(`console.log(typeof oh.setSubprotocols, typeof oh.setClientId, typeof oh.request);`, {
      kind: 'mqtt-before-connect',
      connect: MQTT_CONNECT,
    });
    expect(logged(result)).toEqual(['undefined function undefined']);
  });
});

describe('mqtt-before-publish', () => {
  it('rewrites the topic, payload, flags and properties', async () => {
    const result = await runHook(
      `const payload = JSON.parse(oh.message.payload); payload.ts = 1;
       oh.setPayload(JSON.stringify(payload)); oh.setTopic('probe/echo/v2'); oh.setQos(1); oh.setRetain(true);
       oh.setUserProperty('trace', 'abc');
       console.log(oh.message.topic, oh.message.qos, oh.message.properties.contentType, oh.message.index);`,
      MQTT_OUTBOUND,
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['probe/echo/v2 1 application/json 2']);
    expect(result.sessionMutation).toEqual({
      kind: 'mqtt-publish',
      topic: 'probe/echo/v2',
      payload: '{"op":"ping","ts":1}',
      format: undefined,
      qos: 1,
      retain: true,
      properties: { contentType: 'application/json', userProperties: [{ key: 'trace', value: 'abc' }] },
    });
  });

  it('setPayload may switch the spelling to bytes; drop is a mutation of its own', async () => {
    const bytes = await runHook(`oh.setPayload('AQID', 'base64');`, MQTT_OUTBOUND);
    expect(bytes.sessionMutation).toMatchObject({ kind: 'mqtt-publish', payload: 'AQID', format: 'base64' });
    const dropped = await runHook(
      `oh.setTopic('x'); oh.setTopic(oh.message.topic === 'x' ? 'probe/echo' : 'y'); oh.drop();`,
      MQTT_OUTBOUND,
    );
    expect(dropped.sessionMutation).toEqual({
      kind: 'mqtt-publish',
      topic: undefined,
      payload: undefined,
      format: undefined,
      qos: undefined,
      retain: undefined,
      properties: undefined,
      drop: true,
    });
    const untouched = await runHook(`console.log(oh.message.direction);`, MQTT_OUTBOUND);
    expect(untouched.sessionMutation).toBeUndefined();
  });
});

describe('mqtt-on-message', () => {
  it('replies through the session.publish host op with the reply-to facts', async () => {
    const hostRequests: ScriptHostRequest[] = [];
    const result = await runHook(
      `await oh.publish(oh.message.properties.responseTopic, 'ack', { qos: oh.message.qos, properties: { correlationData: oh.message.properties.correlationData } });
       await oh.publish('probe/bytes', 'AQID', { format: 'base64', retain: true });`,
      MQTT_INBOUND,
      { sessionId: 'session-publish', hostRequests },
    );
    endScriptSession('session-publish');
    expect(result.succeeded).toBe(true);
    expect(hostRequests.map((r) => (r.op === 'session.publish' ? [r.sessionId, r.message] : r.op))).toEqual([
      ['session-publish', { topic: 'probe/ack', payload: 'ack', qos: 1, properties: { correlationData: 'c-1' } }],
      ['session-publish', { topic: 'probe/bytes', payload: 'AQID', format: 'base64', retain: true }],
    ]);
  });

  it('a refused publish throws into the script with the rider reason', async () => {
    executions += 1;
    const result = await executeScript(
      {
        executionId: `exec-${executions}`,
        kind: 'mqtt-on-message',
        source: `try { await oh.publish('x', 'y'); } catch (err) { console.log(err.message); }`,
        sessionId: 'session-refused-mqtt',
        hook: MQTT_INBOUND,
      },
      {
        sendHostRequest: async (request) => ({
          executionId: request.executionId,
          rpcId: request.rpcId,
          ok: true,
          value: { success: false, error: 'The session is not open.' },
        }),
      },
    );
    endScriptSession('session-refused-mqtt');
    expect(logged(result)).toEqual(['oh.publish failed: The session is not open.']);
  });

  it('registers assertions against the message', async () => {
    const result = await runHook(
      `await oh.test('is ping', () => oh.expect(oh.message.text).toBe('ping'));
       await oh.test('is retained', () => oh.expect(oh.message.retain).toBeTruthy());`,
      MQTT_INBOUND,
    );
    expect(result.assertions.map((a) => [a.name, a.passed])).toEqual([
      ['is ping', true],
      ['is retained', false],
    ]);
  });
});

describe('mqtt-after-close', () => {
  it('reads the end record and asserts on it', async () => {
    const result = await runHook(
      `console.log(oh.close.end.by, oh.close.connack.reasonCode, oh.close.published, oh.close.received);
       await oh.test('clean', () => oh.expect(oh.close.end.by).toBe('client'));`,
      MQTT_CLOSE,
    );
    expect(logged(result)).toEqual(['client 0 2 3']);
    expect(result.assertions).toEqual([{ name: 'clean', passed: true, durationMs: expect.any(Number) }]);
  });

  it('shares oh.session from Before connect to After close', async () => {
    await runHook(
      `oh.session.nonce = 'm1';`,
      { kind: 'mqtt-before-connect', connect: MQTT_CONNECT },
      { sessionId: 's-m' },
    );
    const result = await runHook(`console.log(oh.session.nonce);`, MQTT_CLOSE, { sessionId: 's-m' });
    endScriptSession('s-m');
    expect(logged(result)).toEqual(['m1']);
  });
});

// ── gRPC ──────────────────────────────────────────────────────────

const GRPC_INVOKE: GrpcInvokeSnapshot = {
  target: 'grpc.openheaders.io:443',
  service: 'library.v1.Library',
  method: 'GetBook',
  shape: 'unary',
  metadata: [{ key: 'x-tenant', value: 'acme' }],
  messageText: '{"name":"books/1"}',
};

const GRPC_FRAME: SessionHookInput = {
  kind: 'grpc-on-message',
  message: {
    direction: 'down',
    type: 'library.v1.Book',
    value: { name: 'books/1', title: 'Field Guide' },
    dataBase64: 'AA==',
    compressed: false,
    index: 0,
  },
};

const GRPC_RESPONSE: SessionHookInput = {
  kind: 'grpc-after-response',
  response: {
    httpStatus: 200,
    status: 0,
    statusSource: 'trailers',
    headers: [{ key: 'x-probe', value: '1' }],
    trailers: [{ key: 'x-probe-region', value: 'eu' }],
    sent: 1,
    received: 1,
    stopped: false,
    durationMs: 12,
  },
};

describe('grpc-before-invoke', () => {
  it('exposes the call view and folds the mutators into one invoke mutation', async () => {
    const result = await runHook(
      `console.log(oh.invoke.service + '/' + oh.invoke.method, oh.invoke.shape, oh.invoke.target, oh.invoke.metadata.length);
       oh.setMetadata('X-Tenant', 'globex');
       oh.setMetadata('x-trace', 't-1');
       const message = JSON.parse(oh.invoke.messageText); message.name = 'books/2';
       oh.setMessage(JSON.stringify(message));
       console.log(oh.invoke.metadata.map((m) => m.key + '=' + m.value).join(','), oh.invoke.messageText);`,
      { kind: 'grpc-before-invoke', invoke: GRPC_INVOKE },
    );
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual([
      'library.v1.Library/GetBook unary grpc.openheaders.io:443 1',
      'X-Tenant=globex,x-trace=t-1 {"name":"books/2"}',
    ]);
    expect(result.sessionMutation).toEqual({
      kind: 'grpc-invoke',
      metadata: [
        { key: 'X-Tenant', value: 'globex' },
        { key: 'x-trace', value: 't-1' },
      ],
      messageText: '{"name":"books/2"}',
    });
  });

  it('a reverted edit reports no mutation; a removal alone is one', async () => {
    const reverted = await runHook(
      `oh.setMetadata('x-trace', 't'); oh.removeMetadata('x-trace'); oh.setMessage(oh.invoke.messageText);`,
      { kind: 'grpc-before-invoke', invoke: GRPC_INVOKE },
    );
    expect(reverted.sessionMutation).toBeUndefined();
    const removed = await runHook(`oh.removeMetadata('x-tenant');`, {
      kind: 'grpc-before-invoke',
      invoke: GRPC_INVOKE,
    });
    expect(removed.sessionMutation).toEqual({ kind: 'grpc-invoke', metadata: [], messageText: undefined });
  });

  it('has no other family surface — oh.setHeader and oh.setClientId are undefined', async () => {
    const result = await runHook(
      `console.log(typeof oh.setHeader, typeof oh.setClientId, typeof oh.setMetadata, typeof oh.request);`,
      { kind: 'grpc-before-invoke', invoke: GRPC_INVOKE },
    );
    expect(logged(result)).toEqual(['undefined undefined function undefined']);
  });
});

describe('grpc-on-message', () => {
  it('reads the decoded frame and asserts on it — no reply verb', async () => {
    const result = await runHook(
      `console.log(oh.message.direction, oh.message.type, oh.message.value.title, oh.message.index, typeof oh.send, typeof oh.publish);
       await oh.test('has a name', () => oh.expect(oh.message.value.name).toBe('books/1'));
       await oh.test('is sent', () => oh.expect(oh.message.direction).toBe('up'));`,
      GRPC_FRAME,
    );
    expect(logged(result)).toEqual(['down library.v1.Book Field Guide 0 undefined undefined']);
    expect(result.assertions.map((a) => [a.name, a.passed])).toEqual([
      ['has a name', true],
      ['is sent', false],
    ]);
    expect(result.sessionMutation).toBeUndefined();
  });
});

describe('grpc-after-response', () => {
  it('reads the end record and asserts on it', async () => {
    const result = await runHook(
      `console.log(oh.response.status, oh.response.statusSource, oh.response.sent, oh.response.received, oh.response.trailers[0].value);
       await oh.test('ok', () => oh.expect(oh.response.status).toBe(0));`,
      GRPC_RESPONSE,
    );
    expect(logged(result)).toEqual(['0 trailers 1 1 eu']);
    expect(result.assertions).toEqual([{ name: 'ok', passed: true, durationMs: expect.any(Number) }]);
  });

  it('shares oh.session from Before invoke through On message to After response', async () => {
    await runHook(`oh.session.frames = 0;`, { kind: 'grpc-before-invoke', invoke: GRPC_INVOKE }, { sessionId: 's-g' });
    await runHook(`oh.session.frames += 1;`, GRPC_FRAME, { sessionId: 's-g' });
    const result = await runHook(`console.log(oh.session.frames);`, GRPC_RESPONSE, { sessionId: 's-g' });
    endScriptSession('s-g');
    expect(logged(result)).toEqual(['1']);
  });
});
