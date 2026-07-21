/**
 * Phase 6 — daemon metrics provider. Every number is derived at read
 * time from state that already exists: peer registry snapshot, bind
 * lifecycle, status store, and row counts on a `:memory:` handle
 * (mutation log via the HLC-key time bound, audit log via
 * `occurred_at`, observability ring).
 */

import { setHostLogger } from '@openheaders/core/logger';
import { hlcToString } from '@openheaders/core/sync';
import type { StatusSnapshot } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { ensureAuditLogSchema, SqliteAuditLog } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import { ensureMutationLogSchema } from '@openheaders/oracle-host-node/sync/sqlite-mutation-log';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DaemonBindState } from '../../../src/daemon/bind-supervisor';
import { createMetricsProvider, type MetricsProviderDeps } from '../../../src/daemon/metrics';
import { installObservabilityLog } from '../../../src/daemon/observability-log';
import type { PeerSummary } from '../../../src/host-runtime/ws-server';
import { openSqliteDatabase } from '../../../src/sync/sqlite-database';

const ORG = '0193a8ff-c000-7000-8000-00000000000a';
const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

function makePeer(overrides: Partial<PeerSummary> = {}): PeerSummary {
  return {
    peerId: 'peer-1',
    role: 'extension',
    agent: '@openheaders/extension@2026.7.0',
    workspaceId: 'ws-1',
    nodeId: 'node-1',
    installId: null,
    tokenId: 'token-1',
    userId: 'user-1',
    isLoopback: true,
    ...overrides,
  };
}

function insertMutation(db: Database.Database, physicalMs: number, mutationId: string): void {
  db.prepare(
    `INSERT INTO mutation_log (scope, org_id, hlc_key, mutation_id, envelope_json) VALUES (?, ?, ?, ?, ?)`,
  ).run('ws-1', ORG, hlcToString({ physicalMs, logical: 0, nodeId: 'node-1' }), mutationId, '{}');
}

describe('createMetricsProvider', () => {
  let db: Database.Database;
  let peers: PeerSummary[];
  let bindState: DaemonBindState | null;
  let snapshot: StatusSnapshot;
  let deps: MetricsProviderDeps;

  beforeEach(() => {
    setHostLogger(consoleLogger);
    db = openSqliteDatabase(':memory:');
    ensureMutationLogSchema(db);
    ensureAuditLogSchema(db);
    installObservabilityLog({ db, appVersion: '2026.7.0', broadcast: () => undefined });
    peers = [];
    bindState = { kind: 'bound', host: '127.0.0.1', port: 8137 };
    snapshot = {};
    deps = {
      db,
      appVersion: '2026.7.0',
      bootedAtMs: NOW - 90_000,
      getStatusSnapshot: () => snapshot,
      getWsServer: () => ({ listConnectedPeers: () => peers }),
      getBindState: () => bindState,
      listWorkspaceIds: () => ['ws-1', 'ws-2'],
    };
  });

  afterEach(() => {
    db.close();
  });

  it('reports version, uptime, bind state, and workspace count', () => {
    const metrics = createMetricsProvider(deps).getMetrics();
    expect(metrics.version).toBe('2026.7.0');
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(90);
    expect(metrics.bind).toEqual({ state: 'bound', host: '127.0.0.1', port: 8137 });
    expect(metrics.workspaces.total).toBe(2);
  });

  it('reports null bind before the supervisor first emits, and a failed bind verbatim', () => {
    bindState = null;
    const provider = createMetricsProvider(deps);
    expect(provider.getMetrics().bind).toBeNull();
    bindState = { kind: 'failed', host: '0.0.0.0', port: 8137, error: new Error('EADDRINUSE') };
    expect(provider.getMetrics().bind).toEqual({ state: 'failed', host: '0.0.0.0', port: 8137 });
  });

  it('classifies peers into loopback and LAN, and survives a null server slot', () => {
    peers = [
      makePeer({ peerId: 'p1', isLoopback: true }),
      makePeer({ peerId: 'p2', isLoopback: true }),
      makePeer({ peerId: 'p3', isLoopback: false }),
    ];
    const provider = createMetricsProvider(deps);
    expect(provider.getMetrics().peers).toEqual({ total: 3, loopback: 2, lan: 1 });
    deps.getWsServer = () => null;
    expect(createMetricsProvider(deps).getMetrics().peers).toEqual({ total: 0, loopback: 0, lan: 0 });
  });

  it('counts mutations, windowing the last 24h through the HLC key bound', () => {
    insertMutation(db, NOW - 2 * DAY_MS, 'm-old');
    insertMutation(db, NOW - 60_000, 'm-recent-1');
    insertMutation(db, NOW - 1_000, 'm-recent-2');
    const metrics = createMetricsProvider(deps).getMetrics();
    expect(metrics.mutations.total).toBe(3);
    expect(metrics.mutations.last24h).toBe(2);
  });

  it('counts audit decisions by verdict and window', async () => {
    const audit = new SqliteAuditLog(db);
    const base = {
      orgId: ORG,
      actorUserId: 'user-alice',
      capability: 'workspace.write',
      workspaceId: 'ws-1',
    } as const;
    await audit.append({ ...base, decision: { allow: true }, occurredAt: new Date(NOW - 2 * DAY_MS).toISOString() });
    await audit.append({ ...base, decision: { allow: true }, occurredAt: new Date(NOW - 60_000).toISOString() });
    await audit.append({
      ...base,
      decision: { allow: false, reason: 'no-workspace-role-assignment' },
      occurredAt: new Date(NOW - 1_000).toISOString(),
    });
    const metrics = createMetricsProvider(deps).getMetrics();
    expect(metrics.audit).toEqual({ total: 3, allowed: 2, denied: 1, last24h: 2 });
  });

  it('reports the observability ring size and the status snapshot entries', () => {
    const observability = installObservabilityLog({ db, appVersion: '2026.7.0', broadcast: () => undefined });
    observability.record({ subsystem: 'sync', op: 'test', level: 'info', message: 'hello', context: {} });
    snapshot = {
      sync: { subsystem: 'sync', state: 'green', message: 'Idle — no extensions connected', timestamp: NOW },
      live: { subsystem: 'live', state: 'yellow', message: 'Refreshing…', timestamp: NOW },
    };
    const metrics = createMetricsProvider(deps).getMetrics();
    expect(metrics.observability.entries).toBe(1);
    expect(metrics.status).toEqual({
      sync: { state: 'green', message: 'Idle — no extensions connected' },
      live: { state: 'yellow', message: 'Refreshing…' },
    });
  });
});
