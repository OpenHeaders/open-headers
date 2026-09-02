/**
 * WS executor — the session-resilience plane (the MQTT reconnect
 * plane, lifted): a dropped OPEN connection logs `lost` and redials on
 * the period; the attempt cap spends into `reconnectExhausted`; a
 * client Disconnect never redials, a Stop between attempts settles
 * Stopped; the liveness deadline cuts a silent connection (the
 * socketio flavor derives it from the handshake); the raw heartbeat
 * frame rides the captured send path; the reconnect-now rider fires
 * the armed attempt early; a socketio reconnect re-CONNECTs the
 * namespace while a server DISCONNECT is the one drop never redialed.
 */

import type { WebSocketRequest } from '@openheaders/core/types';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { executeWsSession } from '@openheaders/oracle/live/ws-exec/execute';
import {
  closeActiveWsSession,
  reconnectActiveWsSessionNow,
  sendActiveWsSessionMessage,
} from '@openheaders/oracle/live/ws-exec/session-plane';
import {
  type WsSessionCallbacks,
  type WsTransport,
  WsTransportError,
  type WsTransportRequest,
} from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeWsRequest(overrides: Partial<WebSocketRequest> = {}): WebSocketRequest {
  return {
    schemaVersion: 5,
    uid: 'ws-rc-1',
    path: 'requests/suite-col1/probe-ws-rc',
    name: 'Probe WS reconnect',
    flavor: 'raw',
    url: 'wss://events.openheaders.io/live',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    autoReconnect: true,
    reconnectBackoff: false,
    reconnectPeriodMs: 2_000,
    ...overrides,
  };
}

const textFrame = (text: string): { data: Uint8Array; binary: boolean } => ({
  data: new TextEncoder().encode(text),
  binary: false,
});

const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('utf8');

/** Multi-dial scripted transport — every `connect` is one numbered
 *  dial with its own server side; the rig opens, severs, closes or
 *  fails any of them. */
function reconnectRig() {
  const dials: Array<{ request: WsTransportRequest; callbacks: WsSessionCallbacks; ended: boolean; sent: string[] }> =
    [];
  const transport: WsTransport = {
    connect(request, callbacks, signal) {
      const dial = { request, callbacks, ended: false, sent: [] as string[] };
      dials.push(dial);
      const finish = (): void => {
        if (dial.ended) return;
        dial.ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        send: (text) => dial.sent.push(text),
        close: (code, reason) => {
          if (dial.ended) return;
          dial.ended = true;
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
    sentOn: (n: number) => dialAt(n).sent,
    open: (n: number, protocol = '') => dialAt(n).callbacks.onOpen(protocol, ''),
    push: (n: number, text: string) => dialAt(n).callbacks.onMessage(textFrame(text)),
    /** The socket dropped without a Close frame. */
    sever: (n: number) => {
      const dial = dialAt(n);
      dial.ended = true;
      dial.callbacks.onEnd();
    },
    /** The server closed with a Close frame. */
    serverClose: (n: number, code: number, reason: string) => {
      const dial = dialAt(n);
      dial.ended = true;
      dial.callbacks.onClose({ code, reason, wasClean: true });
      dial.callbacks.onEnd();
    },
    /** The dial failed before it opened. */
    fail: (n: number, message: string) => {
      const dial = dialAt(n);
      dial.ended = true;
      dial.callbacks.onEnd(new WsTransportError(message));
    },
  };
}

const baseOptions = (rig: ReturnType<typeof reconnectRig>, sendId: string) => ({
  workspaceId: null,
  environmentId: undefined,
  transport: rig.transport,
  sendId,
  resolution: (template: string) => template,
});

describe('executeWsSession — auto-reconnect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = () => vi.advanceTimersByTimeAsync(0);

  it('logs the lost connection at its message index, redials on the period, and records the reconnected handshake', async () => {
    const rig = reconnectRig();
    const events: string[] = [];
    const settled = executeWsSession(makeWsRequest(), {
      ...baseOptions(rig, 'send-ws-rc'),
      emitStreamEvent: (e) => events.push(e.kind === 'lifecycle' ? `lifecycle:${e.item.kind}` : e.kind),
    });
    await tick();
    rig.open(0, 'chat.v1');
    rig.push(0, 'hello');
    rig.serverClose(0, 1011, 'restarting');
    await tick();
    // Between attempts the riders answer honestly instead of writing.
    expect((await sendActiveWsSessionMessage('send-ws-rc', 'x')).success).toBe(false);
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(rig.dialCount()).toBe(2);
    rig.open(1, 'chat.v2');
    expect(await sendActiveWsSessionMessage('send-ws-rc', 'again')).toEqual({ success: true });
    expect(rig.sentOn(1)).toEqual(['again']);
    closeActiveWsSession('send-ws-rc');
    await tick();
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.protocol).toBe('chat.v2');
    expect(snapshot.close).toEqual({ code: 1000, reason: '', wasClean: true });
    expect(snapshot.reconnectExhausted).toBeUndefined();
    expect(snapshot.lifecycle).toEqual([
      { kind: 'lost', close: { code: 1011, reason: 'restarting', wasClean: true }, atIndex: 1 },
      { kind: 'reconnecting', attempt: 1, delayMs: 2_000, atIndex: 1 },
      { kind: 'reconnected', attempt: 1, protocol: 'chat.v2', extensions: '', atIndex: 1 },
    ]);
    expect(snapshot.messages.map((m) => decode(m.dataBase64))).toEqual(['hello', 'again']);
    expect(events).toEqual([
      'open',
      'messages',
      'lifecycle:lost',
      'lifecycle:reconnecting',
      'lifecycle:reconnected',
      'messages',
      'end',
    ]);
  });

  it('carries a failed dial onto the next attempt and settles Reconnect gave up when the cap is spent', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(makeWsRequest({ reconnectMaxAttempts: 2 }), baseOptions(rig, 'send-ws-rc-cap'));
    await tick();
    rig.open(0);
    rig.sever(0);
    await tick();
    await vi.advanceTimersByTimeAsync(2_000);
    rig.fail(1, 'Connection refused by events.openheaders.io:443');
    await tick();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rig.dialCount()).toBe(3);
    rig.fail(2, 'Connection refused by events.openheaders.io:443');
    await tick();
    const snapshot = await settled;
    expect(snapshot.outcome.kind).toBe('connected');
    expect(snapshot.close).toBeNull();
    expect(snapshot.reconnectExhausted).toEqual({
      attempts: 2,
      error: 'Connection refused by events.openheaders.io:443',
    });
    expect(snapshot.lifecycle).toEqual([
      { kind: 'lost', close: null, atIndex: 0 },
      { kind: 'reconnecting', attempt: 1, delayMs: 2_000, atIndex: 0 },
      {
        kind: 'reconnecting',
        attempt: 2,
        delayMs: 2_000,
        error: 'Connection refused by events.openheaders.io:443',
        atIndex: 0,
      },
    ]);
  });

  it('never redials a client Disconnect, and a Stop between attempts settles Stopped', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(makeWsRequest(), baseOptions(rig, 'send-ws-rc-dc'));
    await tick();
    rig.open(0);
    closeActiveWsSession('send-ws-rc-dc');
    await tick();
    const snapshot = await settled;
    expect(rig.dialCount()).toBe(1);
    expect(snapshot.lifecycle).toBeUndefined();
    expect(snapshot.close).toEqual({ code: 1000, reason: '', wasClean: true });

    const rig2 = reconnectRig();
    const settled2 = executeWsSession(makeWsRequest(), baseOptions(rig2, 'send-ws-rc-stop'));
    await tick();
    rig2.open(0);
    rig2.sever(0);
    await tick();
    expect(stopActiveSend('send-ws-rc-stop')).toBe(true);
    const snapshot2 = await settled2;
    expect(rig2.dialCount()).toBe(1);
    expect(snapshot2.stopped).toBe(true);
    expect(snapshot2.lifecycle).toEqual([{ kind: 'lost', close: null, atIndex: 0 }]);
  });

  it('a first connect that fails never retries', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(makeWsRequest(), baseOptions(rig, 'send-ws-rc-first'));
    await tick();
    rig.fail(0, 'Connection refused');
    const snapshot = await settled;
    expect(snapshot.outcome).toEqual({ kind: 'failed', error: 'Connection refused' });
    expect(rig.dialCount()).toBe(1);
  });

  it('the reconnect-now rider dials the armed attempt early and records the wait actually sat through', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(makeWsRequest(), baseOptions(rig, 'send-ws-rc-now'));
    await tick();
    expect(reconnectActiveWsSessionNow('send-ws-rc-now')).toBe(false);
    rig.open(0);
    rig.sever(0);
    await tick();
    await vi.advanceTimersByTimeAsync(500);
    expect(reconnectActiveWsSessionNow('send-ws-rc-now')).toBe(true);
    expect(rig.dialCount()).toBe(2);
    expect(reconnectActiveWsSessionNow('send-ws-rc-now')).toBe(false);
    rig.open(1);
    closeActiveWsSession('send-ws-rc-now');
    await tick();
    const snapshot = await settled;
    expect(snapshot.lifecycle?.[1]).toEqual({
      kind: 'reconnecting',
      attempt: 1,
      delayMs: 500,
      forced: true,
      atIndex: 0,
    });
  });

  it('the liveness deadline cuts a silent connection as lost (idle) and the loop redials; without auto-reconnect it settles on it', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(makeWsRequest({ idleTimeoutMs: 10_000 }), baseOptions(rig, 'send-ws-rc-idle'));
    await tick();
    rig.open(0);
    await vi.advanceTimersByTimeAsync(9_000);
    rig.push(0, 'still here');
    await vi.advanceTimersByTimeAsync(9_000);
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    await tick();
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rig.dialCount()).toBe(2);
    rig.open(1);
    closeActiveWsSession('send-ws-rc-idle');
    await tick();
    const snapshot = await settled;
    expect(snapshot.lifecycle?.[0]).toEqual({ kind: 'lost', close: null, idle: true, atIndex: 1 });

    const rig2 = reconnectRig();
    const settled2 = executeWsSession(
      makeWsRequest({ autoReconnect: false, idleTimeoutMs: 5_000 }),
      baseOptions(rig2, 'send-ws-idle-only'),
    );
    await tick();
    rig2.open(0);
    await vi.advanceTimersByTimeAsync(5_000);
    await tick();
    const snapshot2 = await settled2;
    expect(rig2.dialCount()).toBe(1);
    expect(snapshot2.outcome.kind).toBe('connected');
    expect(snapshot2.stopped).toBeUndefined();
    expect(snapshot2.lifecycle).toEqual([{ kind: 'lost', close: null, idle: true, atIndex: 0 }]);
  });

  it('writes the raw heartbeat frame on its interval through the captured send path, per connection', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(
      makeWsRequest({ heartbeatMessage: '{"type":"ping"}', heartbeatIntervalMs: 3_000 }),
      baseOptions(rig, 'send-ws-hb'),
    );
    await tick();
    rig.open(0);
    await vi.advanceTimersByTimeAsync(6_000);
    expect(rig.sentOn(0)).toEqual(['{"type":"ping"}', '{"type":"ping"}']);
    rig.sever(0);
    await tick();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(rig.sentOn(0)).toHaveLength(2);
    rig.open(1);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(rig.sentOn(1)).toEqual(['{"type":"ping"}']);
    closeActiveWsSession('send-ws-hb');
    await tick();
    const snapshot = await settled;
    expect(snapshot.messages.filter((m) => m.direction === 'up')).toHaveLength(3);
  });
});

describe('executeWsSession — socketio resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const tick = () => vi.advanceTimersByTimeAsync(0);
  const OPEN_PACKET = '0{"sid":"s1","pingInterval":25000,"pingTimeout":20000}';

  it('re-CONNECTs the namespace on the reconnected engine.io open, and derives the liveness deadline from the handshake', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(
      makeWsRequest({ flavor: 'socketio', url: 'ws://events.openheaders.io/admin', heartbeatMessage: 'ignored' }),
      baseOptions(rig, 'send-sio-rc'),
    );
    await tick();
    rig.open(0);
    rig.push(0, OPEN_PACKET);
    expect(rig.sentOn(0)).toEqual(['40/admin,']);
    // No server ping for pingInterval + pingTimeout — the deadline cuts it.
    await vi.advanceTimersByTimeAsync(44_999);
    expect(rig.dialCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await tick();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(rig.dialCount()).toBe(2);
    rig.open(1);
    rig.push(1, OPEN_PACKET);
    expect(rig.sentOn(1)).toEqual(['40/admin,']);
    closeActiveWsSession('send-sio-rc');
    await tick();
    const snapshot = await settled;
    expect(snapshot.lifecycle?.[0]).toEqual({ kind: 'lost', close: null, idle: true, atIndex: 2 });
    // The heartbeat knob is raw-only — no frame rode the socketio session.
    expect(rig.sentOn(0)).toHaveLength(1);
  });

  it('a server DISCONNECT packet on the namespace is the one drop never redialed', async () => {
    const rig = reconnectRig();
    const settled = executeWsSession(
      makeWsRequest({ flavor: 'socketio', url: 'ws://events.openheaders.io/admin' }),
      baseOptions(rig, 'send-sio-bye'),
    );
    await tick();
    rig.open(0);
    rig.push(0, OPEN_PACKET);
    rig.push(0, '41/admin,');
    rig.serverClose(0, 1000, '');
    await tick();
    const snapshot = await settled;
    expect(rig.dialCount()).toBe(1);
    expect(snapshot.lifecycle).toBeUndefined();
    expect(snapshot.close).toEqual({ code: 1000, reason: '', wasClean: true });
  });
});
