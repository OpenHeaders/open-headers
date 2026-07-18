/**
 * AsyncAPI census parser — the WebSocket spec plane's structural read.
 *
 * Pins the Phase A contract: servers / channels (with resolved
 * messages) / operations / component messages + schemas census with
 * declaration offsets, intra-document `$ref` resolution, 3.0
 * first-class with 2.x read-tolerant, structural problems reported on
 * `issues` and only a non-AsyncAPI document throwing
 * `AsyncApiParseError`.
 */

import { AsyncApiParseError, parseAsyncApi } from '@openheaders/core/asyncapi';
import { describe, expect, it } from 'vitest';

const STREAMING_DOC = `asyncapi: 3.0.0
info:
  title: Live Events API
  version: 1.0.0
servers:
  production:
    host: ws.openheaders.io
    protocol: wss
    description: Public event stream
  development:
    host: localhost:59210
    protocol: ws
channels:
  events:
    address: /ws/events
    messages:
      subscribe:
        $ref: '#/components/messages/Subscribe'
      eventReceived:
        $ref: '#/components/messages/Event'
  control:
    address: /ws/control
    messages:
      ping:
        name: ping
        payload:
          type: object
          properties:
            op:
              const: ping
operations:
  sendSubscribe:
    action: send
    channel:
      $ref: '#/channels/events'
    summary: Subscribe to an event feed
  onEvent:
    action: receive
    channel:
      $ref: '#/channels/events'
    summary: An event arrives
  sendPing:
    action: send
    channel:
      $ref: '#/channels/control'
components:
  messages:
    Subscribe:
      payload:
        type: object
        required:
          - topics
        properties:
          topics:
            type: array
            items:
              type: string
            examples:
              - [orders, trades]
          format:
            enum: [full, compact]
            default: full
    Event:
      payload:
        $ref: '#/components/schemas/Event'
  schemas:
    Event:
      type: object
      properties:
        topic:
          type: string
        sequence:
          type: integer
`;

describe('parseAsyncApi', () => {
  it('censuses a 3.0 document: servers, channels, operations, components', () => {
    const census = parseAsyncApi(STREAMING_DOC);
    expect(census.version).toBe('3.0.0');
    expect(census.title).toBe('Live Events API');
    expect(census.issues).toEqual([]);

    expect(census.servers.map((s) => [s.name, s.host, s.protocol])).toEqual([
      ['production', 'ws.openheaders.io', 'wss'],
      ['development', 'localhost:59210', 'ws'],
    ]);

    expect(census.channels.map((c) => [c.name, c.address])).toEqual([
      ['events', '/ws/events'],
      ['control', '/ws/control'],
    ]);

    expect(census.operations.map((o) => [o.name, o.action, o.channelName])).toEqual([
      ['sendSubscribe', 'send', 'events'],
      ['onEvent', 'receive', 'events'],
      ['sendPing', 'send', 'control'],
    ]);
    expect(census.operations[0].summary).toBe('Subscribe to an event feed');
    expect(census.operations[2].summary).toBeNull();

    expect(census.componentMessages.map((m) => m.name)).toEqual(['Subscribe', 'Event']);
    expect(census.componentSchemas.map((s) => s.name)).toEqual(['Event']);
  });

  it('resolves channel message $refs and keeps channel-local names (vendor outline shape)', () => {
    const census = parseAsyncApi(STREAMING_DOC);
    const events = census.channels[0];
    // The declaring key names the row, even for $ref entries.
    expect(events.messages.map((m) => m.name)).toEqual(['subscribe', 'eventReceived']);
    const subscribe = events.messages[0];
    expect(subscribe.payload).toMatchObject({ type: 'object', required: ['topics'] });
    // Inline message payloads ride verbatim (const in the ratified subset).
    const control = census.channels[1];
    expect(control.messages[0].name).toBe('ping');
    expect(control.messages[0].payload).toMatchObject({ properties: { op: { const: 'ping' } } });
  });

  it('resolves a payload that is itself a $ref and keeps schema bodies', () => {
    const census = parseAsyncApi(STREAMING_DOC);
    // Event's payload is `$ref: '#/components/schemas/Event'` — census
    // resolves it one level so synthesis reads a real schema.
    const event = census.componentMessages[1];
    expect(event.name).toBe('Event');
    expect(event.payload).toMatchObject({ type: 'object', properties: { topic: { type: 'string' } } });
    expect(census.componentSchemas[0].body).toMatchObject({ type: 'object' });
  });

  it('records declaration offsets that point at the declarations', () => {
    const census = parseAsyncApi(STREAMING_DOC);
    expect(STREAMING_DOC.slice(census.servers[0].offset).startsWith('production:')).toBe(true);
    expect(STREAMING_DOC.slice(census.channels[0].offset).startsWith('events:')).toBe(true);
    expect(STREAMING_DOC.slice(census.operations[1].offset).startsWith('onEvent:')).toBe(true);
    expect(STREAMING_DOC.slice(census.componentMessages[0].offset).startsWith('Subscribe:')).toBe(true);
    expect(STREAMING_DOC.slice(census.componentSchemas[0].offset).startsWith('Event:')).toBe(true);
    const events = census.channels[0];
    expect(events.end).not.toBeNull();
    expect(events.end as number).toBeGreaterThan(events.offset);
  });

  it('parses a JSON document through the same census', () => {
    const census = parseAsyncApi(
      JSON.stringify({
        asyncapi: '3.0.0',
        info: { title: 'JSON Doc', version: '1.0.0' },
        servers: { main: { host: 'ws.openheaders.io', protocol: 'wss' } },
        channels: { events: { address: '/ws/events' } },
        operations: { onEvent: { action: 'receive', channel: { $ref: '#/channels/events' } } },
      }),
    );
    expect(census.title).toBe('JSON Doc');
    expect(census.servers[0].protocol).toBe('wss');
    expect(census.operations[0].channelName).toBe('events');
    expect(census.issues).toEqual([]);
  });

  it('reports an unresolved $ref as an issue, never throws', () => {
    const census = parseAsyncApi(`asyncapi: 3.0.0
channels:
  events:
    address: /ws/events
    messages:
      missing:
        $ref: '#/components/messages/Nope'
`);
    expect(census.channels[0].messages).toEqual([]);
    expect(census.issues).toEqual([
      { kind: 'unresolved-ref', reference: '#/components/messages/Nope', scope: 'channels.events.messages.missing' },
    ]);
  });

  it('reports an operation naming no known channel', () => {
    const census = parseAsyncApi(`asyncapi: 3.0.0
channels:
  events:
    address: /ws/events
operations:
  onEvent:
    action: receive
    channel:
      $ref: '#/channels/other'
`);
    expect(census.operations[0].channelName).toBeNull();
    expect(census.issues).toEqual([
      { kind: 'unknown-channel', reference: '#/channels/other', scope: 'operations.onEvent' },
    ]);
  });

  it('resolves escaped JSON Pointer segments in channel refs', () => {
    const census = parseAsyncApi(`asyncapi: 3.0.0
channels:
  ws/market:
    address: /ws/market
operations:
  onTick:
    action: receive
    channel:
      $ref: '#/channels/ws~1market'
`);
    expect(census.operations[0].channelName).toBe('ws/market');
    expect(census.issues).toEqual([]);
  });

  it('skips an operation with an invalid action and reports it', () => {
    const census = parseAsyncApi(`asyncapi: 3.0.0
channels:
  events:
    address: /ws/events
operations:
  broken:
    action: publish
    channel:
      $ref: '#/channels/events'
`);
    expect(census.operations).toEqual([]);
    expect(census.issues).toEqual([{ kind: 'invalid-node', reference: 'action: publish', scope: 'operations.broken' }]);
  });

  it('read-tolerates a 2.x document: url hosts, inline publish/subscribe, oneOf messages', () => {
    const census = parseAsyncApi(`asyncapi: '2.6.0'
info:
  title: Legacy Feed
  version: 1.0.0
servers:
  production:
    url: wss://ws.openheaders.io
    protocol: wss
channels:
  market/ticks:
    publish:
      operationId: sendSubscription
      summary: Subscribe to tick topics
      message:
        $ref: '#/components/messages/Subscribe'
    subscribe:
      message:
        oneOf:
          - $ref: '#/components/messages/Tick'
          - name: heartbeat
            payload:
              type: object
components:
  messages:
    Subscribe:
      payload:
        type: object
    Tick:
      payload:
        type: object
`);
    expect(census.servers[0].host).toBe('wss://ws.openheaders.io');
    // The 2.x channel key IS the address.
    expect(census.channels[0].name).toBe('market/ticks');
    expect(census.channels[0].address).toBe('market/ticks');
    expect(census.operations.map((o) => [o.name, o.action, o.channelName])).toEqual([
      ['sendSubscription', 'send', 'market/ticks'],
      ['subscribe:market/ticks', 'receive', 'market/ticks'],
    ]);
    expect(census.channels[0].messages.map((m) => m.name)).toEqual(['Subscribe', 'Tick', 'heartbeat']);
    expect(census.issues).toEqual([]);
  });

  it('reports an unsupported version and still censuses 3.0 shapes', () => {
    const census = parseAsyncApi(`asyncapi: 4.0.0
channels:
  events:
    address: /ws/events
`);
    expect(census.channels[0].address).toBe('/ws/events');
    expect(census.issues).toEqual([{ kind: 'unsupported-version', reference: '4.0.0', scope: 'asyncapi' }]);
  });

  it('throws AsyncApiParseError on invalid YAML', () => {
    expect(() => parseAsyncApi('asyncapi: [3.0.0\n')).toThrow(AsyncApiParseError);
  });

  it('throws AsyncApiParseError on a non-mapping document', () => {
    expect(() => parseAsyncApi('- just\n- a list\n')).toThrow(AsyncApiParseError);
  });

  it('throws AsyncApiParseError when the asyncapi declaration is missing', () => {
    expect(() => parseAsyncApi('openapi: 3.1.0\ninfo:\n  title: Not AsyncAPI\n')).toThrow(AsyncApiParseError);
  });
});
