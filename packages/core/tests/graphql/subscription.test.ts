/**
 * Subscriptions over `graphql-transport-ws` — the compile into the
 * WebSocket session (the URL derived, the auth narrowed by name, the
 * shared knobs carried, the envelope's pick), the frame codec both
 * ways, the close codes' meanings, and the client state machine over
 * the probe's nine legs: ack → subscribe, ordered events then the
 * server's complete, a request error, the client's own complete on
 * Stop, ping → pong, the protocol refusals as closes, and the replay
 * over a captured session.
 */

import {
  compileGraphqlSubscription,
  decodeGraphqlWsClientMessage,
  decodeGraphqlWsServerMessage,
  encodeGraphqlWsMessage,
  GRAPHQL_WS_INITIAL_STATE,
  type GraphqlRequestLike,
  type GraphqlWsClientState,
  graphqlWsCloseMeaning,
  graphqlWsSubscribePayload,
  reduceGraphqlWsClient,
  replayGraphqlWsCapture,
  subscriptionUrlOf,
} from '@openheaders/core/graphql';
import { WebSocketRequestSchema } from '@openheaders/core/schemas';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

const QUERY = 'subscription Ticks($every: Int) { tick(everyMs: $every, take: 3) }\nquery Viewer { viewer { id } }';

function request(overrides: Partial<GraphqlRequestLike> = {}): GraphqlRequestLike {
  return {
    schemaVersion: 5,
    uid: 'gqrq0001',
    path: 'requests/ticks-gqrq0001',
    pathSegment: 'ticks-gqrq0001',
    name: 'Ticks',
    url: 'https://api.openheaders.io/graphql',
    query: QUERY,
    variables: '{"every": 100}',
    operationName: 'Ticks',
    headers: [{ uid: 'hdr00001', key: 'X-Trace', value: 'on', enabled: true }],
    auth: { type: 'bearer', token: '{{token}}' },
    timeoutMs: 30_000,
    followRedirects: false,
    proxyMode: 'direct',
    sslVerification: false,
    httpVersion: '2',
    cookieJar: false,
    ...overrides,
  };
}

describe('subscriptionUrlOf', () => {
  it('derives ws(s) from http(s) on the same authority and path', () => {
    expect(subscriptionUrlOf('https://api.openheaders.io/graphql')).toBe('wss://api.openheaders.io/graphql');
    expect(subscriptionUrlOf('http://127.0.0.1:3000/api/graphql?x=1')).toBe('ws://127.0.0.1:3000/api/graphql?x=1');
    expect(subscriptionUrlOf('HTTP://{{host}}/graphql')).toBe('ws://{{host}}/graphql');
  });

  it('passes a ws(s) URL as typed and refuses any other scheme', () => {
    expect(subscriptionUrlOf(' wss://api.openheaders.io/graphql ')).toBe('wss://api.openheaders.io/graphql');
    expect(subscriptionUrlOf('{{base}}/graphql')).toBeNull();
    expect(subscriptionUrlOf('ftp://api.openheaders.io/graphql')).toBeNull();
  });
});

describe('compileGraphqlSubscription', () => {
  it('derives a raw WebSocket request offering the subprotocol, identity and shared knobs carried', () => {
    const compiled = compileGraphqlSubscription(request());
    if (!compiled.ok) throw new Error(compiled.error);
    expect(v.safeParse(WebSocketRequestSchema, compiled.request).success).toBe(true);
    expect(compiled.request).toMatchObject({
      schemaVersion: 5,
      uid: 'gqrq0001',
      path: 'requests/ticks-gqrq0001',
      pathSegment: 'ticks-gqrq0001',
      name: 'Ticks',
      url: 'wss://api.openheaders.io/graphql',
      flavor: 'raw',
      subprotocols: ['graphql-transport-ws'],
      headers: [{ uid: 'hdr00001', key: 'X-Trace', value: 'on', enabled: true }],
      params: [],
      auth: { type: 'bearer', token: '{{token}}' },
      message: '',
      timeoutMs: 30_000,
      followRedirects: false,
      proxyMode: 'direct',
      sslVerification: false,
    });
    expect('httpVersion' in compiled.request).toBe(false);
    expect('cookieJar' in compiled.request).toBe(false);
    expect('autoReconnect' in compiled.request).toBe(false);
    expect('heartbeatMessage' in compiled.request).toBe(false);
  });

  it('plans the envelope text parts with the census pick', () => {
    const compiled = compileGraphqlSubscription(request());
    if (!compiled.ok) throw new Error(compiled.error);
    expect(compiled.plan).toEqual({ query: QUERY, variables: '{"every": 100}', operationName: 'Ticks' });
    const overridden = compileGraphqlSubscription(request(), { operationName: 'Viewer' });
    if (!overridden.ok) throw new Error(overridden.error);
    expect(overridden.plan.operationName).toBe('Viewer');
    const stale = compileGraphqlSubscription(request({ operationName: 'Gone' }));
    if (!stale.ok) throw new Error(stale.error);
    expect(stale.plan.operationName).toBe('Ticks');
    const single = compileGraphqlSubscription(request({ query: 'subscription { tick }', variables: undefined }));
    if (!single.ok) throw new Error(single.error);
    expect(single.plan).toEqual({ query: 'subscription { tick }' });
  });

  it('keeps inherit and refuses an auth type outside the WebSocket mask by name', () => {
    const inherit = compileGraphqlSubscription(request({ auth: { type: 'inherit' } }));
    expect(inherit.ok && inherit.request.auth).toEqual({ type: 'inherit' });
    const digest = compileGraphqlSubscription(request({ auth: { type: 'digest', username: 'john', password: 'doe' } }));
    expect(digest).toEqual({ ok: false, error: 'digest authentication cannot ride a WebSocket session.' });
  });

  it('refuses a URL outside http(s) / ws(s)', () => {
    expect(compileGraphqlSubscription(request({ url: '{{base}}/graphql' }))).toEqual({
      ok: false,
      error: 'The URL must start with http://, https://, ws:// or wss://.',
    });
  });
});

describe('graphqlWsSubscribePayload', () => {
  it('embeds parsed variables, drops malformed ones, names the operation only when set', () => {
    expect(graphqlWsSubscribePayload('{ tick }', '{"every": 100}', 'Ticks')).toEqual({
      query: '{ tick }',
      variables: { every: 100 },
      operationName: 'Ticks',
    });
    expect(graphqlWsSubscribePayload('{ tick }', '{not json', undefined)).toEqual({ query: '{ tick }' });
    expect(graphqlWsSubscribePayload('{ tick }', '  ', '')).toEqual({ query: '{ tick }' });
  });
});

describe('the frame codec', () => {
  it('encodes every client message in the protocol shape', () => {
    expect(encodeGraphqlWsMessage({ type: 'connection_init' })).toBe('{"type":"connection_init"}');
    expect(encodeGraphqlWsMessage({ type: 'connection_init', payload: { authorization: 'Bearer t' } })).toBe(
      '{"type":"connection_init","payload":{"authorization":"Bearer t"}}',
    );
    expect(encodeGraphqlWsMessage({ type: 'ping' })).toBe('{"type":"ping"}');
    expect(encodeGraphqlWsMessage({ type: 'pong', payload: { at: 1 } })).toBe('{"type":"pong","payload":{"at":1}}');
    expect(encodeGraphqlWsMessage({ type: 'subscribe', id: '1', payload: { query: '{ tick }' } })).toBe(
      '{"id":"1","type":"subscribe","payload":{"query":"{ tick }"}}',
    );
    expect(encodeGraphqlWsMessage({ type: 'complete', id: '1' })).toBe('{"id":"1","type":"complete"}');
  });

  it('decodes every server message and rejects what is not one', () => {
    expect(decodeGraphqlWsServerMessage('{"type":"connection_ack","payload":{"probe":"graphql-ws"}}')).toEqual({
      type: 'connection_ack',
      payload: { probe: 'graphql-ws' },
    });
    expect(decodeGraphqlWsServerMessage('{"type":"ping"}')).toEqual({ type: 'ping' });
    expect(decodeGraphqlWsServerMessage('{"id":"1","type":"next","payload":{"data":{"tick":1}}}')).toEqual({
      type: 'next',
      id: '1',
      payload: { data: { tick: 1 } },
    });
    expect(decodeGraphqlWsServerMessage('{"id":"1","type":"error","payload":[{"message":"nope"}]}')).toEqual({
      type: 'error',
      id: '1',
      payload: [{ message: 'nope' }],
    });
    expect(decodeGraphqlWsServerMessage('{"id":"1","type":"complete"}')).toEqual({ type: 'complete', id: '1' });
    expect(decodeGraphqlWsServerMessage('not json')).toBeNull();
    expect(decodeGraphqlWsServerMessage('[]')).toBeNull();
    expect(decodeGraphqlWsServerMessage('{"type":"next","payload":{}}')).toBeNull();
    expect(decodeGraphqlWsServerMessage('{"id":"1","type":"next","payload":"text"}')).toBeNull();
    expect(decodeGraphqlWsServerMessage('{"id":"1","type":"error","payload":{}}')).toBeNull();
    expect(decodeGraphqlWsServerMessage('{"type":"subscribe","id":"1","payload":{"query":"x"}}')).toBeNull();
  });

  it('decodes the client frames the replay reads', () => {
    expect(decodeGraphqlWsClientMessage('{"id":"1","type":"complete"}')).toEqual({ type: 'complete', id: '1' });
    expect(decodeGraphqlWsClientMessage('{"id":"1","type":"subscribe","payload":{"query":"{ tick }"}}')).toEqual({
      type: 'subscribe',
      id: '1',
      payload: { query: '{ tick }' },
    });
    expect(decodeGraphqlWsClientMessage('{"type":"connection_init","payload":[]}')).toBeNull();
    expect(decodeGraphqlWsClientMessage('{"type":"next","id":"1","payload":{}}')).toBeNull();
  });

  it('names the protocol close codes and leaves the plain ones alone', () => {
    expect(graphqlWsCloseMeaning(4400)).toBe('bad-request');
    expect(graphqlWsCloseMeaning(4401)).toBe('unauthorized');
    expect(graphqlWsCloseMeaning(4403)).toBe('forbidden');
    expect(graphqlWsCloseMeaning(4406)).toBe('subprotocol-not-acceptable');
    expect(graphqlWsCloseMeaning(4408)).toBe('connection-init-timeout');
    expect(graphqlWsCloseMeaning(4409)).toBe('subscriber-already-exists');
    expect(graphqlWsCloseMeaning(4429)).toBe('too-many-init-requests');
    expect(graphqlWsCloseMeaning(1000)).toBeNull();
    expect(graphqlWsCloseMeaning(1006)).toBeNull();
  });
});

function frame(text: string): { kind: 'message'; text: string } {
  return { kind: 'message', text };
}

const ACK = '{"type":"connection_ack"}';
const tick = (n: number): string => `{"id":"1","type":"next","payload":{"data":{"tick":${n}}}}`;
const COMPLETE = '{"id":"1","type":"complete"}';

function subscribed(): GraphqlWsClientState {
  const opened = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'open' });
  return reduceGraphqlWsClient(opened.state, frame(ACK)).state;
}

describe('the client state machine', () => {
  it('opens with connection_init, subscribes on the ack', () => {
    const opened = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'open' });
    expect(opened.state.phase).toBe('connecting');
    expect(opened.effects).toEqual([{ kind: 'init' }]);
    const acked = reduceGraphqlWsClient(opened.state, frame(ACK));
    expect(acked.state.phase).toBe('subscribed');
    expect(acked.effects).toEqual([{ kind: 'subscribe' }]);
    // A second open or a second ack changes nothing.
    expect(reduceGraphqlWsClient(acked.state, { kind: 'open' })).toEqual({ state: acked.state, effects: [] });
    expect(reduceGraphqlWsClient(acked.state, frame(ACK))).toEqual({ state: acked.state, effects: [] });
  });

  it('counts ordered events and completes on the server’s complete, closing 1000', () => {
    let state = subscribed();
    for (const n of [1, 2, 3]) {
      const step = reduceGraphqlWsClient(state, frame(tick(n)));
      expect(step.effects).toEqual([]);
      state = step.state;
      expect(state.events).toBe(n);
      expect(state.latest).toEqual({ data: { tick: n } });
    }
    const done = reduceGraphqlWsClient(state, frame(COMPLETE));
    expect(done.state.phase).toBe('completed');
    expect(done.effects).toEqual([{ kind: 'close' }]);
    const closed = reduceGraphqlWsClient(done.state, { kind: 'close', code: 1000, reason: '' });
    expect(closed.state).toMatchObject({ phase: 'completed', events: 3, close: { code: 1000, reason: '' } });
    // Nothing moves after the end.
    expect(reduceGraphqlWsClient(closed.state, frame(tick(4))).state).toBe(closed.state);
  });

  it('errors on the server’s error message with its errors[] and closes', () => {
    const step = reduceGraphqlWsClient(subscribed(), frame('{"id":"1","type":"error","payload":[{"message":"nope"}]}'));
    expect(step.state).toMatchObject({ phase: 'errored', errors: [{ message: 'nope' }] });
    expect(step.effects).toEqual([{ kind: 'close' }]);
  });

  it('answers a ping with a pong echoing the payload and ignores a pong', () => {
    const state = subscribed();
    expect(reduceGraphqlWsClient(state, frame('{"type":"ping"}')).effects).toEqual([{ kind: 'pong' }]);
    expect(reduceGraphqlWsClient(state, frame('{"type":"ping","payload":{"at":1}}')).effects).toEqual([
      { kind: 'pong', payload: { at: 1 } },
    ]);
    expect(reduceGraphqlWsClient(state, frame('{"type":"pong"}'))).toEqual({ state, effects: [] });
  });

  it('Stop while subscribed sends the client’s complete then closes; before the ack it only closes', () => {
    const mid = reduceGraphqlWsClient(reduceGraphqlWsClient(subscribed(), frame(tick(1))).state, { kind: 'stop' });
    expect(mid.state).toMatchObject({ phase: 'completed', stopped: true, events: 1 });
    expect(mid.effects).toEqual([{ kind: 'complete' }, { kind: 'close' }]);
    // An event that races the complete never counts.
    expect(reduceGraphqlWsClient(mid.state, frame(tick(2))).state.events).toBe(1);
    const connecting = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'open' }).state;
    const early = reduceGraphqlWsClient(connecting, { kind: 'stop' });
    expect(early.state).toMatchObject({ phase: 'connecting', stopped: true });
    expect(early.effects).toEqual([{ kind: 'close' }]);
    expect(reduceGraphqlWsClient(early.state, { kind: 'close', code: 1000, reason: '' }).state.phase).toBe('closed');
  });

  it('a close under a live phase records the refusal verbatim', () => {
    const connecting = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'open' }).state;
    const refused = reduceGraphqlWsClient(connecting, {
      kind: 'close',
      code: 4408,
      reason: 'Connection initialisation timeout',
    });
    expect(refused.state).toMatchObject({
      phase: 'closed',
      close: { code: 4408, reason: 'Connection initialisation timeout' },
    });
    const unauthorized = reduceGraphqlWsClient(subscribed(), { kind: 'close', code: 4401, reason: 'Unauthorized' });
    expect(unauthorized.state.phase).toBe('closed');
    // A never-opened socket closes from idle — 4406 arrives before any init.
    const rejected = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'close', code: 4406, reason: '' });
    expect(rejected.state).toMatchObject({ phase: 'closed', close: { code: 4406, reason: '' } });
  });

  it('ignores frames for another id, frames before the ack, and non-protocol text', () => {
    const state = subscribed();
    expect(reduceGraphqlWsClient(state, frame('{"id":"2","type":"next","payload":{"data":1}}')).state).toBe(state);
    expect(reduceGraphqlWsClient(state, frame('hello')).state).toBe(state);
    const connecting = reduceGraphqlWsClient(GRAPHQL_WS_INITIAL_STATE, { kind: 'open' }).state;
    expect(reduceGraphqlWsClient(connecting, frame(tick(1))).state).toBe(connecting);
  });
});

describe('replayGraphqlWsCapture', () => {
  it('replays a completed session from the capture', () => {
    const state = replayGraphqlWsCapture(
      true,
      [
        { direction: 'up', text: '{"type":"connection_init"}' },
        { direction: 'down', text: ACK },
        { direction: 'up', text: '{"id":"1","type":"subscribe","payload":{"query":"subscription { tick }"}}' },
        { direction: 'down', text: tick(1) },
        { direction: 'down', text: tick(2) },
        { direction: 'down', text: COMPLETE },
      ],
      { code: 1000, reason: '' },
    );
    expect(state).toMatchObject({ phase: 'completed', events: 2, stopped: false, close: { code: 1000, reason: '' } });
    expect(state.latest).toEqual({ data: { tick: 2 } });
  });

  it('reads the client’s complete as Stop and a refusal as closed', () => {
    const stopped = replayGraphqlWsCapture(
      true,
      [
        { direction: 'down', text: ACK },
        { direction: 'down', text: tick(1) },
        { direction: 'up', text: '{"id":"1","type":"complete"}' },
      ],
      { code: 1000, reason: '' },
    );
    expect(stopped).toMatchObject({ phase: 'completed', stopped: true, events: 1 });
    const refused = replayGraphqlWsCapture(true, [], { code: 4401, reason: 'Unauthorized' });
    expect(refused).toMatchObject({ phase: 'closed', close: { code: 4401, reason: 'Unauthorized' } });
    const live = replayGraphqlWsCapture(true, [{ direction: 'down', text: ACK }], null);
    expect(live).toMatchObject({ phase: 'subscribed', close: null });
    expect(replayGraphqlWsCapture(false, [], null)).toEqual(GRAPHQL_WS_INITIAL_STATE);
  });
});
