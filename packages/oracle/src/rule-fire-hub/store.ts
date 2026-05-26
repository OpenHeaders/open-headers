/**
 * `RuleFireStore` — per-tab dedup + merge + ring cap for rule fires.
 *
 * Pure data. The hub owns one and routes notify verbs through it; the
 * store returns the effective merged entry (or `null` when nothing
 * changed) so the hub knows whether to fan out.
 *
 * Identity: `fireDedupKey(record)` — `(ruleUid, requestId)` when present,
 * `(ruleUid, t)` for scriptable-only fires. Two arrivals describing the
 * same logical fire (heuristic via `subscribeFires`, authoritative via
 * `chrome.declarativeNetRequest.onRuleMatchedDebug`) collapse to one
 * entry; `mergeFire` upgrades `authoritative` + `evidence` + adopts a
 * `ruleSnapshot` if the existing entry didn't carry one.
 *
 * Cap: `MAX_FIRES_PER_TAB` per tab. Oldest-by-arrival is evicted when
 * exceeded — replay then sees a bounded window, which is the entire
 * reason this lives engine-side instead of in the consumer.
 */

import { fireDedupKey, mergeFire, type MergedFire } from '@openheaders/core/rule-fire-stream';
import type { RequestRecord } from '@openheaders/core/types';

/** Per-tab replay cap. Sized for "DevTools session length" not "all-time" —
 *  the consumer keeps its own larger display window if it wants more. */
export const MAX_FIRES_PER_TAB = 1_000;

interface TabBucket {
  /** Dedup key → merged fire. */
  byKey: Map<string, MergedFire>;
  /** Dedup keys in arrival order. Head = oldest (eviction end). */
  order: string[];
}

export class RuleFireStore {
  private readonly buckets = new Map<number, TabBucket>();

  /**
   * Insert or merge a fire arrival. Returns the effective merged entry
   * when state changed (new insert or upgrade); `null` when the arrival
   * was a no-op against the existing entry — hub uses this to skip a
   * redundant broadcast.
   */
  ingest(tabId: number, record: RequestRecord, authoritative: boolean): MergedFire | null {
    const bucket = this.bucketFor(tabId);
    const key = fireDedupKey(record);
    const existing = bucket.byKey.get(key);
    const incoming: MergedFire = { record, authoritative };
    if (existing === undefined) {
      bucket.byKey.set(key, incoming);
      bucket.order.push(key);
      this.enforceCap(bucket);
      return incoming;
    }
    const merged = mergeFire(existing, incoming);
    if (merged === existing) return null;
    bucket.byKey.set(key, merged);
    return merged;
  }

  /** Drop a tab's bucket. Returns `true` when state existed (hub uses
   *  this to gate the `tab-cleared` broadcast). */
  forgetTab(tabId: number): boolean {
    return this.buckets.delete(tabId);
  }

  /** Read-only ordered snapshot (oldest first) — used for replay. */
  snapshotTab(tabId: number): readonly MergedFire[] {
    const bucket = this.buckets.get(tabId);
    if (bucket === undefined) return EMPTY;
    const out: MergedFire[] = [];
    for (const key of bucket.order) {
      const entry = bucket.byKey.get(key);
      if (entry !== undefined) out.push(entry);
    }
    return out;
  }

  private bucketFor(tabId: number): TabBucket {
    let bucket = this.buckets.get(tabId);
    if (bucket === undefined) {
      bucket = { byKey: new Map(), order: [] };
      this.buckets.set(tabId, bucket);
    }
    return bucket;
  }

  private enforceCap(bucket: TabBucket): void {
    while (bucket.order.length > MAX_FIRES_PER_TAB) {
      const evict = bucket.order.shift();
      if (evict !== undefined) bucket.byKey.delete(evict);
    }
  }
}

const EMPTY: readonly MergedFire[] = Object.freeze([]) as readonly MergedFire[];
