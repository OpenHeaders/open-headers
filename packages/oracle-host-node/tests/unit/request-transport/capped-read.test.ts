/**
 * The capped body read against the real undici body pipeline — wire
 * content decoding the mocked-fetch suites never exercise. The cap and
 * truncation matrix itself rides the entry suite's mocked sends.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';
import { makeRequest } from './helpers';

describe('createNodeRequestTransport — wire content decoding (real undici pipeline)', () => {
  it('a zstd-encoded body arrives decoded, Content-Encoding header preserved', async () => {
    // Pins undici's zstd decompression on the fetch path — the capture
    // relies on it, and it lives inside the body pipeline a mocked fetch
    // never exercises, so this test rides a real local server.
    const payload = JSON.stringify({ ok: true, host: 'api.openheaders.io' });
    const compressed = zstdCompressSync(Buffer.from(payload, 'utf8'));
    // Probe discipline: minted bytes must round-trip a real decoder.
    expect(zstdDecompressSync(compressed).toString('utf8')).toBe(payload);
    const server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Encoding', 'zstd');
      res.end(compressed);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/zstd` }));
      expect(res.body).toBe(payload);
      expect(res.bodyBytes).toBe(Buffer.byteLength(payload));
      expect(res.headers).toContainEqual({ key: 'content-encoding', value: 'zstd' });
    } finally {
      server.close();
    }
  });
});
