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
  /**
   * Loader id of the navigation that issued this request — the page-binding
   * key. Identical to the issuing page's {@link Page.loaderId}; the host's
   * rule `request.loaderId !== mainFrame.loaderId` ⇒ the request belongs to a
   * superseded prior page. Set once at request start and stable across the
   * request's redirect hops (unlike the per-hop timing fields, it is never
   * reset on redirect — the host reuses the same loader id for every hop of a
   * navigation). CDP-only; the `chrome.webRequest` heuristic path carries no
   * loader id, so consumers fall back to a start-time page binding when it is
   * absent. A worker-fetched request carries an empty loader id at the wire
   * (it belongs to no document); we leave the field unset there rather than
   * stamping `''`, so identity comparison never mis-binds a worker request to
   * a page.
   */
  readonly loaderId?: string;

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
  /**
   * Wall-clock ms of the latest observed activity on the current hop — the
   * mirror of the browser's `NetworkRequest.endTime`, which advances on every
   * body chunk (`Network.dataReceived`), not only at completion. Lets the panel
   * show a live, growing duration for an in-flight request (the Time column and
   * the waterfall bar) the same way the browser does, instead of "Pending"
   * until the terminal event. Only the CDP path can populate it (it is the only
   * correlator that sees per-chunk events); the heuristic path leaves it unset
   * and degrades to the terminal `completedAtMs`. Resets with the hop on
   * redirect. Consumers prefer the authoritative HAR `time` once the hop has
   * finished — this drives the in-flight interval only.
   */
  readonly lastActivityAtMs?: number;
  /**
   * Running count of decoded body bytes received so far on the current hop —
   * the mirror of `NetworkRequest.resourceSize`, summed from `dataReceived`.
   * Drives the in-flight Size column's resource figure as it grows; the
   * finished row reads the authoritative HAR `content.size`. CDP-only; resets
   * on redirect.
   */
  readonly bytesReceivedSoFar?: number;
  /**
   * Running count of wire bytes (encoded headers + body) transferred so far on
   * the current hop — the mirror of `NetworkRequest.transferSize`, summed from
   * `dataReceived`. Drives the in-flight Size column's transferred figure as it
   * grows; the finished row reads the authoritative HAR `_transferSize`.
   * CDP-only; resets on redirect.
   */
  readonly bytesTransferredSoFar?: number;
  /**
   * Wall-clock ms at which the issuing frame stopped loading while this
   * request was still in flight — the document-teardown fact for a request
   * that will never receive a terminal event. A document canceled mid-stream
   * (a stop() during the body download) gets no `loadingFinished` /
   * `loadingFailed` on the CDP plane, so without this fact it is structurally
   * indistinguishable from an active download. Set only when the frame-stop
   * preceded the request's terminal (a clean load finishes the document
   * first); never set on a finished request. CDP-only; the heuristic path
   * learns the same teardown from its webRequest error terminal instead.
   * Resets with the hop on redirect.
   */
  readonly loadingStoppedAtMs?: number;

  // Resolution — populated as phase advances; monotonic per invariant 5.
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly fromCache?: boolean;
  readonly error?: RequestError;

  /**
   * The current hop's request headers, known from request-start — independent
   * of the response-gated {@link har}, so an in-flight or never-completed row
   * can surface its request headers before any HAR entry lands. Seeded with
   * the renderer-assembled (cooked) set — what the browser *intends* to send —
   * then superseded by the on-the-wire set once the network stack reports it,
   * a value refinement under invariant 5. Resets per hop on redirect. CDP-only;
   * the heuristic path leaves it unset and reads request headers from the
   * attached HAR. Mirrors the browser's first-class request-header field.
   */
  readonly requestHeaders?: readonly { name: string; value: string }[];
  /**
   * True while {@link requestHeaders} holds only the cooked (provisional) set —
   * the on-the-wire headers have not superseded it. Flips false when the
   * network stack's actual sent set arrives. Stays true for a row whose request
   * never reached the network as a fresh on-the-wire exchange (served from
   * cache, blocked before send, or the on-the-wire report withheld) — exactly
   * the browser's "provisional headers are shown" condition. Resets per hop on
   * redirect.
   */
  readonly requestHeadersProvisional?: boolean;

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

type NonJsonSafe = Map<unknown, unknown> | Set<unknown> | Date | RegExp | ((...args: never[]) => unknown);

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
export type RequestLifecycleJsonSafeProof =
  ContainsNonJsonSafe<RequestLifecycle> extends false
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
  /** In-flight progress — the browser's `endTime` / `resourceSize` /
   * `transferSize`, refined on each body chunk. See the `RequestLifecycle`
   * fields of the same names. */
  lastActivityAtMs?: number;
  bytesReceivedSoFar?: number;
  bytesTransferredSoFar?: number;
  /** The frame-stopped-loading instant for a still-in-flight request. See
   * the `RequestLifecycle` field of the same name. */
  loadingStoppedAtMs?: number;
  /** The current hop's request headers + their provisional status. Seeded
   * cooked at request-start, superseded by the on-the-wire set (a value
   * refinement). See the `RequestLifecycle` fields of the same names. */
  requestHeaders?: readonly { name: string; value: string }[];
  requestHeadersProvisional?: boolean;
}
