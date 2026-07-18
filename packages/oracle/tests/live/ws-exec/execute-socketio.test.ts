/**
 * WS executor — the socketio flavor's framing layer (S6): the engine.io
 * dial URL, the namespace CONNECT answered to the server's open packet,
 * the ping → pong heartbeat, EVENT compose on the rider (ack ids
 * minted opt-in), and the capture recording every protocol frame
 * VERBATIM (the display decodes; the snapshot never does). The
 * transport stays protocol-blind — everything here rides the same
 * scripted seam the raw flavor uses.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import { sendActiveWsSessionMessage } from '@openheaders/oracle/live/ws-exec/session-plane';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

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
    expect(snapshot.error).toBeNull();
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

    const plain = sendActiveWsSessionMessage('send-sio-event', '["hello", 2]', {
      eventName: '{{event}}',
      expectAck: false,
    });
    expect(plain).toEqual({ success: true });
    const first = sendActiveWsSessionMessage('send-sio-event', '', { eventName: 'ping-me', expectAck: true });
    const second = sendActiveWsSessionMessage('send-sio-event', '[true]', { eventName: 'ping-me', expectAck: true });
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

    const notArray = sendActiveWsSessionMessage('send-sio-badargs', '{"a":1}', { eventName: 'echo', expectAck: false });
    expect(notArray.success).toBe(false);
    expect(notArray.error).toContain('JSON array');
    const noName = sendActiveWsSessionMessage('send-sio-badargs', '[]', { eventName: ' ', expectAck: false });
    expect(noName.success).toBe(false);
    expect(rig.sent).toEqual(['40']);

    const stillOpen = sendActiveWsSessionMessage('send-sio-badargs', '[1]', { eventName: 'echo', expectAck: false });
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
    expect(snapshot.connected).toBe(false);
    expect(snapshot.error).toContain('namespace');
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
    const result = sendActiveWsSessionMessage('send-sio-onraw', '[]', { eventName: 'echo', expectAck: false });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a Socket.IO session');
    rig.callbacks().onEnd();
    await settled;
  });
});
