/**
 * Pure invariant predicates over `RequestLifecycle` state.
 *
 * The store and correlator call these to enforce the lifecycle
 * invariants; tests call them directly to assert each invariant by
 * name. Keeping the predicates here (in `core`, alongside the types
 * they constrain) means every consumer that produces a refined value
 * can validate it before emission — no scattered re-implementations
 * inside the engine.
 *
 * Each export carries the invariant number it backs in its doc comment.
 */

import type { RedirectHop, RequestLifecycle, RequestLifecyclePatch, RequestPhase } from './types';

/**
 * Phase ordering tuple. Index = "advancement rank". `completed` and
 * `failed` are both terminal (rank 2) — neither can transition to the
 * other under the steady-phase rule. The only retrograde transition is
 * the redirect reset (`completed | failed` excluded; see {@link
 * isRedirectReset}).
 */
const PHASE_RANK: Readonly<Record<RequestPhase, number>> = {
  pending: 0,
  'headers-received': 1,
  completed: 2,
  failed: 2,
};

/**
 * Invariant 3 — monotonic steady-phase advance.
 *
 * Returns true when `next` is the same as `prev` or strictly forward in
 * the steady phase machine. Same-rank terminal swaps (`completed` →
 * `failed` or vice versa) are rejected — once a request resolves, the
 * outcome is fixed.
 *
 * Note: this predicate does NOT cover the redirect reset (invariant 6).
 * The store checks `isRedirectReset` first; only non-redirect
 * transitions are gated by this function.
 */
export function isPhaseAdvance(prev: RequestPhase, next: RequestPhase): boolean {
  if (prev === next) return true;
  const prevRank = PHASE_RANK[prev];
  const nextRank = PHASE_RANK[next];
  if (nextRank <= prevRank) return false;
  return true;
}

/** Convenience: a phase that does not accept further steady-phase advances. */
export function isTerminalPhase(phase: RequestPhase): boolean {
  return phase === 'completed' || phase === 'failed';
}

/**
 * Invariant 6 — redirect is the ONLY retrograde transition.
 *
 * A redirect resets `phase` to `pending`, increments `redirectHopCount`,
 * and appends to `redirectHops`. This predicate validates the shape of
 * the state delta a `redirect` update produces.
 *
 * A redirect MUST NOT fire from a terminal phase (`completed` / `failed`)
 * — Chrome cannot redirect a request it already resolved. The store
 * uses this guard to reject malformed correlator output.
 */
export function isRedirectReset(prevPhase: RequestPhase, prevHopCount: number, nextHopCount: number): boolean {
  if (isTerminalPhase(prevPhase)) return false;
  return nextHopCount === prevHopCount + 1;
}

/**
 * Invariant 5 — single-field refinement.
 *
 * "Once populated, never disappears; may refine." Concretely: if `prev`
 * was set, `next` must also be set (any value). If `prev` was `undefined`,
 * any `next` is acceptable (including `undefined`).
 *
 * Note this allows VALUE changes — `error.code: 'net::ERR_FAILED'` →
 * `'oh:cors-missing-acao'` is a valid refinement under invariant 5.
 * Field-level value semantics (e.g. "statusCode must not change once
 * set") are NOT enforced here; the store enforces those separately
 * because they're tied to phase, not to information content.
 */
export function refinesField<T>(prev: T | undefined, next: T | undefined): boolean {
  if (prev === undefined) return true;
  return next !== undefined;
}

/**
 * Invariant 5 — applied across a `RequestLifecyclePatch`.
 *
 * Validates that no field present-and-defined on `prev` is set to
 * `undefined` by the patch. Fields absent from the patch are unchanged
 * (which is trivially a refinement). The store calls this before
 * reducing a `phase` update onto current state.
 *
 * Phase carve-out: `phase` is required on `RequestLifecycle`, so a patch
 * carrying `phase: undefined` is rejected unconditionally — there is no
 * "prev was undefined" path for phase the way there is for the other
 * (optional) fields below.
 */
export function patchRefines(prev: RequestLifecycle, patch: RequestLifecyclePatch): boolean {
  if ('phase' in patch && patch.phase === undefined) return false;
  if ('statusCode' in patch && patch.statusCode === undefined && prev.statusCode !== undefined) return false;
  if ('statusText' in patch && patch.statusText === undefined && prev.statusText !== undefined) return false;
  if ('fromCache' in patch && patch.fromCache === undefined && prev.fromCache !== undefined) return false;
  if ('error' in patch && patch.error === undefined && prev.error !== undefined) return false;
  if ('completedAtMs' in patch && patch.completedAtMs === undefined && prev.completedAtMs !== undefined) return false;
  if ('hopNetworkStartMs' in patch && patch.hopNetworkStartMs === undefined && prev.hopNetworkStartMs !== undefined) {
    return false;
  }
  if ('lastActivityAtMs' in patch && patch.lastActivityAtMs === undefined && prev.lastActivityAtMs !== undefined) {
    return false;
  }
  if (
    'bytesReceivedSoFar' in patch &&
    patch.bytesReceivedSoFar === undefined &&
    prev.bytesReceivedSoFar !== undefined
  ) {
    return false;
  }
  if (
    'bytesTransferredSoFar' in patch &&
    patch.bytesTransferredSoFar === undefined &&
    prev.bytesTransferredSoFar !== undefined
  ) {
    return false;
  }
  if (
    'loadingStoppedAtMs' in patch &&
    patch.loadingStoppedAtMs === undefined &&
    prev.loadingStoppedAtMs !== undefined
  ) {
    return false;
  }
  if ('pausedByDebugMs' in patch && patch.pausedByDebugMs === undefined && prev.pausedByDebugMs !== undefined) {
    return false;
  }
  if ('requestHeaders' in patch && patch.requestHeaders === undefined && prev.requestHeaders !== undefined) {
    return false;
  }
  if (
    'requestHeadersProvisional' in patch &&
    patch.requestHeadersProvisional === undefined &&
    prev.requestHeadersProvisional !== undefined
  ) {
    return false;
  }
  if ('responseHeaders' in patch && patch.responseHeaders === undefined && prev.responseHeaders !== undefined) {
    return false;
  }
  return true;
}

/**
 * Invariant 1 — identity tuple. Lifecycle equality is `(tabId, requestId)`.
 * The pair stays stable across redirects (Chrome reuses `requestId` per
 * hop). Used by the store's internal map keying.
 */
export function lifecycleKey(tabId: number, requestId: string): string {
  return `${tabId}:${requestId}`;
}

/**
 * Invariant 4 — one lifecycle per request including redirects.
 *
 * Helper for tests / callers that need to project the URL chain from a
 * lifecycle without walking past events. The chain is `[hop0, hop1, …,
 * current]` where each intermediate URL is a `sourceUrl` from
 * `redirectHops` and the tail is the lifecycle's current `url`.
 */
export function urlChain(lifecycle: Pick<RequestLifecycle, 'url' | 'redirectHops'>): readonly string[] {
  if (lifecycle.redirectHops.length === 0) return [lifecycle.url];
  return [...lifecycle.redirectHops.map((h: RedirectHop) => h.sourceUrl), lifecycle.url];
}
