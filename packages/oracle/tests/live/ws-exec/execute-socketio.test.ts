/**
 * WS executor — the socketio flavor's framing layer (S6): the engine.io
 * dial URL, the namespace CONNECT answered to the server's open packet,
 * the ping → pong heartbeat, EVENT compose on the rider (ack ids
 * minted opt-in), and the capture recording every protocol frame
 * VERBATIM (the display decodes; the snapshot never does). The
 * transport stays protocol-blind — everything here rides the same
 * scripted seam the raw flavor uses. The S5 protocol slice: the v4
 * revision (EIO=3, the client pings, the root namespace needs no
 * CONNECT, no CONNECT payload), the ack timeout registry, and the
 * subprotocol offer masked off the socketio flavor.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeSocketIoRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-sio-1',
    path: 'requests/suite-col1/probe-sio1',
    name: 'Probe SIO',
    flavor: 'socketio',
    url: 'ws://{{host}}',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const SCOPE: Record<string, string> = {
  host: 'events.openheaders.io:3000',
  event: 'echo',
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
} {
  let seenRequest: WsTransportRequest | null = null;
  let seenCallbacks: WsSessionCallbacks | null = null;
  const sent: string[] = [];
  return {
    transport: {
      connect(request, callbacks) {
        seenRequest = request;
        seenCallbacks = callbacks;
        return {
          send: (text) => sent.push(text),
          close: () => callbacks.onEnd(),
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
  };
}

const textFrame = (text: string): { data: Uint8Array; binary: boolean } => ({
  data: new TextEncoder().encode(text),
  binary: false,
});

async function settleTick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('executeWsSession — socketio flavor', () => {
  it('dials the engine.io URL: default mount, user params first, EIO + transport joined', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ params: [{ uid: 'p1', key: 'room', value: 'alpha' }] }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-url',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().url).toBe('ws://events.openheaders.io:3000/socket.io/?room=alpha&EIO=4&transport=websocket');
    rig.callbacks().onEnd();
    await settled;
  });

  it('mounts the handshake path setting and reads the URL path as the namespace', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(
      makeSocketIoRequest({ url: 'ws://{{host}}/admin', handshakePath: '/net/sio-probe' }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: rig.transport,
        sendId: 'send-sio-path',
        resolution: scopedResolution,
      },
    );
    await settleTick();
    expect(rig.wire().url).toBe('ws://events.openheaders.io:3000/net/sio-probe/?EIO=4&transport=websocket');
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"s1","pingInterval":25000,"pingTimeout":20000}'));
    expect(rig.sent).toEqual(['40/admin,']);
    rig.callbacks().onEnd();
    await settled;
  });

  it('answers the open packet with the namespace CONNECT and pings with pongs — all captured verbatim', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ namespace: 'probe' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-hs',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc","pingInterval":25000,"pingTimeout":20000}'));
    expect(rig.sent).toEqual(['40/probe,']);
    rig.callbacks().onMessage(textFrame('40/probe,{"sid":"abc"}'));
    rig.callbacks().onMessage(textFrame('2'));
    expect(rig.sent).toEqual(['40/probe,', '3']);
    rig.callbacks().onClose({ code: 1000, reason: '', wasClean: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'connected' });
    // Both directions in call order, protocol frames included verbatim.
    const decode = (b64: string): string => Buffer.from(b64, 'base64').toString('utf8');
    expect(snapshot.messages.map((m) => `${m.direction}:${decode(m.dataBase64)}`)).toEqual([
      'down:0{"sid":"abc","pingInterval":25000,"pingTimeout":20000}',
      'up:40/probe,',
      'down:40/probe,{"sid":"abc"}',
      'down:2',
      'up:3',
    ]);
  });

  it('frames the rider EVENT compose — templates resolved, ack ids minted opt-in', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-event',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));

    const plain = await sendActiveWsSessionMessage('send-sio-event', '["hello", 2]', {
      eventName: '{{event}}',
      expectAck: false,
    });
    expect(plain).toEqual({ success: true });
    const first = await sendActiveWsSessionMessage('send-sio-event', '', { eventName: 'ping-me', expectAck: true });
    const second = await sendActiveWsSessionMessage('send-sio-event', '[true]', {
      eventName: 'ping-me',
      expectAck: true,
    });
    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(rig.sent).toEqual(['40', '42["echo","hello",2]', '421["ping-me"]', '422["ping-me",true]']);

    rig.callbacks().onEnd();
    await settled;
  });

  it('fails a rider that does not compose — the session stays open', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-badargs',
      resolution: scopedResolution,
    });
    await settleTick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));

    const notArray = await sendActiveWsSessionMessage('send-sio-badargs', '{"a":1}', {
      eventName: 'echo',
      expectAck: false,
    });
    expect(notArray.success).toBe(false);
    expect(notArray.error).toContain('JSON array');
    const noName = await sendActiveWsSessionMessage('send-sio-badargs', '[]', { eventName: ' ', expectAck: false });
    expect(noName.success).toBe(false);
    expect(rig.sent).toEqual(['40']);

    const stillOpen = await sendActiveWsSessionMessage('send-sio-badargs', '[1]', {
      eventName: 'echo',
      expectAck: false,
    });
    expect(stillOpen).toEqual({ success: true });

    rig.callbacks().onEnd();
    await settled;
  });

  it('gates a comma-carrying namespace as a structured pre-wire error', async () => {
    const rig = scriptedTransport();
    const snapshot = await executeWsSession(makeSocketIoRequest({ namespace: '/a,b' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-badns',
      resolution: scopedResolution,
    });
    if (snapshot.outcome.kind !== 'failed') throw new Error('expected a failed outcome');
    expect(snapshot.outcome.error).toContain('namespace');
  });

  it('rejects the socketio rider addendum on a raw-flavor session', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ flavor: 'raw', url: 'ws://{{host}}/live' }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-onraw',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().url).toBe('ws://events.openheaders.io:3000/live');
    rig.callbacks().onOpen('', '');
    const result = await sendActiveWsSessionMessage('send-sio-onraw', '[]', { eventName: 'echo', expectAck: false });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a Socket.IO session');
    rig.callbacks().onEnd();
    await settled;
  });

  it('never offers a stored subprotocol list on the socketio flavor', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ subprotocols: ['graphql-ws'] }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-nosub',
      resolution: scopedResolution,
    });
    await settleTick();
    expect(rig.wire().subprotocols).toEqual([]);
    rig.callbacks().onOpen('', '');
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.requestHeaders?.some((h) => h.key === 'Sec-WebSocket-Protocol')).toBe(false);
  });
});

describe('executeWsSession — socketio flavor, timers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = () => vi.advanceTimersByTimeAsync(0);

  it('speaks protocol v4: dials EIO=3, pings on the handshake cadence and again after each pong', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ socketioProtocol: 4 }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-v4',
      resolution: scopedResolution,
    });
    await tick();
    expect(rig.wire().url).toBe('ws://events.openheaders.io:3000/socket.io/?EIO=3&transport=websocket');
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc","pingInterval":1000,"pingTimeout":500}'));
    // The server connects the root namespace itself on v4.
    expect(rig.sent).toEqual([]);
    rig.callbacks().onMessage(textFrame('40'));
    await vi.advanceTimersByTimeAsync(999);
    expect(rig.sent).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(rig.sent).toEqual(['2']);
    // No pong yet — no second ping; the pong re-arms the cadence.
    await vi.advanceTimersByTimeAsync(1000);
    expect(rig.sent).toEqual(['2']);
    rig.callbacks().onMessage(textFrame('3'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(rig.sent).toEqual(['2', '2']);
    rig.callbacks().onEnd();
    await settled;
  });

  it('protocol v4 CONNECTs a non-root namespace without the auth payload; v5 carries it', async () => {
    const v4 = scriptedTransport();
    const settledV4 = executeWsSession(
      makeSocketIoRequest({ socketioProtocol: 4, namespace: 'admin', auth: { type: 'bearer', token: 't0k' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: v4.transport,
        sendId: 'send-sio-v4-ns',
        resolution: scopedResolution,
      },
    );
    await tick();
    v4.callbacks().onOpen('', '');
    v4.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(v4.sent).toEqual(['40/admin,']);
    v4.callbacks().onEnd();
    await settledV4;

    const v5 = scriptedTransport();
    const settledV5 = executeWsSession(
      makeSocketIoRequest({ namespace: 'admin', auth: { type: 'bearer', token: 't0k' } }),
      {
        workspaceId: null,
        environmentId: undefined,
        transport: v5.transport,
        sendId: 'send-sio-v5-ns',
        resolution: scopedResolution,
      },
    );
    await tick();
    expect(v5.wire().url).toContain('EIO=4');
    v5.callbacks().onOpen('', '');
    v5.callbacks().onMessage(textFrame('0{"sid":"abc","pingInterval":1000,"pingTimeout":500}'));
    expect(v5.sent).toEqual(['40/admin,{"token":"t0k"}']);
    // v5 never pings from the client.
    await vi.advanceTimersByTimeAsync(3000);
    expect(v5.sent).toEqual(['40/admin,{"token":"t0k"}']);
    v5.callbacks().onEnd();
    await settledV5;
  });

  it('records an ack timeout fact when the ACK never comes, clears the wait when it does', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ ackTimeoutMs: 2000 }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-ack',
      resolution: scopedResolution,
    });
    await tick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    expect(await sendActiveWsSessionMessage('send-sio-ack', '[1]', { eventName: 'echo', expectAck: true })).toEqual({
      success: true,
    });
    expect(await sendActiveWsSessionMessage('send-sio-ack', '[2]', { eventName: 'echo', expectAck: true })).toEqual({
      success: true,
    });
    expect(await sendActiveWsSessionMessage('send-sio-ack', '[3]', { eventName: 'echo', expectAck: false })).toEqual({
      success: true,
    });
    // The second ack lands in time; the first never does.
    await vi.advanceTimersByTimeAsync(500);
    rig.callbacks().onMessage(textFrame('432[true]'));
    await vi.advanceTimersByTimeAsync(1499);
    rig.callbacks().onMessage(textFrame('42["late"]'));
    await vi.advanceTimersByTimeAsync(1);
    // A late ACK after the timeout captures like any frame, no fact.
    rig.callbacks().onMessage(textFrame('431[false]'));
    rig.callbacks().onEnd();
    const snapshot = await settled;
    expect(snapshot.lifecycle).toEqual([{ kind: 'ackTimeout', ackId: 1, timeoutMs: 2000, atIndex: 7 }]);
    expect(snapshot.messages).toHaveLength(8);
  });

  it('drops pending acks with the connection — no fact after the end, none across a redial', async () => {
    const rig = scriptedTransport();
    const settled = executeWsSession(makeSocketIoRequest({ ackTimeoutMs: 1000 }), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-sio-ack-end',
      resolution: scopedResolution,
    });
    await tick();
    rig.callbacks().onOpen('', '');
    rig.callbacks().onMessage(textFrame('0{"sid":"abc"}'));
    void sendActiveWsSessionMessage('send-sio-ack-end', '[1]', { eventName: 'echo', expectAck: true });
    rig.callbacks().onEnd();
    const snapshot = await settled;
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshot.lifecycle).toBeUndefined();
  });
});
