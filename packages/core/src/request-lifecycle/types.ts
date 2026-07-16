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
  /**
   * `true` when this hop is an Open Headers internal redirect — a
   * `redirect`/`query-param` rule rewriting the URL — rather than a server
   * 3xx. Drives the row-annotation rail's "rule rewrite" label so it lands
   * only on the rule's own hop, never on a server redirect in the same chain.
   */
  internal?: boolean;
}

/**
 * One frame of a WebSocket conversation, as the panel's Messages tab
 * renders it. `type` mirrors the host's frame vocabulary: `send` /
 * `receive` for data frames, `error` for a transport-level frame error
 * (stored in the same list, `opcode: -1`, `data` = the error message).
 * `data` carries the text payload verbatim for text frames (opcode 1)
 * and base64 of the raw bytes for binary frames (opcode 2).
 */
export interface WsStreamMessage {
  kind: 'ws';
  type: 'send' | 'receive' | 'error';
  /** Wall-clock ms of the frame. */
  atMs: number;
  /** WebSocket opcode (1 text, 2 binary, 8 close, …); `-1` for error frames. */
  opcode: number;
  /** Whether the frame was masked (client→server frames are). */
  mask: boolean;
  data: string;
}

/**
 * One per-frame capture relayed by the MAIN-world WebSocket wrapper —
 * the side of a message rule's action the network capture can never
 * see. The wire records a frame at the network layer; the wrapper acts
 * in the page, so per direction one side of every action is wire-
 * invisible: the replacement a receive-modify delivered, the original a
 * send-modify rewrote, an injected receive frame (never on the wire at
 * all), a dropped send frame (ditto). The wrapper holds both sides at
 * the moment it acts and relays them here — recorded evidence, same
 * posture as {@link ResponseOverride}.
 *
 *   op         | original                  | delivered
 *   -----------|---------------------------|---------------------------
 *   replaced   | pre-modify payload¹       | the replacement
 *   dropped    | the swallowed payload¹    | —
 *   injected   | —                         | the injected payload
 *
 * ¹ Text frames only — a filterless modify/drop can take a binary
 *   frame, whose payload the wrapper does not serialize; `original` is
 *   then absent while the capture still records that the action ran.
 *
 * The EventSource wrapper relays the same shape for SSE events. SSE is
 * receive-only — every action happens after wire capture (the wire
 * holds the original) and injected events never cross the wire — so an
 * SSE capture always carries `direction: 'receive'` plus `eventName`,
 * the event type the wrapper acted on (`message` for default events).
 */
export interface StreamMessageCapture {
  readonly ruleUid: string;
  readonly direction: 'send' | 'receive';
  readonly op: 'replaced' | 'dropped' | 'injected';
  /** SSE captures only — the event type the wrapper acted on. */
  readonly eventName?: string;
  readonly original?: string;
  readonly delivered?: string;
  /** Wall-clock ms at the wrapper (page clock). */
  readonly atMs: number;
}

/**
 * One parsed Server-Sent Event, as the panel's EventStream tab renders
 * it. Parsed by the network stack (`event:` / `id:` / `data:` fields;
 * multi-line data already joined with `\n`); `eventName` is `message`
 * for default events.
 */
export interface SseStreamMessage {
  kind: 'sse';
  /** Wall-clock ms the event was received. */
  atMs: number;
  eventName: string;
  eventId: string;
  data: string;
}

/**
 * One entry of a lifecycle's message stream — the WS-frame / SSE-event
 * plane behind the Messages and EventStream detail tabs. A request is
 * either a WebSocket or an EventSource, so a lifecycle's list is
 * homogeneous in practice; the discriminant keeps the consumers honest.
 */
export type StreamMessage = WsStreamMessage | SseStreamMessage;

/**
 * Ring-buffer bound on a lifecycle's {@link RequestLifecycle.messages}.
 * The host keeps its frame/event lists unbounded for the lifetime of its
 * network log; ours accumulate in the long-lived background worker and
 * cross a port per append, so a bound protects both. Drop-oldest, with
 * the drop count surfaced on {@link RequestLifecycle.messagesDropped} so
 * the UI states truncation instead of hiding it. MUST be enforced
 * identically by the engine reducer and the panel client reducer — a
 * differing policy diverges the two stores after N messages.
 */
export const MAX_STREAM_MESSAGES_PER_REQUEST = 5_000;

/**
 * Materiality floor for {@link RequestLifecycle.pausedByDebugMs} — the
 * smallest CDP `Fetch` hold (ms) worth recording. Below it the interception
 * pause is indistinguishable from measurement noise and not worth a store
 * patch or a row annotation. Lives in core so the emit-site guard (host
 * interceptor) and the rail-admission guard (panel classifier) apply ONE
 * threshold — the same single-source rationale as
 * {@link MAX_STREAM_MESSAGES_PER_REQUEST}'s shared ring bound. The rail's
 * re-check is defence in depth: if an immaterial value ever reaches the
 * store, the annotation still suppresses it.
 */
export const MATERIAL_DEBUG_PAUSE_MS = 5;

/**
 * A captured body payload for a rule-modified exchange — `encoding: 'base64'`
 * for binary, `''` for UTF-8 text. Same shape as the wire body's
 * `{ content, encoding }` so consumers render it through one path.
 */
export interface InspectorOverrideBody {
  readonly content: string;
  readonly encoding: '' | 'base64';
}

/**
 * One side of a rule-modified RESPONSE — the status / headers / body the
 * server actually sent, or the ones the page actually received. Captured by
 * the MODIFIER itself (the page-context injection wrapper, or the CDP `Fetch`
 * interceptor) at the moment it acted — NOT inferred from the wire HAR, which
 * does not reliably fire `onRequestFinished` for a wrapper-substituted fetch.
 * Every field is optional: a rule may override only the body, only the status,
 * etc., leaving the rest as the server sent it.
 */
export interface InspectorResponseSnapshot {
  readonly statusCode?: number;
  readonly statusText?: string;
  readonly headers?: readonly { name: string; value: string }[];
  readonly body?: InspectorOverrideBody;
}

/**
 * One side of a rule-modified REQUEST — what the page produced, or what
 * actually went on the wire. The request counterpart of
 * {@link InspectorResponseSnapshot} (Payload tab).
 */
export interface InspectorRequestSnapshot {
  readonly method?: string;
  readonly headers?: readonly { name: string; value: string }[];
  readonly body?: InspectorOverrideBody;
}

/**
 * A response rule's two-sided capture: what the page received (`served`,
 * present once the rule ran) and the real server response (`original`,
 * network-source only — a `mock` rule never hit the server, so there is no
 * original). Sourced from the modifier so it is independent of the devtools
 * HAR. The detail panes render `served` and `original` side by side; `served`
 * is what the body/size/state read prefer.
 */
export interface ResponseOverride {
  readonly ruleUid: string;
  readonly served: InspectorResponseSnapshot;
  readonly original?: InspectorResponseSnapshot;
}

/**
 * A request-body rule's two-sided capture: what actually went to the server
 * (`sent`, the wire) and what the page originally produced (`original`). The
 * request-side twin of {@link ResponseOverride}.
 */
export interface RequestOverride {
  readonly ruleUid: string;
  readonly sent: InspectorRequestSnapshot;
  readonly original?: InspectorRequestSnapshot;
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
  /**
   * UUID of the issuing top-level document — the heuristic page-binding
   * key, sibling of {@link loaderId}. Stamped once at request start from
   * webRequest `documentId`, and only when the outermost frame's document
   * issued the request: an iframe subresource carries its own iframe
   * document's UUID, which can never equal a committed page's
   * {@link Page.documentId}, so it is left unset there (the same
   * never-mis-bind posture as the worker loaderId carve-out) and falls to
   * the start-time page binding. Navigation (`main_frame`) requests carry
   * no documentId at the wire — the target document does not exist yet —
   * so they too are unset. Stable across the request's redirect hops.
   * Chromium-only (Firefox webRequest has no `documentId`); heuristic-path
   * only — the CDP path carries {@link loaderId} instead.
   */
  readonly documentId?: string;
  /**
   * Frame the request was issued for — CDP `Network.requestWillBeSent.frameId`.
   * Set once at request start, stable across redirect hops. Lets consumers
   * that need webRequest-style frame semantics (the rule-engine driver's
   * `main_frame` vs `sub_frame` split for CDP `document` requests) resolve
   * the frame against the tab's main-frame id. CDP-only; the heuristic path
   * already carries frame semantics in `resourceType` and leaves this unset.
   */
  readonly frameId?: string;
  /**
   * Set when this request was issued by a worker on the origin rather than
   * by a page — the browser's gear-prefixed (⚙) Network rows. Currently the
   * only worker plane that mints lifecycles is the service-worker one: rows
   * from a CDP worker target (`target:<id>` session, SW-network Phase A/B).
   * Stamped once at `started` by the minting plane and never patched —
   * provenance is identity, not refinement. Absent on every page-issued row,
   * so the panel gates the gear glyph on presence alone.
   */
  readonly issuedByWorker?: 'service-worker';

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
  /**
   * Milliseconds this hop sat suspended in CDP `Fetch` interception while
   * debug mode decided how to answer it — the latency the control plane
   * itself introduced (answer-land minus pause-receipt), not server or
   * network time. Lets the inspector/waterfall attribute the hold to
   * interception overhead instead of mis-reading it as the server being
   * slow. A measured, attribution-historical duration stamped once at
   * answer-land; never live state and never recomputed. Set only when the
   * hold is material ({@link MATERIAL_DEBUG_PAUSE_MS}) — a sub-millisecond
   * pass-through is not worth a store patch. CDP-only and only on a tab the
   * control plane owns; the heuristic path never pauses a request, so it is
   * always unset there. Resets with the hop on redirect — each wire attempt
   * is paused on its own.
   */
  readonly pausedByDebugMs?: number;

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
   * The current hop's response headers, known from the headers-received
   * moment — independent of the response-gated {@link har}, so consumers
   * that must act when the reply arrives (the rule engine's
   * response-header condition judgment, an in-flight row's header pane)
   * read them without waiting for a HAR entry. Sourced from the same
   * events that advance the phase: `onHeadersReceived` on the heuristic
   * path, `Network.responseReceived` on the CDP path (duplicate headers
   * arrive `\n`-joined there and are split into per-instance entries at
   * normalization). Resets per hop on redirect — each hop's reply carries
   * its own set.
   */
  readonly responseHeaders?: readonly { name: string; value: string }[];

  /**
   * The message stream — WebSocket frames / Server-Sent Events for this
   * request, in arrival order, appended by `message-appended` updates.
   * Bounded by {@link MAX_STREAM_MESSAGES_PER_REQUEST} (drop-oldest);
   * only the CDP plane can populate it (`webSocketFrame*` /
   * `eventSourceMessageReceived` have no webRequest counterpart — the
   * heuristic path leaves it unset). Never reset on redirect: messages
   * can only exist once the final hop's stream is open.
   */
  readonly messages?: readonly StreamMessage[];
  /**
   * Count of messages dropped off the front of {@link messages} by the
   * ring bound. The UI surfaces truncation honestly when this is set.
   */
  readonly messagesDropped?: number;

  /**
   * Per-frame wrapper captures for this request (see
   * {@link StreamMessageCapture}), in arrival order, appended by
   * `message-capture-appended` updates. Populated only when a `ws`
   * rule's MAIN-world wrapper acted on the connection; joined to
   * {@link messages} at consume time (the wire and the wrapper report
   * independently). Same ring bound as `messages`.
   */
  readonly messageCaptures?: readonly StreamMessageCapture[];
  /** Ring-bound drop count for {@link messageCaptures}. */
  readonly messageCapturesDropped?: number;

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

  /**
   * Two-sided capture of a response rule's effect on this request — the
   * `served` response the page received and, for a network-source rule, the
   * `original` server response. Populated by `response-override-attached`,
   * sourced from the modifier (page-context injection wrapper / CDP `Fetch`
   * interceptor), NOT the wire HAR — so it lands even when `onRequestFinished`
   * never fires for the wrapper-substituted fetch. Absent when no response rule
   * modified the request. The detail panes prefer `served` for body/size/state
   * and render `original` alongside it. Carries the modified final exchange;
   * never reset on redirect (a response rule acts on the request that crosses
   * the wire).
   */
  readonly responseOverride?: ResponseOverride;
  /**
   * The request-side counterpart — what the page produced (`original`) vs what
   * went on the wire (`sent`) — for a request-body rule. Drives the Payload
   * tab's side-by-side view. Sourced from the modifier, same rationale as
   * {@link responseOverride}.
   */
  readonly requestOverride?: RequestOverride;
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
  /**
   * The two-sided response capture for a request a response rule modified —
   * served (+ original for a network-source rule). Sets {@link
   * RequestLifecycle.responseOverride}; last write wins (a re-fire refines it).
   */
  | { kind: 'response-override-attached'; tabId: number; requestId: string; override: ResponseOverride }
  /** The request-side twin — sets {@link RequestLifecycle.requestOverride}. */
  | { kind: 'request-override-attached'; tabId: number; requestId: string; override: RequestOverride }
  /**
   * One WS frame / SSE event appended to the lifecycle's message stream.
   * Order-preserving; the reducers enforce the ring bound
   * ({@link MAX_STREAM_MESSAGES_PER_REQUEST}) identically on both sides.
   */
  | { kind: 'message-appended'; tabId: number; requestId: string; message: StreamMessage }
  /**
   * One wrapper capture appended to the lifecycle's capture stream —
   * same ordering and shared ring-bound contract as `message-appended`.
   */
  | { kind: 'message-capture-appended'; tabId: number; requestId: string; capture: StreamMessageCapture }
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
  /** The CDP `Fetch` interception hold for this hop. See the
   * `RequestLifecycle` field of the same name. */
  pausedByDebugMs?: number;
  /** The current hop's request headers + their provisional status. Seeded
   * cooked at request-start, superseded by the on-the-wire set (a value
   * refinement). See the `RequestLifecycle` fields of the same names. */
  requestHeaders?: readonly { name: string; value: string }[];
  requestHeadersProvisional?: boolean;
  /** The current hop's response headers, set with the `headers-received`
   * phase. See the `RequestLifecycle` field of the same name. */
  responseHeaders?: readonly { name: string; value: string }[];
}
