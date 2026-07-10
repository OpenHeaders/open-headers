/**
 * Daemon metrics — one read-only composition of operational state that
 * already exists elsewhere: the bind supervisor's lifecycle, the WS
 * server's peer registry, the status store's snapshot, and row counts
 * on the shared `oracle.db` handle (mutation log, audit log,
 * observability ring). No counters store of its own — every number is
 * derived at read time, so the surface can never drift from the truth
 * it reports.
 *
 * Time-windowed mutation counts ride the HLC key encoding: `hlc_key`
 * starts with the zero-padded physical milliseconds (`hlcToString`),
 * so a lexicographic `>=` against a cutoff key IS a chronological
 * bound — no timestamp column needed. Audit windows use the ISO
 * `occurred_at` column the same way.
 *
 * Consumed by the `/metrics` HTTP route (token-gated, JSON) and — via
 * that route — `oh daemon status --verbose`.
 */

import { hlcToString } from '@openheaders/core/sync';
import type { StatusLevel, StatusSnapshot, StatusSubsystem } from '@openheaders/core/types';
import type Database from 'better-sqlite3';
import type { OracleWsServer } from '../host-runtime/ws-server';
import type { DaemonBindState } from './bind-supervisor';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DaemonMetrics {
  version: string;
  uptimeSeconds: number;
  bind: { state: DaemonBindState['kind']; host: string; port: number } | null;
  peers: { total: number; loopback: number; lan: number };
  workspaces: { total: number };
  status: Partial<Record<StatusSubsystem, { state: StatusLevel; message: string }>>;
  mutations: { total: number; last24h: number };
  audit: { total: number; allowed: number; denied: number; last24h: number };
  observability: { entries: number };
}

export interface MetricsProviderDeps {
  /** The shared `oracle.db` handle — the same one every persistence shim rides. */
  db: Database.Database;
  /** Host app version, echoed so a scrape identifies the build. */
  appVersion: string;
  /** `Date.now()` captured when the spine booted — uptime baseline. */
  bootedAtMs: number;
  getStatusSnapshot(): StatusSnapshot;
  /** Live server slot — null before the first bind and mid-rebind. */
  getWsServer(): Pick<OracleWsServer, 'listConnectedPeers'> | null;
  /** Last bind lifecycle event — null before the supervisor's first emit. */
  getBindState(): DaemonBindState | null;
  listWorkspaceIds(): string[];
}

export interface MetricsProvider {
  getMetrics(): DaemonMetrics;
}

interface CountRow {
  n: number;
}

/** Empty-nodeId floor key: sorts before every real key minted in the same millisecond. */
function hlcCutoffKey(cutoffMs: number): string {
  return hlcToString({ physicalMs: cutoffMs, logical: 0, nodeId: '' });
}

export function createMetricsProvider(deps: MetricsProviderDeps): MetricsProvider {
  const { db } = deps;
  const stmts = {
    mutationsTotal: db.prepare(`SELECT COUNT(*) AS n FROM mutation_log`),
    mutationsSince: db.prepare(`SELECT COUNT(*) AS n FROM mutation_log WHERE hlc_key >= ?`),
    auditTotal: db.prepare(`SELECT COUNT(*) AS n FROM audit_log`),
    auditByAllow: db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE allow_byte = ?`),
    auditSince: db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE occurred_at >= ?`),
    observabilityTotal: db.prepare(`SELECT COUNT(*) AS n FROM observability_log`),
  };

  function count(stmt: Database.Statement, ...params: (string | number)[]): number {
    return (stmt.get(...params) as CountRow).n;
  }

  return {
    getMetrics(): DaemonMetrics {
      const now = Date.now();
      const cutoffMs = now - DAY_MS;

      const bindState = deps.getBindState();
      const peers = deps.getWsServer()?.listConnectedPeers() ?? [];
      const lan = peers.filter((p) => !p.isLoopback).length;

      const status: DaemonMetrics['status'] = {};
      for (const entry of Object.values(deps.getStatusSnapshot())) {
        if (entry) status[entry.subsystem] = { state: entry.state, message: entry.message };
      }

      return {
        version: deps.appVersion,
        uptimeSeconds: Math.max(0, Math.round((now - deps.bootedAtMs) / 1000)),
        bind: bindState ? { state: bindState.kind, host: bindState.host, port: bindState.port } : null,
        peers: { total: peers.length, loopback: peers.length - lan, lan },
        workspaces: { total: deps.listWorkspaceIds().length },
        status,
        mutations: {
          total: count(stmts.mutationsTotal),
          last24h: count(stmts.mutationsSince, hlcCutoffKey(cutoffMs)),
        },
        audit: {
          total: count(stmts.auditTotal),
          allowed: count(stmts.auditByAllow, 1),
          denied: count(stmts.auditByAllow, 0),
          last24h: count(stmts.auditSince, new Date(cutoffMs).toISOString()),
        },
        observability: { entries: count(stmts.observabilityTotal) },
      };
    },
  };
}
