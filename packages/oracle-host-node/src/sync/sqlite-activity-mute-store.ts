/**
 * SQLite-backed {@link ActivityMuteStore} — Phase C F6.b.
 *
 * Sibling to {@link SqliteActivityLog}; same `better-sqlite3` handle,
 * same idempotent-schema-creation pattern, same prepared-statement
 * caching via `WeakMap<Database, Statements>`.
 *
 * Schema:
 *
 *     CREATE TABLE activity_mute_store (
 *       workspace_id  TEXT NOT NULL,
 *       entity_type   TEXT NOT NULL,
 *       entity_id     TEXT NOT NULL,
 *       muted_at      INTEGER NOT NULL,
 *       PRIMARY KEY (workspace_id, entity_type, entity_id)
 *     );
 *
 * The composite primary key is the workspace-prefixed unique invariant
 * — cross-workspace bleed is impossible. `INSERT OR REPLACE` keeps
 * `put` idempotent + re-muting always refreshes `muted_at`.
 */

import type { ActivityMuteEntry } from '@openheaders/core/sync';
import type Database from 'better-sqlite3';

import type { ActivityMuteStore } from '@openheaders/oracle/sync/activity/activity-mute-store';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS activity_mute_store (
    workspace_id  TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    muted_at      INTEGER NOT NULL,
    PRIMARY KEY (workspace_id, entity_type, entity_id)
  )`,
] as const;

/** Idempotent — safe to call on every open. */
export function ensureActivityMuteSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface MuteStatements {
  put: Database.Statement<[string, string, string, number]>;
  remove: Database.Statement<[string, string, string]>;
  has: Database.Statement<[string, string, string]>;
  list: Database.Statement<[string]>;
}

function prepareStatements(db: Database.Database): MuteStatements {
  return {
    put: db.prepare(
      `INSERT OR REPLACE INTO activity_mute_store
        (workspace_id, entity_type, entity_id, muted_at)
       VALUES (?, ?, ?, ?)`,
    ),
    remove: db.prepare(
      `DELETE FROM activity_mute_store
       WHERE workspace_id = ? AND entity_type = ? AND entity_id = ?`,
    ),
    has: db.prepare(
      `SELECT 1 FROM activity_mute_store
       WHERE workspace_id = ? AND entity_type = ? AND entity_id = ?
       LIMIT 1`,
    ),
    list: db.prepare(
      `SELECT workspace_id, entity_type, entity_id, muted_at
       FROM activity_mute_store
       WHERE workspace_id = ?
       ORDER BY muted_at ASC`,
    ),
  };
}

const PREPARED = new WeakMap<Database.Database, MuteStatements>();
function statementsFor(db: Database.Database): MuteStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

interface ListRow {
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  muted_at: number;
}

export class SqliteActivityMuteStore implements ActivityMuteStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async put(entry: ActivityMuteEntry): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.put.run(entry.workspaceId, entry.entityType, entry.entityId, entry.mutedAt);
  }

  async remove(workspaceId: string, entityType: string, entityId: string): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.remove.run(workspaceId, entityType, entityId);
  }

  async has(workspaceId: string, entityType: string, entityId: string): Promise<boolean> {
    const stmts = statementsFor(this.db);
    return stmts.has.get(workspaceId, entityType, entityId) !== undefined;
  }

  async list(workspaceId: string): Promise<ActivityMuteEntry[]> {
    const stmts = statementsFor(this.db);
    const rows = stmts.list.all(workspaceId) as ListRow[];
    return rows.map((r) => ({
      workspaceId: r.workspace_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      mutedAt: r.muted_at,
    }));
  }
}
