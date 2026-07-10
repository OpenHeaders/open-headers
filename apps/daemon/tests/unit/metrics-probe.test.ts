/**
 * `oh daemon status --verbose` probe half — fetch against a stub
 * loopback server (200 / 401 / unreachable) and the human formatting
 * of the metrics payload. Sqlite-free like every CLI-entry test.
 */

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DaemonMetrics } from '@openheaders/oracle-host-node/daemon';
import { afterEach, describe, expect, it } from 'vitest';
import { fetchMetrics, formatMetrics, formatUptime, MetricsProbeError } from '../../src/cli/metrics-probe';

const METRICS: DaemonMetrics = {
  version: '2026.7.0',
  uptimeSeconds: 11_580,
  bind: { state: 'bound', host: '0.0.0.0', port: 8137 },
  peers: { total: 3, loopback: 2, lan: 1 },
  workspaces: { total: 4 },
  status: { sync: { state: 'green', message: 'Connected to 3 extensions (1 on LAN)' } },
  mutations: { total: 1234, last24h: 56 },
  audit: { total: 789, allowed: 700, denied: 89, last24h: 12 },
  observability: { entries: 321 },
};

describe('fetchMetrics', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    const closing = server;
    server = null;
    await new Promise<void>((resolve, reject) => {
      closing.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function listen(statusCode: number, body: string): Promise<number> {
    server = createServer((_req, res) => {
      res.writeHead(statusCode, { 'content-type': 'application/json' });
      res.end(body);
    });
    const started = server;
    await new Promise<void>((resolve) => started.listen(0, '127.0.0.1', resolve));
    return (started.address() as AddressInfo).port;
  }

  it('returns the parsed payload on 200', async () => {
    const port = await listen(200, JSON.stringify(METRICS));
    await expect(fetchMetrics(port, 'oh_secret')).resolves.toEqual(METRICS);
  });

  it('maps 401 to a token-refused error', async () => {
    const port = await listen(401, JSON.stringify({ error: 'a paired access token is required' }));
    await expect(fetchMetrics(port, 'oh_wrong')).rejects.toThrow(MetricsProbeError);
    await expect(fetchMetrics(port, 'oh_wrong')).rejects.toThrow(/token was refused/);
  });

  it('maps other failure statuses to a plain probe error', async () => {
    const port = await listen(500, '{}');
    await expect(fetchMetrics(port, 'oh_secret')).rejects.toThrow(/answered 500/);
  });

  it('maps an unreachable daemon to a probe error', async () => {
    const port = await listen(200, '{}');
    const closing = server;
    server = null;
    await new Promise<void>((resolve, reject) => {
      closing?.close((err) => (err ? reject(err) : resolve()));
    });
    await expect(fetchMetrics(port, 'oh_secret')).rejects.toThrow(/could not reach/);
  });
});

describe('formatUptime', () => {
  it('picks the coarsest two units that apply', () => {
    expect(formatUptime(42)).toBe('42s');
    expect(formatUptime(150)).toBe('2m');
    expect(formatUptime(11_580)).toBe('3h 13m');
    expect(formatUptime(2 * 86400 + 5 * 3600)).toBe('2d 5h');
  });
});

describe('formatMetrics', () => {
  it('renders one aligned line per fact, status entries last', () => {
    const lines = formatMetrics(METRICS);
    expect(lines).toEqual([
      'version:       2026.7.0 — up 3h 13m',
      'bind:          bound on 0.0.0.0:8137',
      'peers:         3 connected (2 on this device, 1 on LAN)',
      'workspaces:    4',
      'mutations:     1234 stored (56 in the last 24h)',
      'audit:         789 decisions — 700 allowed, 89 denied (12 in the last 24h)',
      'observability: 321 entries',
      'sync:          green — Connected to 3 extensions (1 on LAN)',
    ]);
  });

  it('omits the bind line before the supervisor first reports', () => {
    const lines = formatMetrics({ ...METRICS, bind: null, status: {} });
    expect(lines.some((l) => l.startsWith('bind:'))).toBe(false);
    expect(lines.some((l) => l.startsWith('sync:'))).toBe(false);
  });
});
