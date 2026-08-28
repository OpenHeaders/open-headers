/**
 * gRPC streaming executor — the wire leg behind the three streaming
 * shapes, exercised against a fake stream transport. Pins the per-
 * shape ceremony (server-streaming writes the composed message and
 * half-closes; client/bidi register the upstream handle the RPC
 * riders reach), the capture laws (direction-tagged frames in call
 * order, incremental unframing across chunk boundaries, incomplete-
 * tail honesty, byte-cap truncation aborts), the settle paths (normal
 * trailers, cancel mid-stream keeps what arrived with `stopped`, a
 * pre-head failure maps onto `error`), and the live `grpcStreamEvent`
 * feed (head → batched direction-tagged messages → end).
 */

import type { GrpcStreamEventWire } from '@openheaders/core/bridge';
import { buildRegistry, encodeMessage, parseProto, writeGrpcFrame } from '@openheaders/core/proto';
import { executeGrpcStream, type GrpcStreamExecuteParams } from '@openheaders/oracle/live/grpc-exec/execute-stream';
import {
  endActiveGrpcClientStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import {
  type GrpcStreamCallbacks,
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportStreamRequest,
} from '@openheaders/oracle/live/grpc-exec/transport';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { describe, expect, it } from 'vitest';

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc Chat(stream Note) returns (stream Note);
}

message Note { string text = 1; }
`;

const REGISTRY = buildRegistry([{ path: 'index.proto', census: parseProto(PROTO) }]);
const NOTE = 'library.v1.Note';

const encodedNote = (text: string): Uint8Array => encodeMessage(REGISTRY, NOTE, { text });

function streamTransport() {
  let callbacks: GrpcStreamCallbacks | null = null;
  let signal: AbortSignal | undefined;
  const sentUp: Uint8Array[] = [];
  let halfClosed = false;
  const transport: GrpcTransport = {
    invoke: () => Promise.reject(new Error('unary invoke not expected')),
    openStream(_request, cb, sig) {
      callbacks = cb;
      signal = sig;
      return {
        sendMessage: (message) => sentUp.push(message),
        halfClose: () => {
          halfClosed = true;
        },
      };
    },
  };
  return {
    transport,
    cb: (): GrpcStreamCallbacks => {
      if (!callbacks) throw new Error('openStream not called');
      return callbacks;
    },
    signal: () => signal,
    sentUp,
    wasHalfClosed: () => halfClosed,
  };
}

function params(transport: GrpcTransport, overrides: Partial<GrpcStreamExecuteParams> = {}): GrpcStreamExecuteParams {
  return {
    transport,
    authority: 'grpc.openheaders.io:443',
    tls: true,
    path: '/library.v1.Library/Chat',
    metadata: [],
    registry: REGISTRY,
    inputType: NOTE,
    shape: 'bidi-streaming',
    initialMessage: null,
    maxBodyBytes: 2 * 1024 * 1024,
    ...overrides,
  };
}

const okTrailers = [
  { key: 'grpc-status', value: '0' },
  { key: 'grpc-message', value: 'OK' },
];

describe('executeGrpcStream — dial policy', () => {
  it('hands the workspace trusted roots to the stream transport beside the verify knob', async () => {
    const root = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';
    let seen: GrpcTransportStreamRequest | null = null;
    const transport: GrpcTransport = {
      invoke: () => Promise.reject(new Error('unary invoke not expected')),
      openStream(request, cb) {
        seen = request;
        queueMicrotask(() => {
          cb.onHead(200, [], undefined);
          cb.onTrailers(okTrailers);
          cb.onEnd();
        });
        return { sendMessage: () => {}, halfClose: () => {} };
      },
    };
    await executeGrpcStream(params(transport, { sslVerification: false, trustedRootsPem: [root] }));
    expect(seen).toMatchObject({ sslVerification: false, trustedRootsPem: [root] });
  });
});

describe('executeGrpcStream — server-streaming ceremony', () => {
  it('writes the composed message, half-closes, and captures both directions in order', async () => {
    const fake = streamTransport();
    const initial = encodedNote('hello');
    const pending = executeGrpcStream(params(fake.transport, { shape: 'server-streaming', initialMessage: initial }));
    expect(fake.sentUp).toHaveLength(1);
    expect([...fake.sentUp[0]]).toEqual([...initial]);
    expect(fake.wasHalfClosed()).toBe(true);
    const cb = fake.cb();
    cb.onHead(200, [{ key: 'content-type', value: 'application/grpc+proto' }]);
    cb.onData(writeGrpcFrame(encodedNote('one')));
    cb.onData(writeGrpcFrame(encodedNote('two')));
    cb.onTrailers(okTrailers);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.error).toBeNull();
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.grpcStatusSource).toBe('trailers');
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up', 'down', 'down']);
    // The ↑ request message preceded the head in call order — recorded.
    expect(snapshot.headAtMessage).toBe(1);
    expect(snapshot.stopped).toBeUndefined();
    expect(snapshot.bodyBytes).toBe(writeGrpcFrame(encodedNote('one')).byteLength * 2);
  });

  it("stamps a transport-reported route as the system plane's wire truth", async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { shape: 'server-streaming' }));
    const cb = fake.cb();
    cb.onHead(200, [], { proxyUrl: 'http://corp.openheaders.io:8080', source: 'system' });
    cb.onTrailers(okTrailers);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.proxyRoute).toEqual({
      plane: 'system',
      proxyUrl: 'http://corp.openheaders.io:8080',
      source: 'system',
    });
  });

  it('unframes messages split across chunk boundaries and flags a cut tail', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { shape: 'server-streaming' }));
    const cb = fake.cb();
    cb.onHead(200, []);
    const frame = writeGrpcFrame(encodedNote('split'));
    cb.onData(frame.subarray(0, 3));
    cb.onData(frame.subarray(3));
    cb.onData(writeGrpcFrame(encodedNote('cut')).subarray(0, 4));
    cb.onTrailers(okTrailers);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.incompleteTail).toBe(true);
  });
});

describe('executeGrpcStream — client/bidi upstream riders', () => {
  it('encodes and writes rider messages, half-closes on end, and records the up frames', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { sendId: 'send-bidi' }));
    expect(fake.wasHalfClosed()).toBe(false);
    expect(sendActiveGrpcStreamMessage('send-bidi', '{"text": "ping"}')).toEqual({ success: true });
    expect(fake.sentUp).toHaveLength(1);
    expect([...fake.sentUp[0]]).toEqual([...encodedNote('ping')]);
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onData(writeGrpcFrame(encodedNote('pong')));
    expect(endActiveGrpcClientStream('send-bidi')).toBe(true);
    expect(fake.wasHalfClosed()).toBe(true);
    cb.onTrailers(okTrailers);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up', 'down']);
    // Settled: the riders no longer reach the stream.
    expect(sendActiveGrpcStreamMessage('send-bidi', '{}').success).toBe(false);
  });

  it('reports malformed JSON and an encode mismatch on the rider alone, stream intact', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { sendId: 'send-enc' }));
    expect(sendActiveGrpcStreamMessage('send-enc', '{not json').error).toContain('not valid JSON');
    expect(sendActiveGrpcStreamMessage('send-enc', '{"nope": 1}').error).toContain(NOTE);
    expect(fake.sentUp).toHaveLength(0);
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onTrailers(okTrailers);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.error).toBeNull();
    expect(snapshot.messages).toHaveLength(0);
  });

  it('refuses rider writes after End Streaming', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { sendId: 'send-hc' }));
    expect(endActiveGrpcClientStream('send-hc')).toBe(true);
    const late = sendActiveGrpcStreamMessage('send-hc', '{"text": "late"}');
    expect(late.success).toBe(false);
    expect(late.error).toContain('no longer writable');
    expect(fake.sentUp).toHaveLength(0);
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onTrailers(okTrailers);
    cb.onEnd();
    await pending;
  });
});

describe('executeGrpcStream — settle paths', () => {
  it('cancel mid-stream aborts the transport and keeps what arrived with stopped', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { sendId: 'send-stop' }));
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onData(writeGrpcFrame(encodedNote('partial')));
    expect(stopActiveSend('send-stop')).toBe(true);
    expect(fake.signal()?.aborted).toBe(true);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.error).toBeNull();
    expect(snapshot.stopped).toBe(true);
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.grpcStatus).toBeNull();
  });

  it("carries the transport error's trust hint onto the failed snapshot", async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport));
    const hint = {
      kind: 'trust-certificate' as const,
      host: 'grpc.openheaders.io',
      port: 443,
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    };
    fake
      .cb()
      .onEnd(
        new GrpcTransportError(
          'TLS certificate error reaching grpc.openheaders.io:443 (DEPTH_ZERO_SELF_SIGNED_CERT).',
          14,
          hint,
        ),
      );
    const snapshot = await pending;
    expect(snapshot.error).toContain('DEPTH_ZERO_SELF_SIGNED_CERT');
    expect(snapshot.hint).toEqual(hint);
  });

  it('maps a pre-head failure onto an error snapshot with its client-runtime canonical status', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { metadata: [{ key: 'wat', value: 'wat' }] }));
    fake.cb().onEnd(new GrpcTransportError('Connection refused by grpc.openheaders.io:443.', 14));
    const snapshot = await pending;
    expect(snapshot.error).toBe('Connection refused by grpc.openheaders.io:443.');
    expect(snapshot.httpStatus).toBe(0);
    expect(snapshot.headAtMessage).toBeUndefined();
    // The canonical code rides `localStatus`; the wire status stays
    // its honest null.
    expect(snapshot.localStatus).toBe(14);
    expect(snapshot.grpcStatus).toBeNull();
    // The dispatched metadata is recorded even on a failed dial — the
    // sent row's expandable truth.
    expect(snapshot.requestMetadata).toEqual([{ key: 'wat', value: 'wat' }]);
  });

  it('a failure without a canonical mapping carries no localStatus', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport));
    fake.cb().onEnd(new GrpcTransportError('The target must be host or host:port — got "nope".'));
    const snapshot = await pending;
    expect(snapshot.localStatus).toBeUndefined();
  });

  it('a stop before the head maps onto the stopped error message as the local cancel', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { sendId: 'send-early' }));
    expect(stopActiveSend('send-early')).toBe(true);
    fake.cb().onEnd(new GrpcTransportError('aborted'));
    const snapshot = await pending;
    expect(snapshot.error).toBe('Call stopped before a response arrived.');
    expect(snapshot.localStatus).toBe(1);
  });

  it('aborts past the response byte cap and records the truncated truth', async () => {
    const fake = streamTransport();
    const pending = executeGrpcStream(params(fake.transport, { maxBodyBytes: 16 }));
    const cb = fake.cb();
    cb.onHead(200, []);
    cb.onData(writeGrpcFrame(encodedNote('a note far larger than the cap')));
    expect(fake.signal()?.aborted).toBe(true);
    cb.onEnd();
    const snapshot = await pending;
    expect(snapshot.bodyTruncated).toBe(true);
    expect(snapshot.bodyCapBytes).toBe(16);
    // The over-cap chunk's complete frames still arrived — recorded.
    expect(snapshot.messages).toHaveLength(1);
  });
});

describe('executeGrpcStream — live event feed', () => {
  it('emits sent, head, direction-tagged message batches, and end with monotonic seq', async () => {
    const fake = streamTransport();
    const events: GrpcStreamEventWire[] = [];
    const pending = executeGrpcStream(
      params(fake.transport, { sendId: 'send-live', emitEvent: (e) => events.push(e) }),
    );
    sendActiveGrpcStreamMessage('send-live', '{"text": "up"}');
    const cb = fake.cb();
    cb.onHead(200, [{ key: 'content-type', value: 'application/grpc+proto' }]);
    cb.onData(writeGrpcFrame(encodedNote('down')));
    cb.onTrailers(okTrailers);
    cb.onEnd();
    await pending;
    expect(events.map((e) => e.kind)).toEqual(['sent', 'head', 'messages', 'end']);
    expect(events.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    if (events[1].kind !== 'head') throw new Error('expected head frame');
    // The ↑ rider preceded the head; the position rides the wire event
    // so pooled messages can't distort the interleave order.
    expect(events[1].afterMessages).toBe(1);
    if (events[2].kind !== 'messages') throw new Error('expected messages frame');
    expect(events[2].items.map((m) => m.direction)).toEqual(['up', 'down']);
    expect(events[2].items.every((m) => m.atMs > 0)).toBe(true);
  });
});
