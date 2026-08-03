/**
 * `TrafficRetentionRing` — one armed source's bounded in-memory record
 * ring (AGENT_TRAFFIC_PLAN.md §3). Host-neutral: no node deps, no
 * chrome deps; the tap in `oracle-host-node` feeds it and any future
 * host (browser-extension surfaces included) can reuse it as-is.
 *
 * Laws the ring owns (unit-pinned in
 * `tests/traffic-retention/store.test.ts`):
 *
 *   - Bounded by BOTH count and bytes; whichever ceiling trips first
 *     evicts. Byte accounting tracks record GROWTH too — a patch or HAR
 *     fact that fattens a record can itself trigger eviction.
 *   - Eviction is FIFO by admission order. An in-place update never
 *     moves a record to the tail (`Map.set` on an existing key keeps
 *     the original position), so "oldest admitted" stays honest.
 *   - Eviction is monotonic: an evicted identity is remembered and a
 *     later replay of the same identity is refused, never resurrected —
 *     otherwise every reconnect replay would resurrect history the
 *     bounds already dropped, and the ring would never converge.
 *   - A single record larger than the whole byte ceiling is refused
 *     outright (counted as evicted) rather than admitted over budget.
 *   - Reads are projections only; the retained record type never
 *     crosses this boundary.
 */

import type { TrafficRecordProjection, TrafficRetentionStats } from '@openheaders/core/traffic';
import type { InspectorHarBody } from '@openheaders/core/types';

import { captureBody } from './body';
import {
  isFailureRecord,
  measureRecordBytes,
  type ProjectRecordOptions,
  projectRecord,
  type RetainedTrafficRecord,
  recordKey,
} from './record';

export interface TrafficRetentionBounds {
  readonly maxRecords: number;
  readonly maxBytes: number;
}

/** Lifecycle records are a few KB with headers — the defaults hold
 *  thousands of exchanges in single-digit MB, per PLAN §3 sizing. */
export const DEFAULT_TRAFFIC_RETENTION_BOUNDS: TrafficRetentionBounds = {
  maxRecords: 2_000,
  maxBytes: 8 * 1024 * 1024,
};

/** Evicted-identity memory cap, as a multiple of `maxRecords`. Bounded
 *  so the dedup memory cannot itself grow without limit; pruned FIFO. */
const EVICTED_KEYS_FACTOR = 4;

interface LiveEntry {
  record: RetainedTrafficRecord;
  bytes: number;
}

export class TrafficRetentionRing {
  private readonly bounds: TrafficRetentionBounds;
  /** Insertion order IS the FIFO order. */
  private readonly live = new Map<string, LiveEntry>();
  /** Identities the bounds already dropped — replay must not resurrect. */
  private readonly evictedKeys = new Set<string>();
  private byteSize = 0;
  private evictedCount = 0;

  constructor(bounds: TrafficRetentionBounds = DEFAULT_TRAFFIC_RETENTION_BOUNDS) {
    this.bounds = bounds;
  }

  /**
   * Admit or refresh one record. A key already live is updated IN PLACE
   * (replay reconciliation — never a duplicate, never a FIFO re-order);
   * a key the ring evicted is refused. Returns what happened so the
   * consumer can keep honest counters.
   */
  upsert(record: RetainedTrafficRecord): 'admitted' | 'updated' | 'refused-evicted' | 'refused-oversize' {
    const key = recordKey(record.tabId, record.requestId);
    const existing = this.live.get(key);
    if (existing !== undefined) {
      // Replay reconciliation replaces the record object wholesale —
      // the carve-out body and its request stamp must survive it, or a
      // wire flap silently drops every eagerly-captured failure body.
      if (existing.record.failureBody !== undefined && record.failureBody === undefined) {
        record.failureBody = existing.record.failureBody;
      }
      if (existing.record.failureBodyRequested === true) record.failureBodyRequested = true;
      const bytes = measureRecordBytes(record);
      this.byteSize += bytes - existing.bytes;
      existing.record = record;
      existing.bytes = bytes;
      this.evictOverflow();
      return 'updated';
    }
    if (this.evictedKeys.has(key)) return 'refused-evicted';
    const bytes = measureRecordBytes(record);
    if (bytes > this.bounds.maxBytes) {
      this.rememberEvicted(key);
      this.evictedCount++;
      return 'refused-oversize';
    }
    this.live.set(key, { record, bytes });
    this.byteSize += bytes;
    this.evictOverflow();
    return this.live.has(key) ? 'admitted' : 'refused-oversize';
  }

  /** Mutate a live record in place; a non-live key (evicted, pre-arm,
   *  never admitted) is silently ignored — refinements never resurrect.
   *  Returns whether a live record was actually mutated, so the
   *  consumer's admission seam only fires for retained identities. */
  update(tabId: number, requestId: string, mutate: (record: RetainedTrafficRecord) => void): boolean {
    const entry = this.live.get(recordKey(tabId, requestId));
    if (entry === undefined) return false;
    mutate(entry.record);
    const bytes = measureRecordBytes(entry.record);
    this.byteSize += bytes - entry.bytes;
    entry.bytes = bytes;
    this.evictOverflow();
    return true;
  }

  /** Whether the identity is currently retained. */
  has(tabId: number, requestId: string): boolean {
    return this.live.has(recordKey(tabId, requestId));
  }

  /**
   * Retain one eagerly-pulled failure body (PLAN §3 carve-out). Guarded
   * three ways: the record must be live, must classify as a failure, and
   * must carry the consumer's `failureBodyRequested` stamp — a body the
   * retention plane never asked for is not retained, whoever pulled it.
   * The capped body counts against the byte ceiling like any growth.
   */
  attachFailureBody(tabId: number, requestId: string, body: InspectorHarBody): boolean {
    const entry = this.live.get(recordKey(tabId, requestId));
    if (entry === undefined) return false;
    const record = entry.record;
    if (record.failureBodyRequested !== true || record.failureBody !== undefined || !isFailureRecord(record)) {
      return false;
    }
    record.failureBody = captureBody(body);
    const bytes = measureRecordBytes(record);
    this.byteSize += bytes - entry.bytes;
    entry.bytes = bytes;
    this.evictOverflow();
    return true;
  }

  /** Project one retained record, or null when the identity is not
   *  live. Same options contract as {@link snapshot}. */
  projectOne(tabId: number, requestId: string, options?: ProjectRecordOptions): TrafficRecordProjection | null {
    const entry = this.live.get(recordKey(tabId, requestId));
    return entry === undefined ? null : projectRecord(entry.record, options);
  }

  /** Projected records, FIFO order (oldest admitted first). Redacted by
   *  default; `revealSecrets` is honored only when the caller holds an
   *  active per-source reveal escalation (the tap owns that window). */
  snapshot(options?: ProjectRecordOptions): TrafficRecordProjection[] {
    const out: TrafficRecordProjection[] = [];
    for (const entry of this.live.values()) out.push(projectRecord(entry.record, options));
    return out;
  }

  /** Content-free counters. `droppedPreArm` / `droppedEvictedReplay` /
   *  `readyEpochs` belong to the consumer; it composes the full stats. */
  counters(): Pick<TrafficRetentionStats, 'recordCount' | 'byteSize' | 'maxRecords' | 'maxBytes' | 'evictedCount'> {
    return {
      recordCount: this.live.size,
      byteSize: this.byteSize,
      maxRecords: this.bounds.maxRecords,
      maxBytes: this.bounds.maxBytes,
      evictedCount: this.evictedCount,
    };
  }

  private evictOverflow(): void {
    while (this.live.size > this.bounds.maxRecords || this.byteSize > this.bounds.maxBytes) {
      const oldest = this.live.keys().next();
      if (oldest.done === true) return;
      const key = oldest.value;
      const entry = this.live.get(key);
      this.live.delete(key);
      if (entry !== undefined) this.byteSize -= entry.bytes;
      this.rememberEvicted(key);
      this.evictedCount++;
    }
  }

  private rememberEvicted(key: string): void {
    this.evictedKeys.add(key);
    const cap = this.bounds.maxRecords * EVICTED_KEYS_FACTOR;
    while (this.evictedKeys.size > cap) {
      const oldest = this.evictedKeys.values().next();
      if (oldest.done === true) return;
      this.evictedKeys.delete(oldest.value);
    }
  }
}
