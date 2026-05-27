/**
 * SQLite-backed {@link ActivityLog} — Phase C F1.
 *
 * Production storage for desktop main (and the future Node daemon).
 * Sibling to {@link SqlitePendingOutQueue}; same `better-sqlite3`
 * handle, same idempotent-schema-creation pattern, same prepared-
 * statement caching.
 *
 * Schema (one row per classified entry):
 *
 *     CREATE TABLE activity_log (
 *       workspace_id  TEXT NOT NULL,
 *       hlc_key       TEXT NOT NULL,
 *       mutation_id   TEXT NOT NULL,
 *       kind          TEXT NOT NULL,
 *       entry_id      TEXT NOT NULL,
 *       observed_at   INTEGER NOT NULL,
 *       read_byte     INTEGER NOT NULL,
 *       entry_json    TEXT NOT NULL,
 *       PRIMARY KEY (workspace_id, mutation_id, kind)
 *     );
 *     CREATE INDEX activity_log_by_hlc
 *       ON activity_log (workspace_id, hlc_key);
 *     CREATE INDEX activity_log_by_unread
 *       ON activity_log (workspace_id, read_byte);
 *     CREATE INDEX activity_log_by_observed_at
 *       ON activity_log (workspace_id, observed_at);
 *
 * Design notes:
 *
 *   - **Workspace-scoped reads** — `workspace_id` is the leftmost key
 *     column in every index; cross-workspace bleed is structurally
 *     impossible.
 *   - **`(workspace_id, mutation_id, kind)` primary key** enforces
 *     the same idempotency invariant as the IDB unique index.
 *     `enqueue` uses `INSERT OR IGNORE`.
 *   - **HLC-ordered list** — `hlc_key` second-index supports the
 *     newest-first list traversal.
 *   - **Sync API satisfied async** — better-sqlite3 is synchronous;
 *     every method returns a resolved Promise so the {@link ActivityLog}
 *     contract is preserved.
 */

import {
  activityEntryId,
  hlcToString,
  type ActivityEntry,
  type ActivityEntryKind,
} from '@openheaders/core/sync';
import type Database from 'better-sqlite3';

import type { ActivityLog, ActivityLogListOptions } from '@openheaders/oracle/sync/activity-log';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS activity_log (
    workspace_id  TEXT NOT NULL,
    hlc_key       TEXT NOT NULL,
    mutation_id   TEXT NOT NULL,
    kind          TEXT NOT NULL,
    entry_id      TEXT NOT NULL,
    observed_at   INTEGER NOT NULL,
    read_byte     INTEGER NOT NULL,
    entry_json    TEXT NOT NULL,
    PRIMARY KEY (workspace_id, mutation_id, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS activity_log_by_hlc
    ON activity_log (workspace_id, hlc_key)`,
  `CREATE INDEX IF NOT EXISTS activity_log_by_unread
    ON activity_log (workspace_id, read_byte)`,
  `CREATE INDEX IF NOT EXISTS activity_log_by_observed_at
    ON activity_log (workspace_id, observed_at)`,
] as const;

/** Idempotent — safe to call on every open. */
export function ensureActivityLogSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface ActivityStatements {
  append: Database.Statement<
    [string, string, string, string, string, number, number, string]
  >;
  list: Database.Statement<[string]>;
  markRead: Database.Statement<[string, string]>;
  countUnread: Database.Statement<[string]>;
  pruneBefore: Database.Statement<[string, number]>;
  has: Database.Statement<[string, string, string]>;
}

function prepareStatements(db: Database.Database): ActivityStatements {
  return {
    append: db.prepare(
      `INSERT OR IGNORE INTO activity_log
        (workspace_id, hlc_key, mutation_id, kind, entry_id, observed_at, read_byte, entry_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    list: db.prepare(
      `SELECT entry_json, hlc_key, read_byte FROM activity_log
       WHERE workspace_id = ?
       ORDER BY hlc_key DESC, mutation_id DESC`,
    ),
    markRead: db.prepare(
      `UPDATE activity_log
         SET read_byte = 1,
             entry_json = json_set(entry_json, '$.read', json('true'))
       WHERE workspace_id = ? AND entry_id = ? AND read_byte = 0`,
    ),
    countUnread: db.prepare(
      `SELECT COUNT(*) AS c FROM activity_log
       WHERE workspace_id = ? AND read_byte = 0`,
    ),
    pruneBefore: db.prepare(
      `DELETE FROM activity_log
       WHERE workspace_id = ? AND observed_at < ?`,
    ),
    has: db.prepare(
      `SELECT 1 FROM activity_log
       WHERE workspace_id = ? AND mutation_id = ? AND kind = ?
       LIMIT 1`,
    ),
  };
}

const PREPARED = new WeakMap<Database.Database, ActivityStatements>();
function statementsFor(db: Database.Database): ActivityStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

interface ListRow {
  entry_json: string;
  hlc_key: string;
  read_byte: number;
}

export class SqliteActivityLog implements ActivityLog {
  private readonly db: Database.Database;
  private readonly markReadBatch: (workspaceId: string, ids: readonly string[]) => void;

  constructor(db: Database.Database) {
    this.db = db;
    const stmts = statementsFor(db);
    this.markReadBatch = db.transaction((workspaceId: string, ids: readonly string[]) => {
      for (const id of ids) stmts.markRead.run(workspaceId, id);
    });
  }

  async append(entry: ActivityEntry): Promise<void> {
    const stmts = statementsFor(this.db);
    const id = entry.id.length > 0 ? entry.id : activityEntryId(entry);
    const normalized: ActivityEntry = { ...entry, id };
    stmts.append.run(
      normalized.workspaceId,
      hlcToString(normalized.hlc),
      normalized.mutationId,
      normalized.kind,
      id,
      normalized.observedAt,
      normalized.read ? 1 : 0,
      JSON.stringify(normalized),
    );
  }

  async list(workspaceId: string, opts: ActivityLogListOptions = {}): Promise<ActivityEntry[]> {
    const stmts = statementsFor(this.db);
    const rows = stmts.list.all(workspaceId) as ListRow[];
    let view = rows;
    if (opts.unreadOnly) view = view.filter((r) => r.read_byte === 0);
    if (opts.sinceHlcKey !== undefined) {
      const cutoff = opts.sinceHlcKey;
      view = view.filter((r) => r.hlc_key > cutoff);
    }
    if (opts.limit !== undefined) view = view.slice(0, Math.max(0, opts.limit));
    return view.map((r) => JSON.parse(r.entry_json) as ActivityEntry);
  }

  async markRead(workspaceId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    this.markReadBatch(workspaceId, ids);
  }

  async countUnread(workspaceId: string): Promise<number> {
    const stmts = statementsFor(this.db);
    const row = stmts.countUnread.get(workspaceId) as { c: number };
    return row.c;
  }

  async prune(workspaceId: string, beforeObservedAtMs: number): Promise<number> {
    const stmts = statementsFor(this.db);
    const info = stmts.pruneBefore.run(workspaceId, beforeObservedAtMs);
    return Number(info.changes);
  }

  async has(workspaceId: string, mutationId: string, kind: ActivityEntryKind): Promise<boolean> {
    const stmts = statementsFor(this.db);
    return stmts.has.get(workspaceId, mutationId, kind) !== undefined;
  }
}
