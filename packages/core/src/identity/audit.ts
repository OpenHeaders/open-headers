/**
 * Audit-emit seam — the resolver calls this on every capability decision
 * (allow or deny). The default sink logs through the shared `logger`;
 * hosts swap in durable sinks via {@link setAuditSink} (extension SW
 * installs the IDB-backed `audit_counters` sink at boot per
 * UNIFIED_ORACLE_MODEL.md §9.5; desktop main installs a SQLite sink in
 * a later slice).
 */

import { logger } from '../utils/logger';
import { getIdentitySnapshot } from './registry';
import type { Capability, CapabilityDecision } from './resolver';

export interface AuditEntryInput {
  actorUserId: string;
  capability: Capability;
  workspaceId?: string;
  decision: CapabilityDecision;
  /**
   * Org the actor is acting under. Optional at the call site so the
   * resolver gate doesn't have to re-derive it — when absent,
   * `emitAuditEntry` resolves the current snapshot's `user.homeOrgId`.
   */
  orgId?: string;
  /** ISO timestamp; injected by callers in tests for determinism. */
  occurredAt?: string;
}

/**
 * Fully-resolved audit entry the sink receives. Callers' optional fields
 * (`orgId`, `occurredAt`) are filled in by {@link emitAuditEntry} so
 * sinks never have to think about defaults.
 */
export interface ResolvedAuditEntry {
  actorUserId: string;
  capability: Capability;
  workspaceId?: string;
  decision: CapabilityDecision;
  orgId: string;
  occurredAt: string;
}

export type AuditSink = (entry: ResolvedAuditEntry) => void;

const defaultSink: AuditSink = (entry) => {
  const verdict = entry.decision.allow ? 'allow' : `deny(${entry.decision.reason ?? 'unspecified'})`;
  const ws = entry.workspaceId ? ` ws=${entry.workspaceId}` : '';
  logger.info('Identity.Audit', `${entry.actorUserId} ${entry.capability} → ${verdict}${ws} (org=${entry.orgId})`);
};

let sink: AuditSink = defaultSink;

export function setAuditSink(next: AuditSink): void {
  sink = next;
}

export function resetAuditSink(): void {
  sink = defaultSink;
}

/**
 * Sentinel orgId stamped on entries emitted before any identity snapshot
 * is installed (boot race, post-wipe). Real orgs use UUIDv7s so the
 * sentinel cannot collide; durable sinks may partition or drop
 * `pre-bootstrap` rows on their own retention policy.
 */
const PRE_BOOTSTRAP_ORG_ID = 'pre-bootstrap';

export function emitAuditEntry(entry: AuditEntryInput): void {
  const snapshot = getIdentitySnapshot();
  const orgId =
    entry.orgId ?? snapshot?.user.homeOrgId ?? PRE_BOOTSTRAP_ORG_ID;
  const occurredAt = entry.occurredAt ?? new Date().toISOString();
  const resolved: ResolvedAuditEntry = {
    actorUserId: entry.actorUserId,
    capability: entry.capability,
    ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
    decision: entry.decision,
    orgId,
    occurredAt,
  };
  sink(resolved);
}
