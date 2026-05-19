/**
 * Audit-emit stub — the resolver calls this on every capability decision
 * (allow or deny). The implementation is intentionally minimal in slice 1
 * of Phase U2; U2.4 lands the durable `audit_counters`-keyed IDB object
 * store (UNIFIED_ORACLE_MODEL.md §9.5).
 *
 * Hosts can swap the sink via `setAuditSink` — desktop main installs a
 * SQLite-backed sink in a later slice; the extension SW installs an IDB
 * sink. Until then, the default sink logs through the shared `logger` so
 * forensic traces aren't silently dropped.
 */

import { logger } from '../utils/logger';
import type { Capability, CapabilityDecision } from './resolver';

export interface AuditEntryInput {
  actorUserId: string;
  capability: Capability;
  workspaceId?: string;
  decision: CapabilityDecision;
  /** ISO timestamp; injected by callers in tests for determinism. */
  now?: string;
}

export type AuditSink = (entry: AuditEntryInput) => void;

const defaultSink: AuditSink = (entry) => {
  const verdict = entry.decision.allow ? 'allow' : `deny(${entry.decision.reason ?? 'unspecified'})`;
  const ws = entry.workspaceId ? ` ws=${entry.workspaceId}` : '';
  logger.info('Identity.Audit', `${entry.actorUserId} ${entry.capability} → ${verdict}${ws}`);
};

let sink: AuditSink = defaultSink;

export function setAuditSink(next: AuditSink): void {
  sink = next;
}

export function resetAuditSink(): void {
  sink = defaultSink;
}

export function emitAuditEntry(entry: AuditEntryInput): void {
  sink(entry);
}
