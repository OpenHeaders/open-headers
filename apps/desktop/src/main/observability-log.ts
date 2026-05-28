/**
 * Observability Log — main-process owner of the structured event ring.
 *
 * Sibling to the extension SW's observability-log module: same {@link LogEntry}
 * shape, same FIFO-with-capacity discipline, same "no telemetry ever leaves
 * the device" contract. Persistence rides the existing `oracle.db` SQLite
 * handle — one extra table, no separate file to manage.
 *
 * Capacity is enforced inline after each insert: if the row count exceeds
 * the capacity, the oldest rows are deleted. Reads return the current ring
 * (oldest first) via a single SELECT.
 *
 * Wired by `install-rpc-host` once the sync persistence handle is open.
 * Subsystem call sites (sync, rules, requests, …) follow in their own
 * slices; this module is the seam.
 */

import type { LogEntry, LogEntryContext } from '@openheaders/core/types';
import type Database from 'better-sqlite3';

const CAPACITY = 500;

const SCHEMA = `CREATE TABLE IF NOT EXISTS observability_log (
  rowid        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp    INTEGER NOT NULL,
  subsystem    TEXT NOT NULL,
  op           TEXT NOT NULL,
  level        TEXT NOT NULL,
  message      TEXT NOT NULL,
  context_json TEXT NOT NULL
)`;

interface Row {
  timestamp: number;
  subsystem: string;
  op: string;
  level: string;
  message: string;
  context_json: string;
}

interface Statements {
  insert: Database.Statement<[number, string, string, string, string, string]>;
  list: Database.Statement<[]>;
  count: Database.Statement<[]>;
  trim: Database.Statement<[number]>;
  clear: Database.Statement<[]>;
}

export interface InstallObservabilityLogOpts {
  db: Database.Database;
  appVersion: string;
  /** Fan-out hook — main calls this on every record/clear so renderers refresh. */
  broadcast: (type: 'observabilityLogUpdated', payload: { size: number }) => void;
}

export interface ObservabilityLogHandle {
  /** Append one entry. Caller provides the feature payload; this module stamps timestamp + app version. */
  record(entry: Omit<LogEntry, 'timestamp'>): void;
  /** Read-only view of the current ring, oldest first. */
  getAll(): LogEntry[];
  /** Drop every entry. */
  clear(): void;
  /** Current row count. */
  size(): number;
}

export function installObservabilityLog(opts: InstallObservabilityLogOpts): ObservabilityLogHandle {
  const { db, appVersion, broadcast } = opts;
  db.exec(SCHEMA);

  const stmts: Statements = {
    insert: db.prepare(
      `INSERT INTO observability_log
         (timestamp, subsystem, op, level, message, context_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ),
    list: db.prepare(
      `SELECT timestamp, subsystem, op, level, message, context_json
       FROM observability_log
       ORDER BY rowid ASC`,
    ),
    count: db.prepare(`SELECT COUNT(*) AS n FROM observability_log`),
    trim: db.prepare(
      `DELETE FROM observability_log
       WHERE rowid IN (
         SELECT rowid FROM observability_log
         ORDER BY rowid ASC
         LIMIT ?
       )`,
    ),
    clear: db.prepare(`DELETE FROM observability_log`),
  };

  function currentCount(): number {
    return (stmts.count.get() as { n: number }).n;
  }

  function record(entry: Omit<LogEntry, 'timestamp'>): void {
    const context: LogEntryContext = {
      ...entry.context,
      extensionVersion: entry.context.extensionVersion ?? appVersion,
    };
    stmts.insert.run(
      Date.now(),
      entry.subsystem,
      entry.op,
      entry.level,
      entry.message,
      JSON.stringify(context),
    );
    const count = currentCount();
    if (count > CAPACITY) {
      stmts.trim.run(count - CAPACITY);
    }
    broadcast('observabilityLogUpdated', { size: Math.min(count, CAPACITY) });
  }

  function getAll(): LogEntry[] {
    const rows = stmts.list.all() as Row[];
    return rows.map((r) => ({
      timestamp: r.timestamp,
      subsystem: r.subsystem as LogEntry['subsystem'],
      op: r.op,
      level: r.level as LogEntry['level'],
      message: r.message,
      context: parseContext(r.context_json),
    }));
  }

  function clear(): void {
    stmts.clear.run();
    broadcast('observabilityLogUpdated', { size: 0 });
  }

  function size(): number {
    return currentCount();
  }

  return { record, getAll, clear, size };
}

function parseContext(json: string): LogEntryContext {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === 'object') return parsed as LogEntryContext;
  } catch {
    // Corrupted row — surface as empty context; the rest of the entry
    // (timestamp/op/message) is still useful for triage.
  }
  return {};
}
