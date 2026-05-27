/**
 * SQLite-backed {@link PendingIntents} (Phase A R6 production impl for
 * any Node host — Electron desktop main today, headless daemon / CLI
 * `runOnce` later).
 *
 * Schema (one row per `(scope, kind, key)` tuple — coalescing built in):
 *
 *     CREATE TABLE pending_intents (
 *       scope       TEXT NOT NULL,
 *       kind        TEXT NOT NULL,
 *       key         TEXT NOT NULL,
 *       intent_json TEXT NOT NULL,
 *       PRIMARY KEY (scope, kind, key)
 *     );
 *
 * Design notes:
 *
 *   - **Latest-HLC-wins** at the application layer, NOT in SQL. Every
 *     enqueue compares incoming HLC against the existing row's HLC
 *     (decoded from `intent_json`) under the oracle's `withLock`; the
 *     newer intent overwrites the row. This matches the in-memory and
 *     IDB impls exactly. Doing the HLC compare in SQL would mean
 *     pulling a sub-select per write — not worth the contortion for
 *     low-frequency intent traffic.
 *   - **Coalescing** rides the primary key. `INSERT OR REPLACE` after a
 *     successful HLC compare keeps one row per `(scope, kind, key)`.
 *   - **Stable iteration order** for `list()` is `(kind, key)` lex;
 *     matches the in-memory impl.
 */

import { compareHlc, type SideEffectIntent } from '@openheaders/core/sync';
import type Database from 'better-sqlite3';
import type { PendingIntents } from '@openheaders/oracle/sync/pending-intents';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS pending_intents (
    scope       TEXT NOT NULL,
    kind        TEXT NOT NULL,
    key         TEXT NOT NULL,
    intent_json TEXT NOT NULL,
    PRIMARY KEY (scope, kind, key)
  )`,
] as const;

export function ensurePendingIntentsSchema(db: Database.Database): void {
  for (const stmt of SCHEMA_STATEMENTS) db.exec(stmt);
}

interface PendingIntentsStatements {
  selectOne: Database.Statement<[string, string, string]>;
  upsert: Database.Statement<[string, string, string, string]>;
  list: Database.Statement<[string]>;
  deleteOne: Database.Statement<[string, string, string]>;
  clear: Database.Statement<[string]>;
}

function prepareStatements(db: Database.Database): PendingIntentsStatements {
  return {
    selectOne: db.prepare(
      `SELECT intent_json FROM pending_intents WHERE scope = ? AND kind = ? AND key = ? LIMIT 1`,
    ),
    upsert: db.prepare(
      `INSERT OR REPLACE INTO pending_intents (scope, kind, key, intent_json) VALUES (?, ?, ?, ?)`,
    ),
    list: db.prepare(
      `SELECT intent_json FROM pending_intents WHERE scope = ? ORDER BY kind ASC, key ASC`,
    ),
    deleteOne: db.prepare(
      `DELETE FROM pending_intents WHERE scope = ? AND kind = ? AND key = ?`,
    ),
    clear: db.prepare(`DELETE FROM pending_intents WHERE scope = ?`),
  };
}

const PREPARED = new WeakMap<Database.Database, PendingIntentsStatements>();
function statementsFor(db: Database.Database): PendingIntentsStatements {
  let cached = PREPARED.get(db);
  if (!cached) {
    cached = prepareStatements(db);
    PREPARED.set(db, cached);
  }
  return cached;
}

export class SqlitePendingIntents implements PendingIntents {
  private readonly db: Database.Database;
  private readonly scope: string;
  private readonly enqueueBatch: (intents: SideEffectIntent[]) => void;

  constructor(db: Database.Database, scope: string) {
    this.db = db;
    this.scope = scope;
    const stmts = statementsFor(db);
    this.enqueueBatch = db.transaction((intents: SideEffectIntent[]) => {
      for (const intent of intents) {
        const existing = stmts.selectOne.get(scope, intent.kind, intent.key) as
          | { intent_json: string }
          | undefined;
        if (existing) {
          const prior = JSON.parse(existing.intent_json) as SideEffectIntent;
          if (compareHlc(intent.hlc, prior.hlc) <= 0) continue;
        }
        stmts.upsert.run(scope, intent.kind, intent.key, JSON.stringify(intent));
      }
    });
  }

  async enqueue(intent: SideEffectIntent): Promise<void> {
    this.enqueueBatch([intent]);
  }

  async enqueueAll(intents: SideEffectIntent[]): Promise<void> {
    if (intents.length === 0) return;
    this.enqueueBatch(intents);
  }

  async list(): Promise<SideEffectIntent[]> {
    const stmts = statementsFor(this.db);
    const rows = stmts.list.all(this.scope) as Array<{ intent_json: string }>;
    return rows.map((r) => JSON.parse(r.intent_json) as SideEffectIntent);
  }

  async drain(kind: string, key: string): Promise<SideEffectIntent | null> {
    const stmts = statementsFor(this.db);
    const row = stmts.selectOne.get(this.scope, kind, key) as { intent_json: string } | undefined;
    if (!row) return null;
    stmts.deleteOne.run(this.scope, kind, key);
    return JSON.parse(row.intent_json) as SideEffectIntent;
  }

  async clear(): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.clear.run(this.scope);
  }
}
