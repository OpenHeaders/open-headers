/**
 * Audit-log retention sweep — Phase 5 slice 4.
 *
 * Sibling of {@link installActivityPruneScheduler}: a plain hourly
 * `setInterval` on the long-lived host process. Each tick drops every
 * `audit_log` row older than the retention window in one statement
 * (UNIFIED_ORACLE_MODEL.md §9.1 — one knob for all entries regardless
 * of actor type; default 90 days, uncapped upward for compliance
 * deployments).
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type Database from 'better-sqlite3';
import { pruneAuditEntriesBefore } from '../sync/sqlite-audit-log';

const SCOPE = 'AuditPrune';

export const AUDIT_RETENTION_DEFAULT_DAYS = 90;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export interface InstallAuditPruneSchedulerInput {
  db: Database.Database;
  /** Retention window in days; default {@link AUDIT_RETENTION_DEFAULT_DAYS}. */
  retentionDays?: number;
  /** Period override (default = 1 hour). Tests pass smaller values. */
  periodMs?: number;
  /** Optional clock override for tests. */
  now?: () => number;
}

/**
 * Start the recurring sweep. Returns a `stop` handle for host teardown +
 * tests. Calling `stop` is idempotent.
 */
export function installAuditPruneScheduler(input: InstallAuditPruneSchedulerInput): () => void {
  const retentionDays = input.retentionDays ?? AUDIT_RETENTION_DEFAULT_DAYS;
  const periodMs = input.periodMs ?? HOUR_MS;
  const now = input.now ?? (() => Date.now());
  const sweep = (): void => {
    try {
      const beforeIso = new Date(now() - retentionDays * DAY_MS).toISOString();
      const removed = pruneAuditEntriesBefore(input.db, beforeIso);
      if (removed > 0) {
        logger.info(SCOPE, `pruned ${removed} audit row(s) older than ${retentionDays} day(s)`);
      }
    } catch (err) {
      logger.warn(SCOPE, 'audit prune sweep failed', err);
    }
  };
  const timer = setInterval(sweep, periodMs);
  // Node's setInterval keeps the event loop alive; opt out so a quiet
  // process can still exit cleanly under `electron .` + Ctrl-C.
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    (timer as { unref: () => void }).unref();
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}
