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

import { fireDedupKey, type MergedFire, mergeFire } from '@openheaders/core/rule-fire-stream';
import type { RequestRecord } from '@openheaders/core/types';

import {
  isTranslationMatch,
  MAX_PENDING_PER_TAB,
  type PendingAuthoritativeFire,
  prunePending,
  TRANSLATION_WINDOW_MS,
} from './translation';

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
  /** Authoritative arrivals awaiting their driver record (cross-id-space
   *  tabs only — see `translation.ts`). */
  private readonly pendingAuth = new Map<number, PendingAuthoritativeFire[]>();

  /**
   * Insert or merge a fire arrival. Returns the effective merged entry
   * when state changed (new insert or upgrade); `null` when the arrival
   * was a no-op against the existing entry — hub uses this to skip a
   * redundant broadcast.
   *
   * A NEW insert additionally reconciles the tab's pending authoritative
   * arrivals: exactly one pending pairing with the inserted record
   * upgrades it in the same step (the broadcast already carries
   * `authoritative: true`); an ambiguous pairing drops the pendings —
   * never guess.
   */
  ingest(tabId: number, record: RequestRecord, authoritative: boolean): MergedFire | null {
    const bucket = this.bucketFor(tabId);
    const key = fireDedupKey(record);
    const existing = bucket.byKey.get(key);
    const incoming: MergedFire = { record, authoritative };
    if (existing === undefined) {
      const inserted = this.reconcilePending(tabId, incoming);
      bucket.byKey.set(key, inserted);
      bucket.order.push(key);
      this.enforceCap(bucket);
      return inserted;
    }
    const merged = mergeFire(existing, incoming);
    if (merged === existing) return null;
    bucket.byKey.set(key, merged);
    return merged;
  }

  /**
   * Ingest an authoritative fire whose `requestId` lives in a FOREIGN id
   * space relative to the tab's rows (webRequest id on a CDP-fed tab) —
   * it must never insert under its own key, or it would dangle as a
   * double-count next to the driver record describing the same logical
   * fire. Instead it pairs by `(ruleUid, matchUrl, ±window)`:
   *
   *   - exactly one non-authoritative entry → upgraded in place (returned
   *     for broadcast under the entry's OWN key);
   *   - none → buffered until a matching insert or window expiry;
   *   - two or more → dropped (ambiguous same-URL burst — never guess).
   *
   * `matchUrl` is the host-normalized URL (driver fires record normalized
   * URLs; the caller normalizes the raw event URL the same way).
   */
  ingestTranslated(tabId: number, record: RequestRecord, matchUrl: string): MergedFire | null {
    const bucket = this.buckets.get(tabId);
    const pending = this.pendingFor(tabId);
    prunePending(pending, record.t);
    const candidateKeys: string[] = [];
    for (const [key, entry] of bucket?.byKey ?? []) {
      if (!entry.authoritative && isTranslationMatch(record.ruleUid, matchUrl, record.t, entry.record)) {
        candidateKeys.push(key);
        if (candidateKeys.length > 1) break;
      }
    }
    if (bucket !== undefined && candidateKeys.length === 1) {
      const key = candidateKeys[0];
      const existing = bucket.byKey.get(key);
      if (existing === undefined) return null;
      const merged = mergeFire(existing, { record, authoritative: true });
      if (merged === existing) return null;
      bucket.byKey.set(key, merged);
      return merged;
    }
    if (candidateKeys.length === 0 && pending.length < MAX_PENDING_PER_TAB) {
      pending.push({ record, matchUrl });
    }
    return null;
  }

  /** Drop a tab's bucket. Returns `true` when state existed (hub uses
   *  this to gate the `tab-cleared` broadcast). */
  forgetTab(tabId: number): boolean {
    this.pendingAuth.delete(tabId);
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

  /** Pair a NEW insert against the tab's pending authoritative arrivals.
   *  Exactly one pending matches → consume it and return the upgraded
   *  entry; two or more → ambiguous burst, drop them all (never guess);
   *  none → the insert passes through untouched. */
  private reconcilePending(tabId: number, incoming: MergedFire): MergedFire {
    const pending = this.pendingAuth.get(tabId);
    if (pending === undefined || pending.length === 0) return incoming;
    prunePending(pending, incoming.record.t);
    const { ruleUid, url, t } = incoming.record;
    const matches: number[] = [];
    for (let i = 0; i < pending.length; i++) {
      const p = pending[i];
      if (p.record.ruleUid === ruleUid && p.matchUrl === url && Math.abs(p.record.t - t) <= TRANSLATION_WINDOW_MS) {
        matches.push(i);
      }
    }
    if (matches.length === 0) return incoming;
    if (matches.length > 1) {
      for (let i = matches.length - 1; i >= 0; i--) pending.splice(matches[i], 1);
      return incoming;
    }
    const [paired] = pending.splice(matches[0], 1);
    return mergeFire(incoming, { record: paired.record, authoritative: true });
  }

  private pendingFor(tabId: number): PendingAuthoritativeFire[] {
    let pending = this.pendingAuth.get(tabId);
    if (pending === undefined) {
      pending = [];
      this.pendingAuth.set(tabId, pending);
    }
    return pending;
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
