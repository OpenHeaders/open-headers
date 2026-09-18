/**
 * The delegating WebSocket transport over a fake socket wire: the
 * resolved handshake rides the open frame with the context's
 * workspace and a transport-minted socket id; the place's events feed
 * the seam's callbacks (bytes decoded, `end` exactly once, the claim
 * released); the writer's sends and close ride riders; the executor's
 * abort forwards as the place's abort; an open refusal, a dead wire
 * and a missing answer all settle through `onEnd` with the classified
 * error; `executedOn()` names who answered.
 */

import type { DelegatedSocketEvent } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createDelegatingWsTransport } from '../../../src/live/delegated-socket/delegating-ws-transport';
import type { DelegatedSocketWire } from '../../../src/live/delegated-socket/wire';
import { type WsSessionCallbacks, WsTransportError } from '../../../src/live/ws-exec/transport';

const REQUEST = {
  url: 'wss://echo.openheaders.io/ws',
  headers: [{ key: 'X-Token', value: 'resolved' }],
  subprotocols: ['chat'],
};
const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

/** One event variant minus the wire's own stamps — Omit distributed
 *  over the union so each variant keeps its own fields. */
type SocketEventInput = DelegatedSocketEvent extends infer E
  ? E extends DelegatedSocketEvent
    ? Omit<E, 'socketId' | 'seq'>
    : never
  : never;

interface FakeWire extends DelegatedSocketWire {
  calls: Array<Record<string, unknown>>;
  listeners: Map<string, (event: DelegatedSocketEvent) => void>;
  emit(socketId: string, event: SocketEventInput & { seq?: number }): void;
}

function fakeWire(answer: (frame: Record<string, unknown>) => Promise<unknown>): FakeWire {
  const wire: FakeWire = {
    calls: [],
    listeners: new Map(),
    call: (frame) => {
      wire.calls.push(frame);
      return answer(frame);
    },
    subscribe: (socketId, onEvent) => {
      wire.listeners.set(socketId, onEvent);
      return () => {
        wire.listeners.delete(socketId);
      };
    },
    emit: (socketId, event) => {
      wire.listeners.get(socketId)?.({ socketId, seq: 0, ...event } as DelegatedSocketEvent);
    },
  };
  return wire;
}

function callbacks(): WsSessionCallbacks & { ends: Array<WsTransportError | undefined> } {
  const ends: Array<WsTransportError | undefined> = [];
  return {
    ends,
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onEnd: (error) => {
      ends.push(error);
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('createDelegatingWsTransport', () => {
  it('rides the open frame and feeds the events to the seam, releasing the claim on end', async () => {
    const wire = fakeWire(async () => ({ success: true, executedOn: EXECUTED_ON }));
    const transport = createDelegatingWsTransport({ wire, workspaceId: 'ws-1', mintSocketId: () => 'sock-1' });
    const cb = callbacks();
    const writer = transport.connect(REQUEST, cb);
    await flush();
    expect(wire.calls[0]).toEqual({
      type: 'delegateWsOpen',
      socketId: 'sock-1',
      workspaceId: 'ws-1',
      request: REQUEST,
    });
    expect(transport.executedOn()).toEqual(EXECUTED_ON);
    wire.emit('sock-1', { kind: 'open', protocol: 'chat', extensions: '' });
    expect(cb.onOpen).toHaveBeenCalledWith('chat', '', undefined);
    wire.emit('sock-1', { kind: 'message', dataBase64: 'aGk=', binary: false });
    const message = (cb.onMessage as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      data: Uint8Array;
      binary: boolean;
    };
    expect(Array.from(message.data)).toEqual([104, 105]);
    expect(message.binary).toBe(false);
    writer.send('hello');
    writer.sendBinary?.(new Uint8Array([1, 2]));
    writer.close(1000, 'done');
    expect(wire.calls.slice(1)).toEqual([
      { type: 'delegateWsSend', socketId: 'sock-1', text: 'hello' },
      { type: 'delegateWsSend', socketId: 'sock-1', binaryBase64: 'AQI=' },
      { type: 'delegateWsClose', socketId: 'sock-1', code: 1000, reason: 'done' },
    ]);
    wire.emit('sock-1', { kind: 'close', code: 1000, reason: 'done', wasClean: true });
    expect(cb.onClose).toHaveBeenCalledWith({ code: 1000, reason: 'done', wasClean: true });
    wire.emit('sock-1', { kind: 'end' });
    expect(cb.ends).toEqual([undefined]);
    expect(wire.listeners.size).toBe(0);
    // Writes after the end are quiet no-ops.
    writer.send('late');
    expect(wire.calls).toHaveLength(4);
  });

  it("forwards the executor's abort as the place's abort by the socket id", async () => {
    const wire = fakeWire(async () => ({ success: true, executedOn: EXECUTED_ON }));
    const transport = createDelegatingWsTransport({ wire, workspaceId: 'ws-1', mintSocketId: () => 'sock-2' });
    const controller = new AbortController();
    transport.connect(REQUEST, callbacks(), controller.signal);
    await flush();
    controller.abort();
    expect(wire.calls.at(-1)).toEqual({ type: 'delegateSocketAbort', socketId: 'sock-2' });
  });

  it("settles through onEnd with the place's classified failure, hint included", async () => {
    const wire = fakeWire(async () => ({ success: true, executedOn: EXECUTED_ON }));
    const transport = createDelegatingWsTransport({ wire, workspaceId: 'ws-1', mintSocketId: () => 'sock-3' });
    const cb = callbacks();
    transport.connect(REQUEST, cb);
    await flush();
    wire.emit('sock-3', {
      kind: 'end',
      error: {
        message: 'self signed certificate',
        hint: { kind: 'trust-certificate', host: 'echo.openheaders.io', port: 443, code: 'X' },
      },
    });
    expect(cb.ends).toHaveLength(1);
    expect(cb.ends[0]).toBeInstanceOf(WsTransportError);
    expect(cb.ends[0]?.message).toBe('self signed certificate');
    expect(cb.ends[0]?.hint).toMatchObject({ kind: 'trust-certificate' });
  });

  it("settles on the place's open refusal, on a dead wire, and on an answer that is no answer", async () => {
    const refused = fakeWire(async () => ({ success: false, error: 'No such workspace', executedOn: EXECUTED_ON }));
    const a = callbacks();
    createDelegatingWsTransport({ wire: refused, workspaceId: 'ws-1' }).connect(REQUEST, a);
    await flush();
    expect(a.ends[0]?.message).toBe('No such workspace');

    const dead = fakeWire(async () => {
      throw new Error('not-connected');
    });
    const b = callbacks();
    createDelegatingWsTransport({ wire: dead, workspaceId: 'ws-1' }).connect(REQUEST, b);
    await flush();
    expect(b.ends[0]?.message).toBe('not-connected');
    expect(dead.listeners.size).toBe(0);

    const mute = fakeWire(async () => undefined);
    const c = callbacks();
    createDelegatingWsTransport({ wire: mute, workspaceId: 'ws-1' }).connect(REQUEST, c);
    await flush();
    expect(c.ends[0]?.message).toBe('The place gave no answer to the open.');

    // A failure the WIRE answered (the place's gate refusal thrown on
    // its RPC, relayed unstamped by a worker that cannot reject across
    // its bridge) settles with that sentence — never "no answer" — and
    // names no place: nothing opened anything.
    const relayed = fakeWire(async () => ({ success: false, error: 'Sending from this device is turned off' }));
    const d = callbacks();
    const transport = createDelegatingWsTransport({ wire: relayed, workspaceId: 'ws-1' });
    transport.connect(REQUEST, d);
    await flush();
    expect(d.ends[0]?.message).toBe('Sending from this device is turned off');
    expect(transport.executedOn()).toBeNull();
  });
});
