/**
 * Daemon-ops egress through a LIVE local proxy — the S35-recorded
 * residual: the audit→SIEM forwarder and the license refresh agent now
 * dispatch through the node request transport instead of bare fetch,
 * so on a proxied machine both operator-facing POSTs tunnel through
 * the proxy the environment names. Resolvers are the REAL env-var
 * implementation, injected through the transport's `environmentProxy`
 * option (the hermeticity law: the process-global registry stays off
 * for the whole run).
 */

import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { LicenseSnapshot } from '@openheaders/core/licensing';
import { ensureAuditLogSchema, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEnvProxyResolver } from '../../../src/live/environment-proxy/env-proxy-resolver';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';
import { openSqliteDatabase } from '../../../src/sync/sqlite-database';
import { listenPort, startConnectProxy } from '../request-transport/connect-proxy-rig';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { type AuditForwarderHandle, installAuditForwarder } from '../../../src/daemon/audit-forwarder';
import { installLicenseRefreshAgent, type LicenseRefreshAgentHandle } from '../../../src/daemon/license-refresh-agent';
import type { LicenseSlotHandle } from '../../../src/daemon/license-slot';

const ORG = '0193a8ff-c000-7000-8000-00000000000a';
const DAY = 86_400_000;

interface EndpointRig {
  url: string;
  /** Request paths served, arrival order. */
  hits: string[];
  close(): Promise<void>;
}

async function startEndpoint(status: number): Promise<EndpointRig> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '');
    res.statusCode = status;
    res.end();
  });
  const port = await listenPort(server);
  const { address } = server.address() as AddressInfo;
  return {
    url: `http://${address}:${port}/ingest`,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

describe('daemon-ops egress through the environment plane', () => {
  let db: Database.Database | null = null;
  let forwarder: AuditForwarderHandle | null = null;
  let agent: LicenseRefreshAgentHandle | null = null;

  beforeEach(() => {
    db = null;
    forwarder = null;
    agent = null;
  });

  afterEach(() => {
    forwarder?.stop();
    agent?.dispose();
    db?.close();
  });

  it('tunnels the audit-forwarder batch POST through the env-var CONNECT proxy', async () => {
    const collector = await startEndpoint(200);
    const proxy = await startConnectProxy();
    try {
      db = openSqliteDatabase(':memory:');
      ensureAuditLogSchema(db);
      await new SqliteAuditLog(db).append({
        orgId: ORG,
        actorUserId: 'user-alice',
        capability: 'workspace.write',
        decision: { allow: true },
        occurredAt: '2026-07-31T09:00:00.000Z',
      });
      forwarder = installAuditForwarder({
        db,
        config: { url: collector.url, intervalMs: 60_000 },
        transport: createNodeRequestTransport({
          environmentProxy: createEnvProxyResolver(() => ({ http_proxy: proxy.url })),
        }),
      });
      await vi.waitFor(() => {
        expect(collector.hits).toEqual(['/ingest']);
      });
      expect(proxy.tunnels).toEqual([new URL(collector.url).host]);
    } finally {
      await proxy.close();
      await collector.close();
    }
  });

  it('tunnels the license refresh POST through the env-var CONNECT proxy', async () => {
    const endpoint = await startEndpoint(500);
    const proxy = await startConnectProxy();
    try {
      const snapshot: LicenseSnapshot = {
        status: 'licensed',
        licenseId: 'lic-rig-1',
        licensee: { name: 'Ada Example', org: 'OpenHeaders', email: 'ada@openheaders.io' },
        seats: 25,
        entitlements: [],
        validUntil: Date.now() + 15 * DAY,
        graceEndsAt: Date.now() + 36 * DAY,
      };
      const slot: LicenseSlotHandle = {
        getSnapshot: () => snapshot,
        getInstalledText: async () => 'license-key-text',
        install: async () => ({ ok: false, error: 'rig slot never installs' }),
        remove: async () => ({ ok: true, snapshot: { status: 'unlicensed' } }),
        reload: async () => snapshot,
        dispose: () => undefined,
      };
      agent = installLicenseRefreshAgent({
        slot,
        appVersion: '2026.7.31',
        platform: 'testos',
        transport: createNodeRequestTransport({
          environmentProxy: createEnvProxyResolver(() => ({ http_proxy: proxy.url })),
        }),
        listUsers: async () => [],
        endpoint: endpoint.url,
        setTimer: () => 0 as unknown as NodeJS.Timeout,
        clearTimer: () => undefined,
      });
      await agent.tick();
      expect(endpoint.hits).toEqual(['/ingest']);
      expect(proxy.tunnels).toEqual([new URL(endpoint.url).host]);
    } finally {
      await proxy.close();
      await endpoint.close();
    }
  });
});
