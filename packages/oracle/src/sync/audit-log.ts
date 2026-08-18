/**
 * `AuditLog` — durable record of every capability decision the resolver
 * emits. Per the unified-oracle model §9.1 entries are retained for a
 * single configurable window (default 90 days) regardless of actor
 * type; per §9.5 ids are gapless within Org via a per-Org sequence
 * counter committed inside the same transaction as the entry insert.
 *
 * The interface stays host-neutral; the IDB / SQLite implementations
 * live alongside the other persistence shims in this directory.
 */

import type { AuditLogEntry } from '@openheaders/core/types';

export interface AuditLogAppendInput {
  /** Required — every entry must carry a real or synthetic Org binding. */
  orgId: string;
  actorUserId: string;
  capability: AuditLogEntry['capability'];
  workspaceId?: string;
  decision: AuditLogEntry['decision'];
  /** ISO timestamp; injected by callers for determinism in tests. */
  occurredAt: string;
}

export interface AuditLogListOptions {
  /** Cap on entries returned; default = unbounded. */
  limit?: number;
  /** Only entries with `seq > sinceSeq` (forward cursor). */
  sinceSeq?: number;
}

export interface AuditLog {
  /**
   * Append one entry. Implementations mint `seq` from a per-`orgId`
   * counter inside the storage transaction so concurrent writers don't
   * race on duplicate sequence numbers.
   */
  append(input: AuditLogAppendInput): Promise<AuditLogEntry>;

  /** List entries for one Org, newest-first. */
  list(orgId: string, opts?: AuditLogListOptions): Promise<AuditLogEntry[]>;

  /** Drop entries with `occurredAt < beforeIso`. Returns the removed count. */
  prune(orgId: string, beforeIso: string): Promise<number>;
}

/**
 * In-memory `AuditLog`. Default for the desktop main process today and
 * for unit tests; the extension SW installs the IDB-backed
 * implementation at boot.
 */
export class InMemoryAuditLog implements AuditLog {
  private readonly entries: AuditLogEntry[] = [];
  private readonly counters = new Map<string, number>();

  async append(input: AuditLogAppendInput): Promise<AuditLogEntry> {
    const next = (this.counters.get(input.orgId) ?? 0) + 1;
    this.counters.set(input.orgId, next);
    const entry: AuditLogEntry = {
      id: `${input.orgId}:${next}`,
      orgId: input.orgId,
      seq: next,
      actorUserId: input.actorUserId,
      capability: input.capability,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      decision: input.decision,
      occurredAt: input.occurredAt,
    };
    this.entries.push(entry);
    return entry;
  }

  async list(orgId: string, opts: AuditLogListOptions = {}): Promise<AuditLogEntry[]> {
    let rows = this.entries.filter((e) => e.orgId === orgId);
    if (opts.sinceSeq !== undefined) {
      const cutoff = opts.sinceSeq;
      rows = rows.filter((e) => e.seq > cutoff);
    }
    rows.sort((a, b) => b.seq - a.seq);
    if (opts.limit !== undefined) rows = rows.slice(0, Math.max(0, opts.limit));
    return rows;
  }

  async prune(orgId: string, beforeIso: string): Promise<number> {
    let removed = 0;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (entry.orgId === orgId && entry.occurredAt < beforeIso) {
        this.entries.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }
}
