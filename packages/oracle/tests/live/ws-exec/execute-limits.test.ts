/**
 * WS executor — the limits plane: the request's max message size is
 * ONE law on every host (an inbound message over the cap is never
 * captured and ends the session on the Message Too Big close, a
 * client-asked end auto-reconnect never redials); the handshake
 * redirect knobs ride the transport request only when set.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { executeWsSession, WS_MESSAGE_TOO_BIG_CODE } from '@openheaders/oracle/live/ws-exec/execute';
import type { WsSessionCallbacks, WsTransport, WsTransportRequest } from '@openheaders/oracle/live/ws-exec/transport';
import { describe, expect, it } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-lim-1',
    path: 'requests/suite-col1/probe-ws-limits',
    name: 'Probe WS limits',
    flavor: 'raw',
    url: 'wss://events.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    ...overrides,
  };
}

const frame = (byteLength: number): { data: Uint8Array; binary: boolean } => ({
  data: new Uint8Array(byteLength).fill(0x61),
  binary: false,
});

/** Scripted transport: one dial per connect, the server side driven
 *  from the test; a client close is answered with the peer's echo. */
function limitsRig() {
  const dials: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks; closes: Array<[number, string]> }> =
    [];
  const transport: WsTransport = {
    connect(request, callbacks) {
      const dial = { request, callbacks, closes: [] as Array<[number, string]> };
      dials.push(dial);
      return {
        send: () => {},
        close: (code, reason) => {
          dial.closes.push([code, reason]);
          callbacks.onClose({ code, reason, wasClean: true });
          queueMicrotask(() => callbacks.onEnd());
        },
      };
    },
  };
  const dialAt = (n: number) => {
    const dial = dials[n];
    if (dial === undefined) throw new Error(`dial ${n} never happened`);
    return dial;
  };
  return {
    transport,
    dialCount: () => dials.length,
    requestOf: (n: number) => dialAt(n).request,
    closesOn: (n: number) => dialAt(n).closes,
    open: (n: number) => dialAt(n).callbacks.onOpen('', ''),
    push: (n: number, byteLength: number) => dialAt(n).callbacks.onMessage(frame(byteLength)),
    serverClose: (n: number) => {
      dialAt(n).callbacks.onClose({ code: 1000, reason: '', wasClean: true });
      dialAt(n).callbacks.onEnd();
    },
  };
}

const baseOptions = (rig: ReturnType<typeof limitsRig>, sendId: string) => ({
  workspaceId: null,
  environmentId: undefined,
  transport: rig.transport,
  sendId,
  resolution: (template: string) => template,
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('executeWsSession — max message size', () => {
  it('ends the session on Message Too Big for a message over the cap, never captured, never redialed', async () => {
    const rig = limitsRig();
    const settled = executeWsSession(
      makeWsRequest({ maxMessageBytes: 1_024, autoReconnect: true, reconnectPeriodMs: 1_000 }),
      baseOptions(rig, 'send-ws-lim-cap'),
    );
    await tick();
    rig.open(0);
    rig.push(0, 1_024);
    rig.push(0, 1_025);
    const snapshot = await settled;
    expect(rig.closesOn(0)).toEqual([[WS_MESSAGE_TOO_BIG_CODE, 'Message of 1025 bytes exceeds the 1024 byte limit']]);
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.messages.map((m) => Buffer.from(m.dataBase64, 'base64').byteLength)).toEqual([1_024]);
    expect(snapshot.close).toEqual({
      code: WS_MESSAGE_TOO_BIG_CODE,
      reason: 'Message of 1025 bytes exceeds the 1024 byte limit',
      wasClean: true,
    });
    expect(snapshot.lifecycle).toBeUndefined();
    expect(rig.dialCount()).toBe(1);
  });

  it('captures every size with no cap set', async () => {
    const rig = limitsRig();
    const settled = executeWsSession(makeWsRequest(), baseOptions(rig, 'send-ws-lim-none'));
    await tick();
    rig.open(0);
    rig.push(0, 200_000);
    rig.serverClose(0);
    const snapshot = await settled;
    expect(rig.closesOn(0)).toEqual([]);
    expect(snapshot.messages).toHaveLength(1);
  });
});

describe('executeWsSession — handshake redirects on the transport request', () => {
  it('rides the knobs only when the request sets them', async () => {
    const rig = limitsRig();
    const settledBare = executeWsSession(makeWsRequest(), baseOptions(rig, 'send-ws-lim-rd0'));
    await tick();
    expect(rig.requestOf(0)).not.toHaveProperty('followRedirects');
    expect(rig.requestOf(0)).not.toHaveProperty('maxRedirects');
    rig.open(0);
    rig.serverClose(0);
    await settledBare;
    const settledOn = executeWsSession(
      makeWsRequest({ followRedirects: true, maxRedirects: 3 }),
      baseOptions(rig, 'send-ws-lim-rd1'),
    );
    await tick();
    expect(rig.requestOf(1)).toMatchObject({ followRedirects: true, maxRedirects: 3 });
    rig.open(1);
    rig.serverClose(1);
    await settledOn;
  });
});
