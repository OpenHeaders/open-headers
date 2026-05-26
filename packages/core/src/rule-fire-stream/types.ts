/**
 * Rule fire stream — engine→consumer update model.
 *
 * Sibling of `@openheaders/core/request-lifecycle` and
 * `@openheaders/core/page-stream`. The engine emits one fire per `(ruleUid,
 * requestId)` observation (or `(ruleUid, t)` for scriptable fires); the
 * engine-side store dedupes and merges evidence so the wire carries
 * idempotent upserts. Consumers reduce by `fireDedupKey(record)`.
 *
 * One update kind (`'fire'`) for live + replay — replay re-emits each
 * stored fire as a `'fire'` update, identical shape to live, so the
 * consumer reducer has no replay/live branch. `'tab-cleared'` is emitted
 * when the engine drops a tab's fire log (mirror of the page stream).
 */

import type { Evidence, RequestRecord } from '../types';

export type RuleFireUpdate =
  | { kind: 'fire'; tabId: number; record: RequestRecord; authoritative: boolean }
  | { kind: 'tab-cleared'; tabId: number };

/** Engine-side merged fire — the canonical entry held in the store and
 *  fanned out on each upsert. */
export interface MergedFire {
  readonly record: RequestRecord;
  readonly authoritative: boolean;
}

const EVIDENCE_RANK: Record<Evidence, number> = {
  confirmed: 3,
  matched: 2,
  'matched-fallback': 1,
  silent: 0,
};

export function strongerEvidence(a: Evidence, b: Evidence): Evidence {
  return EVIDENCE_RANK[a] >= EVIDENCE_RANK[b] ? a : b;
}

/** Deterministic dedup key. `requestId` is the host network identifier
 *  when present; scriptable fires fall back to fire timestamp. */
export function fireDedupKey(record: RequestRecord): string {
  return record.requestId ? `${record.ruleUid}:${record.requestId}` : `${record.ruleUid}:t:${record.t}`;
}

/**
 * Merge two fire observations that share a dedup key. Returns the same
 * reference when no upgrade is needed so callers can short-circuit
 * equality checks. Upgrades:
 *
 *   - `authoritative` — OR (an authoritative arrival upgrades the entry).
 *   - `evidence`      — stronger tier wins.
 *   - `ruleSnapshot`  — first-arrival-with-snapshot wins; adopted from
 *                       incoming only when existing didn't have one.
 *
 * All other `RequestRecord` fields stay first-arrival.
 */
export function mergeFire(existing: MergedFire, incoming: MergedFire): MergedFire {
  const auth = existing.authoritative || incoming.authoritative;
  const ev = strongerEvidence(existing.record.evidence, incoming.record.evidence);
  const snap = existing.record.ruleSnapshot ?? incoming.record.ruleSnapshot;
  if (
    auth === existing.authoritative &&
    ev === existing.record.evidence &&
    snap === existing.record.ruleSnapshot
  ) {
    return existing;
  }
  const nextRecord: RequestRecord = {
    ...existing.record,
    evidence: ev,
    ...(snap ? { ruleSnapshot: snap } : {}),
  };
  return { record: nextRecord, authoritative: auth };
}
