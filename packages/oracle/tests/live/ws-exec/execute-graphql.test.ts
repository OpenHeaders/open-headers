/**
 * WS executor — the GraphQL subscription plane (the GraphQL client's
 * Phase H): a session carrying a `graphql` plan mounts the
 * `graphql-transport-ws` client above the same scripted seam the raw
 * flavor rides. `connection_init` leaves on open with the credential's
 * minted headers as its payload, the ack subscribes with the envelope
 * (templates resolved at Connect, variables embedded parsed), a ping
 * pongs with the payload echoed, the server's complete / error closes
 * 1000, and the Disconnect rider's Stop sends the client's complete
 * before the close. Every protocol frame is captured VERBATIM.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { closeActiveWsSession } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeSubscriptionRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'gqrq0001',
    path: 'requests/suite-col1/ticks-gqrq0001',
    name: 'Ticks',
    flavor: 'raw',
    url: 'ws://{{host}}/api/graphql',
    subprotocols: ['graphql-transport-ws'],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const SCOPE: Record<string, string> = {
  host: 'api.openheaders.io:3000',
  every: '100',
  token: 'probe-token',
};

function scopedResolution(template: string, unresolved: Set<string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
    const value = SCOPE[name.trim()];
    if (value === undefined) {
      unresolved.add(name.trim());
      return whole;
    }
    return value;
  });
}

function scriptedTransport(): {
  transport: WsTransport;
  wire: () => WsTransportRequest;
  callbacks: () => WsSessionCallbacks;
  sent: string[];
  closes: Array<{ code: number; reason: string }>;
} {
  let seenRequest: WsTransportRequest | null = null;
  let seenCallbacks: WsSessionCallbacks | null = null;
  const sent: string[] = [];
  const closes: Array<{ code: number; reason: string }> = [];
  return {
    transport: {
      connect(request, callbacks) {
        seenRequest = request;
        seenCallbacks = callbacks;
        return {
          send: (text) => sent.push(text),
          close: (code, reason) => {
            closes.push({ code, reason });
            callbacks.onClose({ code, reason, wasClean: true });
            callbacks.onEnd();
          },
        };
      },
    },
    wire: () => {
      if (seenRequest === null) throw new Error('connect never reached the transport');
      return seenRequest;
    },
    callbacks: () => {
      if (seenCallbacks === null) throw new Error('connect never reached the transport');
      return seenCallbacks;
    },
    sent,
    closes,
  };
}

const textFrame = (text: string): { data: Uint8Array; binary: boolean } => ({
  data: new TextEncoder().encode(text),
  binary: false,
});

async function settleTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const PLAN = {
  query: 'subscription Ticks($every: Int) { tick(everyMs: $every, take: 3) }',
  variables: '{"every": {{every}}}',
  operationName: 'Ticks',
};

const ACK = '{"type":"connection_ack"}';
const tick = (n: number): string => `{"id":"1","type":"next","payload":{"data":{"tick":${n}}}}`;

/** A session opened and acked — the settle promise is handed back
 *  WRAPPED (an async return would await it). */
async function openSubscribed(
  rig: ReturnType<typeof scriptedTransport>,
  sendId: string,
  overrides: Partial<WebSocketRequest> = {},
): Promise<{ settled: ReturnType<typeof executeWsSession> }> {
  const settled = executeWsSession(makeSubscriptionRequest(overrides), {
    workspaceId: null,
    environmentId: undefined,
    transport: rig.transport,
    sendId,
    resolution: scopedResolution,
    graphql: PLAN,
  });
  await settleTick();
  rig.callbacks().onOpen('graphql-transport-ws', '');
  rig.callbacks().onMessage(textFrame(ACK));
  return { settled };
}

describe('executeWsSession — the GraphQL subscription plane', () => {
  it('offers the subprotocol, inits on open, subscribes on the ack with the resolved envelope', async () => {
    const rig = scriptedTransport();
    const { settled } = await openSubscribed(rig, 'send-gql-open');
    expect(rig.wire().url).toBe('ws://api.openheaders.io:3000/api/graphql');
    expect(rig.wire().subprotocols).toEqual(['graphql-transport-ws']);
    expect(rig.sent).toEqual([
      '{"type":"connection_init"}',
      '{"id":"1","type":"subscribe","payload":{"query":"subscription Ticks($every: Int) { tick(everyMs: $every, take: 3) }","variables":{"every":100},"operationName":"Ticks"}}',
    ]);
    rig.callbacks().onMessage(textFrame('{"id":"1","type":"complete"}'));
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(rig.closes).toEqual([{ code: 1000, reason: '' }]);
    expect(snapshot.close).toEqual({ code: 1000, reason: '', wasClean: true });
    // Every protocol frame captured verbatim, both directions.
    expect(snapshot.messages.map((m) => `${m.direction}:${Buffer.from(m.dataBase64, 'base64').toString()}`)).toEqual([
      'up:{"type":"connection_init"}',
      `down:${ACK}`,
      `up:${rig.sent[1]}`,
      'down:{"id":"1","type":"complete"}',
    ]);
  });

  it('carries the credential’s minted headers as the connection_init payload', async () => {
    const rig = scriptedTransport();
    const { settled } = await openSubscribed(rig, 'send-gql-auth', { auth: { type: 'bearer', token: '{{token}}' } });
    expect(rig.wire().headers).toEqual([{ key: 'Authorization', value: 'Bearer probe-token' }]);
    expect(rig.sent[0]).toBe('{"type":"connection_init","payload":{"authorization":"Bearer probe-token"}}');
    rig.callbacks().onMessage(textFrame('{"id":"1","type":"complete"}'));
    await settled;
  });

  it('gates an unresolved reference in the envelope before the wire', async () => {
    const rig = scriptedTransport();
    const snapshot = await executeWsSession(makeSubscriptionRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-gql-unresolved',
      resolution: scopedResolution,
      graphql: { ...PLAN, variables: '{"every": {{missing}}}' },
    });
    expect(snapshot.outcome).toMatchObject({ kind: 'failed' });
    expect(snapshot.outcome.kind === 'failed' && snapshot.outcome.error).toContain('missing');
  });

  it('pongs a ping with its payload and closes 1000 on the server’s error', async () => {
    const rig = scriptedTransport();
    const { settled } = await openSubscribed(rig, 'send-gql-ping');
    rig.callbacks().onMessage(textFrame('{"type":"ping","payload":{"at":1}}'));
    expect(rig.sent[2]).toBe('{"type":"pong","payload":{"at":1}}');
    rig.callbacks().onMessage(textFrame('{"id":"1","type":"error","payload":[{"message":"nope"}]}'));
    const snapshot = await settled;
    expect(rig.closes).toEqual([{ code: 1000, reason: '' }]);
    expect(snapshot.close?.code).toBe(1000);
  });

  it('Stop through the Disconnect rider sends the client’s complete before the clean close', async () => {
    const rig = scriptedTransport();
    const { settled } = await openSubscribed(rig, 'send-gql-stop');
    rig.callbacks().onMessage(textFrame(tick(1)));
    rig.callbacks().onMessage(textFrame(tick(2)));
    expect(closeActiveWsSession('send-gql-stop')).toBe(true);
    expect(rig.sent.slice(2)).toEqual(['{"id":"1","type":"complete"}']);
    expect(rig.closes).toEqual([{ code: 1000, reason: '' }]);
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.stopped).toBeUndefined();
    expect(snapshot.messages.filter((m) => m.direction === 'down')).toHaveLength(3);
  });

  it('records a protocol refusal verbatim — a 4401 close ends the session as the server sent it', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSubscriptionRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-gql-4401',
      resolution: scopedResolution,
      graphql: PLAN,
    });
    await settleTick();
    rig.callbacks().onOpen('graphql-transport-ws', '');
    rig.callbacks().onClose({ code: 4401, reason: 'Unauthorized', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.close).toEqual({ code: 4401, reason: 'Unauthorized', wasClean: true });
    expect(rig.closes).toEqual([]);
  });
});
