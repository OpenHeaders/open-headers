/**
 * Browser WS transport — real-wire pins against a live `ws` server
 * (the node twin's discipline: no mocked sockets). The test runtime's
 * global `WebSocket` is the same platform-constructor contract the
 * page realm exposes — url + subprotocols only. Covers the session
 * round trip (subprotocol negotiation, both directions text + binary),
 * the server close code/reason verbatim, the local clean close, the
 * classified no-detail dial failure, the honored connect deadline, and
 * both abort legs.
 */

import { createServer, type Server } from 'node:http';
import type {
  WsTransportClose,
  WsTransportError,
  WsTransportMessage,
} from '@openheaders/oracle/live/ws-exec/transport';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { createBrowserWsTransport } from '../../src/live/browser-ws-transport';

const servers: Server[] = [];

async function startWsServer(options: { neverUpgrade?: boolean } = {}): Promise<{ url: string }> {
  const httpServer = createServer((_req, res) => {
    res.statusCode = 426;
    res.end();
  });
  servers.push(httpServer);
  if (!options.neverUpgrade) {
    const wss = new WebSocketServer({
      server: httpServer,
      handleProtocols: (protocols) => {
        const first = protocols.values().next();
        return first.done ? false : first.value;
      },
    });
    wss.on('connection', (ws) => {
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
  return { url: `ws://127.0.0.1:${address.port}/session` };
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
  options: { subprotocols?: string[]; timeoutMs?: number },
  steps: (writer: { send(text: string): void; close(code: number, reason: string): void }, seen: SessionRun) => void,
  signal?: AbortSignal,
): Promise<SessionRun> {
  const transport = createBrowserWsTransport();
  return new Promise<SessionRun>((resolve) => {
    const seen: SessionRun = { protocol: '', messages: [], close: null };
    const writer = transport.connect(
      {
        url,
        // The seam still carries headers — the browser constructor
        // cannot apply them, and the transport must not throw on a
        // configured row (the honesty notice is the calling surface's).
        headers: [{ key: 'x-probe-client', value: 'not-applicable-here' }],
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

describe('createBrowserWsTransport — session round trip', () => {
  it('negotiates the subprotocol, echoes text, closes clean — headers untouched', async () => {
    const server = await startWsServer();
    const seen = await runSession(server.url, { subprotocols: ['chat.v2', 'chat.v1'] }, (writer, s) => {
      writer.send('hello');
      setTimeout(() => {
        if (s.messages.length > 0) writer.close(1000, 'done');
      }, 50);
    });
    expect(seen.error).toBeUndefined();
    expect(seen.protocol).toBe('chat.v2');
    expect(seen.messages).toEqual([{ text: 'echo:hello', binary: false, byteLength: 10 }]);
    expect(seen.close).toEqual({ code: 1000, reason: 'done', wasClean: true });
  });

  it('tags a server binary frame honestly with its bytes intact', async () => {
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

describe('createBrowserWsTransport — failure classification', () => {
  it('classifies a refused dial with the honest no-detail message', async () => {
    const transport = createBrowserWsTransport();
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
    expect(error?.message).toContain('Could not open a WebSocket session to 127.0.0.1:59998');
    expect(error?.message).toContain('no failure detail');
  });

  it('classifies a rejected upgrade (non-101 answer) the same honest way', async () => {
    const server = await startWsServer({ neverUpgrade: true });
    const transport = createBrowserWsTransport();
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
    expect(error?.message).toContain('Could not open a WebSocket session to');
  });

  it('honors the connect deadline with the deadline named', async () => {
    // A server that accepts TCP but never answers the upgrade — the
    // deadline timer fails the CONNECTING socket.
    const httpServer = createServer(() => {
      // Never respond — the upgrade request hangs.
    });
    servers.push(httpServer);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address();
    if (address === null || typeof address === 'string') throw new Error('no listen address');
    const transport = createBrowserWsTransport();
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

describe('createBrowserWsTransport — abort discipline', () => {
  it('a pre-open abort settles through onEnd with the stop error', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = createBrowserWsTransport();
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
    expect(seen.close).toBeNull();
  });
});
