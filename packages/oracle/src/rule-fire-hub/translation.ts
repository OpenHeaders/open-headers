/**
 * Authoritative-fire translation — the cross-id-space join for tabs whose
 * rows are not keyed by the host's webRequest ids.
 *
 * An authoritative fire carries the webRequest request id; a tab fed by
 * the CDP correlator keys its rows (and therefore its driver fires) by
 * the CDP store id. The two id spaces have no deterministic bridge, so
 * the store's `(ruleUid, requestId)` dedup can never converge the two
 * arrivals describing one logical fire — the authoritative record would
 * coexist as a dangling double-count.
 *
 * The translation is a HEURISTIC join, gated for confidence:
 *
 *   - match key: same `ruleUid`, same normalized URL, fire timestamps
 *     within {@link TRANSLATION_WINDOW_MS}.
 *   - exactly ONE non-authoritative candidate → upgrade it in place
 *     (`mergeFire` keeps the entry's own identity; only authoritative /
 *     evidence / snapshot move).
 *   - ZERO candidates → the driver fire may simply not have landed yet
 *     (arrival order across the two planes is not guaranteed); the
 *     arrival waits in a bounded pending buffer and reconciles against
 *     the next matching insert.
 *   - TWO OR MORE candidates (a same-URL burst — exactly the shape where
 *     naive joins mis-bind) → NO upgrade, never guess. The logical fire
 *     stays represented by its driver record; only the authoritative
 *     upgrade is forfeited. A mis-attach is impossible by construction.
 *
 * Pure helpers — the store owns the buckets and the pending buffers and
 * composes these.
 */

import type { RequestRecord } from '@openheaders/core/types';

/** Pairing window between the two planes' fire timestamps. Both stamp
 *  "request start" (the DNR match instant vs the lifecycle's
 *  `startedAtMs`), but they live on different clocks and event paths. */
export const TRANSLATION_WINDOW_MS = 5_000;

/** Pending-buffer cap per tab — arrivals beyond it are dropped (the
 *  logical fire is still represented by its driver record). */
export const MAX_PENDING_PER_TAB = 200;

/** An authoritative arrival waiting for its driver record. `matchUrl` is
 *  the host-normalized URL (driver fires record normalized URLs; the raw
 *  event URL would never compare equal). */
export interface PendingAuthoritativeFire {
  readonly record: RequestRecord;
  readonly matchUrl: string;
}

/** Whether an entry/pending pair describes the same logical fire. */
export function isTranslationMatch(ruleUid: string, url: string, t: number, candidate: RequestRecord): boolean {
  return candidate.ruleUid === ruleUid && candidate.url === url && Math.abs(candidate.t - t) <= TRANSLATION_WINDOW_MS;
}

/** Drop pendings too old to ever pair (relative to the newest observed
 *  fire timestamp). Mutates in place; returns the same array. */
export function prunePending(pending: PendingAuthoritativeFire[], newestT: number): PendingAuthoritativeFire[] {
  const floor = newestT - TRANSLATION_WINDOW_MS;
  let keep = 0;
  for (const p of pending) {
    if (p.record.t >= floor) pending[keep++] = p;
  }
  pending.length = keep;
  return pending;
}
