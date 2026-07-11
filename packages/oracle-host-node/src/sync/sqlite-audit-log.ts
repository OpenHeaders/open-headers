/**
 * SQLite-backed {@link AuditLog} — Phase 5 slice 4 (DAEMON_PLAN.md §7).
 *
 * Node-host twin of the extension SW's `IdbAuditLog`: same
 * per-Org gapless sequence contract (UNIFIED_ORACLE_MODEL.md §9.5),
 * same append/list/prune surface, riding the shared `oracle.db`
 * better-sqlite3 handle like the other persistence shims here.
 *
 * Schema (one row per capability decision):
 *
 *     CREATE TABLE audit_log (
 *       org_id        TEXT NOT NULL,
 *       seq           INTEGER NOT NULL,
 *       entry_id      TEXT NOT NULL,      -- `${orgId}:${seq}`
 *       actor_user_id TEXT NOT NULL,      -- immutable FK (§9.3)
 *       capability    TEXT NOT NULL,
 *       workspace_id  TEXT,
 *       allow_byte    INTEGER NOT NULL,
 *       deny_reason   TEXT,
 *       occurred_at   TEXT NOT NULL,      -- ISO 8601
 *       PRIMARY KEY (org_id, seq)
 *     );
 *     CREATE TABLE audit_counters (
 *       org_id TEXT PRIMARY KEY,
 *       next   INTEGER NOT NULL
 *     );
 *
 * Design notes:
 *
 *   - **Gapless seq** — the counter row is read + incremented inside
 *     the same better-sqlite3 transaction as the entry insert, so
 *     concurrent appenders on the handle can't mint duplicates and a
 *     rolled-back insert rolls the counter back with it.
 *   - **ISO `occurred_at`** — `Date.toISOString()` output is
 *     fixed-width, so lexicographic string comparison IS chronological
 *     comparison; range scans need no epoch column.
 *   - **Sync API satisfied async** — better-sqlite3 is synchronous;
 *     every method returns a resolved Promise to keep the host-neutral
 *     {@link AuditLog} contract.
 *
 * The standalone query/prune functions below serve the report surfaces
 * (`ohd audit`, the prune scheduler) that read the table without
 * an {@link AuditLog} instance.
 */

import type { AuditLogEntry } from '@openheaders/core/types';
import type { AuditLog, AuditLogAppendInput, AuditLogListOptions } from '@openheaders/oracle/sync/audit-log';
import type Database from 'better-sqlite3';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS audit_log (
    org_id        TEXT NOT NULL,
    seq           INTEGER NOT NULL,
    entry_id      TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    capability    TEXT NOT NULL,
    workspace_id  TEXT,
    allow_byte    INTEGER NOT NULL,
    deny_reason   TEXT,
    occurred_at   TEXT NOT NULL,
    PRIMARY KEY (org_id, seq)
  )`,
  `CREATE INDEX IF NOT EXISTS audit_log_by_occurred_at
    ON audit_log (org_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS audit_counters (
    org_id TEXT PRIMARY KEY,
    next   INTEGER NOT NULL
  )`,
] as const;

/** Idempotent — safe to call on every open. */
export function ensureAuditLogSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface AuditStatements {
  getCounter: Database.Statement<[string]>;
  putCounter: Database.Statement<[string, number]>;
  insert: Database.Statement<[string, number, string, string, string, string | null, number, string | null, string]>;
  listBySeq: Database.Statement<[string, number]>;
  pruneOrgBefore: Database.Statement<[string, string]>;
  pruneAllBefore: Database.Statement<[string]>;
}

function prepareStatements(db: Database.Database): AuditStatements {
  return {
    getCounter: db.prepare(`SELECT next FROM audit_counters WHERE org_id = ?`),
    putCounter: db.prepare(
      `INSERT INTO audit_counters (org_id, next) VALUES (?, ?)
       ON CONFLICT (org_id) DO UPDATE SET next = excluded.next`,
    ),
    insert: db.prepare(
      `INSERT INTO audit_log
        (org_id, seq, entry_id, actor_user_id, capability, workspace_id, allow_byte, deny_reason, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    listBySeq: db.prepare(
      `SELECT * FROM audit_log
       WHERE org_id = ? AND seq > ?
       ORDER BY seq DESC`,
    ),
    pruneOrgBefore: db.prepare(
      `DELETE FROM audit_log
       WHERE org_id = ? AND occurred_at < ?`,
    ),
    pruneAllBefore: db.prepare(
      `DELETE FROM audit_log
       WHERE occurred_at < ?`,
    ),
  };
}

const PREPARED = new WeakMap<Database.Database, AuditStatements>();
function statementsFor(db: Database.Database): AuditStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    ensureAuditLogSchema(db);
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

interface Row {
  org_id: string;
  seq: number;
  entry_id: string;
  actor_user_id: string;
  capability: string;
  workspace_id: string | null;
  allow_byte: number;
  deny_reason: string | null;
  occurred_at: string;
}

type AuditDenyReason = NonNullable<AuditLogEntry['decision']['reason']>;

function rowToEntry(row: Row): AuditLogEntry {
  return {
    id: row.entry_id,
    orgId: row.org_id,
    seq: row.seq,
    actorUserId: row.actor_user_id,
    capability: row.capability as AuditLogEntry['capability'],
    ...(row.workspace_id !== null ? { workspaceId: row.workspace_id } : {}),
    decision: {
      allow: row.allow_byte === 1,
      ...(row.deny_reason !== null ? { reason: row.deny_reason as AuditDenyReason } : {}),
    },
    occurredAt: row.occurred_at,
  };
}

export class SqliteAuditLog implements AuditLog {
  private readonly db: Database.Database;
  private readonly appendTx: (input: AuditLogAppendInput) => AuditLogEntry;

  constructor(db: Database.Database) {
    this.db = db;
    const stmts = statementsFor(db);
    this.appendTx = db.transaction((input: AuditLogAppendInput): AuditLogEntry => {
      const existing = stmts.getCounter.get(input.orgId) as { next: number } | undefined;
      const seq = (existing?.next ?? 0) + 1;
      stmts.putCounter.run(input.orgId, seq);
      const entry: AuditLogEntry = {
        id: `${input.orgId}:${seq}`,
        orgId: input.orgId,
        seq,
        actorUserId: input.actorUserId,
        capability: input.capability,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        decision: input.decision,
        occurredAt: input.occurredAt,
      };
      stmts.insert.run(
        entry.orgId,
        seq,
        entry.id,
        entry.actorUserId,
        entry.capability,
        entry.workspaceId ?? null,
        entry.decision.allow ? 1 : 0,
        entry.decision.reason ?? null,
        entry.occurredAt,
      );
      return entry;
    });
  }

  async append(input: AuditLogAppendInput): Promise<AuditLogEntry> {
    return this.appendTx(input);
  }

  async list(orgId: string, opts: AuditLogListOptions = {}): Promise<AuditLogEntry[]> {
    const stmts = statementsFor(this.db);
    const rows = stmts.listBySeq.all(orgId, opts.sinceSeq ?? 0) as Row[];
    const view = opts.limit !== undefined ? rows.slice(0, Math.max(0, opts.limit)) : rows;
    return view.map(rowToEntry);
  }

  async prune(orgId: string, beforeIso: string): Promise<number> {
    const stmts = statementsFor(this.db);
    return Number(stmts.pruneOrgBefore.run(orgId, beforeIso).changes);
  }
}

/**
 * Keyset-pagination cursor — the full sort key of the last row a
 * previous page returned. Rows strictly after that position (in the
 * query's `order` direction) come back, so pages never lose or repeat
 * rows that share an `occurred_at` timestamp the way a bare
 * `untilIso` window would.
 */
export interface AuditQueryCursor {
  occurredAt: string;
  orgId: string;
  seq: number;
}

/**
 * Filters for the report surface. All optional; absent = unfiltered.
 * `since`/`until` compare against the ISO `occurred_at` column
 * (inclusive lower bound, exclusive upper bound).
 */
export interface AuditQueryFilter {
  actorUserId?: string;
  capability?: string;
  /** `true` = allows only, `false` = denies only. */
  allow?: boolean;
  workspaceId?: string;
  sinceIso?: string;
  untilIso?: string;
  limit?: number;
  /** Row order by `occurred_at`; default `'desc'` (newest first). */
  order?: 'asc' | 'desc';
  /** Resume after this row (exclusive) in the current `order`. */
  after?: AuditQueryCursor;
}

/**
 * Cross-Org filtered read for `ohd audit list/export`. Composes
 * one WHERE clause from the given filters; unlike {@link AuditLog.list}
 * it spans every Org in the table (a daemon report covers the whole
 * install, and the seq tiebreak keeps within-Org order stable).
 */
export function queryAuditEntries(db: Database.Database, filter: AuditQueryFilter = {}): AuditLogEntry[] {
  // The report surface opens `oracle.db` read-only, so no schema
  // creation here — a database from before the audit plane simply has
  // no rows to report.
  const hasTable = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'`).get();
  if (hasTable === undefined) return [];
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.actorUserId !== undefined) {
    where.push('actor_user_id = ?');
    params.push(filter.actorUserId);
  }
  if (filter.capability !== undefined) {
    where.push('capability = ?');
    params.push(filter.capability);
  }
  if (filter.allow !== undefined) {
    where.push('allow_byte = ?');
    params.push(filter.allow ? 1 : 0);
  }
  if (filter.workspaceId !== undefined) {
    where.push('workspace_id = ?');
    params.push(filter.workspaceId);
  }
  if (filter.sinceIso !== undefined) {
    where.push('occurred_at >= ?');
    params.push(filter.sinceIso);
  }
  if (filter.untilIso !== undefined) {
    where.push('occurred_at < ?');
    params.push(filter.untilIso);
  }
  const order = filter.order ?? 'desc';
  if (filter.after !== undefined) {
    // Row-value keyset comparison against the full ORDER BY key — the
    // page boundary is exact even when rows share `occurred_at`.
    where.push(`(occurred_at, org_id, seq) ${order === 'asc' ? '>' : '<'} (?, ?, ?)`);
    params.push(filter.after.occurredAt, filter.after.orgId, filter.after.seq);
  }
  const sql =
    `SELECT * FROM audit_log` +
    (where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY occurred_at ${order === 'asc' ? 'ASC' : 'DESC'}, org_id ${order === 'asc' ? 'ASC' : 'DESC'}, seq ${order === 'asc' ? 'ASC' : 'DESC'}` +
    (filter.limit !== undefined ? ` LIMIT ${Math.max(0, Math.floor(filter.limit))}` : '');
  const rows = db.prepare(sql).all(...params) as Row[];
  return rows.map(rowToEntry);
}

/**
 * Retention sweep across every Org in one statement — SQLite needs no
 * per-Org cursor walk. Returns the removed row count.
 */
export function pruneAuditEntriesBefore(db: Database.Database, beforeIso: string): number {
  const stmts = statementsFor(db);
  return Number(stmts.pruneAllBefore.run(beforeIso).changes);
}
