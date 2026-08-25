/**
 * SQLite store for published public workspace snapshots (the
 * access-foundation plan §8 F5b). One row per workspace — re-publish
 * replaces it in place (the stable-URL contract), unpublish deletes
 * it. Rides the shared `oracle.db` better-sqlite3 handle like the
 * audit log and the other persistence shims here.
 *
 * The payload column holds the serialized
 * `PublicWorkspacePublication` envelope verbatim — the HTTP route
 * serves it as-is, so a publish is the ONE moment the projection is
 * computed and the contract applied; nothing re-derives at read time.
 */

import type Database from 'better-sqlite3';

const SCHEMA = `CREATE TABLE IF NOT EXISTS published_workspace_snapshots (
  workspace_id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  published_by TEXT NOT NULL
)`;

export interface PublishedSnapshotRow {
  workspaceId: string;
  /** The serialized `PublicWorkspacePublication` envelope, verbatim. */
  payloadJson: string;
  publishedAt: string;
  publishedBy: string;
}

export class SqlitePublishedSnapshotStore {
  private readonly getStmt: Database.Statement<[string]>;
  private readonly putStmt: Database.Statement<[string, string, string, string]>;
  private readonly deleteStmt: Database.Statement<[string]>;

  constructor(db: Database.Database) {
    db.exec(SCHEMA);
    this.getStmt = db.prepare(
      'SELECT workspace_id, payload_json, published_at, published_by FROM published_workspace_snapshots WHERE workspace_id = ?',
    );
    this.putStmt = db.prepare(
      `INSERT INTO published_workspace_snapshots (workspace_id, payload_json, published_at, published_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (workspace_id) DO UPDATE SET
         payload_json = excluded.payload_json,
         published_at = excluded.published_at,
         published_by = excluded.published_by`,
    );
    this.deleteStmt = db.prepare('DELETE FROM published_workspace_snapshots WHERE workspace_id = ?');
  }

  get(workspaceId: string): PublishedSnapshotRow | null {
    const row = this.getStmt.get(workspaceId) as
      | { workspace_id: string; payload_json: string; published_at: string; published_by: string }
      | undefined;
    if (!row) return null;
    return {
      workspaceId: row.workspace_id,
      payloadJson: row.payload_json,
      publishedAt: row.published_at,
      publishedBy: row.published_by,
    };
  }

  put(row: PublishedSnapshotRow): void {
    this.putStmt.run(row.workspaceId, row.payloadJson, row.publishedAt, row.publishedBy);
  }

  /** Returns true when a standing publication was removed. */
  delete(workspaceId: string): boolean {
    return this.deleteStmt.run(workspaceId).changes > 0;
  }
}
