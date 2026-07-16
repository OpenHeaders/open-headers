/**
 * Node gRPC transport — real-wire pins against a live `node:http2` h2c
 * server (the same discipline as the HTTP transport's real-wire legs:
 * no mocked sessions, the actual protocol stack). Covers the unary
 * round trip (ceremony headers, framed request, response frames +
 * trailers), the trailers-only reply shape, the `grpc-timeout` carry +
 * local deadline abort, the pre-head Stop abort, the body cap, the
 * mid-body materialization law (post-head severs resolve partial, no
 * throw), and connect-failure classification.
 */

import {
  createServer as createHttp2Server,
  type Http2Server,
  type IncomingHttpHeaders,
  type ServerHttp2Stream,
} from 'node:http2';
import { readGrpcFrames, writeGrpcFrame } from '@openheaders/core/proto';
import { GrpcTransportError } from '@openheaders/oracle/live/grpc-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { createNodeGrpcTransport } from '../../src/live/node-grpc-transport';

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
