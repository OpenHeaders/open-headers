/**
 * gRPC stream riders over the real wire — the executor + node
 * transport driven exactly like the workbench does: open a client/bidi
 * stream, sit idle (the user composes), then write upstream through
 * the active-stream registry (`sendGrpcStreamMessage`'s path) and
 * half-close (`endGrpcClientStream`'s). The transport suite covers
 * immediate writes; these pin the DEFERRED sends an interactive
 * session actually performs, against probe-shaped h2c servers.
 */

import { readFileSync } from 'node:fs';
import { createServer as createHttp2Server, type Http2Server, type ServerHttp2Stream } from 'node:http2';
import { buildRegistry, createGrpcFrameReader, decodeMessage, encodeMessage, parseProto, writeGrpcFrame } from '@openheaders/core/proto';
import { executeGrpcStream } from '@openheaders/oracle/live/grpc-exec/execute-stream';
import {
  endActiveGrpcClientStream,
  sendActiveGrpcStreamMessage,
} from '@openheaders/oracle/live/grpc-exec/stream-plane';
import { afterEach, describe, expect, it } from 'vitest';
import { createNodeGrpcTransport } from '../../src/live/node-grpc-transport';

const PROTO_PATH = new URL('./fixtures/book_service.proto', import.meta.url).pathname;
const PKG = 'openheaders.playground.v1';

const registry = buildRegistry([{ path: 'book_service.proto', census: parseProto(readFileSync(PROTO_PATH, 'utf8')) }]);

const servers: Http2Server[] = [];
afterEach(() => {
  for (const s of servers.splice(0)) s.close();
});

/** Probe-shaped bidi echo + client-stream buffer server. */
async function startProbe(): Promise<{ authority: string }> {
  const server = createHttp2Server();
  server.on('stream', (stream: ServerHttp2Stream, headers) => {
    stream.on('error', () => {});
    const path = String(headers[':path'] ?? '');
    if (path.endsWith('/Chat')) {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' }));
      const reader = createGrpcFrameReader();
      stream.on('data', (chunk: Buffer) => {
        for (const frame of reader.push(new Uint8Array(chunk))) {
          const decoded = decodeMessage(registry, `${PKG}.ChatMessage`, frame.data) as { text?: string };
          const echo = encodeMessage(registry, `${PKG}.ChatMessage`, { author: 'probe', text: `echo: ${decoded.text ?? ''}` });
          stream.write(Buffer.from(writeGrpcFrame(echo)));
        }
      });
      stream.on('end', () => {
        if (!stream.destroyed) stream.end();
      });
      return;
    }
    // UploadBooks: buffer to half-close, then summary.
    const parts: Buffer[] = [];
    stream.on('data', (c: Buffer) => parts.push(c));
    stream.on('end', () => {
      const reader = createGrpcFrameReader();
      const frames = reader.push(new Uint8Array(Buffer.concat(parts)));
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' }));
      const summary = encodeMessage(registry, `${PKG}.UploadBooksSummary`, { bookCount: frames.length, names: [] });
      stream.write(Buffer.from(writeGrpcFrame(summary)));
      stream.end();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}` };
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('grpc stream riders — app-shaped deferred sends', () => {
  it('bidi: idle open, then registry send echoes, end settles', async () => {
    const { authority } = await startProbe();
    const events: unknown[] = [];
    const pending = executeGrpcStream({
      transport: createNodeGrpcTransport(),
      authority,
      tls: false,
      path: `/${PKG}.BookService/Chat`,
      metadata: [],
      registry,
      inputType: `${PKG}.ChatMessage`,
      shape: 'bidi-streaming',
      initialMessage: null,
      sendId: 'repro-bidi',
      emitEvent: (e) => events.push(e),
      maxBodyBytes: 2 * 1024 * 1024,
    });
    await wait(400);
    const sent = sendActiveGrpcStreamMessage('repro-bidi', '{"author":"me","text":"hello"}');
    expect(sent).toEqual({ success: true });
    await wait(400);
    const ended = endActiveGrpcClientStream('repro-bidi');
    expect(ended).toBe(true);
    const snapshot = await pending;
    expect(snapshot.error).toBeNull();
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.messages.map((m) => m.direction)).toEqual(['up', 'down']);
  }, 15000);

  it('client-stream: idle open, deferred sends, end settles with summary', async () => {
    const { authority } = await startProbe();
    const pending = executeGrpcStream({
      transport: createNodeGrpcTransport(),
      authority,
      tls: false,
      path: `/${PKG}.BookService/UploadBooks`,
      metadata: [],
      registry,
      inputType: `${PKG}.UploadBookRequest`,
      shape: 'client-streaming',
      initialMessage: null,
      sendId: 'repro-client',
      emitEvent: () => {},
      maxBodyBytes: 2 * 1024 * 1024,
    });
    await wait(400);
    const sent = sendActiveGrpcStreamMessage(
      'repro-client',
      '{"book":{"name":"books/1","title":"t","author":"a","pageCount":"1"}}',
    );
    expect(sent).toEqual({ success: true });
    const ended = endActiveGrpcClientStream('repro-client');
    expect(ended).toBe(true);
    const snapshot = await pending;
    expect(snapshot.error).toBeNull();
    expect(snapshot.grpcStatus).toBe(0);
    expect(snapshot.messages.filter((m) => m.direction === 'down')).toHaveLength(1);
  }, 15000);
});
