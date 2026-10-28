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
 *     stamped with the git branch active when they were appended. The
 *     stamp is the WIRE's identity, not the store's. `readSince` — the
 *     read every peer-facing reader (delta stream, state-vector fold,
 *     snapshot threshold) consumes — filters to the trunk plus the
 *     active branch, so a peer of this host is shown one branch's
 *     history and never a sibling's (§6.3 names the log a short-term
 *     reconciliation buffer whose per-branch split keeps a peer's
 *     per-entity HLC order coherent). `readAll` — the boot replay's
 *     read — ignores the stamp: the oracle's store applied every batch
 *     this host committed, on whatever branch HEAD named at the time
 *     (a checkout enters only the tree's delta against the state the
 *     store already held), so the only replay that rebuilds the store
 *     is the whole scope in HLC order. A branch-filtered boot would
 *     omit the previous branch's rows that the current branch's tree
 *     was forked from, and the tree-wins sweep — whose premise is that
 *     the engine state equals the state that produced its baseline —
 *     would then let the materializer rewrite the working tree from a
 *     state the host never held. `''` is the branchless trunk (unbound
 *     workspaces, and every row appended before a binding existed):
 *     trunk rows precede any branch-stamped row and are visible from
 *     every branch. Dedup stays scope-global (`mutationId` is minted
 *     fresh per branch — checkout/merge enter as virtual batches with
 *     new ids, so a cross-branch collision is the same envelope).
 *     Compaction, when it is designed, must be scope-wide or
 *     checkpoint-based: a branch-local truncate would remove rows the
 *     boot replay needs. The pointer flips via
 *     {@link SqliteMutationLog.setActiveBranch}, called by the
 *     workspace-tree runtime at bind-open and on every checkout; the
 *     boot state does not depend on when it flips.
 *
 * Design notes:
 *
 *   - **`hlc_key`** is the {@link hlcToString} encoding (lex order ===
 *     HLC numeric order). An ordered read is a keyset walk over the
 *     primary key: `WHERE scope = ? AND (hlc_key, mutation_id) > (?, ?)
 *     ORDER BY hlc_key, mutation_id LIMIT n`, one index search per
 *     page. `since` becomes the cursor `(since, '~')` — every mutation
 *     id sorts below the tilde, so it is exactly `hlc_key > since`, the
 *     IDB impl's own upper sentinel.
 *   - **No statement is ever open across a `yield`.** better-sqlite3
 *     refuses every write on the connection while any statement
 *     iterates ("This database connection is busy executing a query"),
 *     and the reads here are consumed by async generators whose
 *     consumer suspends between rows: the handshake responder's
 *     threshold count and delta walk run while a peer's reconnect flush
 *     and this host's own edits apply on the same handle, and an
 *     `appendAll` or an audit append that lands during an open walk
 *     throws and is lost. So `readSince` / `readAll` page by keyset —
 *     each page one synchronous `all()` of {@link MUTATION_LOG_PAGE_SIZE}
 *     rows, the statement finished before the first row is yielded,
 *     the next page fetched from the last `(hlc_key, mutation_id)` the
 *     consumer saw. The law for every reader of the shared handle:
 *     materialize before yielding to caller code — the pending-out
 *     drain's one `all()` and these pages are two instances of it. A
 *     row that lands above the cursor during a walk is streamed by a
 *     later page; a peer that also receives it through the live fan-out
 *     absorbs the duplicate at its durable `mutationId` dedup. A row
 *     that lands below the cursor (a flushed envelope carrying its
 *     sender's offline HLC) is not streamed back, and need not be: the
 *     sender holds it, and the vector folded after the walk covers it.
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

/** One row of a keyset page: the envelope plus the cursor columns the next page starts above. */
interface PageRow {
  envelope_json: string;
  hlc_key: string;
  mutation_id: string;
}

interface MutationLogStatements {
  append: Database.Statement<[string, string, string, string, string, string]>;
  hasMutation: Database.Statement<[string, string]>;
  knownMutationIds: Database.Statement<[string, string]>;
  readSincePage: Database.Statement<[string, string, string, string, number], PageRow>;
  readAllPage: Database.Statement<[string, string, string, number], PageRow>;
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
    // One probe of the dedup index per batch: the ids ride in as a JSON
    // array so the statement's arity never varies with the batch size.
    knownMutationIds: db.prepare(
      `SELECT mutation_id FROM mutation_log
       WHERE scope = ? AND mutation_id IN (SELECT value FROM json_each(?))`,
    ),
    // One keyset page of the wire's read: the branchless trunk plus the
    // active branch — never a sibling branch's rows (§6.3 HLC-coherence
    // law) — above the `(hlc_key, mutation_id)` cursor.
    readSincePage: db.prepare(
      `SELECT envelope_json, hlc_key, mutation_id FROM mutation_log
       WHERE scope = ? AND branch IN ('', ?) AND (hlc_key, mutation_id) > (?, ?)
       ORDER BY hlc_key ASC, mutation_id ASC LIMIT ?`,
    ),
    // One keyset page of the boot replay's read: the whole scope in
    // stored order — every branch's rows, because the store applied
    // every one of them.
    readAllPage: db.prepare(
      `SELECT envelope_json, hlc_key, mutation_id FROM mutation_log
       WHERE scope = ? AND (hlc_key, mutation_id) > (?, ?)
       ORDER BY hlc_key ASC, mutation_id ASC LIMIT ?`,
    ),
    // Compaction is branch-local: a watermark computed while on branch
    // A must never drop rows another branch still needs; trunk rows
    // compact only while the pointer itself is the trunk.
    truncateBefore: db.prepare(`DELETE FROM mutation_log WHERE scope = ? AND branch = ? AND hlc_key < ?`),
    purgeOrgSelect: db.prepare(`SELECT mutation_id FROM mutation_log WHERE scope = ? AND org_id = ?`),
    purgeOrgDelete: db.prepare(`DELETE FROM mutation_log WHERE scope = ? AND org_id = ?`),
  };
}

/**
 * Rows per page of an ordered read. Each page is one synchronous
 * `all()`, so this bounds both the memory a walk holds between yields
 * and the length of the statement's run on the shared handle.
 */
export const MUTATION_LOG_PAGE_SIZE = 500;

/**
 * The keyset cursor's `mutation_id` for the first page above a
 * `since` key: every mutation id sorts below it, so `(since, '~')`
 * admits exactly the rows whose `hlc_key` exceeds `since`.
 */
const CURSOR_ABOVE_ANY_ID = '~';

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

  readSince(sinceHlcKey: string | null): AsyncIterable<MutationEnvelope> {
    const stmts = statementsFor(this.db);
    return this.walk(sinceHlcKey, (hlcKey, mutationId) =>
      stmts.readSincePage.all(this.scope, this.branch, hlcKey, mutationId, MUTATION_LOG_PAGE_SIZE),
    );
  }

  readAll(): AsyncIterable<MutationEnvelope> {
    const stmts = statementsFor(this.db);
    return this.walk(null, (hlcKey, mutationId) =>
      stmts.readAllPage.all(this.scope, hlcKey, mutationId, MUTATION_LOG_PAGE_SIZE),
    );
  }

  // The keyset walk (the header): a page is fetched whole, its
  // statement finished, before any row of it is yielded; the next page
  // starts above the last row the consumer saw. A short page ends the
  // walk.
  private async *walk(
    sinceHlcKey: string | null,
    page: (hlcKey: string, mutationId: string) => PageRow[],
  ): AsyncIterable<MutationEnvelope> {
    let hlcKey = sinceHlcKey ?? '';
    let mutationId = sinceHlcKey === null ? '' : CURSOR_ABOVE_ANY_ID;
    for (;;) {
      const rows = page(hlcKey, mutationId);
      for (const row of rows) {
        yield JSON.parse(row.envelope_json) as MutationEnvelope;
      }
      if (rows.length < MUTATION_LOG_PAGE_SIZE) return;
      const last = rows[rows.length - 1];
      hlcKey = last.hlc_key;
      mutationId = last.mutation_id;
    }
  }

  async hasMutation(mutationId: string): Promise<boolean> {
    const stmts = statementsFor(this.db);
    return stmts.hasMutation.get(this.scope, mutationId) !== undefined;
  }

  async knownMutationIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    if (ids.length === 0) return new Set();
    const stmts = statementsFor(this.db);
    const rows = stmts.knownMutationIds.all(this.scope, JSON.stringify(ids)) as Array<{ mutation_id: string }>;
    return new Set(rows.map((row) => row.mutation_id));
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
