/**
 * Prior-knowledge HTTP/2 pipeline — the `httpVersion:
 * '2-prior-knowledge'` wire path over `node:http2`, exercised through
 * the transport seam against real cleartext (`http2.createServer`) and
 * TLS (`createSecureServer`) rigs. Verifies the sanctioned
 * cleartext-h2 route, the trust knobs riding the dial, native GET
 * bodies and trailers, the shared policy layer (redirect follower)
 * above the pipeline, the always-on spoken-protocol report, the
 * honest failure against a server that does not answer the preface,
 * and the `captureNetwork` socket facts off the session's own dial.
 */

import { createServer } from 'node:http';
import { createServer as createH2cServer, createSecureServer } from 'node:http2';
import type { AddressInfo } from 'node:net';
import { TransportError, type TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { describe, expect, it } from 'vitest';
import { h2PriorKnowledgeHop } from '../../src/live/h2-prior-knowledge';
import type { ConnectionRecord } from '../../src/live/instrumented-connector';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';

function makeRequest(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    body: { kind: 'none' },
    redirect: 'follow',
    credentials: 'omit',
    maxBodyBytes: 2 * 1024 * 1024,
    httpVersion: '2-prior-knowledge',
    ...overrides,
  };
}

/** Self-signed localhost EC key + cert for the createSecureServer rig
 *  (SAN: localhost + 127.0.0.1) — requests dial with
 *  `sslVerification: false`, the self-signed dev-server knob the
 *  pipeline must honor. */
const TLS_RIG_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg+VtrunHMTXZgAibU
F2qvGK8NSsUZWHvQm8AVlNVmWFGhRANCAASDgxJ3TvvNgyCz2VshK+YrOxzEAEWx
0cpcyNNuVXO1o0b+qVJ7DbkV7ovHTz4JmNbiRBS6tFSI7XMxSQ0rScZZ
-----END PRIVATE KEY-----`;
const TLS_RIG_CERT = `-----BEGIN CERTIFICATE-----
MIIBmDCCAT+gAwIBAgIUUQH6jJxRPNXg/ZbEIFfgQX9jTWQwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDcyOTA5MTI0NloXDTM2MDcyNjA5
MTI0NlowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEg4MSd077zYMgs9lbISvmKzscxABFsdHKXMjTblVztaNG/qlSew25Fe6L
x08+CZjW4kQUurRUiO1zMUkNK0nGWaNvMG0wHQYDVR0OBBYEFPXsX/To4JL36hvC
ltH5CbNutUaWMB8GA1UdIwQYMBaAFPXsX/To4JL36hvCltH5CbNutUaWMA8GA1Ud
EwEB/wQFMAMBAf8wGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMAoGCCqGSM49
BAMCA0cAMEQCIB0tJC0hYo5VLj5dDo5pjjNYWGkCMAg/+MY3yUvg20w5AiBopnqk
1hvixhrpP4hunsMqznTiTa07e7tnUcx6as6gpw==
-----END CERTIFICATE-----`;

describe('createNodeRequestTransport — prior-knowledge HTTP/2 pipeline', () => {
  it('sends over cleartext h2 — the sanctioned cleartext-h2 route ALPN can never reach', async () => {
    const server = createH2cServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ proto: req.httpVersion, path: req.url }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/h2c` }));
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ proto: '2.0', path: '/h2c' });
      // The always-on report: for prior knowledge, 'h2' IS wire truth —
      // the connection spoke h2 framing or the send would have failed.
      expect(res.httpVersion).toBe('h2');
    } finally {
      server.close();
    }
  });

  it('sends over TLS h2 with the request trust knobs riding the dial', async () => {
    const server = createSecureServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, (req, res) => {
      res.end(`spoke ${req.httpVersion}`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `https://127.0.0.1:${port}/h2`, sslVerification: false }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe('spoke 2.0');
      expect(res.httpVersion).toBe('h2');
    } finally {
      server.close();
    }
  });

  it('writes a raw body onto the stream and reads the echo back', async () => {
    const server = createH2cServer((req, res) => {
      const parts: Buffer[] = [];
      req.on('data', (chunk: Buffer) => parts.push(chunk));
      req.on('end', () => {
        res.setHeader('x-echo-method', req.method);
        res.setHeader('x-echo-content-type', String(req.headers['content-type']));
        res.end(Buffer.concat(parts));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${port}/echo`,
          method: 'POST',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          body: { kind: 'raw', content: '{"ping":true}' },
        }),
      );
      expect(res.body).toBe('{"ping":true}');
      expect(res.headers).toContainEqual({ key: 'x-echo-method', value: 'POST' });
      expect(res.headers).toContainEqual({ key: 'x-echo-content-type', value: 'application/json' });
    } finally {
      server.close();
    }
  });

  it('carries a GET body natively — no method/body refusal on this pipeline', async () => {
    const server = createH2cServer((req, res) => {
      const parts: Buffer[] = [];
      req.on('data', (chunk: Buffer) => parts.push(chunk));
      req.on('end', () => res.end(`${req.method}:${Buffer.concat(parts).toString()}`));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${port}/search`,
          method: 'GET',
          body: { kind: 'raw', content: '{"q":"headers"}' },
        }),
      );
      expect(res.body).toBe('GET:{"q":"headers"}');
    } finally {
      server.close();
    }
  });

  it('serializes a multipart body through the undici encoder, boundary intact', async () => {
    const server = createH2cServer((req, res) => {
      const parts: Buffer[] = [];
      req.on('data', (chunk: Buffer) => parts.push(chunk));
      req.on('end', () => {
        res.setHeader('x-echo-content-type', String(req.headers['content-type']));
        res.end(Buffer.concat(parts));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${port}/upload`,
          method: 'POST',
          body: { kind: 'multipart', parts: [{ kind: 'text', name: 'field', value: 'value-1' }] },
        }),
      );
      const contentType = res.headers.find((h) => h.key === 'x-echo-content-type')?.value ?? '';
      expect(contentType).toMatch(/^multipart\/form-data; boundary=/);
      const boundary = contentType.split('boundary=')[1] ?? '';
      expect(res.body).toContain(`--${boundary}`);
      expect(res.body).toContain('name="field"');
      expect(res.body).toContain('value-1');
    } finally {
      server.close();
    }
  });

  it('surfaces HTTP trailers off the h2 stream natively', async () => {
    const server = createH2cServer((_req, res) => {
      res.setHeader('content-type', 'application/grpc+proto');
      // Compat-API trailers: declared before end, sent after the body.
      res.addTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' });
      res.end('framed');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/rpc` }));
      expect(res.trailers).toContainEqual({ key: 'grpc-status', value: '0' });
      expect(res.trailers).toContainEqual({ key: 'grpc-message', value: 'OK' });
    } finally {
      server.close();
    }
  });

  it('rides the shared redirect follower — the policy layer above the pipeline', async () => {
    const server = createH2cServer((req, res) => {
      if (req.url === '/start') {
        res.statusCode = 302;
        res.setHeader('location', '/final');
        res.end();
        return;
      }
      res.end('landed');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/start` }));
      expect(res.status).toBe(200);
      expect(res.body).toBe('landed');
      expect(res.redirectChain).toEqual([
        expect.objectContaining({ url: `http://127.0.0.1:${port}/start`, status: 302, location: '/final' }),
      ]);
      expect(res.httpVersion).toBe('h2');
    } finally {
      server.close();
    }
  });

  it('reports socket facts under captureNetwork on a cleartext send — endpoints from the dialed rig', async () => {
    const server = createH2cServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `http://127.0.0.1:${port}/facts`, captureNetwork: true }),
      );
      expect(res.network).toMatchObject({ httpVersion: 'h2', remoteAddress: '127.0.0.1', remotePort: port });
      expect(res.network?.localAddress).toBe('127.0.0.1');
      expect(typeof res.network?.localPort).toBe('number');
      // The socket legs split out of Waiting: a TCP leg always, no TLS
      // leg on a cleartext dial, no DNS leg for an IP literal.
      expect(res.phaseTimings?.connectMs).toBeGreaterThanOrEqual(0);
      expect(res.phaseTimings?.tlsMs).toBeUndefined();
      expect(res.phaseTimings?.dnsMs).toBeUndefined();
    } finally {
      server.close();
    }
  });

  it('reports socket facts under captureNetwork on a TLS send — the TLS leg present', async () => {
    const server = createSecureServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, (_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `https://127.0.0.1:${port}/facts`, sslVerification: false, captureNetwork: true }),
      );
      expect(res.network).toMatchObject({ httpVersion: 'h2', remoteAddress: '127.0.0.1', remotePort: port });
      expect(res.phaseTimings?.connectMs).toBeGreaterThanOrEqual(0);
      expect(res.phaseTimings?.tlsMs).toBeGreaterThanOrEqual(0);
    } finally {
      server.close();
    }
  });

  it('reports no socket facts without the captureNetwork opt-in', async () => {
    const server = createH2cServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/quiet` }));
      expect(res.network).toBeUndefined();
      expect(res.phaseTimings?.connectMs).toBeUndefined();
      // The always-on report still rides the spoken-protocol log.
      expect(res.httpVersion).toBe('h2');
    } finally {
      server.close();
    }
  });

  it('hands over an ordered connection record at dial start — the instrumented connector contract', async () => {
    const server = createSecureServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, (_req, res) => {
      res.end('recorded');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const records: ConnectionRecord[] = [];
      const res = await h2PriorKnowledgeHop({
        url: `https://127.0.0.1:${port}/record`,
        method: 'GET',
        headers: [],
        connect: { rejectUnauthorized: false },
        onConnection: (record) => records.push(record),
      });
      // Drain the stream so the session winds down behind the read.
      for await (const _chunk of res.body) {
        // body bytes irrelevant — the record is the subject
      }
      expect(records).toHaveLength(1);
      const record = records[0] as ConnectionRecord;
      expect(record.origin).toBe(`127.0.0.1:${port}`);
      expect(record.tlsUsed).toBe(true);
      expect(record.alpnProtocol).toBe('h2');
      // Marks ordered: dial start ≤ TCP ≤ ready; no DNS mark for an IP
      // literal (nothing resolved).
      expect(record.dnsEndAt).toBeUndefined();
      expect(record.tcpEndAt).toBeGreaterThanOrEqual(record.startAt);
      expect(record.readyAt).toBeGreaterThanOrEqual(record.tcpEndAt as number);
      expect(record.remotePort).toBe(port);
    } finally {
      server.close();
    }
  });

  it('fails honestly against a server that does not answer the h2 preface, naming the setting', async () => {
    // A plain HTTP/1.1 server — the preface reads as a garbage request
    // and the exchange collapses (protocol error or reset, timing-
    // dependent); either way the classification names the setting.
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const attempt = createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/legacy` }));
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/prior knowledge.*set it to Auto/s);
    } finally {
      server.close();
    }
  });
});
