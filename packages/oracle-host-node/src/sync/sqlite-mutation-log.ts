/**
 * SQLite-backed {@link MutationLog} (Phase A R5 production impl for any
 * Node host — Electron desktop main today, headless daemon / CLI
 * `runOnce` later).
 *
 * Schema (one row per envelope, one shared table across scopes):
 *
 *     CREATE TABLE mutation_log (
 *       scope         TEXT NOT NULL,
 *       org_id        TEXT NOT NULL,
 *       branch        TEXT NOT NULL DEFAULT '',
 *       hlc_key       TEXT NOT NULL,
 *       mutation_id   TEXT NOT NULL,
 *       envelope_json TEXT NOT NULL,
 *       PRIMARY KEY (scope, hlc_key, mutation_id)
 *     );
 *     CREATE UNIQUE INDEX mutation_log_dedup
 *       ON mutation_log (scope, mutation_id);
 *     CREATE INDEX mutation_log_workspace_org
 *       ON mutation_log (scope, org_id);
 *     CREATE INDEX mutation_log_branch
 *       ON mutation_log (scope, branch, hlc_key);
 *
 *   - **`org_id`** is denormalized per the unified-oracle model §8.2 so
 *     transport filters can run `WHERE org_id IN (authorized set)`
 *     without unpacking each envelope blob (U2.7-U2.9). V5 launched
 *     fresh with zero prior users; no backfill code path because
 *     there is no pre-v5 data.
 *   - **`branch`** is the per-branch log of the data-plane topologies design
 *     §6.3 (the git-sync plan Phase 6): a tree-bound workspace's rows are
 *     stamped with the git branch active when they were appended, and
 *     ordered reads filter to the active branch — two branches can
 *     legitimately hold different histories for the same entity, and
 *     interleaving them would corrupt per-entity HLC ordering. `''` is
 *     the branchless trunk (unbound workspaces, and every row appended
 *     before a binding existed): trunk rows precede any branch-stamped
 *     row and are visible from every branch. Dedup stays scope-global
 *     (`mutationId` is minted fresh per branch — checkout/merge enter
 *     as virtual batches with new ids, so a cross-branch collision is
 *     the same envelope). The pointer flips via
 *     {@link SqliteMutationLog.setActiveBranch}, called by the
 *     workspace-tree runtime at bind-open and on every checkout.
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
 *     the sync-engine design §11.1.
 *
 * Hosts open one {@link Database} (typically `<userData>/oracle.db`) and
 * pass it to every per-scope `SqliteMutationLog` / `SqlitePendingIntents`
 * via the `sqliteSyncPersistenceProvider` factory. Closing the database
 * is the host's concern (call on `app.before-quit` / daemon shutdown).
 */

import { hlcToString, type MutationEnvelope } from '@openheaders/core/sync';
import type { MutationLog } from '@openheaders/oracle/sync/mutation-log';
import type Database from 'better-sqlite3';

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS mutation_log (
    scope         TEXT NOT NULL,
    org_id        TEXT NOT NULL,
    branch        TEXT NOT NULL DEFAULT '',
    hlc_key       TEXT NOT NULL,
    mutation_id   TEXT NOT NULL,
    envelope_json TEXT NOT NULL,
    PRIMARY KEY (scope, hlc_key, mutation_id)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS mutation_log_dedup
    ON mutation_log (scope, mutation_id)`,
  `CREATE INDEX IF NOT EXISTS mutation_log_workspace_org
    ON mutation_log (scope, org_id)`,
  `CREATE INDEX IF NOT EXISTS mutation_log_branch
    ON mutation_log (scope, branch, hlc_key)`,
] as const;

/**
 * Idempotent — safe to call on every open. Used by
 * {@link createSqliteSyncPersistenceProvider} during DB init. A table
 * created before the Phase 6 per-branch column gains it in place
 * (existing rows become `''` trunk rows — visible from every branch,
 * which is exactly what pre-branch history is).
 */
export function ensureMutationLogSchema(db: Database.Database): void {
  db.exec(SCHEMA_STATEMENTS[0]);
  const columns = db.pragma('table_info(mutation_log)') as Array<{ name: string }>;
  if (!columns.some((column) => column.name === 'branch')) {
    db.exec(`ALTER TABLE mutation_log ADD COLUMN branch TEXT NOT NULL DEFAULT ''`);
  }
  for (const stmt of SCHEMA_STATEMENTS.slice(1)) db.exec(stmt);
}

/**
 * The per-branch surface a git-hosting runtime needs beyond
 * {@link MutationLog} (the data-plane topologies design §6.3). Only the SQLite
 * log implements it — extension/in-memory logs have no git plane.
 */
export interface BranchScopedMutationLog extends MutationLog {
  /** Flip the active-branch pointer; `''` is the branchless trunk. */
  setActiveBranch(branch: string): void;
}

/** Whether a log supports the §6.3 per-branch pointer. */
export function supportsBranchScope(log: MutationLog): log is BranchScopedMutationLog {
  return typeof (log as Partial<BranchScopedMutationLog>).setActiveBranch === 'function';
}

interface MutationLogStatements {
  append: Database.Statement<[string, string, string, string, string, string]>;
  hasMutation: Database.Statement<[string, string]>;
  readSinceAll: Database.Statement<[string, string]>;
  readSinceFrom: Database.Statement<[string, string, string]>;
  truncateBefore: Database.Statement<[string, string, string]>;
  purgeOrgSelect: Database.Statement<[string, string]>;
  purgeOrgDelete: Database.Statement<[string, string]>;
}

function prepareStatements(db: Database.Database): MutationLogStatements {
  return {
    append: db.prepare(
      `INSERT OR IGNORE INTO mutation_log (scope, org_id, branch, hlc_key, mutation_id, envelope_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    hasMutation: db.prepare(`SELECT 1 FROM mutation_log WHERE scope = ? AND mutation_id = ? LIMIT 1`),
    // Ordered reads see the branchless trunk plus the active branch —
    // never a sibling branch's rows (§6.3 HLC-coherence law).
    readSinceAll: db.prepare(
      `SELECT envelope_json FROM mutation_log WHERE scope = ? AND branch IN ('', ?)
       ORDER BY hlc_key ASC, mutation_id ASC`,
    ),
    readSinceFrom: db.prepare(
      `SELECT envelope_json FROM mutation_log WHERE scope = ? AND branch IN ('', ?) AND hlc_key > ?
       ORDER BY hlc_key ASC, mutation_id ASC`,
    ),
    // Compaction is branch-local: a watermark computed while on branch
    // A must never drop rows another branch still needs; trunk rows
    // compact only while the pointer itself is the trunk.
    truncateBefore: db.prepare(`DELETE FROM mutation_log WHERE scope = ? AND branch = ? AND hlc_key < ?`),
    purgeOrgSelect: db.prepare(`SELECT mutation_id FROM mutation_log WHERE scope = ? AND org_id = ?`),
    purgeOrgDelete: db.prepare(`DELETE FROM mutation_log WHERE scope = ? AND org_id = ?`),
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

export class SqliteMutationLog implements BranchScopedMutationLog {
  private readonly db: Database.Database;
  private readonly scope: string;
  private readonly appendBatch: (envs: MutationEnvelope[]) => void;
  /** §6.3 active-branch pointer; `''` = branchless trunk. */
  private branch = '';

  constructor(db: Database.Database, scope: string) {
    this.db = db;
    this.scope = scope;
    const stmts = statementsFor(db);
    // Pre-bind the transaction wrapper — better-sqlite3 docs recommend
    // constructing transactions once and calling them many times.
    this.appendBatch = db.transaction((envs: MutationEnvelope[]) => {
      for (const env of envs) {
        stmts.append.run(scope, env.orgId, this.branch, hlcToString(env.hlc), env.mutationId, JSON.stringify(env));
      }
    });
  }

  setActiveBranch(branch: string): void {
    this.branch = branch;
  }

  async append(env: MutationEnvelope): Promise<void> {
    const stmts = statementsFor(this.db);
    stmts.append.run(this.scope, env.orgId, this.branch, hlcToString(env.hlc), env.mutationId, JSON.stringify(env));
  }

  async appendAll(envs: MutationEnvelope[]): Promise<void> {
    if (envs.length === 0) return;
    this.appendBatch(envs);
  }

  async *readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope> {
    const stmts = statementsFor(this.db);
    const iter =
      sinceHlcKey === null
        ? stmts.readSinceAll.iterate(this.scope, this.branch)
        : stmts.readSinceFrom.iterate(this.scope, this.branch, sinceHlcKey);
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
    stmts.truncateBefore.run(this.scope, this.branch, beforeHlcKey);
  }

  async purgeOrg(orgId: string): Promise<string[]> {
    const stmts = statementsFor(this.db);
    const rows = stmts.purgeOrgSelect.all(this.scope, orgId) as Array<{ mutation_id: string }>;
    stmts.purgeOrgDelete.run(this.scope, orgId);
    return rows.map((row) => row.mutation_id);
  }
}
