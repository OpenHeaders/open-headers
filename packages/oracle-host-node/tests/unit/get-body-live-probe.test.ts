/**
 * Real-stack probe for the GET/HEAD-with-body wire path: the REAL
 * undici request() pipeline (no seam mock) against a local HTTP
 * server, through the full transport — proving the body actually
 * arrives on the wire and the adapted response reads back.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((req, res) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (req.url === '/redirect') {
        res.writeHead(302, { location: '/echo' });
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ method: req.method, received: data, contentType: req.headers['content-type'] ?? null }));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe('GET-with-body over the real undici stack', () => {
  it('puts a raw GET body on the wire and reads the response back', async () => {
    const res = await createNodeRequestTransport().send({
      method: 'GET',
      url: `${baseUrl}/echo`,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: { kind: 'raw', content: '{"query":{"match_all":{}}}' },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: 1024,
    });
    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(JSON.parse(res.body)).toEqual({
      method: 'GET',
      received: '{"query":{"match_all":{}}}',
      contentType: 'application/json',
    });
  });

  it('re-sends the GET body across a redirect hop', async () => {
    const res = await createNodeRequestTransport().send({
      method: 'GET',
      url: `${baseUrl}/redirect`,
      headers: [],
      body: { kind: 'raw', content: 'still-here' },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: 1024,
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).received).toBe('still-here');
  });
});
