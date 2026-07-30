/**
 * The HTTP/3 hop over a real fake-helper exchange — resolves at the
 * response head shaped as a `NodeRequestResponse` (stream body, live
 * trailers record), reports `'h3'` as wire truth at the head, applies
 * the h2 header-hygiene rules node-side, and carries the trust legs
 * onto the protocol head. Failure contracts: pre-head ERROR rejects,
 * post-head ERROR errors the body read, abort cancels.
 */

import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { h3Hop } from '../../../src/live/h3-helper/h3-hop';
import { createH3HelperClient, type H3HelperClient, H3HelperFailure } from '../../../src/live/h3-helper/helper-process';
import type { ConnectionRecord } from '../../../src/live/instrumented-connector';

const FAKE_HELPER = fileURLToPath(new URL('./fixtures/fake-helper.mjs', import.meta.url));

let client: H3HelperClient | null = null;

function makeClient(): H3HelperClient {
  client = createH3HelperClient({ binaryPath: process.execPath, args: [FAKE_HELPER], helloTimeoutMs: 2000 });
  return client;
}

afterEach(() => {
  client?.dispose();
  client = null;
});

async function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('h3Hop', () => {
  it('resolves at the head with the stream as the body and trailers after the read', async () => {
    const spoken: Array<[string, string]> = [];
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [{ key: 'Accept', value: 'application/json' }],
      client: makeClient(),
      onProtocol: (origin, alpnProtocol) => spoken.push([origin, alpnProtocol]),
    });
    expect(response.statusCode).toBe(200);
    expect(spoken).toEqual([['api.openheaders.io:443', 'h3']]);
    const body = JSON.parse(await readAll(response.body));
    expect(body.path).toBe('/ok');
    expect(body.headers).toContainEqual(['accept', 'application/json']);
    // The live trailers record fills once the stream is consumed — the
    // ask-after-the-read contract shared with the other pipelines.
    expect(response.trailers).toEqual({ 'x-fake-trailer': 'end' });
  });

  it('sends the payload as body frames the helper reassembles', async () => {
    const response = await h3Hop({
      url: 'https://api.openheaders.io/echo',
      method: 'POST',
      headers: [],
      payload: 'a=1&b=2',
      client: makeClient(),
    });
    const body = JSON.parse(await readAll(response.body));
    expect(body.receivedBytes).toBe('a=1&b=2'.length);
  });

  it('applies the h2 header hygiene: connection-specific dropped, Host folded to authority', async () => {
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [
        { key: 'Connection', value: 'keep-alive' },
        { key: 'TE', value: 'gzip' },
        { key: 'Host', value: 'internal.openheaders.io' },
        { key: 'X-Kept', value: 'yes' },
      ],
      client: makeClient(),
    });
    expect(response.headers['x-echo-authority']).toBe('internal.openheaders.io');
    const body = JSON.parse(await readAll(response.body));
    expect(body.headers).toEqual([['x-kept', 'yes']]);
  });

  it('carries the trust legs onto the protocol head', async () => {
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [],
      insecure: true,
      clientCert: { certPem: 'CERT', keyPem: 'KEY-MATERIAL-PKCS8' },
      connectAddress: '127.0.0.1',
      client: makeClient(),
    });
    expect(response.headers['x-echo-insecure']).toBe('1');
    expect(response.headers['x-echo-connect-address']).toBe('127.0.0.1');
    expect(response.headers['x-echo-client-cert-key']).toBe('KEY-MATERIAL-PKCS8');
  });

  it('carries the TLS 1.3 cipher-suite restriction onto the protocol head, order kept', async () => {
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [],
      cipherSuites: ['TLS_CHACHA20_POLY1305_SHA256', 'TLS_AES_128_GCM_SHA256'],
      client: makeClient(),
    });
    expect(response.headers['x-echo-cipher-suites']).toBe('TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256');
  });

  it('captureNetwork rides the head and the dial facts come back as a QUIC-shaped connection record', async () => {
    const records: ConnectionRecord[] = [];
    const before = performance.now();
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [],
      captureNetwork: true,
      client: makeClient(),
      onConnection: (record) => records.push(record),
    });
    expect(response.headers['x-echo-capture-network']).toBe('1');
    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record?.origin).toBe('api.openheaders.io:443');
    expect(record?.alpnProtocol).toBe('h3');
    expect(record?.localAddress).toBe('127.0.0.1');
    expect(record?.localPort).toBe(52341);
    expect(record?.remoteAddress).toBe('203.0.113.7');
    expect(record?.remotePort).toBe(443);
    // Marks are synthesized on this process's clock from the helper's
    // measured durations; QUIC has no TCP leg, so tcpEndAt stays absent.
    expect(record?.tlsUsed).toBe(true);
    expect(record?.tcpEndAt).toBeUndefined();
    expect(record?.startAt).toBeGreaterThanOrEqual(before);
    expect(record?.dnsEndAt).toBeCloseTo((record?.startAt ?? 0) + 1.5, 5);
    expect(record?.readyAt).toBeCloseTo((record?.startAt ?? 0) + 1.5 + 12.25, 5);
    await readAll(response.body);
  });

  it('without captureNetwork the helper reports no facts and the sink stays silent', async () => {
    const records: ConnectionRecord[] = [];
    const response = await h3Hop({
      url: 'https://api.openheaders.io/ok',
      method: 'GET',
      headers: [],
      client: makeClient(),
      onConnection: (record) => records.push(record),
    });
    expect(response.statusCode).toBe(200);
    expect(records).toHaveLength(0);
    await readAll(response.body);
  });

  it('rejects pre-head with the helper failure for the classifier', async () => {
    const attempt = h3Hop({
      url: 'https://api.openheaders.io/error-pre',
      method: 'GET',
      headers: [],
      client: makeClient(),
    });
    await expect(attempt).rejects.toBeInstanceOf(H3HelperFailure);
    await expect(attempt).rejects.toMatchObject({ code: 'connect-timeout' });
  });

  it('a post-head failure errors the body read, not the hop promise', async () => {
    const response = await h3Hop({
      url: 'https://api.openheaders.io/error-post',
      method: 'GET',
      headers: [],
      client: makeClient(),
    });
    expect(response.statusCode).toBe(200);
    await expect(readAll(response.body)).rejects.toMatchObject({ code: 'reset' });
  });

  it('an aborted signal rejects a hop still waiting on its head', async () => {
    const controller = new AbortController();
    const attempt = h3Hop({
      url: 'https://api.openheaders.io/never',
      method: 'GET',
      headers: [],
      client: makeClient(),
      signal: controller.signal,
    });
    controller.abort();
    await expect(attempt).rejects.toThrow('aborted');
  });
});
