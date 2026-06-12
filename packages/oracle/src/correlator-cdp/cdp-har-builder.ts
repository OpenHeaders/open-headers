/**
 * Stateful HAR synthesis for the CDP correlator.
 *
 * A single `InspectorHarEntry` spans several CDP events
 * (`requestWillBeSent` → `responseReceived` → `loadingFinished`), so it
 * cannot be assembled by the pure per-event mapper. This builder
 * accumulates a partial entry per `(requestId, hopIndex)` and emits a
 * `har-attached` update once the response is known — first a partial at
 * `responseReceived`, then a refined one at `loadingFinished` carrying
 * `_transferSize` and the body-download (`receive`) leg. The store's
 * `setHopSlot` reducer overwrites the slot, so the re-attach is a clean
 * refinement (invariant 5 governs lifecycle fields, not HAR slot
 * contents).
 *
 * Redirect hops are synthesized from `requestWillBeSent.redirectResponse`:
 * each redirect carries the just-finished prior hop's full response, so
 * the prior hop's HAR lands at the builder's current hop cursor before
 * the cursor advances to the new hop. CDP reuses `requestId` across
 * hops, matching lifecycle invariants 1 and 4.
 *
 * The two `*ExtraInfo` events carry the on-the-wire header sets (the real
 * `Cookie` the page never sees; the `Set-Cookie` the cooked response
 * omits). They have no hop index and no guaranteed order vs their base
 * event, so the builder pairs them to a hop by ordinal — the k-th
 * request-extra to hop k, the k-th response-extra to hop k (hops finalize
 * strictly in order, so the response ordinal tracks the hop). An extra
 * that arrives before its hop is stashed and applied when the base event
 * creates the hop; one that arrives after re-emits a refined `har-attached`
 * immediately. The merged headers supersede the cooked base headers
 * wholesale for the section they cover (see {@link ./cdp-har-synth}).
 *
 * State posture mirrors the heuristic correlator's per-tab maps: scoped
 * by tab, cleared by {@link CdpHarBuilder.forgetTab}, bounded by a per-tab
 * cap on concurrent in-flight requests, and pruned by a lazy retention
 * sweep after a terminal event (no timers — the monotonic event
 * timestamp drives gc, keeping it deterministic under fake clocks and
 * SW-suspend-safe). The pure shape conversions live in
 * {@link ./cdp-har-synth}.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry } from '@openheaders/core/types';

import {
  cdpBlockedTimings,
  cdpInitiatorToHar,
  cdpRawTiming,
  cdpRequestToHar,
  cdpResponseToHar,
  cdpTimingToHar,
  harTimeFromTimings,
  headerRecordToHar,
  totalTimeMs,
  wallTimeToIso,
} from './cdp-har-synth';
import type { CdpWallClockResolver } from './cdp-wall-clock';
import {
  type CdpInitiator,
  type CdpNetworkEvent,
  type CdpRequestParams,
  type CdpResponseParams,
  cdpStoreRequestId,
} from './events';

/**
 * Per-tab cap on concurrently-tracked requests. Bounds the leak from
 * requests that never reach a terminal event (no `loadingFinished` /
 * `loadingFailed`); oldest-inserted evicts first. Same envelope as the
 * heuristic correlator's in-flight maps.
 */
export const MAX_CDP_HAR_REQUESTS_PER_TAB = 5_000;

/**
 * Window a finalized request's builder state is retained after its
 * terminal event, so a trailing/duplicate event still refines rather
 * than orphaning. Measured against the monotonic event timestamp.
 * Bounded — this holds per-request memory on exactly the high-volume
 * tabs CDP targets, so it stays capped, matching the heuristic's
 * retention envelope.
 */
export const CDP_HAR_RETENTION_MS = 60_000;

/**
 * Per-tab cap on retained body refs (see {@link CdpBodyRef}). Sized to the
 * store's per-tab lifecycle cap so a row still viewable in the panel always
 * resolves a ref — the lazy body fetch (Slice 8) is keyed off the same
 * identity. Refs are a handful of strings each, so this is cheap; unlike
 * the HAR partials they survive the {@link CDP_HAR_RETENTION_MS} gc, since
 * a body can be fetched long after its lifecycle finalized.
 */
export const MAX_CDP_BODY_REFS_PER_TAB = 10_000;

const secondsToMs = (t: number): number => Math.round(t * 1000);

/**
 * HAR `_connectionId` (stringified physical connection id), or `undefined`
 * when there is none — CDP reports `0` for a request that opened no socket
 * (cache hits, data: URLs), which Chrome's exporter omits.
 */
function connectionIdString(connectionId: number | undefined): string | undefined {
  return connectionId === undefined || connectionId === 0 ? undefined : String(connectionId);
}

/**
 * Whether a response is a disk-cache hit — HAR `_fromCache: 'disk'`. Mirrors
 * Chrome's `cached()`: served from disk cache with nothing on the wire.
 * (Memory-cache detection needs the Resource Timing relay's signal, deferred.)
 */
function isDiskCacheHit(response: CdpResponseParams | undefined, transferSize: number | undefined): boolean {
  return Boolean(response?.fromDiskCache) && !transferSize;
}

/**
 * Synthetic status-0 response for a request that failed before any real
 * response (a blocked beacon). Chrome still exports a full entry for these
 * — request + a `status: 0` response carrying the `_error` — so we
 * reconstruct the same shape from the request alone.
 */
function blockedResponse(url: string): CdpResponseParams {
  return { url, status: 0, statusText: '' };
}

/**
 * The minimum a lazy body fetch needs to issue `Network.getResponseBody`
 * and shape the resulting `InspectorHarBody`: the raw CDP identity the
 * command targets, plus the source request's descriptive fields. Recorded
 * per store id at request time and kept past the HAR-partial gc — a body
 * may be opened long after the request finalized.
 */
export interface CdpBodyRef {
  /** The session the request lives on — `Network.getResponseBody` routes here. */
  readonly sessionId: string;
  /** The session-local CDP `requestId` (not the composite store id). */
  readonly rawRequestId: string;
  readonly method: string;
  readonly url: string;
  readonly startedDateTime: string;
}

/**
 * Everything a body fetch needs to pick its command and shape the result:
 * the {@link CdpBodyRef} identity, whether the request is still in flight
 * (no terminal event yet — routes the fetch to `streamResourceContent`,
 * the only command that serves an unfinished request's bytes-so-far; a
 * finished request routes to `getResponseBody`), and the current hop's
 * MIME type + charset, which decode a streamed raw-bytes body to text.
 * Composed at query time from the live HAR state; a request whose state
 * was retention-swept reads as finished (only finalized states are swept).
 */
export interface CdpBodyFetchContext extends CdpBodyRef {
  readonly inFlight: boolean;
  readonly mimeType?: string;
  readonly charset?: string;
}

interface HopPartial {
  /** Wall-clock ISO start, stamped from this hop's `requestWillBeSent.wallTime`. */
  readonly startedDateTime: string;
  /** Monotonic issue time (`requestWillBeSent.timestamp`, seconds) — the base
   *  for HAR `timings._blocked_queueing` against the timing's `requestTime`. */
  readonly issuedSec: number;
  readonly request: CdpRequestParams;
  /** `Network.Initiator` for this hop — forwarded verbatim as HAR `_initiator`. */
  readonly initiator?: CdpInitiator;
  /** Set once the response (or `redirectResponse` for a prior hop) is known. */
  response?: CdpResponseParams;
  /** Wire bytes, known at the hop's terminal/redirect point — HAR `_transferSize`. */
  transferSize?: number;
  /** Decoded body bytes, summed from `dataReceived` — HAR `content.size`. */
  contentSize?: number;
  /** CDP `ResourceType` for this hop (`Media`, `XHR`, …) — HAR `_resourceType`, lowercased. */
  readonly resourceType?: string;
  /** Net-stack code from a terminal `loadingFailed` (`net::ERR_*`) — HAR `_error`. */
  error?: string;
  /** Total span in ms, computed at the hop's terminal/redirect point — HAR `time`. */
  totalMs?: number;
  /** Monotonic `responseReceived` event instant (seconds) — `_rawTiming`'s
   *  wait-boundary clamp source. Absent on a redirect hop (no discrete event). */
  responseReceivedSec?: number;
  /** Monotonic terminal instant (seconds): `loadingFinished`/`loadingFailed`,
   *  or the next hop's request for a redirect — `_rawTiming.endSec`. */
  terminalSec?: number;
}

interface RequestHarState {
  /** Hop index the live response events currently attribute to. */
  hopCursor: number;
  /** Dense per-hop partials; index = hop number. */
  readonly hops: HopPartial[];
  /** On-the-wire request headers per hop (ordinal-paired ExtraInfo); index = hop. */
  readonly requestExtraByHop: Array<Readonly<Record<string, string>>>;
  /** On-the-wire response headers per hop (ordinal-paired ExtraInfo); index = hop. */
  readonly responseExtraByHop: Array<Readonly<Record<string, string>>>;
  /** Next hop ordinal a `requestWillBeSentExtraInfo` attributes to. */
  reqExtraCursor: number;
  /** Next hop ordinal a `responseReceivedExtraInfo` attributes to. */
  respExtraCursor: number;
  /** Monotonic ms of the terminal event, once seen — drives retention gc. */
  finalizedAtMs?: number;
}

function newRequestHarState(): RequestHarState {
  return {
    hopCursor: 0,
    hops: [],
    requestExtraByHop: [],
    responseExtraByHop: [],
    reqExtraCursor: 0,
    respExtraCursor: 0,
  };
}

/**
 * Default monotonic→wall resolver — treats the monotonic instant as wall ms
 * when no per-request offset is known, the same zero-offset degradation
 * {@link ../correlator-cdp/cdp-wall-clock.CdpWallClock} documents. Production
 * always injects the correlator's real resolver; this keeps the builder
 * independently constructible (HAR-synthesis tests that don't exercise the
 * wall clock) without a silent `undefined`.
 */
const passThroughWallMs: CdpWallClockResolver = (_tabId, _sessionId, _requestId, monotonicSec) => monotonicSec * 1000;

export class CdpHarBuilder {
  /** Resolves a body chunk's monotonic `timestamp` to wall ms for the in-flight
   *  progress patch's `lastActivityAtMs` (see {@link observe}). */
  private readonly toWallMs: CdpWallClockResolver;

  constructor(toWallMs: CdpWallClockResolver = passThroughWallMs) {
    this.toWallMs = toWallMs;
  }

  private readonly perTab = new Map<number, Map<string, RequestHarState>>();
  /**
   * Per-tab store-id → {@link CdpBodyRef}. Separate from {@link perTab} so
   * it outlives the HAR-partial retention gc: a body fetch can land long
   * after the partial was swept. Bounded by {@link MAX_CDP_BODY_REFS_PER_TAB}
   * and dropped wholesale with the tab.
   */
  private readonly bodyRefs = new Map<number, Map<string, CdpBodyRef>>();

  /**
   * Fold one CDP event into the accumulating HAR state and return any
   * lifecycle updates it completes — `har-attached` at response/finish, and
   * an in-flight progress `phase` patch on each body chunk. Pure relative to
   * the listener set — the correlator emits these alongside the mapper's
   * lifecycle updates.
   *
   * The body-chunk progress patch needs the chunk's wall-clock instant for
   * `lastActivityAtMs`; the constructor-injected {@link toWallMs} converts the
   * monotonic `timestamp` onto the same clock as `startedAtMs`.
   */
  observe(event: CdpNetworkEvent): readonly RequestLifecycleUpdate[] {
    // Key by the namespaced identity so a child session reusing a page
    // session's `requestId` cannot clobber its HAR state, matching the
    // store key `cdp-to-update` emits.
    const requestId = cdpStoreRequestId(event.sessionId, event.requestId);
    // The `*ExtraInfo` variants carry no `timestamp` (they are header
    // refinements, not lifecycle points); gc rides their surrounding base
    // events instead.
    if ('timestamp' in event) this.gcFinalized(event.tabId, secondsToMs(event.timestamp));
    switch (event.method) {
      case 'Network.requestWillBeSent':
        return this.onRequest(event, requestId);
      case 'Network.responseReceived':
        return this.onResponse(event.tabId, requestId, event.response, event.timestamp);
      case 'Network.dataReceived':
        return this.onData(
          event.tabId,
          requestId,
          event.dataLength,
          event.encodedDataLength,
          this.toWallMs(event.tabId, event.sessionId, event.requestId, event.timestamp),
        );
      case 'Network.loadingFinished':
        return this.onFinished(event.tabId, requestId, event.encodedDataLength, event.timestamp);
      case 'Network.loadingFailed':
        return this.onFailed(event.tabId, requestId, event.errorText, event.timestamp);
      case 'Network.requestWillBeSentExtraInfo':
        return this.onRequestExtra(event.tabId, requestId, event.headers);
      case 'Network.responseReceivedExtraInfo':
        return this.onResponseExtra(event.tabId, requestId, event.headers);
      case 'Network.webSocketCreated':
        return this.onWsCreated(event, requestId);
      case 'Network.webSocketWillSendHandshakeRequest':
        return this.onWsHandshakeRequest(event, requestId);
      case 'Network.webSocketHandshakeResponseReceived':
        return this.onWsHandshakeResponse(event, requestId);
      case 'Network.webSocketClosed':
        return this.onWsClosed(event.tabId, requestId, event.timestamp);
      case 'Network.webSocketFrameSent':
      case 'Network.webSocketFrameReceived':
      case 'Network.webSocketFrameError':
      case 'Network.eventSourceMessageReceived':
        // Frames / parsed SSE events ride the lifecycle's message stream
        // (`message-appended`, see cdp-to-update); the HAR plane carries
        // them only at export time, synthesized from that stream.
        return [];
    }
  }

  /**
   * The body-fetch context for a store id, or `undefined` if the request
   * was never seen on this tab (or its ref was cap-evicted). The lazy body
   * fetcher (Slice 8) resolves the raw CDP identity, the in-flight bit and
   * the decode hints through this.
   */
  bodyContext(tabId: number, requestId: string): CdpBodyFetchContext | undefined {
    const ref = this.bodyRefs.get(tabId)?.get(requestId);
    if (ref === undefined) return undefined;
    const state = this.getState(tabId, requestId);
    const response = state?.hops[state.hopCursor]?.response;
    return {
      ...ref,
      inFlight: state !== undefined && state.finalizedAtMs === undefined,
      ...(response?.mimeType !== undefined ? { mimeType: response.mimeType } : {}),
      ...(response?.charset !== undefined ? { charset: response.charset } : {}),
    };
  }

  /** Drop all HAR state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
    this.bodyRefs.delete(tabId);
  }

  /** Discard all accumulated state. */
  clear(): void {
    this.perTab.clear();
    this.bodyRefs.clear();
  }

  /** Total tracked requests across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  private onRequest(
    event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
    requestId: string,
  ): readonly RequestLifecycleUpdate[] {
    const updates: RequestLifecycleUpdate[] = [];
    let state: RequestHarState;
    if (event.redirectResponse !== undefined) {
      // Continuation hop: the prior hop just finished — finalize its HAR
      // from the carried response before advancing the cursor.
      const existing = this.getState(event.tabId, requestId);
      state = existing ?? this.startState(event.tabId, requestId);
      if (existing !== undefined) {
        const finalized = this.finalizeRedirectHop(
          event.tabId,
          requestId,
          existing,
          event.redirectResponse,
          event.timestamp,
        );
        if (finalized !== undefined) updates.push(finalized);
        existing.hopCursor += 1;
      }
    } else {
      // Fresh lifecycle (also resets a reused requestId after gc). An
      // early `requestWillBeSentExtraInfo` may have seeded a hop-less stub
      // (extra-before-base, the common ordering) — adopt it so its stashed
      // headers survive; otherwise start clean.
      const existing = this.getState(event.tabId, requestId);
      state =
        existing !== undefined && existing.finalizedAtMs === undefined && existing.hops.length === 0
          ? existing
          : this.startState(event.tabId, requestId);
    }
    state.finalizedAtMs = undefined;
    state.hops[state.hopCursor] = {
      startedDateTime: wallTimeToIso(event.wallTime),
      issuedSec: event.timestamp,
      request: event.request,
      ...(event.initiator !== undefined ? { initiator: event.initiator } : {}),
      ...(event.type !== undefined ? { resourceType: event.type } : {}),
    };
    this.recordBodyRef(event, requestId);
    // Surface the new hop's request headers immediately — cooked (provisional)
    // unless an early extra already supplied the on-the-wire set. This is the
    // only path that shows request headers before the response-gated HAR lands.
    const headers = this.requestHeaderUpdate(event.tabId, requestId, state, state.hopCursor);
    if (headers !== undefined) updates.push(headers);
    return updates;
  }

  /**
   * A `phase` patch carrying the current hop's request headers + their
   * provisional status, or `undefined` when there is no live hop to describe.
   * Effective headers are the on-the-wire set once paired, else the cooked
   * request set — the same `extra ?? cooked` precedence the HAR uses; provisional
   * means the on-the-wire set has not arrived. Emitted only for the live hop
   * cursor so a late lower-hop extra cannot patch a superseded hop's headers
   * back onto the lifecycle's current hop.
   */
  private requestHeaderUpdate(
    tabId: number,
    requestId: string,
    state: RequestHarState,
    hopIndex: number,
  ): RequestLifecycleUpdate | undefined {
    if (hopIndex !== state.hopCursor) return undefined;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return undefined;
    const wire = state.requestExtraByHop[hopIndex];
    return {
      kind: 'phase',
      tabId,
      requestId,
      patch: {
        requestHeaders: headerRecordToHar(wire ?? hop.request.headers),
        requestHeadersProvisional: wire === undefined,
      },
    };
  }

  /**
   * Capture (or refresh) the body ref for this request. The raw identity is
   * constant across a redirect chain; the descriptive fields track the
   * latest hop, so a fetched body describes the response actually shown.
   */
  private recordBodyRef(
    event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
    requestId: string,
  ): void {
    const tabRefs = this.ensureBodyRefs(event.tabId);
    if (tabRefs.has(requestId)) tabRefs.delete(requestId);
    tabRefs.set(requestId, {
      sessionId: event.sessionId,
      rawRequestId: event.requestId,
      method: event.request.method,
      url: event.request.url,
      startedDateTime: wallTimeToIso(event.wallTime),
    });
    while (tabRefs.size > MAX_CDP_BODY_REFS_PER_TAB) {
      const oldest = tabRefs.keys().next().value;
      if (oldest === undefined) break;
      tabRefs.delete(oldest);
    }
  }

  private finalizeRedirectHop(
    tabId: number,
    requestId: string,
    state: RequestHarState,
    redirectResponse: CdpResponseParams,
    nextRequestSec: number,
  ): RequestLifecycleUpdate | undefined {
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return undefined;
    hop.response = redirectResponse;
    hop.transferSize = redirectResponse.encodedDataLength;
    hop.totalMs = totalTimeMs(redirectResponse.timing, nextRequestSec);
    hop.terminalSec = nextRequestSec;
    return this.emitHop(tabId, requestId, state, hopIndex);
  }

  private onResponse(
    tabId: number,
    requestId: string,
    response: CdpResponseParams,
    timestampSec: number,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    if (state === undefined) return [];
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return [];
    // Partial: total time and the authoritative transfer size are not
    // known until the body finishes; emit headers/cookies/status now and
    // refine later. `encodedDataLength` here is the bytes-so-far floor —
    // it lets a hop that aborts before `loadingFinished` still report a
    // wire size; the terminal event overrides it with the total.
    hop.response = response;
    hop.responseReceivedSec = timestampSec;
    if (response.encodedDataLength !== undefined) hop.transferSize = response.encodedDataLength;
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
  }

  /**
   * Accumulate one body chunk into the current hop: `dataLength` (decoded)
   * into the content size, `encodedDataLength` (wire) onto the transfer-size
   * floor. The transfer floor matters for a hop that aborts mid-body — no
   * `loadingFinished` arrives to supply the authoritative total, so the
   * summed wire bytes are the only transfer size we can report (a clean hop's
   * floor is overwritten by `loadingFinished`'s total).
   *
   * Emits an in-flight progress `phase` patch carrying the running decoded /
   * wire byte counts and the chunk's wall-clock instant, mirroring the
   * browser's per-`dataReceived` update of `resourceSize` / `transferSize` /
   * `endTime`: the panel's Size and Time columns grow live during a slow
   * download instead of jumping from "Pending" to the final value at
   * `loadingFinished`. The full HAR still lands at response/finish; this patch
   * carries only the three running scalars, so each chunk is a tiny refinement
   * the panel's rAF publisher coalesces to one render per frame.
   */
  private onData(
    tabId: number,
    requestId: string,
    dataLength: number,
    encodedDataLength: number,
    lastActivityAtMs: number,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    const hop = state?.hops[state.hopCursor];
    if (hop === undefined) return [];
    hop.contentSize = (hop.contentSize ?? 0) + dataLength;
    hop.transferSize = (hop.transferSize ?? 0) + encodedDataLength;
    return [
      {
        kind: 'phase',
        tabId,
        requestId,
        patch: {
          lastActivityAtMs,
          bytesReceivedSoFar: hop.contentSize,
          bytesTransferredSoFar: hop.transferSize,
        },
      },
    ];
  }

  private onFinished(
    tabId: number,
    requestId: string,
    encodedDataLength: number,
    finishedSec: number,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    if (state === undefined) return [];
    this.markFinalized(tabId, requestId, secondsToMs(finishedSec));
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined || hop.response === undefined) return [];
    hop.transferSize = encodedDataLength;
    hop.totalMs = totalTimeMs(hop.response.timing, finishedSec);
    hop.terminalSec = finishedSec;
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
  }

  /**
   * Terminal failure (`net::ERR_*`: canceled, aborted, blocked, net error).
   * A hop that already produced a response — an aborted media range probe,
   * a canceled XHR — must still finalize its HAR: the failure timestamp
   * resolves `time` (the body leg ran up to the abort), and `_error`
   * records the net-stack code. The transfer-size floor set on
   * `responseReceived` carries through (`loadingFailed` itself has no size).
   * A failure with no response (a blocked status-0 beacon) still gets a full
   * entry, like Chrome: a synthetic status-0 response carrying `_error`, the
   * whole span attributed to `blocked` (the no-response timing branch).
   */
  private onFailed(
    tabId: number,
    requestId: string,
    errorText: string,
    failedSec: number,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    this.markFinalized(tabId, requestId, secondsToMs(failedSec));
    if (state === undefined) return [];
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return [];
    hop.error = errorText;
    hop.terminalSec = failedSec;
    if (hop.response === undefined) {
      // Blocked before any response: synthesize a status-0 response carrying
      // `_error`; the whole span is attributed to `blocked` (`failed −
      // issued`), Chrome's no-response timing branch (see `emitHop`).
      hop.response = blockedResponse(hop.request.url);
      hop.transferSize = 0;
      hop.totalMs = (failedSec - hop.issuedSec) * 1000;
    } else {
      hop.totalMs = totalTimeMs(hop.response.timing, failedSec);
    }
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
  }

  // ── WebSocket HAR synthesis ──────────────────────────────────────────
  //
  // A WS row is a single hop whose events arrive on the `webSocket*`
  // vocabulary (no plain-Network events exist for it — see events.ts).
  // The hop shapes itself into the same `HopPartial` the HTTP path uses,
  // so `emitHop` serves it unchanged: no ResourceTiming ⇒ no `timings`
  // ladder, `time` = the handshake-issue → close span, exactly the span
  // the host's own network log gives the row. No body ref is recorded —
  // a socket has no `getResponseBody` surface.

  /** `webSocketCreated` — seed the hop with the socket's url/initiator. The
   *  event carries no timestamp; the arrival stamp stands in until the
   *  handshake's wall instant refines it. */
  private onWsCreated(
    event: Extract<CdpNetworkEvent, { method: 'Network.webSocketCreated' }>,
    requestId: string,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.startState(event.tabId, requestId);
    state.hops[0] = {
      startedDateTime: wallTimeToIso(event.atWallMs / 1000),
      issuedSec: Number.NaN,
      request: { url: event.url, method: 'GET' },
      ...(event.initiator !== undefined ? { initiator: event.initiator } : {}),
      resourceType: 'websocket',
    };
    return [];
  }

  /** `webSocketWillSendHandshakeRequest` — the issue instant + the cooked
   *  handshake headers. Replaces the seeded hop's provisional fields. */
  private onWsHandshakeRequest(
    event: Extract<CdpNetworkEvent, { method: 'Network.webSocketWillSendHandshakeRequest' }>,
    requestId: string,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(event.tabId, requestId);
    const hop = state?.hops[0];
    if (state === undefined || hop === undefined) return [];
    state.hops[0] = {
      ...hop,
      startedDateTime: wallTimeToIso(event.wallTime),
      issuedSec: event.timestamp,
      request: { ...hop.request, headers: event.headers },
    };
    const headers = this.requestHeaderUpdate(event.tabId, requestId, state, 0);
    return headers === undefined ? [] : [headers];
  }

  /** `webSocketHandshakeResponseReceived` — status 101 + both directions'
   *  on-the-wire headers. The wire request set lands in the extra slot so
   *  `emitHop` supersedes the cooked set (capture point `effective`). */
  private onWsHandshakeResponse(
    event: Extract<CdpNetworkEvent, { method: 'Network.webSocketHandshakeResponseReceived' }>,
    requestId: string,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.getState(event.tabId, requestId);
    const hop = state?.hops[0];
    if (state === undefined || hop === undefined) return [];
    hop.response = {
      url: hop.request.url,
      status: event.response.status,
      statusText: event.response.statusText,
      headers: event.response.headers,
    };
    hop.responseReceivedSec = event.timestamp;
    const updates: RequestLifecycleUpdate[] = [];
    if (event.response.requestHeaders !== undefined) {
      state.requestExtraByHop[0] = event.response.requestHeaders;
      const promoted = this.requestHeaderUpdate(event.tabId, requestId, state, 0);
      if (promoted !== undefined) updates.push(promoted);
    }
    const emitted = this.emitHop(event.tabId, requestId, state, 0);
    if (emitted !== undefined) updates.push(emitted);
    return updates;
  }

  /** `webSocketClosed` — the WS terminal. `time` becomes the issue → close
   *  span (the host's own row span); a socket that never handshaked has no
   *  issue instant and honestly keeps `time` absent. */
  private onWsClosed(tabId: number, requestId: string, closedSec: number): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    this.markFinalized(tabId, requestId, secondsToMs(closedSec));
    const hop = state?.hops[0];
    if (state === undefined || hop === undefined || hop.response === undefined) return [];
    if (!Number.isNaN(hop.issuedSec)) hop.totalMs = (closedSec - hop.issuedSec) * 1000;
    hop.terminalSec = closedSec;
    return this.collect(this.emitHop(tabId, requestId, state, 0));
  }

  /**
   * Fold one `requestWillBeSentExtraInfo` onto its hop. Ordinal-paired:
   * the k-th request-extra belongs to hop k. Stash it on the state (so a
   * not-yet-created hop picks it up when its base event lands), and
   * re-emit only once the hop has a response — matching the builder's
   * "first `har-attached` at `responseReceived`" cadence.
   */
  private onRequestExtra(
    tabId: number,
    requestId: string,
    headers: Readonly<Record<string, string>>,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.ensureState(tabId, requestId);
    const hopIndex = state.reqExtraCursor;
    state.reqExtraCursor += 1;
    state.requestExtraByHop[hopIndex] = headers;
    // Promote the lifecycle's request headers to the on-the-wire set (clearing
    // provisional) the moment they arrive — independent of the response gate,
    // so an in-flight row stops showing provisional as soon as the real set is
    // known. A no-op when the base hop has not landed yet (extra-before-base):
    // `onRequest` will emit the non-provisional set when it adopts the stash.
    const promoted = this.requestHeaderUpdate(tabId, requestId, state, hopIndex);
    const reemit = this.reemitIfResponded(tabId, requestId, state, hopIndex);
    return promoted === undefined ? reemit : [promoted, ...reemit];
  }

  /** As {@link onRequestExtra}, for `responseReceivedExtraInfo` (Set-Cookie source). */
  private onResponseExtra(
    tabId: number,
    requestId: string,
    headers: Readonly<Record<string, string>>,
  ): readonly RequestLifecycleUpdate[] {
    const state = this.ensureState(tabId, requestId);
    const hopIndex = state.respExtraCursor;
    state.respExtraCursor += 1;
    state.responseExtraByHop[hopIndex] = headers;
    return this.reemitIfResponded(tabId, requestId, state, hopIndex);
  }

  private reemitIfResponded(
    tabId: number,
    requestId: string,
    state: RequestHarState,
    hopIndex: number,
  ): readonly RequestLifecycleUpdate[] {
    const hop = state.hops[hopIndex];
    // No hop yet, or no response yet: the stash applies when the response
    // lands (extra-before-base). Re-emit only once there is a HAR to refine.
    if (hop === undefined || hop.response === undefined) return [];
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
  }

  private emitHop(
    tabId: number,
    requestId: string,
    state: RequestHarState,
    hopIndex: number,
  ): RequestLifecycleUpdate | undefined {
    const hop = state.hops[hopIndex];
    if (hop === undefined) return undefined;
    const response = hop.response;
    const requestExtra = state.requestExtraByHop[hopIndex];
    const responseExtra = state.responseExtraByHop[hopIndex];
    const connectionId = connectionIdString(response?.connectionId);
    const timings =
      response?.timing !== undefined
        ? cdpTimingToHar(response.timing, hop.totalMs, hop.issuedSec)
        : // A failed-before-response hop has no ResourceTiming; attribute the
          // whole span to `blocked`, matching Chrome's no-response branch.
          hop.error !== undefined && hop.totalMs !== undefined
          ? cdpBlockedTimings(hop.totalMs)
          : undefined;
    // The unfolded raw instants behind the export-dialect `timings` — only a
    // hop with real ResourceTiming carries them (a synthesized blocked
    // response has no instants to unfold).
    const rawTiming =
      response?.timing !== undefined
        ? cdpRawTiming(response.timing, hop.issuedSec, hop.responseReceivedSec, hop.terminalSec)
        : undefined;
    // `time` is the leg-sum once a terminal arrives (matching Chrome); a
    // pre-terminal partial leaves it absent, the signal that it has not
    // refined yet.
    const time =
      hop.totalMs === undefined ? undefined : timings !== undefined ? harTimeFromTimings(timings) : hop.totalMs;
    const diskCacheHit = isDiskCacheHit(response, hop.transferSize);
    // Key order mirrors Chrome's exporter (`EntryDTO`); `pageref` is
    // appended downstream by the HAR exporter.
    const har: InspectorHarEntry = {
      _initiator: cdpInitiatorToHar(hop.initiator),
      _priority: hop.request.initialPriority ?? null,
      // Request side: `requestWillBeSentExtraInfo` carries the on-the-wire
      // set, captured after the engine's rewrite — an applied modification
      // is visible there. Response side: ground-truthed PRE-rewrite for a
      // wire-crossing response — the fire-evidence probe
      // (playground/scripts/probe-fire-evidence.mjs) observed
      // `responseReceivedExtraInfo` holding the server's original header
      // while the page received the DNR-rewritten value, so a response
      // claim can never be judged against it and the section stays `raw`.
      // A disk-cache hit never crossed the wire: its cooked response set is
      // the SERVED one with the engine's rewrite re-applied (probe-observed
      // carrying the rewritten value), so that case alone is `effective` —
      // unless an ExtraInfo set landed anyway, which supersedes the cooked
      // headers wholesale and is wire-raw by definition.
      _ohHeaderCapture: {
        request: requestExtra !== undefined ? 'effective' : 'raw',
        response: diskCacheHit && responseExtra === undefined ? 'effective' : 'raw',
      },
      _ohEntrySource: 'cdp',
      ...(hop.resourceType !== undefined ? { _resourceType: hop.resourceType.toLowerCase() } : {}),
      // Empty object, HAR-spec-required and emitted on every Chrome entry.
      cache: {},
      ...(response?.remotePort !== undefined ? { connection: String(response.remotePort) } : {}),
      request: cdpRequestToHar(hop.request, response?.protocol, requestExtra),
      ...(response !== undefined
        ? { response: cdpResponseToHar(response, hop.transferSize, hop.contentSize, hop.error, responseExtra) }
        : {}),
      // IPv6 normalization, matched verbatim to Chrome's exporter (it strips
      // only an empty `[]` sequence; real bracketed addresses pass through).
      // Always present, like Chrome (`''` when no peer address is known).
      serverIPAddress: (response?.remoteIPAddress ?? '').replace(/\[\]/g, ''),
      startedDateTime: hop.startedDateTime,
      ...(time !== undefined ? { time } : {}),
      ...(timings !== undefined ? { timings } : {}),
      ...(isDiskCacheHit(response, hop.transferSize) ? { _fromCache: 'disk' } : {}),
      ...(connectionId !== undefined ? { _connectionId: connectionId } : {}),
      ...(rawTiming !== undefined ? { _rawTiming: rawTiming } : {}),
    };
    return { kind: 'har-attached', tabId, requestId, hopIndex, har };
  }

  private collect(update: RequestLifecycleUpdate | undefined): readonly RequestLifecycleUpdate[] {
    return update === undefined ? [] : [update];
  }

  private markFinalized(tabId: number, requestId: string, monotonicMs: number): void {
    const state = this.getState(tabId, requestId);
    if (state !== undefined) state.finalizedAtMs = monotonicMs;
  }

  private getState(tabId: number, requestId: string): RequestHarState | undefined {
    return this.perTab.get(tabId)?.get(requestId);
  }

  private startState(tabId: number, requestId: string): RequestHarState {
    const tabMap = this.ensureTab(tabId);
    // Touch-to-end so a reused id sits at the tail under the per-tab cap.
    if (tabMap.has(requestId)) tabMap.delete(requestId);
    const state = newRequestHarState();
    tabMap.set(requestId, state);
    this.enforceCap(tabMap);
    return state;
  }

  /**
   * Get-or-create without resetting — the entry point for an early
   * `*ExtraInfo` that may precede its base `requestWillBeSent`. The stub it
   * creates is hop-less; `onRequest` adopts it so the stashed headers
   * survive the base event.
   */
  private ensureState(tabId: number, requestId: string): RequestHarState {
    const tabMap = this.ensureTab(tabId);
    let state = tabMap.get(requestId);
    if (state === undefined) {
      state = newRequestHarState();
      tabMap.set(requestId, state);
      this.enforceCap(tabMap);
    }
    return state;
  }

  private enforceCap(tabMap: Map<string, RequestHarState>): void {
    while (tabMap.size > MAX_CDP_HAR_REQUESTS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      tabMap.delete(oldest);
    }
  }

  private ensureTab(tabId: number): Map<string, RequestHarState> {
    let tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
  }

  private ensureBodyRefs(tabId: number): Map<string, CdpBodyRef> {
    let tabRefs = this.bodyRefs.get(tabId);
    if (tabRefs === undefined) {
      tabRefs = new Map();
      this.bodyRefs.set(tabId, tabRefs);
    }
    return tabRefs;
  }

  /**
   * Lazy retention sweep for one tab: drop finalized states older than
   * {@link CDP_HAR_RETENTION_MS}. Insertion order is not monotonic in
   * `finalizedAtMs` (a long redirect chain can finalize after a later
   * short request), so the sweep checks every finalized entry rather
   * than early-exiting.
   */
  private gcFinalized(tabId: number, nowMs: number): void {
    const tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) return;
    const cutoff = nowMs - CDP_HAR_RETENTION_MS;
    for (const [requestId, state] of tabMap) {
      if (state.finalizedAtMs !== undefined && state.finalizedAtMs < cutoff) {
        tabMap.delete(requestId);
      }
    }
    if (tabMap.size === 0) this.perTab.delete(tabId);
  }
}
