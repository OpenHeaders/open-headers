/**
 * Ambient WS/gRPC proxy coverage over REAL wire (P6) — the session
 * twins of the HTTP system-plane rig legs: live CONNECT and
 * SOCKS5 proxies from the shared rig, real `ws` / `node:http2`
 * servers behind them, resolvers injected through each transport's
 * `systemProxy` seat (the test-hermeticity law: REAL resolvers,
 * injected). Pins the tunnel actually carrying the session (the rig
 * records CONNECT targets / SOCKS negotiations), the credential leg,
 * the 407 honesty, chain fall-through past a dead proxy, the SOCKS5
 * agent seat on WS, the socket-pin stand-down, and the wire-truth
 * route reported through `onOpen` / the unary response / `onHead`.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createServer as createHttp2Server, type Http2Server, type ServerHttp2Stream } from 'node:http2';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readGrpcFrames, writeGrpcFrame } from '@openheaders/core/proto';
import type { GrpcProxyRoute } from '@openheaders/oracle/live/grpc-exec/transport';
import type { WsProxyRoute, WsTransportError } from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { createNodeGrpcTransport } from '../../src/live/node-grpc-transport';
import { createNodeWsTransport } from '../../src/live/node-ws-transport';
import type { SystemProxyEntry, SystemProxyResolver } from '../../src/live/system-proxy/types';
import { closedPort, startConnectProxy, startSocks5Proxy } from './request-transport/connect-proxy-rig';

const resolverOf = (entries: SystemProxyEntry[], source: 'env' | 'system' = 'env'): SystemProxyResolver => ({
  resolve: () => Promise.resolve({ entries, source }),
});

const servers: Array<Server | Http2Server> = [];
const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((close) => close()));
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          (server as Server).closeAllConnections?.();
        }),
    ),
  );
});

async function startWsEcho(socketPath?: string): Promise<{ url: string; port: number }> {
  const httpServer = createServer((_req, res) => {
    res.statusCode = 426;
    res.end();
  });
  servers.push(httpServer);
  const wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', (ws) => {
    ws.on('message', (data) => ws.send(`echo:${data.toString('utf8')}`));
  });
  if (socketPath !== undefined) {
    await new Promise<void>((resolve) => httpServer.listen(socketPath, resolve));
    return { url: 'ws://ws.openheaders.io/session', port: 0 };
  }
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return { url: `ws://127.0.0.1:${address.port}/session`, port: address.port };
}

interface WsRun {
  opened: boolean;
  route?: WsProxyRoute;
  echoes: string[];
  error?: WsTransportError;
}

/** One session over an injected resolver: send `hello` on open, close
 *  after the first echo, resolve on end with everything observed. */
function runWsSession(
  url: string,
  resolver: SystemProxyResolver | null,
  options: { unixSocketPath?: string; timeoutMs?: number } = {},
): Promise<WsRun> {
  const transport = createNodeWsTransport({ systemProxy: resolver });
  return new Promise<WsRun>((resolve) => {
    const seen: WsRun = { opened: false, echoes: [] };
    const writer = transport.connect(
      {
        url,
        headers: [],
        subprotocols: [],
        ...(options.unixSocketPath !== undefined ? { unixSocketPath: options.unixSocketPath } : {}),
        timeoutMs: options.timeoutMs ?? 5000,
      },
      {
        onOpen: (_protocol, _extensions, route) => {
          seen.opened = true;
          if (route !== undefined) seen.route = route;
          writer.send('hello');
        },
        onMessage: ({ data }) => {
          seen.echoes.push(new TextDecoder().decode(data));
          writer.close(1000, 'done');
        },
        onClose: () => {},
        onEnd: (error) => {
          if (error !== undefined) seen.error = error;
          resolve(seen);
        },
      },
    );
  });
}

async function startGrpcEcho(): Promise<{ authority: string; port: number }> {
  const server = createHttp2Server();
  server.on('stream', (stream: ServerHttp2Stream) => {
    const parts: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => parts.push(chunk));
    stream.on('end', () => {
      stream.respond({ ':status': 200, 'content-type': 'application/grpc+proto' }, { waitForTrailers: true });
      stream.on('wantTrailers', () => stream.sendTrailers({ 'grpc-status': '0' }));
      const { frames } = readGrpcFrames(new Uint8Array(Buffer.concat(parts)));
      for (const frame of frames) stream.write(Buffer.from(writeGrpcFrame(frame.data)));
      stream.end();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  return { authority: `127.0.0.1:${address.port}`, port: address.port };
}

const grpcRequest = (authority: string) => ({
  authority,
  tls: false,
  path: '/library.v1.Library/GetBook',
  metadata: [],
  message: new Uint8Array([0x0a, 0x03, 0x61, 0x62, 0x63]),
  maxBodyBytes: 64 * 1024,
  timeoutMs: 5000,
});

describe('ambient WS coverage — live rigs', () => {
  it('tunnels a ws:// session through the CONNECT proxy and reports the route', async () => {
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const { url, port } = await startWsEcho();
    const run = await runWsSession(url, resolverOf([{ kind: 'proxy', url: proxy.url }], 'system'));
    expect(run.error).toBeUndefined();
    expect(run.opened).toBe(true);
    expect(run.echoes).toEqual(['echo:hello']);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(run.route).toEqual({ proxyUrl: proxy.url, source: 'system' });
  });

  it('sends the environment credential as Proxy-Authorization on the tunnel', async () => {
    const proxy = await startConnectProxy({ requireAuth: 'corp:secret' });
    cleanups.push(proxy.close);
    const { url } = await startWsEcho();
    const run = await runWsSession(url, resolverOf([{ kind: 'proxy', url: proxy.url, credential: 'corp:secret' }]));
    expect(run.error).toBeUndefined();
    expect(run.echoes).toEqual(['echo:hello']);
    expect(proxy.authHeaders[0]).toBe(`Basic ${Buffer.from('corp:secret').toString('base64')}`);
  });

  it('classifies an unauthenticated 407 against the proxy, not the target', async () => {
    const proxy = await startConnectProxy({ requireAuth: 'corp:secret' });
    cleanups.push(proxy.close);
    const { url } = await startWsEcho();
    const run = await runWsSession(url, resolverOf([{ kind: 'proxy', url: proxy.url }]));
    expect(run.opened).toBe(false);
    expect(run.error?.message).toContain('407');
    expect(run.error?.message).toContain(new URL(proxy.url).host);
  });

  it('falls through a dead chain entry to the live proxy behind it', async () => {
    const dead = `http://127.0.0.1:${await closedPort()}`;
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const { url, port } = await startWsEcho();
    const run = await runWsSession(
      url,
      resolverOf([
        { kind: 'proxy', url: dead },
        { kind: 'proxy', url: proxy.url },
      ]),
    );
    expect(run.error).toBeUndefined();
    expect(run.echoes).toEqual(['echo:hello']);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(run.route).toEqual({ proxyUrl: proxy.url, source: 'env' });
  });

  it('rides a SOCKS5 answer on the agent seat (RFC 1928 over real wire)', async () => {
    const socks = await startSocks5Proxy({ requireAuth: 'user:pass' });
    cleanups.push(socks.close);
    const { url, port } = await startWsEcho();
    const run = await runWsSession(url, resolverOf([{ kind: 'proxy', url: socks.url, credential: 'user:pass' }]));
    expect(run.error).toBeUndefined();
    expect(run.echoes).toEqual(['echo:hello']);
    expect(socks.targets).toEqual([`127.0.0.1:${port}`]);
    expect(socks.auths).toEqual(['user:pass']);
    expect(run.route).toEqual({ proxyUrl: socks.url, source: 'env' });
  });

  it('stands down for a socket-pinned session, recorded — the proxy never sees a tunnel', async () => {
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const dir = mkdtempSync(join(tmpdir(), 'oh-ws-plane-'));
    const socketPath = join(dir, 'ws.sock');
    const { url } = await startWsEcho(socketPath);
    const run = await runWsSession(url, resolverOf([{ kind: 'proxy', url: proxy.url }], 'system'), {
      unixSocketPath: socketPath,
    });
    rmSync(dir, { recursive: true, force: true });
    expect(run.error).toBeUndefined();
    expect(run.echoes).toEqual(['echo:hello']);
    expect(proxy.tunnels).toEqual([]);
    expect(run.route).toEqual({ source: 'system', standDownReason: 'unix-socket' });
  });
});

describe('ambient gRPC coverage — live rigs', () => {
  it('tunnels a unary h2c call through the CONNECT proxy and stamps the route', async () => {
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const { authority, port } = await startGrpcEcho();
    const transport = createNodeGrpcTransport({ systemProxy: resolverOf([{ kind: 'proxy', url: proxy.url }]) });
    const response = await transport.invoke(grpcRequest(authority));
    expect(response.httpStatus).toBe(200);
    const { frames } = readGrpcFrames(response.body);
    expect(frames).toHaveLength(1);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(response.proxyRoute).toEqual({ proxyUrl: proxy.url, source: 'env' });
  });

  it('classifies an unauthenticated 407 against the proxy', async () => {
    const proxy = await startConnectProxy({ requireAuth: 'corp:secret' });
    cleanups.push(proxy.close);
    const { authority } = await startGrpcEcho();
    const transport = createNodeGrpcTransport({ systemProxy: resolverOf([{ kind: 'proxy', url: proxy.url }]) });
    await expect(transport.invoke(grpcRequest(authority))).rejects.toThrow(/407/);
  });

  it('skips a SOCKS5 chain entry (CONNECT-only dial) and rides the HTTP fallback', async () => {
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const { authority, port } = await startGrpcEcho();
    const transport = createNodeGrpcTransport({
      systemProxy: resolverOf([
        { kind: 'proxy', url: 'socks5://socks.openheaders.io:1080' },
        { kind: 'proxy', url: proxy.url },
      ]),
    });
    const response = await transport.invoke(grpcRequest(authority));
    expect(response.httpStatus).toBe(200);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(response.proxyRoute).toEqual({ proxyUrl: proxy.url, source: 'env' });
  });

  it('fails a SOCKS5-only chain honestly before the wire', async () => {
    const { authority } = await startGrpcEcho();
    const transport = createNodeGrpcTransport({
      systemProxy: resolverOf([{ kind: 'proxy', url: 'socks5://socks.openheaders.io:1080' }]),
    });
    await expect(transport.invoke(grpcRequest(authority))).rejects.toThrow(/HTTP CONNECT only/);
  });

  it('runs a streaming call through the proxy — queued upstream writes flush, onHead carries the route', async () => {
    const proxy = await startConnectProxy();
    cleanups.push(proxy.close);
    const { authority, port } = await startGrpcEcho();
    const transport = createNodeGrpcTransport({
      systemProxy: resolverOf([{ kind: 'proxy', url: proxy.url }], 'system'),
    });
    const openStream = transport.openStream;
    if (openStream === undefined) throw new Error('openStream missing');
    const outcome = await new Promise<{ route?: GrpcProxyRoute; chunks: number; error?: Error }>((resolve) => {
      const seen: { route?: GrpcProxyRoute; chunks: number; error?: Error } = { chunks: 0 };
      const writer = openStream.call(
        transport,
        { authority, tls: false, path: '/library.v1.Library/Watch', metadata: [], timeoutMs: 5000 },
        {
          onHead: (_status, _headers, route) => {
            if (route !== undefined) seen.route = route;
          },
          onData: () => {
            seen.chunks += 1;
          },
          onTrailers: () => {},
          onEnd: (error) => {
            if (error !== undefined) seen.error = error;
            resolve(seen);
          },
        },
      );
      // The server-stream ceremony writes BEFORE the ambient route has
      // resolved — the transport queues and flushes in order.
      writer.sendMessage(new Uint8Array([0x0a, 0x01, 0x61]));
      writer.halfClose();
    });
    expect(outcome.error).toBeUndefined();
    expect(outcome.chunks).toBeGreaterThan(0);
    expect(proxy.tunnels).toEqual([`127.0.0.1:${port}`]);
    expect(outcome.route).toEqual({ proxyUrl: proxy.url, source: 'system' });
  });
});
