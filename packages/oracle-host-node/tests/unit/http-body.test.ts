/**
 * Bounded body reader — both hard bounds exercised over real sockets:
 * size (oversize body destroys + rejects), time (a slow-loris drip that
 * never finishes rejects at the deadline instead of holding the socket),
 * and the happy path resolving the full body.
 */

import { createServer, type Server } from 'node:http';
import { connect, type Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { readRawBody } from '../../src/host-runtime/http-body';

let server: Server | null = null;
const sockets: Socket[] = [];

/**
 * Bind a server whose first request hands back its in-flight body read.
 * Boxed (`{ body }`) because `await` would otherwise flatten the nested
 * promise into its settled value.
 */
async function startServer(): Promise<{ port: number; firstBody: Promise<{ body: Promise<string> }> }> {
  let deliver!: (read: { body: Promise<string> }) => void;
  const firstBody = new Promise<{ body: Promise<string> }>((resolve) => {
    deliver = resolve;
  });
  const bound = createServer((req, res) => {
    const body = readRawBody(req, { maxBytes: 64, timeoutMs: 150 });
    // Swallow the rejection here so a bound violation doesn't surface as
    // an unhandled rejection — the test asserts on the same promise.
    body.catch(() => {});
    deliver({ body });
    req.on('error', () => {});
    req.on('end', () => {
      res.statusCode = 200;
      res.end();
    });
  });
  server = bound;
  const port = await new Promise<number>((resolve) => {
    bound.listen(0, '127.0.0.1', () => {
      const addr = bound.address();
      resolve(typeof addr === 'object' && addr ? addr.port : 0);
    });
  });
  return { port, firstBody };
}

function openSocket(port: number): Promise<Socket> {
  return new Promise((resolve) => {
    const socket = connect(port, '127.0.0.1', () => resolve(socket));
    socket.on('error', () => {});
    sockets.push(socket);
  });
}

afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
  server = null;
});

describe('readRawBody', () => {
  it('resolves a well-formed body within the bounds', async () => {
    const { port, firstBody } = await startServer();
    const socket = await openSocket(port);
    socket.write('POST / HTTP/1.1\r\nHost: openheaders.io\r\nContent-Length: 5\r\n\r\nhello');
    await expect((await firstBody).body).resolves.toBe('hello');
  });

  it('rejects an oversize body and destroys the request', async () => {
    const { port, firstBody } = await startServer();
    const socket = await openSocket(port);
    const oversize = 'x'.repeat(128);
    socket.write(`POST / HTTP/1.1\r\nHost: openheaders.io\r\nContent-Length: ${oversize.length}\r\n\r\n${oversize}`);
    await expect((await firstBody).body).rejects.toThrow('request body too large');
  });

  it('rejects a slow-loris body that never completes once the deadline passes', async () => {
    const { port, firstBody } = await startServer();
    const socket = await openSocket(port);
    // Announce a body, drip one byte, then stall past the 150ms deadline.
    socket.write('POST / HTTP/1.1\r\nHost: openheaders.io\r\nContent-Length: 32\r\n\r\nx');
    await expect((await firstBody).body).rejects.toThrow('request body read timed out');
  });
});
