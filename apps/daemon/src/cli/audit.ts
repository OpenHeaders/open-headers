/**
 * `ohd audit list / export` — Phase 5 slice 4's report surface
 * over the daemon's SQLite audit log.
 *
 * This module is the ONE piece of the CLI that reaches better-sqlite3,
 * so `cli.ts` loads it via dynamic import: it becomes its own build
 * chunk and the entry bundle stays sqlite-free by construction (same
 * boundary as "the engine lives behind dist/main.js"). Reads open
 * `oracle.db` read-only — WAL admits concurrent readers, so reporting
 * against a RUNNING daemon is safe; the gates flush each row as it's
 * appended. The sqlite-free halves (flag parsing, filter building,
 * formatting) live in `audit-format.ts`.
 *
 * `list` renders display names at view time by resolving each row's
 * immutable `actorUserId` through the current directory record
 * (the unified-oracle model §9.3); ids without a directory row (the
 * daemon operator's synthetic user, deleted rows) print verbatim.
 * `export` emits the raw `AuditLogEntry` rows as JSONL, oldest-first.
 */

import { parseArgs } from 'node:util';
import { queryAuditEntries } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import Database from 'better-sqlite3';
import { buildFilter, formatLine, LIST_DEFAULT_LIMIT, resolveAuditDbPath } from './audit-format';
import { CONFIG_OPTIONS, resolveConfigFlags } from './config-flags';
import { listUsers } from './users';

const AUDIT_OPTIONS = {
  ...CONFIG_OPTIONS,
  actor: { type: 'string' },
  capability: { type: 'string' },
  decision: { type: 'string' },
  workspace: { type: 'string' },
  since: { type: 'string' },
  until: { type: 'string' },
  limit: { type: 'string' },
} as const;

export async function commandAudit(argv: readonly string[]): Promise<void> {
  const [sub, ...rest] = argv;
  const { values } = parseArgs({ args: [...rest], options: AUDIT_OPTIONS });
  const config = resolveConfigFlags(values);
  if (sub === 'list') {
    const filter = await buildFilter(config, values, 'desc');
    if (filter.limit === undefined) filter.limit = LIST_DEFAULT_LIMIT;
    const db = new Database(resolveAuditDbPath(config), { readonly: true, fileMustExist: true });
    try {
      const entries = queryAuditEntries(db, filter);
      if (entries.length === 0) {
        console.log('No audit rows match.');
        return;
      }
      // §9.3 display-at-view-time — resolve the immutable actor ids
      // through the CURRENT directory records.
      const displayNameByUserId = new Map<string, string>();
      for (const record of await listUsers(config)) {
        displayNameByUserId.set(record.user.id, record.user.displayName);
      }
      for (const entry of entries) {
        console.log(formatLine(entry, displayNameByUserId));
      }
      if (entries.length === filter.limit) {
        console.log(`(showing newest ${filter.limit} — raise with --limit, or filter with --since/--actor)`);
      }
    } finally {
      db.close();
    }
    return;
  }
  if (sub === 'export') {
    const filter = await buildFilter(config, values, 'asc');
    const db = new Database(resolveAuditDbPath(config), { readonly: true, fileMustExist: true });
    try {
      for (const entry of queryAuditEntries(db, filter)) {
        console.log(JSON.stringify(entry));
      }
    } finally {
      db.close();
    }
    return;
  }
  throw new Error('usage: ohd audit <list|export>');
}
