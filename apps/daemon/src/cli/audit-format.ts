/**
 * Sqlite-free half of `oh daemon audit` — flag parsing, filter
 * building (including the §9.3 actor-email resolution against the
 * directory), row formatting, and the never-booted refusal. Split from
 * `audit.ts` so these paths stay testable under plain Node: only the
 * lazily-loaded `audit.ts` chunk touches better-sqlite3.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AuditLogEntry } from '@openheaders/core/types';
import type { AuditQueryFilter } from '@openheaders/oracle-host-node/sync/sqlite-audit-log';
import type { DaemonConfig } from '../config';
import { resolveDirectoryUser } from './users';

export const LIST_DEFAULT_LIMIT = 50;

/**
 * A time bound: ISO 8601 (`2026-07-01`, `2026-07-01T12:00:00Z`) or
 * relative to now (`30m`, `24h`, `7d`).
 */
export function parseTimeBound(raw: string, flag: string): string {
  const relative = /^(\d+)([mhd])$/.exec(raw.trim());
  if (relative) {
    const amount = Number(relative[1]);
    const unitMs = relative[2] === 'm' ? 60_000 : relative[2] === 'h' ? 3_600_000 : 86_400_000;
    return new Date(Date.now() - amount * unitMs).toISOString();
  }
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--${flag} must be an ISO date/time or relative (e.g. 30m, 24h, 7d), got '${raw}'`);
  }
  return parsed.toISOString();
}

function parseLimit(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--limit must be a positive integer, got '${raw}'`);
  }
  return parsed;
}

export interface AuditFlagValues {
  actor?: string;
  capability?: string;
  decision?: string;
  workspace?: string;
  since?: string;
  until?: string;
  limit?: string;
}

export async function buildFilter(
  config: DaemonConfig,
  values: AuditFlagValues,
  order: 'asc' | 'desc',
): Promise<AuditQueryFilter> {
  const filter: AuditQueryFilter = { order };
  if (values.actor !== undefined) {
    // Accept an email for ergonomics; the table stores only user ids.
    const record = await resolveDirectoryUser(config, values.actor);
    filter.actorUserId = record.user.id;
  }
  if (values.capability !== undefined) filter.capability = values.capability;
  if (values.decision !== undefined) {
    if (values.decision !== 'allow' && values.decision !== 'deny') {
      throw new Error(`--decision must be 'allow' or 'deny', got '${values.decision}'`);
    }
    filter.allow = values.decision === 'allow';
  }
  if (values.workspace !== undefined) filter.workspaceId = values.workspace;
  if (values.since !== undefined) filter.sinceIso = parseTimeBound(values.since, 'since');
  if (values.until !== undefined) filter.untilIso = parseTimeBound(values.until, 'until');
  if (values.limit !== undefined) filter.limit = parseLimit(values.limit);
  return filter;
}

/** The audit database's path, refusing a data dir the daemon never booted against. */
export function resolveAuditDbPath(config: DaemonConfig): string {
  const dbPath = path.join(config.dataDir, 'oracle.db');
  if (!fs.existsSync(dbPath)) {
    throw new Error(
      `no oracle.db in ${config.dataDir} — the daemon has never booted against this data dir, so there is no audit log.`,
    );
  }
  return dbPath;
}

function formatDecision(entry: AuditLogEntry): string {
  // `daemon.admission` rows are the HELLO gate's per-connect stamps —
  // label them as admissions, not enforcement decisions. The
  // `daemon.sso-*` rows are the claims→grant mapping's applied changes.
  if (entry.capability === 'daemon.admission') {
    return entry.decision.allow ? 'admission' : `admission-refused(${entry.decision.reason ?? 'unspecified'})`;
  }
  if (entry.capability === 'daemon.sso-grant') return 'sso-grant';
  if (entry.capability === 'daemon.sso-revoke') return 'sso-revoke';
  return entry.decision.allow ? 'allow' : `deny(${entry.decision.reason ?? 'unspecified'})`;
}

export function formatLine(entry: AuditLogEntry, displayNameByUserId: ReadonlyMap<string, string>): string {
  const actorName = displayNameByUserId.get(entry.actorUserId);
  const actor = actorName !== undefined ? `${actorName} (${entry.actorUserId})` : entry.actorUserId;
  const ws = entry.workspaceId !== undefined ? `  ws=${entry.workspaceId}` : '';
  return `${entry.occurredAt}  ${formatDecision(entry)}  ${entry.capability}${ws}  ${actor}`;
}
