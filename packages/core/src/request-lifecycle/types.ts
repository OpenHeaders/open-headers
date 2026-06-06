/**
 * Request lifecycle — shared primitive (`@openheaders/core/request-lifecycle`).
 *
 * One typed lifecycle per request, per tab, with one owner. Replaces the
 * legacy 5-stream + 1,374-line panel-store implicit pipeline. See
 * `docs/REQUEST_LIFECYCLE_DESIGN.md` for the full architecture; this
 * module owns the wire-shaped data the engine produces and every
 * consumer (panel, popup, rule-engine) reduces against.
 *
 * Invariants (asserted by tests in `packages/core/tests/request-lifecycle/`):
 *   1. Identity = `(tabId, requestId)`, stable across redirects.
 *   2. Tab-scoped; lifecycles die with the tab.
 *   3. Phase monotonic: `pending` → `headers-received` → `completed | failed`.
 *   4. One lifecycle per request including redirects (chain in `redirectHops`).
 *   5. Monotonic information content — fields refine, never disappear.
 *   6. Redirect is the ONLY retrograde phase transition.
 *   7. Exactly one `chrome.webRequest.*` subscriber across the extension
 *      (the heuristic correlator). Integration-level assertion, not unit.
 *   8. Correlator output totally ordered per `(tabId, requestId)`.
 *      Heuristic uses an in-window buffer; HAR-body attachment is exempt.
 */

import type { InspectorHarBody, InspectorHarEntry } from '../types/har-source';

/**
 * Steady phases a lifecycle passes through. `redirect` is an event, not a
 * phase: on `onBeforeRedirect` the phase resets to `pending` and the hop
 * count increments (invariant 6) — the lifecycle stays single.
 *
 * Ordering used for monotonic-phase checks (invariant 3) is the position
 * in this tuple. Keep declaration order = advancement order; the
 * predicate `isPhaseAdvance` in `./invariants` depends on it.
 */
export type RequestPhase = 'pending' | 'headers-received' | 'completed' | 'failed';

/**
 * One URL in a redirect chain. A lifecycle accumulates one entry per hop
 * in `redirectHops`, appended on `chrome.webRequest.onBeforeRedirect`.
 *
 * The chain is reconstructable from this array alone (invariant 4); we
 * never read past events to assemble it.
 */
export interface RedirectHop {
  /** The URL that produced the 3xx response. */
  sourceUrl: string;
  /** The resolved `Location` header target — the next hop's URL. */
  redirectUrl: string;
  /** HTTP status of the redirect response (301/302/303/307/308). */
  statusCode: number;
  /** Wall-clock ms at which `onBeforeRedirect` fired. */
  timestampMs: number;
}

/**
 * Per-request authoritative state owned by the engine-side store.
 *
 * Consumer-owned derived state ("inspector display id", "rule-engine
 * matched-rule cache") lives in parallel facet maps in the consumer
 * modules — `core` does not know facet shapes. Redirect chain stays here
 * because every consumer projects from the same authoritative chain.
 */
export interface RequestLifecycle {
  // Identity (invariants 1–2).
  readonly tabId: number;
  readonly requestId: string;

  // Current cursor — `url` updates on redirect.
  readonly url: string;
  readonly method: string;
  readonly resourceType: string;
  readonly initiator?: string;

  // Phase machine (invariants 3, 6).
  readonly phase: RequestPhase;
  readonly redirectHopCount: number;
  readonly redirectHops: readonly RedirectHop[];

  // Timestamps.
  /** Wall-clock ms at the first `onBeforeRequest` of this lifecycle. */
  readonly startedAtMs: number;
  /** Wall-clock ms at the `onBeforeRequest` of the current hop. */
  readonly hopStartedAtMs: number;
  /**
   * Wall-clock ms at the current hop's network start — when the request left
   * the queue and went on the wire, i.e. `hopStartedAtMs` plus the queueing
   * leg. This is the start the footer anchors DCL / Load / Finish to (the
   * browser's `baseTime`); `hopStartedAtMs` is the earlier issue instant.
   * Set once the hop's timing is known — the CDP path stamps it from the
   * response's network-start time, the heuristic path derives it from the
   * attached HAR's queueing leg. Absent until known; consumers fall back to
   * `hopStartedAtMs`. Resets with the hop on redirect.
   */
  readonly hopNetworkStartMs?: number;
  /** Wall-clock ms at the terminal phase (`completed` or `failed`). */
  readonly completedAtMs?: number;

  // Resolution — populated as phase advances; monotonic per invariant 5.
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly fromCache?: boolean;
  readonly error?: RequestError;

  /**
   * Per-hop HAR shell forwarded from the devtools_page. Index = hop
   * number; hop 0 is the original request, hop N is the request after
   * the Nth redirect. Slots for hops whose HAR has not landed yet hold
   * `null` (an array, not a Map, because chrome.runtime.Port serializes
   * across processes via JSON — see the JSON-safe pin below).
   */
  readonly har: readonly (InspectorHarEntry | null)[];

  /**
   * Per-hop response bodies, indexed separately because body delivery is
   * async (HAR `getContent`) and orthogonal to the phase invariants
   * (invariant 8's exception). Same shape rationale as `har`.
   */
  readonly harBodyByHop: readonly (InspectorHarBody | null)[];
}

// ── JSON-safe wire contract ──────────────────────────────────────────
// chrome.runtime.Port.postMessage uses JSON across process boundaries
// (service worker ↔ devtools panel). RequestLifecycle must remain
// structurally JSON-safe — no Map / Set / Date / RegExp / class
// instances / functions. The recursive check below errors at compile
// time if a non-safe field is added; the runtime round-trip test in
// `packages/core/tests/request-lifecycle/json-safe.test.ts` is the
// belt-and-suspenders backstop.

type NonJsonSafe =
  | Map<unknown, unknown>
  | Set<unknown>
  | Date
  | RegExp
  | ((...args: never[]) => unknown);

type ContainsNonJsonSafe<T> = T extends NonJsonSafe
  ? true
  : T extends readonly (infer U)[]
    ? ContainsNonJsonSafe<U>
    : T extends object
      ? { [K in keyof T]-?: ContainsNonJsonSafe<NonNullable<T[K]>> }[keyof T]
      : false;

/**
 * Compile-time proof that `RequestLifecycle` is JSON-safe. Resolves to
 * `true` when safe, to a descriptive string when not. Imported by the
 * round-trip test for a static assertion that the contract holds.
 */
export type RequestLifecycleJsonSafeProof = ContainsNonJsonSafe<RequestLifecycle> extends false
  ? true
  : 'RequestLifecycle has a non-JSON-safe field — chrome.runtime.Port serializes via JSON across processes';

/**
 * Refined error surface. `code` is the Chromium net-stack string
 * (`net::ERR_FAILED`) refined upward by the correlator to an
 * OpenHeaders-side classification (`oh:cors-missing-acao`) once enough
 * signal is available. Invariant 5 guarantees: once `error` is set, it
 * never goes back to `undefined`; `code` may change to a more specific
 * value.
 */
export interface RequestError {
  code: string;
  reason: string;
  /**
   * Short block-reason vocabulary word (`csp`, `mixed-content`, `corp`,
   * `coep`, …) when a correlator can name *why* the browser blocked the
   * request more precisely than the net-stack `code` allows. Set only on
   * the CDP path, where `Network.loadingFailed.blockedReason` carries a
   * fine-grained reason the generic `net::ERR_BLOCKED_BY_*` code collapses
   * to `other`. Absent on the heuristic path — consumers fall back to the
   * net-stack-code vocabulary, so the label is unchanged there.
   */
  blockedReason?: string;
}

/**
 * Wire-shaped diff emitted by the correlator and applied by the store.
 *
 * Consumers reduce against this union; the reducer is trivially correct
 * because of invariant 5 (monotonic information content). The five
 * non-terminal variants compose the full request shape; `gone` is the
 * tab-removal signal driven by `chrome.tabs.onRemoved`.
 */
export type RequestLifecycleUpdate =
  | { kind: 'started'; lifecycle: RequestLifecycle }
  | {
      kind: 'phase';
      tabId: number;
      requestId: string;
      /**
       * Sparse refinement — every field present here is a refinement
       * over the prior state (invariant 5). Fields absent here are
       * unchanged; fields cannot be set to `undefined`.
       */
      patch: RequestLifecyclePatch;
    }
  | { kind: 'redirect'; tabId: number; requestId: string; hop: RedirectHop; nextUrl: string }
  | { kind: 'har-attached'; tabId: number; requestId: string; hopIndex: number; har: InspectorHarEntry }
  | { kind: 'body-attached'; tabId: number; requestId: string; hopIndex: number; body: InspectorHarBody }
  | { kind: 'gone'; tabId: number; requestId: string };

/**
 * Sparse, refining patch applied by the store's reducer. We pick the
 * subset of `RequestLifecycle` that genuinely refines mid-flight — the
 * identity / startedAt fields are never patched, only set at `started`.
 */
export interface RequestLifecyclePatch {
  phase?: RequestPhase;
  statusCode?: number;
  statusText?: string;
  fromCache?: boolean;
  error?: RequestError;
  completedAtMs?: number;
  hopNetworkStartMs?: number;
}
