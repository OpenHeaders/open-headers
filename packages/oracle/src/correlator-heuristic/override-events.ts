/**
 * Override seam — the page-relayed capture of a rule-modified exchange that
 * the wire cannot honestly attest.
 *
 * A response/request-body rule modifies the bytes the page sees IN PAGE
 * CONTEXT (the injection wrapper substitutes a `Response` / rewrites the
 * outgoing body), so the wire HAR never reflects the modification — and for a
 * substituted `Response` the devtools `onRequestFinished` may not even fire.
 * The wrapper, which holds both sides at the moment it acts, relays them; this
 * seam carries that relay into the heuristic correlator, which joins it to the
 * webRequest lifecycle by `(url, method, start)` (the page never knows the
 * requestId) and emits the `response-override-attached` / `request-override-
 * attached` update.
 *
 * Chrome-free by construction: the host wires the chrome transport (the fire
 * bridge → background relay) to this plain subscribe seam, mirroring the HAR
 * and Resource Timing sources.
 */

import type { RequestOverride, ResponseOverride } from '@openheaders/core/request-lifecycle';

/**
 * One page-relayed override capture. `startedAtMs` is the request's start
 * instant as the wrapper observed it (captured before the real fetch), the
 * join anchor against the lifecycle's `startedAtMs`. Exactly one of
 * `response` / `request` is set per event.
 */
export interface OverrideEvent {
  readonly tabId: number;
  readonly url: string;
  readonly method: string;
  readonly startedAtMs: number;
  readonly response?: ResponseOverride;
  readonly request?: RequestOverride;
}

/** Host-bound source of {@link OverrideEvent}s. Optional correlator injection. */
export interface OverrideEventSource {
  subscribe(listener: (event: OverrideEvent) => void): () => void;
}
