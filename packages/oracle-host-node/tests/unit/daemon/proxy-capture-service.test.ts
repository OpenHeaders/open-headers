/**
 * Proxy capture service laws (the proxy plan Phase 2) — the control
 * surface that drives S5's capture engine and persists the port + §2.4
 * decrypt scope. Status is re-derived per call; scope edits validate and
 * persist (a bare `*` is unrepresentable); start/stop bind and unbind a
 * real loopback port while the captured store survives a stop; the hub
 * is fed by the engine's lifecycle sink.
 */

import 'reflect-metadata';
import { mkdtemp, rm } from 'node:fs/promises';
import * as http from 'node:http';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { setHostStorage } from '@openheaders/core/storage';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProxyCaptureService,
  DEFAULT_PROXY_CAPTURE_PORT,
  type ProxyCaptureService,
} from '../../../src/daemon/proxy/proxy-capture-service';
import { FileBackedHostStorage } from '../../../src/host-storage';

const b64Cipher: SecretCipher = {
  isAvailable: () => true,
  encrypt: (plaintext) => Buffer.from(plaintext, 'utf8').toString('base64'),
  decrypt: (blob) => Buffer.from(blob, 'base64').toString('utf8'),
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

let dir: string;
let service: ProxyCaptureService | null = null;

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'oh-proxy-capture-'));
  setHostStorage(new FileBackedHostStorage({ filePath: path.join(dir, 'host-storage.json'), secretCipher: b64Cipher }));
});

afterEach(async () => {
  await service?.dispose();
  service = null;
  await rm(dir, { recursive: true, force: true });
});

describe('proxy capture service — status', () => {
  it('defaults to stopped, the default port, an empty scope, and no CA', async () => {
    service = createProxyCaptureService();
    const status = await service.status();
    expect(status.running).toBe(false);
    expect(status.boundPort).toBeNull();
    expect(status.port).toBe(DEFAULT_PROXY_CAPTURE_PORT);
    expect(status.scopePatterns).toEqual([]);
    expect(status.caPresent).toBe(false);
    expect(status.lastError).toBeNull();
  });
});

describe('proxy capture service — scope', () => {
  it('persists a validated, de-duplicated, trimmed scope list', async () => {
    service = createProxyCaptureService();
    const res = await service.setScope(['  api.openheaders.io ', '*.openheaders.io', 'api.openheaders.io', '']);
    expect(res).toEqual({ ok: true, scopePatterns: ['api.openheaders.io', '*.openheaders.io'] });
    expect((await service.status()).scopePatterns).toEqual(['api.openheaders.io', '*.openheaders.io']);
  });

  it('refuses the whole edit on an invalid pattern (no partial write)', async () => {
    service = createProxyCaptureService();
    await service.setScope(['good.openheaders.io']);
    const res = await service.setScope(['also-good.openheaders.io', '*']);
    expect(res.ok).toBe(false);
    // The prior list is untouched — the bad edit never landed.
    expect((await service.status()).scopePatterns).toEqual(['good.openheaders.io']);
  });

  it('survives a fresh service instance (persisted to host storage)', async () => {
    service = createProxyCaptureService();
    await service.setScope(['*.openheaders.io']);
    await service.dispose();
    service = createProxyCaptureService();
    expect((await service.status()).scopePatterns).toEqual(['*.openheaders.io']);
  });
});

describe('proxy capture service — lifecycle', () => {
  it('binds an explicit port, reports it live, and stops cleanly', async () => {
    const port = await freePort();
    service = createProxyCaptureService();
    const started = await service.start(port);
    expect(started).toEqual({ ok: true, port });

    const status = await service.status();
    expect(status.running).toBe(true);
    expect(status.boundPort).toBe(port);
    // The chosen port is now the persisted preference.
    expect(status.port).toBe(port);

    await service.stop();
    const stopped = await service.status();
    expect(stopped.running).toBe(false);
    expect(stopped.boundPort).toBeNull();
    // A stop keeps the port preference — restart binds the same one.
    expect(stopped.port).toBe(port);
  });

  it('refuses a port change while running', async () => {
    const port = await freePort();
    service = createProxyCaptureService();
    await service.start(port);
    const res = await service.start(port + 1);
    expect(res.ok).toBe(false);
  });

  it('rejects an out-of-range port', async () => {
    service = createProxyCaptureService();
    const res = await service.start(70000);
    expect(res.ok).toBe(false);
  });

  it('captures a plain-HTTP request through the engine into the hub', async () => {
    // A real upstream to re-originate to, so the capture completes.
    const upstream = http.createServer((_req, res) => res.writeHead(200).end('ok'));
    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
    const upstreamPort = (upstream.address() as { port: number }).port;

    service = createProxyCaptureService();
    const started = await service.start(await freePort());
    if (!started.ok) throw new Error('start failed');

    // Attach a hub sink to observe the proxy partition.
    const seen: string[] = [];
    const handle = service.hub.attach(-59210, {
      deliverReady: () => {},
      deliverUpdate: (u) => {
        if (u.kind === 'started') seen.push(u.lifecycle.url);
      },
      deliverTabCleared: () => {},
      close: () => {},
    });

    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: started.port,
          method: 'GET',
          path: `http://127.0.0.1:${upstreamPort}/hello`,
        },
        (res) => {
          res.resume();
          res.on('end', () => resolve());
        },
      );
      req.on('error', reject);
      req.end();
    });

    handle.detach();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
    expect(seen.some((u) => u.includes('/hello'))).toBe(true);
  });
});
