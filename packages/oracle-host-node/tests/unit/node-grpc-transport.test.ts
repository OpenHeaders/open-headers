/**
 * Node gRPC transport — real-wire pins against a live `node:http2` h2c
 * server (the same discipline as the HTTP transport's real-wire legs:
 * no mocked sessions, the actual protocol stack). Covers the unary
 * round trip (ceremony headers, framed request, response frames +
 * trailers), the trailers-only reply shape, the `grpc-timeout` carry +
 * local deadline abort, the pre-head Stop abort, the body cap, the
 * mid-body materialization law (post-head severs resolve partial, no
 * throw), and connect-failure classification. The `openStream` twin
 * pins the bidi round trip (incremental echo, upstream frames,
 * half-close → trailers → onEnd), the pre-head failure/deadline/abort
 * paths through onEnd, and the post-head abort settling clean.
 */

import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  createServer as createHttp2Server,
  createSecureServer as createSecureHttp2Server,
  type Http2Server,
  constants as http2Constants,
  type IncomingHttpHeaders,
  type ServerHttp2Stream,
} from 'node:http2';
import * as net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { readGrpcFrames, writeGrpcFrame } from '@openheaders/core/proto';
import { GrpcTransportError } from '@openheaders/oracle/live/grpc-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { mintLeafCertificate, mintProxyCa } from '../../src/daemon/proxy/ca-store';
import {
  armKeepalive,
  createNodeGrpcTransport,
  type KeepaliveSession,
  sessionOptionsFor,
  tunnelSessionOptionsFor,
} from '../../src/live/node-grpc-transport';

interface SeenCall {
  headers: IncomingHttpHeaders;
  body: Buffer;
}

const servers: Http2Server[] = [];

async function startServer(
  handle: (stream: ServerHttp2Stream, call: SeenCall) => void,
): Promise<{ authority: string; calls: SeenCall[] }> {
  const calls: SeenCall[] = [];
  const server = createHttp2Server();
  server.on('stream', (stream, headers) => {
    const parts: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => parts.push(chunk));
    stream.on('end', () => {
      const call: SeenCall = { headers, body: Buffer.concat(parts) };
      calls.push(call);
      handle(stream, call);
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}`, calls };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

const transport = createNodeGrpcTransport();

const request = (authority: string, overrides: Partial<Parameters<typeof transport.invoke>[0]> = {}) => ({
  authority,
  tls: false,
  path: '/library.v1.Library/GetBook',
  metadata: [],
  message: new Uint8Array([0x0a, 0x07, 0x62, 0x6f, 0x6f, 0x6b, 0x73, 0x2f, 0x31]),
  maxBodyBytes: 64 * 1024,
  ...overrides,
});

describe('createNodeGrpcTransport — real wire', () => {
  it('runs a unary exchange: ceremony headers out, frames and trailers back', async () => {
    const reply = new Uint8Array([0x12, 0x03, 0x61, 0x62, 0x63]);
    const { authority, calls } = await startServer((stream) => {
      stream.respond(
        { ':status': 200, 'content-type': 'application/grpc+proto', 'x-server': 'probe' },
        { waitForTrailers: true },
      );
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' }));
      stream.write(Buffer.from(writeGrpcFrame(reply)));
      stream.end();
    });
    const response = await transport.invoke(
      request(authority, {
        metadata: [
          { key: 'x-api-key', value: 'k-1' },
          { key: 'x-api-key', value: 'k-2' },
        ],
      }),
    );
    expect(response.httpStatus).toBe(200);
    expect(response.headers).toContainEqual({ key: 'x-server', value: 'probe' });
    expect(response.trailers).toContainEqual({ key: 'grpc-status', value: '0' });
    expect(response.bodyTruncated).toBe(false);
    const { frames, incomplete } = readGrpcFrames(response.body);
    expect(incomplete).toBe(false);
    expect(frames).toHaveLength(1);
    expect([...frames[0].data]).toEqual([...reply]);

    const seen = calls[0];
    expect(seen.headers[':method']).toBe('POST');
    expect(seen.headers[':path']).toBe('/library.v1.Library/GetBook');
    expect(seen.headers['content-type']).toBe('application/grpc+proto');
    expect(seen.headers['user-agent']).toBe('OpenHeaders');
    expect(seen.headers.te).toBe('trailers');
    // Node folds repeated request headers into one comma-joined value
    // on the receiving side; both values made the wire.
    expect(seen.headers['x-api-key']).toContain('k-1');
    expect(seen.headers['x-api-key']).toContain('k-2');
    const sent = readGrpcFrames(new Uint8Array(seen.body));
    expect(sent.frames).toHaveLength(1);
    expect(sent.frames[0].flag).toBe(0);
  });

  it('surfaces a trailers-only reply: status in the headers, empty body', async () => {
    const { authority } = await startServer((stream) => {
      stream.respond(
        { ':status': 200, 'content-type': 'application/grpc+proto', 'grpc-status': '5', 'grpc-message': 'nope' },
        { endStream: true },
      );
    });
    const response = await transport.invoke(request(authority));
    expect(response.httpStatus).toBe(200);
    expect(response.headers).toContainEqual({ key: 'grpc-status', value: '5' });
    expect(response.trailers).toHaveLength(0);
    expect(response.body.byteLength).toBe(0);
  });

  it('sends grpc-timeout and aborts locally when the deadline elapses pre-head', async () => {
    const { authority, calls } = await startServer(() => {
      // Never respond — the local deadline must fire.
    });
    await expect(transport.invoke(request(authority, { timeoutMs: 150 }))).rejects.toThrow(
      /deadline of 150 ms elapsed/,
    );
    expect(calls[0]?.headers['grpc-timeout']).toBe('150m');
  });

  it('throws the abort message when the Stop signal fires pre-head', async () => {
    const { authority } = await startServer(() => {
      // Hold the stream open; the caller aborts.
    });
    const controller = new AbortController();
    const pending = transport.invoke(request(authority), controller.signal);
    setTimeout(() => controller.abort(), 50);
    await expect(pending).rejects.toThrow(/aborted before a response/);
  });

  it('materializes the partial body when the abort fires mid-body', async () => {
    const { authority } = await startServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' });
      stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([1, 2, 3]))));
      // Keep the stream open — no trailers, no end.
    });
    const controller = new AbortController();
    const pending = transport.invoke(request(authority), controller.signal);
    setTimeout(() => controller.abort(), 150);
    const response = await pending;
    expect(response.httpStatus).toBe(200);
    const { frames } = readGrpcFrames(response.body);
    expect(frames).toHaveLength(1);
    expect(response.trailers).toHaveLength(0);
  });

  it('caps the body read and marks the truncation', async () => {
    const { authority } = await startServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
      stream.write(Buffer.from(writeGrpcFrame(new Uint8Array(4096).fill(7))));
      stream.end();
    });
    const response = await transport.invoke(request(authority, { maxBodyBytes: 1024 }));
    expect(response.bodyTruncated).toBe(true);
    expect(response.body.byteLength).toBeLessThanOrEqual(1024 + 4096);
    expect(readGrpcFrames(response.body).incomplete).toBe(true);
  });

  it('classifies a refused connection', async () => {
    // Port 1 needs root to bind — nothing ever listens there.
    await expect(transport.invoke(request('127.0.0.1:1'))).rejects.toThrow(GrpcTransportError);
    await expect(transport.invoke(request('127.0.0.1:1'))).rejects.toThrow(/Connection refused/);
  });

  it('rejects a malformed authority before dialing', async () => {
    await expect(transport.invoke(request('not a host'))).rejects.toThrow(/Invalid target/);
    await expect(transport.invoke(request('host:443/extra/path'))).rejects.toThrow(/host or host:port/);
  });
});

/** Incremental server: the handler owns the stream from arrival —
 *  no buffering, the streaming legs' shape. */
async function startStreamingServer(
  handle: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => void,
): Promise<{ authority: string }> {
  const server = createHttp2Server();
  server.on('stream', (stream, headers) => handle(stream, headers));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}` };
}

interface StreamRun {
  heads: Array<{ httpStatus: number; headers: Array<{ key: string; value: string }> }>;
  chunks: Uint8Array[];
  trailers: Array<Array<{ key: string; value: string }>>;
  ended: Promise<GrpcTransportError | undefined>;
}

function openStreamRun(
  authority: string,
  overrides: {
    timeoutMs?: number;
    tls?: boolean;
    sslVerification?: boolean;
    unixSocketPath?: string;
    keepaliveIntervalMs?: number;
    keepaliveTimeoutMs?: number;
  } = {},
  signal?: AbortSignal,
): { run: StreamRun; writer: ReturnType<NonNullable<typeof transport.openStream>> } {
  const openStream = transport.openStream;
  if (!openStream) throw new Error('node transport must implement openStream');
  const heads: StreamRun['heads'] = [];
  const chunks: Uint8Array[] = [];
  const trailers: StreamRun['trailers'] = [];
  let resolveEnd: (error?: GrpcTransportError) => void = () => {};
  const ended = new Promise<GrpcTransportError | undefined>((resolve) => {
    resolveEnd = resolve;
  });
  const writer = openStream(
    { authority, tls: false, path: '/library.v1.Library/Chat', metadata: [], ...overrides },
    {
      onHead: (httpStatus, incoming) => heads.push({ httpStatus, headers: incoming.map((h) => ({ ...h })) }),
      onData: (chunk) => chunks.push(chunk.slice()),
      onTrailers: (incoming) => trailers.push(incoming.map((h) => ({ ...h }))),
      onEnd: (error) => resolveEnd(error),
    },
    signal,
  );
  return { run: { heads, chunks, trailers, ended }, writer };
}

/** Count the PING frames a server's sessions receive. */
function countPings(server: Http2Server): { pings: () => number } {
  let pings = 0;
  server.on('session', (session) => {
    session.on('ping', () => {
      pings += 1;
    });
  });
  return { pings: () => pings };
}

describe('createNodeGrpcTransport — channel protocol', () => {
  it('sends the authority override as :authority while dialing the target', async () => {
    const { authority, calls } = await startServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
      stream.end();
    });
    await transport.invoke(request(authority, { authorityOverride: 'gateway.openheaders.io' }));
    expect(calls[0].headers[':authority']).toBe('gateway.openheaders.io');
  });

  it('the default :authority is the target itself', async () => {
    const { authority, calls } = await startServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
      stream.end();
    });
    await transport.invoke(request(authority));
    expect(calls[0].headers[':authority']).toBe(authority);
  });

  it('pings on the keepalive cadence while the call is open and settles clean', async () => {
    const { authority, calls } = await startServer((stream) => {
      setTimeout(() => {
        stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
        stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
        stream.end();
      }, 220);
    });
    const counter = countPings(servers[servers.length - 1]);
    const response = await transport.invoke(request(authority, { keepaliveIntervalMs: 50, keepaliveTimeoutMs: 500 }));
    expect(calls).toHaveLength(1);
    expect(counter.pings()).toBeGreaterThanOrEqual(2);
    expect(response.connectionError).toBeUndefined();
    expect(response.trailers).toContainEqual({ key: 'grpc-status', value: '0' });
  });

  it('a call without the interval never pings', async () => {
    const { authority } = await startServer((stream) => {
      setTimeout(() => {
        stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
        stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
        stream.end();
      }, 120);
    });
    const counter = countPings(servers[servers.length - 1]);
    await transport.invoke(request(authority));
    expect(counter.pings()).toBe(0);
  });

  it("names the server's GOAWAY too_many_pings after the head, arrived frames standing", async () => {
    const { authority } = await startStreamingServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' });
      stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([7]))));
      stream.session?.once('ping', () => {
        stream.session?.goaway(http2Constants.NGHTTP2_ENHANCE_YOUR_CALM, 0, Buffer.from('too_many_pings'));
      });
    });
    const { run } = openStreamRun(authority, { keepaliveIntervalMs: 40, keepaliveTimeoutMs: 500 });
    const error = await run.ended;
    expect(error?.message).toMatch(/too_many_pings/);
    expect(error?.message).toMatch(/Raise the keepalive ping interval/);
    expect(run.heads).toHaveLength(1);
    expect(run.chunks.length).toBeGreaterThan(0);
  });

  it('a connection dropped after the head resolves with the reason beside the partial body', async () => {
    const { authority } = await startServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' });
      stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([7]))));
      setTimeout(() => stream.session?.destroy(), 50);
    });
    const response = await transport.invoke(request(authority));
    expect(response.httpStatus).toBe(200);
    expect(readGrpcFrames(response.body).frames).toHaveLength(1);
    expect(response.connectionError).toMatch(/mid-call/);
    expect(response.trailers).toEqual([]);
  });
});

describe('armKeepalive — the ping discipline', () => {
  /** A scripted session: pings are recorded, acknowledged by the test. */
  function scriptedSession() {
    const listeners: Partial<Record<'connect' | 'goaway', (...args: never[]) => void>> = {};
    const pings: Array<(err: Error | null, duration: number, payload: Buffer) => void> = [];
    let accept = true;
    const session: KeepaliveSession = {
      ping(callback) {
        if (!accept) return false;
        pings.push(callback);
        return true;
      },
      once(event: 'connect' | 'goaway', listener: (...args: never[]) => void) {
        listeners[event] = listener;
        return session;
      },
    };
    return {
      session,
      pings,
      connect: () => listeners.connect?.(),
      goaway: (code: number, data?: Buffer) => {
        const listener = listeners.goaway as ((code: number, last: number, data?: Buffer) => void) | undefined;
        listener?.(code, 0, data);
      },
      refusePings: () => {
        accept = false;
      },
    };
  }

  it('does nothing without an interval', () => {
    const rig = scriptedSession();
    const reasons: string[] = [];
    armKeepalive(rig.session, 'grpc.openheaders.io:443', {}, (reason) => reasons.push(reason));
    rig.connect();
    expect(rig.pings).toHaveLength(0);
    expect(reasons).toEqual([]);
  });

  it('pings after the interval once connected, re-arms on the acknowledgement, and dies on a missed one', async () => {
    const rig = scriptedSession();
    const reasons: string[] = [];
    armKeepalive(
      rig.session,
      'grpc.openheaders.io:443',
      { keepaliveIntervalMs: 20, keepaliveTimeoutMs: 40 },
      (reason) => reasons.push(reason),
    );
    expect(rig.pings).toHaveLength(0);
    rig.connect();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rig.pings).toHaveLength(1);
    rig.pings[0](null, 1, Buffer.alloc(8));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rig.pings).toHaveLength(2);
    // Second ping never acknowledged — the timeout names the death once.
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(reasons).toEqual([
      'No keepalive response from grpc.openheaders.io:443 within 40 ms — the connection is dead.',
    ]);
    rig.pings[1](null, 1, Buffer.alloc(8));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rig.pings).toHaveLength(2);
    expect(reasons).toHaveLength(1);
  });

  it('a refused ping and a ping error both name the death; the disarm silences everything', async () => {
    const refused = scriptedSession();
    const refusedReasons: string[] = [];
    armKeepalive(refused.session, 'a.openheaders.io', { keepaliveIntervalMs: 10 }, (r) => refusedReasons.push(r));
    refused.refusePings();
    refused.connect();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(refusedReasons).toEqual([
      'Keepalive ping to a.openheaders.io could not be sent — the connection is closed.',
    ]);

    const errored = scriptedSession();
    const erroredReasons: string[] = [];
    armKeepalive(errored.session, 'b.openheaders.io', { keepaliveIntervalMs: 10 }, (r) => erroredReasons.push(r));
    errored.connect();
    await new Promise((resolve) => setTimeout(resolve, 25));
    errored.pings[0](new Error('session closed'), 0, Buffer.alloc(8));
    expect(erroredReasons).toEqual(['Keepalive ping to b.openheaders.io failed: session closed']);

    const disarmed = scriptedSession();
    const disarmedReasons: string[] = [];
    const disarm = armKeepalive(disarmed.session, 'c.openheaders.io', { keepaliveIntervalMs: 10 }, (r) =>
      disarmedReasons.push(r),
    );
    disarmed.connect();
    disarm();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(disarmed.pings).toHaveLength(0);
    expect(disarmedReasons).toEqual([]);
  });

  it('a GOAWAY too_many_pings names the server floor; other GOAWAYs are not its business', () => {
    const rig = scriptedSession();
    const reasons: string[] = [];
    armKeepalive(rig.session, 'grpc.openheaders.io:443', { keepaliveIntervalMs: 60_000 }, (r) => reasons.push(r));
    rig.goaway(http2Constants.NGHTTP2_NO_ERROR, Buffer.from('bye'));
    expect(reasons).toEqual([]);
    rig.goaway(http2Constants.NGHTTP2_ENHANCE_YOUR_CALM, Buffer.from('too_many_pings'));
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatch(/GOAWAY too_many_pings/);
  });
});

describe('createNodeGrpcTransport — openStream real wire', () => {
  it('runs a bidi echo: upstream frames out as written, echoes back incrementally', async () => {
    const { authority } = await startStreamingServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' }));
      stream.on('data', (chunk: Buffer) => stream.write(chunk));
      stream.on('end', () => stream.end());
    });
    const { run, writer } = openStreamRun(authority);
    writer.sendMessage(new Uint8Array([1, 2, 3]));
    writer.sendMessage(new Uint8Array([9]));
    writer.halfClose();
    const error = await run.ended;
    expect(error).toBeUndefined();
    expect(run.heads).toHaveLength(1);
    expect(run.heads[0].httpStatus).toBe(200);
    expect(run.heads[0].headers).toContainEqual({ key: 'content-type', value: 'application/grpc+proto' });
    const echoed = readGrpcFrames(new Uint8Array(Buffer.concat(run.chunks.map((c) => Buffer.from(c)))));
    expect(echoed.incomplete).toBe(false);
    expect(echoed.frames.map((f) => [...f.data])).toEqual([[1, 2, 3], [9]]);
    expect(run.trailers).toEqual([
      [
        { key: 'grpc-status', value: '0' },
        { key: 'grpc-message', value: 'OK' },
      ],
    ]);
  });

  it('classifies a refused connection through onEnd', async () => {
    const { run } = openStreamRun('127.0.0.1:1');
    const error = await run.ended;
    expect(error).toBeInstanceOf(GrpcTransportError);
    expect(error?.message).toMatch(/Connection refused/);
  });

  it('reports a malformed authority through onEnd with a no-op writer', async () => {
    const { run, writer } = openStreamRun('host:443/extra/path');
    writer.sendMessage(new Uint8Array([1]));
    writer.halfClose();
    const error = await run.ended;
    expect(error?.message).toMatch(/host or host:port/);
  });

  it('names the deadline when it elapses before a response head', async () => {
    const { authority } = await startStreamingServer(() => {
      // Never respond — the local deadline must fire.
    });
    const { run } = openStreamRun(authority, { timeoutMs: 150 });
    const error = await run.ended;
    expect(error?.message).toMatch(/deadline of 150 ms elapsed/);
  });

  it('settles clean on a post-head abort — arrived frames stand', async () => {
    const { authority } = await startStreamingServer((stream) => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' });
      stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([7]))));
      // Hold the stream open; the caller aborts.
    });
    const controller = new AbortController();
    const { run } = openStreamRun(authority, {}, controller.signal);
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
    controller.abort();
    const error = await run.ended;
    expect(error).toBeUndefined();
    expect(run.heads).toHaveLength(1);
    expect(run.chunks.length).toBeGreaterThan(0);
  });

  it('throws the abort message through onEnd when the Stop fires pre-head', async () => {
    const { authority } = await startStreamingServer(() => {
      // Hold the stream open; the caller aborts.
    });
    const controller = new AbortController();
    const { run } = openStreamRun(authority, {}, controller.signal);
    setTimeout(() => controller.abort(), 50);
    const error = await run.ended;
    expect(error?.message).toMatch(/aborted before a response/);
  });
});

// ── TLS verification knob ───────────────────────────────────────────
//
// Self-signed fixture pair (CN/SAN 127.0.0.1, 100-year expiry) — test
// data only, minted for this file; never trusted anywhere else.

const SELF_SIGNED_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDDDQqwCVx00Yf
xgcPjYjk3bf6LUo/0wcCO6LEOwHXg93l5BBfhi1mOCaECumswwlgv7cRgIgYGoKQ
sQE+FmovHu+8f4hbv5mXTVNkk9aoSCtX9r1/EbXkzFbSTQBbykVNWiA5+dKjCher
XU47BCv3dRZF6GIFQxLS1n3uif8LMYoCJjfATyVOd/ECkQpZsaZwqdCFHYkIkqVt
jGlI8urskMTGX/RPyWnQWkgropJig1z776kuYuGgetomtko1TDg8jOqTDPSc181f
9o5XD4zTeTeQgeN87CthPd6NTUlXhoGXuzjEg164aSzHGyzXqr5hqGyNC7sd+rsD
uGHckt5NAgMBAAECggEAArkh5VLncu5jNUBbiuEL/z4FOo31UmzM1UAl5p14Sh0C
NRp5DAxgh+PSzdclKg9TCzHCCZGE1OlR11lRTh+b/eptqHETY0yKhW1D88yIm7Le
QA0m2iZSJs6fi7IdhiqNyyWt+4E8aqBSckcMN5C4WG0fEXzMGYy1L5JlEbaFhA93
urBd0p1y5rQUgR8rdSWTEUJ+dvb5XqQ+IMvFMLfgKMH7/lD/Hp1XAmj0AZSfvOSO
+qP5gjU5uLk8TD0OxcwNH0TuKSoYgRJyJ8LNKEgEKjBUbcaarul21L5aMEZITDC9
z3/YDKPqVq0KqGQc6R8bftUAw49MzMFSKFokJWQWdQKBgQD4HY4bO3aqF7fxoWuf
kTmjnh2vqfwTjdeRsjefMN94HQLozngPjlBpmqP2CdCWYB+oYJ/ZwWzO98SupJXJ
1vtBY99mkt74mkUFY2Yp3/zcHU+NfSkwgU4Y8liP5NTdz0tx+EpDbZcf3yh93/1D
pIUrAv+wRLKIw0gbrZxVU1FDBwKBgQDJPu/R0oyEH9AqsGpcbPiminyJpUo2otkU
AC+VFCP9Z7cOhlE/yyLu7vAegMUGfxbNK/jBqk7Ih/06e99PKuLAwkfVq50mfWlP
V8juX811ns1xh7nvRXBCf1n+vricFPMoLRt4s4pT8lOdb28+MBBrYMIHYujnW4DY
gNUf+NLbCwKBgEaxnRjTQ4dJRMbbGGAZr9OXrJutkj48DuzbW4/HDBUcJwUQNxMv
mGfOgOMMftspvjtqdIFF5GvAGtEr4eXllCdYfoGqXU92HS5g2O4bfN92loEY5VCF
tyvSeTteluwwMS3i8b3ujr2tBst+s5m/WZYcv5+Io1nmUjhYqg+BssinAoGAOJpE
F67xqMPN6APglohr02PGLWzZF87r4Y0/1N1qVf7S5PnwZlH7TFrWHK45PF+IiUKh
387IA+0D02w93eWBC5hZXga717SUZyWYtTsq7bcxr4nuSRctwPZS2KzJ/dSCo700
KdnNwVi6HeDW2BXquFjpmew+97ur3Lk3uJtiqwsCgYEAr1N/tBbH2hA2tSx/U/0g
raCxlPhvse9Cj4TgIcO75Qz99B2bEsvFd6ZShRxzh26Tj5U+w3MAdmLbe0fWpXDE
BKD92prib0vgFPyZ4QdugfbPzs25bg4gSTQxviUkqlOJ51ygtCsmjblMpfOgqBp/
/uy3x6xVazoDcMYMJb4JUPY=
-----END PRIVATE KEY-----`;

const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIIDJzCCAg+gAwIBAgIUYeq6SMGrvTGMEnrUHEMIdoHLo6QwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMCAXDTI2MDcxNzA4MTQyM1oYDzIxMjYw
NjIzMDgxNDIzWjAUMRIwEAYDVQQDDAkxMjcuMC4wLjEwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDDDDQqwCVx00YfxgcPjYjk3bf6LUo/0wcCO6LEOwHX
g93l5BBfhi1mOCaECumswwlgv7cRgIgYGoKQsQE+FmovHu+8f4hbv5mXTVNkk9ao
SCtX9r1/EbXkzFbSTQBbykVNWiA5+dKjCherXU47BCv3dRZF6GIFQxLS1n3uif8L
MYoCJjfATyVOd/ECkQpZsaZwqdCFHYkIkqVtjGlI8urskMTGX/RPyWnQWkgropJi
g1z776kuYuGgetomtko1TDg8jOqTDPSc181f9o5XD4zTeTeQgeN87CthPd6NTUlX
hoGXuzjEg164aSzHGyzXqr5hqGyNC7sd+rsDuGHckt5NAgMBAAGjbzBtMB0GA1Ud
DgQWBBShiaGXNlBoiofmZPdCFkXNxVM1rjAfBgNVHSMEGDAWgBShiaGXNlBoiofm
ZPdCFkXNxVM1rjAPBgNVHRMBAf8EBTADAQH/MBoGA1UdEQQTMBGHBH8AAAGCCWxv
Y2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAQEAX31x2DeQGgRUMSLfiWwQ/pd5nOTr
gvWeCUCMdjeSAD+2Jb4kbLa5f1FQQRPtlP7UPL/YvRPhd7E77I4vNshvelbSIlsj
YlG8QnNgf5/voGRvPjM3zAsw2RXioJ1m93OTSQO41mNhbOsCW064P5zx+NfVCpOl
AObp885gq0Q9lpQMUH+KhLle7No2KRznvpS97FCaMo6jI8460AuTCvAsDQ9M4NsM
NUQJ3Oxn7CJkys1GEUb7wHVnkYTG0P1ftJw0c51vRYQDfT7nHe1CetbrJoh1acP5
KfxyzWrzAL8PG19NaZob/0EuYlX0UvfHNDflMMDwVEJDmafFC9vqkk6OYQ==
-----END CERTIFICATE-----`;

function keyPem(pkcs8B64: string): string {
  const body = pkcs8B64.match(/.{1,64}/g)?.join('\n') ?? pkcs8B64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

/** A server whose leaf chains to a freshly minted private CA — the
 *  workspace-trusted-roots rig: nothing in the runtime bundle vouches
 *  for it, so only the appended root can make the dial verify. */
async function startPrivateCaServer(): Promise<{ authority: string; rootPem: string }> {
  const ca = await mintProxyCa();
  const leaf = await mintLeafCertificate(ca, ['127.0.0.1']);
  const server = createSecureHttp2Server({ key: keyPem(leaf.privateKeyPkcs8B64), cert: leaf.certPem });
  server.on('stream', (stream) => {
    stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
    stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
    stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([0x08, 0x01]))));
    stream.end();
  });
  servers.push(server as unknown as Http2Server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}`, rootPem: ca.certPem };
}

async function startTlsServer(): Promise<{ authority: string }> {
  const server = createSecureHttp2Server({ key: SELF_SIGNED_KEY, cert: SELF_SIGNED_CERT });
  server.on('stream', (stream) => {
    stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
    stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
    stream.write(Buffer.from(writeGrpcFrame(new Uint8Array([0x08, 0x01]))));
    stream.end();
  });
  servers.push(server as unknown as Http2Server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}` };
}

describe('createNodeGrpcTransport — workspace trusted roots', () => {
  it('a private-CA server verifies once its root rides the request; the bare dial still refuses it', async () => {
    const { authority, rootPem } = await startPrivateCaServer();
    await expect(transport.invoke(request(authority, { tls: true }))).rejects.toThrow(
      /TLS certificate error|TLS handshake/,
    );
    const response = await transport.invoke(request(authority, { tls: true, trustedRootsPem: [rootPem] }));
    expect(response.httpStatus).toBe(200);
    expect(readGrpcFrames(response.body).frames).toHaveLength(1);
  });
});

describe('createNodeGrpcTransport — TLS verification knob', () => {
  it('rejects a self-signed server under the default verify posture, naming the cert failure', async () => {
    const { authority } = await startTlsServer();
    await expect(transport.invoke(request(authority, { tls: true }))).rejects.toThrow(
      /TLS certificate error|TLS handshake/,
    );
  });

  it('completes the round trip with sslVerification: false — the self-signed dev-server knob', async () => {
    const { authority } = await startTlsServer();
    const response = await transport.invoke(request(authority, { tls: true, sslVerification: false }));
    expect(response.httpStatus).toBe(200);
    const { frames } = readGrpcFrames(response.body);
    expect(frames).toHaveLength(1);
  });

  it('opens a verified-off TLS stream through the openStream twin', async () => {
    const { authority } = await startTlsServer();
    const { run, writer } = openStreamRun(authority, { tls: true, sslVerification: false });
    writer.halfClose();
    const error = await run.ended;
    expect(error).toBeUndefined();
    expect(run.heads).toHaveLength(1);
  });
});

const posixOnly = it.runIf(process.platform !== 'win32');

const socketDirs: string[] = [];

/** Short socket path under the OS tmpdir — the OS caps sun_path at
 *  ~104 bytes on macOS, so the rig never rides a long test-run dir. */
function mintSocketPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'oh-grpc-'));
  socketDirs.push(dir);
  return join(dir, 'g.sock');
}

afterEach(() => {
  for (const dir of socketDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** The unary echo rig listening on a Unix socket instead of a port. */
async function startSocketServer(socketPath: string): Promise<{ calls: SeenCall[] }> {
  const calls: SeenCall[] = [];
  const server = createHttp2Server();
  server.on('stream', (stream, headers) => {
    const parts: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => parts.push(chunk));
    stream.on('end', () => {
      calls.push({ headers, body: Buffer.concat(parts) });
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
      stream.end(Buffer.from(writeGrpcFrame(new Uint8Array([0x12, 0x02, 0x6f, 0x6b]))));
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(socketPath, () => resolve()));
  return { calls };
}

describe('createNodeGrpcTransport — Unix socket target', () => {
  posixOnly('runs the unary exchange over the socket with the authority cosmetic', async () => {
    const socketPath = mintSocketPath();
    const { calls } = await startSocketServer(socketPath);
    const response = await transport.invoke(request('grpc.openheaders.io:50051', { unixSocketPath: socketPath }));
    expect(response.httpStatus).toBe(200);
    const { frames } = readGrpcFrames(response.body);
    expect(frames).toHaveLength(1);
    // The authority never decided the dial — but it IS the :authority
    // the server saw (the cosmetic-host contract).
    expect(calls[0]?.headers[':authority']).toBe('grpc.openheaders.io:50051');
  });

  posixOnly('opens a streaming call over the socket through the openStream twin', async () => {
    const socketPath = mintSocketPath();
    await startSocketServer(socketPath);
    const { run, writer } = openStreamRun('grpc.openheaders.io:50051', { unixSocketPath: socketPath });
    writer.halfClose();
    const error = await run.ended;
    expect(error).toBeUndefined();
    expect(run.heads).toHaveLength(1);
  });

  posixOnly('classifies a missing socket file naming the setting and the path', async () => {
    const socketPath = join(tmpdir(), 'oh-grpc-missing.sock');
    const attempt = transport.invoke(request('grpc.openheaders.io:50051', { unixSocketPath: socketPath }));
    await expect(attempt).rejects.toThrow(GrpcTransportError);
    await expect(attempt).rejects.toThrow(/No socket at .*oh-grpc-missing\.sock — the request's Unix-socket setting/);
  });

  it('a socket-pinned tuple owns its dial; a TCP tuple hands the dial to the session', () => {
    // Options-level (the dispatcher.test.ts idiom) — the named-pipe
    // spelling rides the same seat, so the Windows shape is covered
    // without a live pipe rig.
    const target = new URL('https://grpc.openheaders.io:50051');
    expect(sessionOptionsFor({ tls: true, unixSocketPath: '/var/run/openheaders/grpc.sock' }, target)).toHaveProperty(
      'createConnection',
    );
    expect(sessionOptionsFor({ tls: false, unixSocketPath: '\\\\.\\pipe\\openheaders-grpc' }, target)).toHaveProperty(
      'createConnection',
    );
    expect(sessionOptionsFor({ tls: true }, target)).toBeUndefined();
    expect(sessionOptionsFor({ tls: true, sslVerification: false }, target)).toEqual({ rejectUnauthorized: false });
  });

  it('the TLS policy rides the TCP session: client certificate, version window, ciphers, SNI override', () => {
    const target = new URL('https://grpc.openheaders.io:50051');
    expect(
      sessionOptionsFor(
        {
          tls: true,
          clientCertificatePem: 'CERT',
          clientCertificateKeyPem: 'KEY',
          tlsMinVersion: '1.2',
          tlsCipherSuites: 'AES128-SHA',
          sniServerName: 'edge.openheaders.io',
        },
        target,
      ),
    ).toEqual({
      cert: 'CERT',
      key: 'KEY',
      minVersion: 'TLSv1.2',
      ciphers: 'AES128-SHA',
      servername: 'edge.openheaders.io',
    });
    expect(sessionOptionsFor({ tls: false, sniServerName: 'edge.openheaders.io' }, target)).toBeUndefined();
  });

  it('workspace trusted roots ride the TCP session behind the runtime bundle; cleartext and empty set nothing', () => {
    const target = new URL('https://grpc.openheaders.io:50051');
    const root = '-----BEGIN CERTIFICATE-----\nROOT\n-----END CERTIFICATE-----\n';
    expect(sessionOptionsFor({ tls: true, trustedRootsPem: [root] }, target)).toEqual({
      ca: [...rootCertificates, root],
    });
    expect(sessionOptionsFor({ tls: true, sslVerification: false, trustedRootsPem: [root] }, target)).toEqual({
      rejectUnauthorized: false,
      ca: [...rootCertificates, root],
    });
    expect(sessionOptionsFor({ tls: true, trustedRootsPem: [] }, target)).toBeUndefined();
    expect(sessionOptionsFor({ tls: false, trustedRootsPem: [root] }, target)).toBeUndefined();
    // The socket-pinned and tunnel shapes own their dial — the bag
    // is applied inside `createConnection`, so they still expose it.
    expect(
      sessionOptionsFor({ tls: true, trustedRootsPem: [root], unixSocketPath: '/tmp/g.sock' }, target),
    ).toHaveProperty('createConnection');
    expect(tunnelSessionOptionsFor({ tls: true, trustedRootsPem: [root] }, target, new net.Socket())).toHaveProperty(
      'createConnection',
    );
  });
});
