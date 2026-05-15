/**
 * SQLite-backed {@link MutationLog} (Phase A R5 production impl for any
 * Node host — Electron desktop main today, headless daemon / CLI
 * `runOnce` later).
 *
 * Schema (one row per envelope, one shared table across scopes):
 *
 *     CREATE TABLE mutation_log (
 *       scope         TEXT NOT NULL,
 *       hlc_key       TEXT NOT NULL,
 *       mutation_id   TEXT NOT NULL,
 *       envelope_json TEXT NOT NULL,
 *       PRIMARY KEY (scope, hlc_key, mutation_id)
 *     );
 *     CREATE UNIQUE INDEX mutation_log_dedup
 *       ON mutation_log (scope, mutation_id);
 *
 * Design notes:
 *
 *   - **`hlc_key`** is the {@link hlcToString} encoding (lex order ===
 *     HLC numeric order). Range reads collapse to a single
 *     `WHERE scope = ? AND hlc_key > ?` query — same shape as the
 *     IDB impl's `IDBKeyRange.bound`.
 *   - **Dedup** rides the unique index on `(scope, mutation_id)`. Every
 *     append uses `INSERT OR IGNORE`; duplicate `mutationId` is a
 *     silent no-op, matching the in-memory + IDB impls.
 *   - **Multi-append atomicity** uses `better-sqlite3`'s synchronous
 *     `transaction()` wrapper. All-or-nothing per call, exactly as the
 *     interface requires; partial-write recovery is the oracle's
 *     concern (it owns the per-batch lock).
 *   - **better-sqlite3 is synchronous.** The async signatures on the
 *     interface are satisfied trivially — every operation returns a
 *     resolved Promise. This is intentional: the oracle's `withLock`
 *     callback runs sqlite reads/writes directly without await, per
 *     `docs/SYNC_ENGINE_DESIGN.md` §11.1.
 *
 * Hosts open one {@link Database} (typically `<userData>/oracle.db`) and
 * pass it to every per-scope `SqliteMutationLog` / `SqlitePendingIntents`
 * via the `sqliteSyncPersistenceProvider` factory. Closing the database
 * is the host's concern (call on `app.before-quit` / daemon shutdown).
 */

import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';
import type Database from 'better-sqlite3';
import type { MutationLog } from './mutation-log';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS mutation_log (
    scope         TEXT NOT NULL,
    hlc_key       TEXT NOT NULL,
    mutation_id   TEXT NOT NULL,
    envelope_json TEXT NOT NULL,
    PRIMARY KEY (scope, hlc_key, mutation_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS mutation_log_dedup
    ON mutation_log (scope, mutation_id)`,
] as const;

/**
 * Idempotent — safe to call on every open. Used by
 * {@link createSqliteSyncPersistenceProvider} during DB init.
 */
export function ensureMutationLogSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface MutationLogStatements {
  append: Database.Statement<[string, string, string, string]>;
  hasMutation: Database.Statement<[string, string]>;
  readSinceAll: Database.Statement<[string]>;
  readSinceFrom: Database.Statement<[string, string]>;
  truncateBefore: Database.Statement<[string, string]>;
}

function prepareStatements(db: Database.Database): MutationLogStatements {
  return {
    append: db.prepare(
      `INSERT OR IGNORE INTO mutation_log (scope, hlc_key, mutation_id, envelope_json)
       VALUES (?, ?, ?, ?)`,
    ),
    hasMutation: db.prepare(
      `SELECT 1 FROM mutation_log WHERE scope = ? AND mutation_id = ? LIMIT 1`,
    ),
    readSinceAll: db.prepare(
      `SELECT envelope_json FROM mutation_log WHERE scope = ? ORDER BY hlc_key ASC, mutation_id ASC`,
    ),
    readSinceFrom: db.prepare(
      `SELECT envelope_json FROM mutation_log WHERE scope = ? AND hlc_key > ?
       ORDER BY hlc_key ASC, mutation_id ASC`,
    ),
    truncateBefore: db.prepare(
      `DELETE FROM mutation_log WHERE scope = ? AND hlc_key < ?`,
    ),
  };
}

const PREPARED = new WeakMap<Database.Database, MutationLogStatements>();
function statementsFor(db: Database.Database): MutationLogStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

export class SqliteMutationLog implements MutationLog {
  private readonly db: Database.Database;
  private readonly scope: string;
  private readonly appendBatch: (envs: MutationEnvelope[]) => void;

  constructor(db: Database.Database, scope: string) {
    this.db = db;
    this.scope = scope;
    const stmts = statementsFor(db);
    // Pre-bind the transaction wrapper — better-sqlite3 docs recommend
    // constructing transactions once and calling them many times.
    this.appendBatch = db.transaction((envs: MutationEnvelope[]) => {
      for (const env of envs) {
        stmts.append.run(scope, hlcToString(env.hlc), env.mutationId, JSON.stringify(env));
      }
    });
  }

  async append(env: MutationEnvelope): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.append.run(this.scope, hlcToString(env.hlc), env.mutationId, JSON.stringify(env));
  }

  async appendAll(envs: MutationEnvelope[]): Promise<void> {
    if (envs.length === 0) return;
    this.appendBatch(envs);
  }

  async *readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope> {
    const stmts = statementsFor(this.db);
    const iter =
      sinceHlcKey === null
        ? stmts.readSinceAll.iterate(this.scope)
        : stmts.readSinceFrom.iterate(this.scope, sinceHlcKey);
    for (const row of iter as IterableIterator<{ envelope_json: string }>) {
      yield JSON.parse(row.envelope_json) as MutationEnvelope;
    }
  }

  async hasMutation(mutationId: string): Promise<boolean> {
    const stmts = statementsFor(this.db);
    return stmts.hasMutation.get(this.scope, mutationId) !== undefined;
  }

  async truncateBefore(beforeHlcKey: string): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.truncateBefore.run(this.scope, beforeHlcKey);
  }
}
