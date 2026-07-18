/**
 * Node WS transport — real-wire pins against a live `ws` server (the
 * same discipline as the gRPC transport's real-wire legs: no mocked
 * sockets, the actual protocol stack). Covers the session round trip
 * (subprotocol negotiation, custom handshake headers, both directions
 * text + binary), the server close code/reason verbatim, the local
 * clean close, connect-failure classification off the wrapped
 * connector, the connect deadline, the pre-open abort, and the
 * post-open Stop-abort settling immediately with no error.
 */

import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { createNodeWsTransport } from '../../src/live/node-ws-transport';
import type { WsTransportClose, WsTransportError, WsTransportMessage } from '@openheaders/oracle/live/ws-exec/transport';

const servers: Server[] = [];

interface ProbeServer {
  url: string;
  seenHeaders: () => IncomingMessage['headers'];
}

async function startWsServer(options: { neverUpgrade?: boolean } = {}): Promise<ProbeServer> {
  const httpServer = createServer((_req, res) => {
    res.statusCode = 426;
    res.end();
  });
  servers.push(httpServer);
  let headers: IncomingMessage['headers'] = {};
  if (!options.neverUpgrade) {
    const wss = new WebSocketServer({
      server: httpServer,
      handleProtocols: (protocols) => {
        const first = protocols.values().next();
        return first.done ? false : first.value;
      },
    });
    wss.on('connection', (ws, req) => {
      headers = req.headers;
      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          ws.send(data, { binary: true });
          return;
        }
        const text = data.toString('utf8');
        const closeMatch = text.match(/^close:(\d{4})(?::(.*))?$/);
        if (closeMatch) {
          ws.close(Number(closeMatch[1]), closeMatch[2] ?? '');
          return;
        }
        if (text === 'binary') {
          ws.send(Buffer.of(1, 2, 3), { binary: true });
          return;
        }
        ws.send(`echo:${text}`);
      });
    });
  }
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('no listen address');
  return { url: `ws://127.0.0.1:${address.port}/session`, seenHeaders: () => headers };
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections?.();
        }),
    ),
  );
});

interface SessionRun {
  protocol: string;
  messages: Array<{ text: string | null; binary: boolean; byteLength: number }>;
  close: WsTransportClose | null;
  error?: WsTransportError;
}

/** Drive one session: on open run `steps` against the writer, resolve
 *  on end with everything observed. */
function runSession(
  url: string,
  options: { headers?: Array<{ key: string; value: string }>; subprotocols?: string[]; timeoutMs?: number },
  steps: (writer: { send(text: string): void; close(code: number, reason: string): void }, seen: SessionRun) => void,
  signal?: AbortSignal,
): Promise<SessionRun> {
  const transport = createNodeWsTransport();
  return new Promise<SessionRun>((resolve) => {
    const seen: SessionRun = { protocol: '', messages: [], close: null };
    const writer = transport.connect(
      {
        url,
        headers: options.headers ?? [],
        subprotocols: options.subprotocols ?? [],
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
      },
      {
        onOpen: (protocol) => {
          seen.protocol = protocol;
          steps(writer, seen);
        },
        onMessage: ({ data, binary }: WsTransportMessage) => {
          seen.messages.push({
            text: binary ? null : new TextDecoder().decode(data),
            binary,
            byteLength: data.byteLength,
          });
        },
        onClose: (close) => {
          seen.close = close;
        },
        onEnd: (error) => {
          if (error !== undefined) seen.error = error;
          resolve(seen);
        },
      },
      signal,
    );
  });
}

describe('createNodeWsTransport — session round trip', () => {
  it('negotiates the subprotocol, carries custom headers, echoes text, closes clean', async () => {
    const server = await startWsServer();
    const seen = await runSession(
      server.url,
      { headers: [{ key: 'x-probe-client', value: 'oh-real-wire' }], subprotocols: ['chat.v2', 'chat.v1'] },
      (writer, s) => {
        writer.send('hello');
        setTimeout(() => {
          if (s.messages.length > 0) writer.close(1000, 'done');
        }, 50);
      },
    );
    expect(seen.error).toBeUndefined();
    expect(seen.protocol).toBe('chat.v2');
    expect(server.seenHeaders()['x-probe-client']).toBe('oh-real-wire');
    expect(seen.messages).toEqual([{ text: 'echo:hello', binary: false, byteLength: 10 }]);
    expect(seen.close).toEqual({ code: 1000, reason: 'done', wasClean: true });
  });

  it('tags a server binary frame honestly with its bytes intact', async () => {
    // The seam writer is text-only (v1 composes text); the binary leg
    // pins the DOWNSTREAM tag: a server binary frame arrives tagged.
    const server = await startWsServer();
    const seen = await runSession(server.url, {}, (writer, s) => {
      writer.send('binary');
      setTimeout(() => {
        if (s.messages.length > 0) writer.close(1000, '');
      }, 50);
    });
    expect(seen.error).toBeUndefined();
    expect(seen.messages).toEqual([{ text: null, binary: true, byteLength: 3 }]);
  });

  it('delivers the server close code and reason verbatim', async () => {
    const server = await startWsServer();
    const seen = await runSession(server.url, {}, (writer) => {
      writer.send('close:4444:menu-reason');
    });
    expect(seen.error).toBeUndefined();
    expect(seen.close).toEqual({ code: 4444, reason: 'menu-reason', wasClean: true });
  });
});

describe('createNodeWsTransport — failure classification', () => {
  it('classifies a refused dial with the real ECONNREFUSED off the connector', async () => {
    const transport = createNodeWsTransport();
    const error = await new Promise<WsTransportError | undefined>((resolve) => {
      transport.connect(
        { url: 'ws://127.0.0.1:59998/nothing', headers: [], subprotocols: [] },
        {
          onOpen: () => resolve(undefined),
          onMessage: () => {},
          onClose: () => {},
          onEnd: (err) => resolve(err),
        },
      );
    });
    expect(error?.message).toContain('Connection refused by 127.0.0.1:59998');
  });

  it('classifies a rejected upgrade (non-101 answer) as a handshake refusal', async () => {
    const server = await startWsServer({ neverUpgrade: true });
    const transport = createNodeWsTransport();
    const error = await new Promise<WsTransportError | undefined>((resolve) => {
      transport.connect(
        { url: server.url, headers: [], subprotocols: [] },
        {
          onOpen: () => resolve(undefined),
          onMessage: () => {},
          onClose: () => {},
          onEnd: (err) => resolve(err),
        },
      );
    });
    expect(error?.message).toContain('did not accept the WebSocket handshake');
  });

  it('aborts the connect on the deadline with the deadline named', async () => {
    // A server that accepts TCP but never answers the upgrade within
    // the deadline: point at a plain HTTP server that stalls.
    const httpServer = createServer(() => {
      // Never respond — the upgrade request hangs.
    });
    servers.push(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (address === null || typeof address === 'string') throw new Error('no listen address');
    const transport = createNodeWsTransport();
    const error = await new Promise<WsTransportError | undefined>((resolve) => {
      transport.connect(
        { url: `ws://127.0.0.1:${address.port}/stall`, headers: [], subprotocols: [], timeoutMs: 150 },
        {
          onOpen: () => resolve(undefined),
          onMessage: () => {},
          onClose: () => {},
          onEnd: (err) => resolve(err),
        },
      );
    });
    expect(error?.message).toContain('Connect deadline of 150 ms');
  });
});

describe('createNodeWsTransport — abort discipline', () => {
  it('a pre-open abort settles through onEnd with the stop error', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = createNodeWsTransport();
    const error = await new Promise<WsTransportError | undefined>((resolve) => {
      transport.connect(
        { url: 'ws://127.0.0.1:59997/nothing', headers: [], subprotocols: [] },
        {
          onOpen: () => resolve(undefined),
          onMessage: () => {},
          onClose: () => {},
          onEnd: (err) => resolve(err),
        },
        controller.signal,
      );
    });
    expect(error?.message).toBe('Session stopped before it connected.');
  });

  it('a post-open abort settles immediately with no error — Stop materializes', async () => {
    const server = await startWsServer();
    const controller = new AbortController();
    const seen = await runSession(
      server.url,
      {},
      (writer, s) => {
        writer.send('one');
        setTimeout(() => {
          if (s.messages.length > 0) controller.abort();
        }, 50);
      },
      controller.signal,
    );
    expect(seen.error).toBeUndefined();
    expect(seen.messages.map((m) => m.text)).toEqual(['echo:one']);
    // No Close frame arrived before the teardown — the platform's
    // accounting stays honest (nothing synthesized).
    expect(seen.close).toBeNull();
  });
});
