/**
 * The delegating gRPC transport over a fake wire: a unary call rides
 * one invoke frame with the context's workspace and a transport-minted
 * send id, the message base64, and comes back as the seam's response
 * (the body decoded, the stamp kept); the place's classified failure
 * throws the seam's error with its canonical status and hint; a dead
 * wire, a missing and a malformed answer throw too; the executor's
 * abort forwards as the place's stop by the send id. A streaming call
 * rides the open frame; the place's head, data, trailers and end feed
 * the seam's callbacks (bytes decoded, `end` exactly once, the claim
 * released); the writer's messages and half-close ride riders; the
 * abort forwards as the place's abort; an open refusal settles through
 * `onEnd`.
 */

import type { DelegatedSocketEvent } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { type DelegatedGrpcWire, encodeDelegatedGrpcResponse } from '../../../src/live/grpc-exec/delegated-wire';
import { createDelegatingGrpcTransport } from '../../../src/live/grpc-exec/delegating-grpc-transport';
import {
  type GrpcStreamCallbacks,
  GrpcTransportError,
  type GrpcTransportRequest,
  type GrpcTransportResponse,
} from '../../../src/live/grpc-exec/transport';

const REQUEST: GrpcTransportRequest = {
  authority: 'grpc.openheaders.io:443',
  tls: true,
  path: '/books.Books/GetBook',
  metadata: [{ key: 'authorization', value: 'Bearer resolved' }],
  message: new Uint8Array([10, 2, 104, 105]),
  maxBodyBytes: 4096,
};

const RESPONSE: GrpcTransportResponse = {
  httpStatus: 200,
  headers: [{ key: 'content-type', value: 'application/grpc+proto' }],
  trailers: [{ key: 'grpc-status', value: '0' }],
  body: new Uint8Array([0, 0, 0, 0, 2, 8, 1]),
  bodyTruncated: false,
};

const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

type SocketEventInput = DelegatedSocketEvent extends infer E
  ? E extends DelegatedSocketEvent
    ? Omit<E, 'socketId' | 'seq'>
    : never
  : never;

interface FakeWire extends DelegatedGrpcWire {
  invokes: Array<Record<string, unknown>>;
  calls: Array<Record<string, unknown>>;
  aborts: string[];
  listeners: Map<string, (event: DelegatedSocketEvent) => void>;
  emit(socketId: string, event: SocketEventInput): void;
}

function fakeWire(
  answerInvoke: (frame: Record<string, unknown>) => Promise<unknown>,
  answerCall: (frame: Record<string, unknown>) => Promise<unknown> = async () => ({
    success: true,
    executedOn: EXECUTED_ON,
  }),
): FakeWire {
  const wire: FakeWire = {
    invokes: [],
    calls: [],
    aborts: [],
    listeners: new Map(),
    invoke: (frame) => {
      wire.invokes.push(frame);
      return answerInvoke(frame);
    },
    abort: (sendId) => {
      wire.aborts.push(sendId);
    },
    call: (frame) => {
      wire.calls.push(frame);
      return answerCall(frame);
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

function callbacks(): GrpcStreamCallbacks & { ends: Array<GrpcTransportError | undefined> } {
  const ends: Array<GrpcTransportError | undefined> = [];
  return {
    ends,
    onHead: vi.fn(),
    onData: vi.fn(),
    onTrailers: vi.fn(),
    onEnd: (error) => {
      ends.push(error);
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('createDelegatingGrpcTransport — a unary call', () => {
  it('rides the invoke frame with the message base64 and answers the seam response, stamped', async () => {
    const wire = fakeWire(async () => ({
      success: true,
      response: encodeDelegatedGrpcResponse(RESPONSE),
      executedOn: EXECUTED_ON,
    }));
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1', mintId: () => 'send-1' });
    const response = await transport.invoke(REQUEST);
    expect(wire.invokes[0]).toEqual({
      type: 'delegateGrpcInvoke',
      sendId: 'send-1',
      workspaceId: 'ws-1',
      request: {
        authority: REQUEST.authority,
        tls: true,
        path: REQUEST.path,
        metadata: REQUEST.metadata,
        messageBase64: 'CgJoaQ==',
        maxBodyBytes: 4096,
      },
    });
    expect(Array.from(response.body)).toEqual([0, 0, 0, 0, 2, 8, 1]);
    expect(response).toMatchObject({ httpStatus: 200, headers: RESPONSE.headers, trailers: RESPONSE.trailers });
    expect(transport.executedOn()).toEqual(EXECUTED_ON);
  });

  it("throws the place's classified failure with its canonical status and hint, stamped", async () => {
    const hint = {
      kind: 'trust-certificate' as const,
      host: 'grpc.openheaders.io',
      port: 443,
      code: 'CERT_HAS_EXPIRED',
    };
    const wire = fakeWire(async () => ({
      success: false,
      error: 'TLS certificate error',
      canonicalStatus: 14,
      hint,
      executedOn: EXECUTED_ON,
    }));
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1' });
    const failure = await transport.invoke(REQUEST).catch((err: unknown) => err);
    expect(failure).toBeInstanceOf(GrpcTransportError);
    expect(failure).toMatchObject({ message: 'TLS certificate error', canonicalStatus: 14, hint });
    expect(transport.executedOn()).toEqual(EXECUTED_ON);
  });

  it('throws a dead wire, a missing answer and a reply that does not decode as the seam error', async () => {
    const dead = createDelegatingGrpcTransport({
      wire: fakeWire(async () => {
        throw new Error('not-connected');
      }),
      workspaceId: 'ws-1',
    });
    await expect(dead.invoke(REQUEST)).rejects.toMatchObject({ name: 'GrpcTransportError', message: 'not-connected' });
    const silent = createDelegatingGrpcTransport({ wire: fakeWire(async () => ({ ok: true })), workspaceId: 'ws-1' });
    await expect(silent.invoke(REQUEST)).rejects.toThrow('The place gave no answer to the call.');
    const garbled = createDelegatingGrpcTransport({
      wire: fakeWire(async () => ({
        success: true,
        response: { ...encodeDelegatedGrpcResponse(RESPONSE), bodyBase64: '!!' },
        executedOn: EXECUTED_ON,
      })),
      workspaceId: 'ws-1',
    });
    await expect(garbled.invoke(REQUEST)).rejects.toThrow('The place answered a reply that does not decode.');
  });

  it("forwards the executor's abort as the place's stop by the send id", async () => {
    let settle: (value: unknown) => void = () => {};
    const wire = fakeWire(() => new Promise((resolve) => (settle = resolve)));
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1', mintId: () => 'send-stop' });
    const controller = new AbortController();
    const pending = transport.invoke(REQUEST, controller.signal);
    controller.abort();
    expect(wire.aborts).toEqual(['send-stop']);
    settle({ success: true, response: encodeDelegatedGrpcResponse(RESPONSE), executedOn: EXECUTED_ON });
    await expect(pending).resolves.toMatchObject({ httpStatus: 200 });
  });
});

describe('createDelegatingGrpcTransport — a streaming call', () => {
  const { message: _message, maxBodyBytes: _cap, ...STREAM } = REQUEST;

  it('rides the open frame and feeds head, data, trailers and end to the seam, releasing the claim', async () => {
    const wire = fakeWire(async () => null);
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1', mintId: () => 'sock-1' });
    const cb = callbacks();
    const writer = transport.openStream?.(STREAM, cb);
    expect(writer).toBeDefined();
    if (writer === undefined) return;
    await flush();
    expect(wire.calls[0]).toEqual({
      type: 'delegateGrpcOpen',
      socketId: 'sock-1',
      workspaceId: 'ws-1',
      request: STREAM,
    });
    expect(transport.executedOn()).toEqual(EXECUTED_ON);
    wire.emit('sock-1', {
      kind: 'head',
      httpStatus: 200,
      headers: [{ key: 'a', value: 'b' }],
      proxyRoute: { plane: 'system' },
    });
    expect(cb.onHead).toHaveBeenCalledWith(200, [{ key: 'a', value: 'b' }], { plane: 'system' });
    wire.emit('sock-1', { kind: 'data', dataBase64: 'AAAAAAIIAQ==' });
    const chunk = (cb.onData as ReturnType<typeof vi.fn>).mock.calls[0][0] as Uint8Array;
    expect(Array.from(chunk)).toEqual([0, 0, 0, 0, 2, 8, 1]);
    wire.emit('sock-1', { kind: 'trailers', trailers: [{ key: 'grpc-status', value: '0' }] });
    expect(cb.onTrailers).toHaveBeenCalledWith([{ key: 'grpc-status', value: '0' }]);
    writer.sendMessage(new Uint8Array([8, 1]));
    writer.halfClose();
    expect(wire.calls.slice(1)).toEqual([
      { type: 'delegateGrpcSend', socketId: 'sock-1', messageBase64: 'CAE=' },
      { type: 'delegateGrpcHalfClose', socketId: 'sock-1' },
    ]);
    wire.emit('sock-1', { kind: 'end' });
    expect(cb.ends).toEqual([undefined]);
    expect(wire.listeners.size).toBe(0);
    // Writes after the end are quiet no-ops.
    writer.sendMessage(new Uint8Array([1]));
    expect(wire.calls).toHaveLength(3);
  });

  it("carries the place's classified end as the seam error with its canonical status", async () => {
    const wire = fakeWire(async () => null);
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1', mintId: () => 'sock-2' });
    const cb = callbacks();
    transport.openStream?.(STREAM, cb);
    await flush();
    wire.emit('sock-2', { kind: 'end', error: { message: 'Deadline exceeded', canonicalStatus: 4 } });
    expect(cb.ends).toHaveLength(1);
    expect(cb.ends[0]).toBeInstanceOf(GrpcTransportError);
    expect(cb.ends[0]).toMatchObject({ message: 'Deadline exceeded', canonicalStatus: 4 });
  });

  it("forwards the executor's abort as the place's abort and settles on the end that follows", async () => {
    const wire = fakeWire(async () => null);
    const transport = createDelegatingGrpcTransport({ wire, workspaceId: 'ws-1', mintId: () => 'sock-3' });
    const controller = new AbortController();
    const cb = callbacks();
    transport.openStream?.(STREAM, cb, controller.signal);
    await flush();
    controller.abort();
    expect(wire.calls.at(-1)).toEqual({ type: 'delegateSocketAbort', socketId: 'sock-3' });
    wire.emit('sock-3', { kind: 'end' });
    expect(cb.ends).toEqual([undefined]);
  });

  it('settles through onEnd on an open refusal, a dead wire and a missing answer', async () => {
    const refused = fakeWire(
      async () => null,
      async () => ({ success: false, error: 'Requests from devices are turned off', executedOn: EXECUTED_ON }),
    );
    const cb1 = callbacks();
    createDelegatingGrpcTransport({ wire: refused, workspaceId: 'ws-1' }).openStream?.(STREAM, cb1);
    await flush();
    expect(cb1.ends[0]).toMatchObject({ message: 'Requests from devices are turned off' });
    const dead = fakeWire(
      async () => null,
      async () => {
        throw new Error('not-connected');
      },
    );
    const cb2 = callbacks();
    createDelegatingGrpcTransport({ wire: dead, workspaceId: 'ws-1' }).openStream?.(STREAM, cb2);
    await flush();
    expect(cb2.ends[0]).toMatchObject({ message: 'not-connected' });
    const silent = fakeWire(
      async () => null,
      async () => undefined,
    );
    const cb3 = callbacks();
    createDelegatingGrpcTransport({ wire: silent, workspaceId: 'ws-1' }).openStream?.(STREAM, cb3);
    await flush();
    expect(cb3.ends[0]).toMatchObject({ message: 'The place gave no answer to the open.' });
  });
});
