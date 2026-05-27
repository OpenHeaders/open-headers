/**
 * SQLite-backed {@link PendingOutQueue} — Phase C C14.
 *
 * Production storage for desktop main (and the future Node daemon).
 * Sibling to {@link SqliteMutationLog}; same `better-sqlite3` handle,
 * same idempotent-schema-creation pattern, same prepared-statement
 * caching.
 *
 * Schema (one row per pending envelope):
 *
 *     CREATE TABLE pending_out_queue (
 *       remote_id     TEXT NOT NULL,
 *       workspace_id  TEXT NOT NULL,
 *       hlc_key       TEXT NOT NULL,
 *       mutation_id   TEXT NOT NULL,
 *       envelope_json TEXT NOT NULL,
 *       PRIMARY KEY (remote_id, workspace_id, hlc_key, mutation_id)
 *     );
 *     CREATE UNIQUE INDEX pending_out_dedup
 *       ON pending_out_queue (remote_id, mutation_id);
 *
 * Design notes:
 *
 *   - **Per-remote isolation** — `remote_id` is the leftmost key
 *     column, so a single-remote drain is a contiguous range scan.
 *     Matches the IDB impl's key shape.
 *   - **HLC-ordered drain** — `hlc_key` second so `ORDER BY hlc_key`
 *     under a remote-id filter gives the same order as the IDB
 *     `IDBKeyRange` traversal.
 *   - **Dedup** rides the unique index on `(remote_id, mutation_id)`;
 *     `enqueue` uses `INSERT OR IGNORE`. Same contract as the
 *     in-memory + IDB impls.
 *   - **Sync API satisfied async** — better-sqlite3 is synchronous;
 *     every method returns a trivially-resolved Promise so the
 *     {@link PendingOutQueue} contract is preserved.
 */
import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';
import type Database from 'better-sqlite3';

import type { PendingOutQueue } from '@openheaders/oracle/sync/pending-out-queue';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pending_out_queue (
    remote_id     TEXT NOT NULL,
    workspace_id  TEXT NOT NULL,
    hlc_key       TEXT NOT NULL,
    mutation_id   TEXT NOT NULL,
    envelope_json TEXT NOT NULL,
    PRIMARY KEY (remote_id, workspace_id, hlc_key, mutation_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pending_out_dedup
    ON pending_out_queue (remote_id, mutation_id)`,
] as const;

/** Idempotent — safe to call on every open. Mirrors {@link ensureMutationLogSchema}. */
export function ensurePendingOutQueueSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface PendingOutStatements {
  enqueue: Database.Statement<[string, string, string, string, string]>;
  has: Database.Statement<[string, string]>;
  drain: Database.Statement<[string]>;
  ack: Database.Statement<[string, string]>;
  size: Database.Statement<[string]>;
}

function prepareStatements(db: Database.Database): PendingOutStatements {
  return {
    enqueue: db.prepare(
      `INSERT OR IGNORE INTO pending_out_queue (remote_id, workspace_id, hlc_key, mutation_id, envelope_json)
       VALUES (?, ?, ?, ?, ?)`,
    ),
    has: db.prepare(
      `SELECT 1 FROM pending_out_queue WHERE remote_id = ? AND mutation_id = ? LIMIT 1`,
    ),
    drain: db.prepare(
      `SELECT envelope_json FROM pending_out_queue
       WHERE remote_id = ?
       ORDER BY hlc_key ASC, mutation_id ASC`,
    ),
    ack: db.prepare(
      `DELETE FROM pending_out_queue WHERE remote_id = ? AND mutation_id = ?`,
    ),
    size: db.prepare(
      `SELECT COUNT(*) AS c FROM pending_out_queue WHERE remote_id = ?`,
    ),
  };
}

const PREPARED = new WeakMap<Database.Database, PendingOutStatements>();
function statementsFor(db: Database.Database): PendingOutStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

export class SqlitePendingOutQueue implements PendingOutQueue {
  private readonly db: Database.Database;
  private readonly ackBatch: (remoteId: string, mutationIds: readonly string[]) => void;

  constructor(db: Database.Database) {
    this.db = db;
    const stmts = statementsFor(db);
    this.ackBatch = db.transaction((remoteId: string, mutationIds: readonly string[]) => {
      for (const id of mutationIds) stmts.ack.run(remoteId, id);
    });
  }

  async enqueue(remoteId: string, env: MutationEnvelope): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.enqueue.run(remoteId, env.workspaceId, hlcToString(env.hlc), env.mutationId, JSON.stringify(env));
  }

  async *drain(remoteId: string): AsyncIterable<MutationEnvelope> {
    const stmts = statementsFor(this.db);
    const iter = stmts.drain.iterate(remoteId);
    for (const row of iter as IterableIterator<{ envelope_json: string }>) {
      yield JSON.parse(row.envelope_json) as MutationEnvelope;
    }
  }

  async ack(remoteId: string, mutationId: string): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.ack.run(remoteId, mutationId);
  }

  async ackAll(remoteId: string, mutationIds: readonly string[]): Promise<void> {
    if (mutationIds.length === 0) return;
    this.ackBatch(remoteId, mutationIds);
  }

  async has(remoteId: string, mutationId: string): Promise<boolean> {
    const stmts = statementsFor(this.db);
    return stmts.has.get(remoteId, mutationId) !== undefined;
  }

  async size(remoteId: string): Promise<number> {
    const stmts = statementsFor(this.db);
    const row = stmts.size.get(remoteId) as { c: number };
    return row.c;
  }
}
