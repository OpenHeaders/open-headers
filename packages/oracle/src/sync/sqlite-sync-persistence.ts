/**
 * SQLite-backed {@link SyncPersistenceProvider} factory — opens one
 * `better-sqlite3` database at the given path, sets WAL + sensible
 * pragmas, and hands out per-scope {@link SqliteMutationLog} /
 * {@link SqlitePendingIntents} that share it.
 *
 * Hosts (Electron desktop main, headless Node daemon, CLI `runOnce`)
 * call this factory once at boot, install the returned provider via
 * `setSyncPersistenceProvider`, and call the returned `close()` on
 * shutdown.
 *
 * Per-scope stores are cached in a Map so the oracle sees the same
 * instance for repeated `createMutationLog(scope)` calls within one
 * provider lifetime — matches the in-memory provider's semantics.
 *
 * Connection lifecycle:
 *
 *   - **Open:** synchronous; `mkdir -p` the directory; ensure schema;
 *     set `journal_mode=WAL` + `synchronous=NORMAL` (durable enough
 *     for a single-writer local oracle, fast enough for typing-speed
 *     mutation streams per `docs/SYNC_ENGINE_DESIGN.md` §6.3).
 *   - **Close:** flushes WAL and closes the database. Idempotent.
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ActivityLog } from './activity-log';
import type { MutationLog } from './mutation-log';
import type { PendingIntents } from './pending-intents';
import type { PendingOutQueue } from './pending-out-queue';
import { ensureActivityLogSchema, SqliteActivityLog } from './sqlite-activity-log';
import { ensureMutationLogSchema, SqliteMutationLog } from './sqlite-mutation-log';
import { ensurePendingIntentsSchema, SqlitePendingIntents } from './sqlite-pending-intents';
import { ensurePendingOutQueueSchema, SqlitePendingOutQueue } from './sqlite-pending-out-queue';
import type { SyncPersistenceProvider } from './sync-persistence-provider';

export interface SqliteSyncPersistenceOptions {
  /** Absolute path to the SQLite database file. */
  dbPath: string;
  /** Optional `verbose` callback; passed straight through to better-sqlite3. */
  verbose?: (message?: unknown, ...rest: unknown[]) => void;
}

export interface SqliteSyncPersistenceHandle extends SyncPersistenceProvider {
  /** Underlying better-sqlite3 handle. Exposed for tests + future schema migrations. */
  db: Database.Database;
  /** Close the database. Idempotent; safe to call from `app.before-quit`. */
  close(): void;
}

export function createSqliteSyncPersistence(
  options: SqliteSyncPersistenceOptions,
): SqliteSyncPersistenceHandle {
  fs.mkdirSync(path.dirname(options.dbPath), { recursive: true });
  const db = new Database(options.dbPath, options.verbose ? { verbose: options.verbose } : undefined);

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  ensureMutationLogSchema(db);
  ensurePendingIntentsSchema(db);
  ensurePendingOutQueueSchema(db);
  ensureActivityLogSchema(db);

  const logs = new Map<string, MutationLog>();
  const intents = new Map<string, PendingIntents>();
  let pendingOut: PendingOutQueue | null = null;
  let activityLog: ActivityLog | null = null;
  let closed = false;

  return {
    db,
    createMutationLog(scope: string): MutationLog {
      let log = logs.get(scope);
      if (!log) {
        log = new SqliteMutationLog(db, scope);
        logs.set(scope, log);
      }
      return log;
    },
    createPendingIntents(scope: string): PendingIntents {
      let store = intents.get(scope);
      if (!store) {
        store = new SqlitePendingIntents(db, scope);
        intents.set(scope, store);
      }
      return store;
    },
    createPendingOutQueue(): PendingOutQueue {
      if (!pendingOut) pendingOut = new SqlitePendingOutQueue(db);
      return pendingOut;
    },
    createActivityLog(): ActivityLog {
      if (!activityLog) activityLog = new SqliteActivityLog(db);
      return activityLog;
    },
    close(): void {
      if (closed) return;
      closed = true;
      try {
        db.close();
      } catch {
        // close() throws on already-closed db; idempotency over loudness.
      }
    },
  };
}
