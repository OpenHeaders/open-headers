/**
 * Audit-emit seam — the resolver calls this on every capability decision
 * (allow or deny). The default sink logs through the shared `logger`;
 * hosts swap in durable sinks via {@link setAuditSink} (extension SW
 * installs the IDB-backed `audit_counters` sink at boot per
 * the unified-oracle model §9.5; the Node daemon spine installs the
 * SQLite-backed sink for desktop main and the headless daemon).
 */

import type { AuditCapability } from '../types';
import { logger } from '../utils/logger';
import { getIdentitySnapshot } from './registry';
import type { CapabilityDecision } from './resolver';

/**
 * Read-only capabilities. An `allow` on one of these is the high-volume,
 * low-signal case — every hydration query authorizes a read — so the
 * default sink demotes it to `debug`. Denials and mutations stay at
 * `info` so the audit signal survives the default log level.
 */
const READ_ONLY_CAPABILITIES: ReadonlySet<AuditCapability> = new Set<AuditCapability>([
  'workspace.read',
  'workspace.list',
]);

export interface AuditEntryInput {
  actorUserId: string;
  capability: AuditCapability;
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
  capability: AuditCapability;
  workspaceId?: string;
  decision: CapabilityDecision;
  orgId: string;
  occurredAt: string;
}

export type AuditSink = (entry: ResolvedAuditEntry) => void;

const defaultSink: AuditSink = (entry) => {
  const verdict = entry.decision.allow ? 'allow' : `deny(${entry.decision.reason ?? 'unspecified'})`;
  const ws = entry.workspaceId ? ` ws=${entry.workspaceId}` : '';
  const message = `${entry.actorUserId} ${entry.capability} → ${verdict}${ws} (org=${entry.orgId})`;
  const routineRead = entry.decision.allow && READ_ONLY_CAPABILITIES.has(entry.capability);
  if (routineRead) logger.debug('Identity.Audit', message);
  else logger.info('Identity.Audit', message);
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
  const orgId = entry.orgId ?? snapshot?.user.homeOrgId ?? PRE_BOOTSTRAP_ORG_ID;
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
