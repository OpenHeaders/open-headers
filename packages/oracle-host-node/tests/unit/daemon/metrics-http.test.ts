/**
 * Phase 6 — `/metrics` HTTP route. Same admission discipline as `/mcp`:
 * path fall-through, GET-only, Origin rejection, bearer-token
 * validation against the real daemon token ledger (in-memory
 * HostStorage fake), directory refusal for deactivated bound users,
 * and the JSON payload round-trip.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  clearIdentitySnapshot,
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  mintDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaemonMetrics } from '../../../src/daemon/metrics';
import { createMetricsHttpHandler, METRICS_HTTP_PATH } from '../../../src/daemon/metrics-http';
import { createHostStorageFake } from '../_host-storage-fake';

const METRICS: DaemonMetrics = {
  version: '2026.7.0',
  uptimeSeconds: 4242,
  bind: { state: 'bound', host: '127.0.0.1', port: 8137 },
  peers: { total: 2, loopback: 1, lan: 1 },
  workspaces: { total: 3 },
  status: { sync: { state: 'green', message: 'Connected to 2 extensions (1 on LAN)' } },
  mutations: { total: 120, last24h: 7 },
  audit: { total: 40, allowed: 38, denied: 2, last24h: 5 },
  observability: { entries: 12 },
};

describe('metrics HTTP handler', () => {
  let server: Server;
  let baseUrl: string;
  let secret: string;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    setHostStorage(createHostStorageFake());
    clearIdentitySnapshot();
    await ensureSyntheticIdentity({ hostKind: 'daemon', now: '2026-07-10T00:00:00.000Z' });
    secret = (await mintDaemonAuthToken({ label: 'ops probe' })).secret;
    const handler = createMetricsHttpHandler({ provider: { getMetrics: () => METRICS } });
    server = createServer((req, res) => {
      if (handler(req, res)) return;
      res.statusCode = 400;
      res.end('fallback');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('ignores non-metrics paths so the caller chain falls through', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('fallback');
  });

  it('405s non-GET methods', async () => {
    const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });

  it('403s any browser-originated request (Origin header present)', async () => {
    const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { authorization: `Bearer ${secret}`, origin: 'https://openheaders.io' },
    });
    expect(response.status).toBe(403);
  });

  it('401s a missing or unknown bearer token', async () => {
    const missing = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`);
    expect(missing.status).toBe(401);
    expect(missing.headers.get('www-authenticate')).toBe('Bearer');

    const unknown = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { authorization: 'Bearer oh_not-a-real-token' },
    });
    expect(unknown.status).toBe(401);
  });

  it('serves the metrics JSON to a valid token, no-store', async () => {
    const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(METRICS);
  });

  it('serves the Prometheus exposition when Accept names a scraper media type', async () => {
    const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: {
        authorization: `Bearer ${secret}`,
        accept: 'application/openmetrics-text;version=1.0.0,text/plain;version=0.0.4;q=0.5,*/*;q=0.1',
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; version=0.0.4; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.text();
    expect(body).toContain('oh_uptime_seconds 4242');
    expect(body).toContain('oh_bind_info{state="bound",host="127.0.0.1",port="8137"} 1');
  });

  it('keeps JSON the default for a wildcard or JSON Accept', async () => {
    for (const accept of ['*/*', 'application/json']) {
      const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
        headers: { authorization: `Bearer ${secret}`, accept },
      });
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(await response.json()).toEqual(METRICS);
    }
  });

  it('401s an unauthenticated scrape — the exposition format weakens nothing', async () => {
    const response = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { accept: 'text/plain;version=0.0.4' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('401s a bound token once its directory user is deactivated', async () => {
    const created = await createDaemonUser({ displayName: 'Alice' });
    if (!created.ok) throw new Error('directory create failed');
    const bound = await mintDaemonAuthToken({ label: 'alice ops', userId: created.record.user.id });

    const before = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { authorization: `Bearer ${bound.secret}` },
    });
    expect(before.status).toBe(200);

    await deactivateDaemonUser(created.record.user.id);
    const after = await fetch(`${baseUrl}${METRICS_HTTP_PATH}`, {
      headers: { authorization: `Bearer ${bound.secret}` },
    });
    expect(after.status).toBe(401);
  });
});
