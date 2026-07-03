/**
 * The stateful builder class — folds CDP events into per-(tab, request)
 * HAR accumulation state and emits `har-attached` / progress updates.
 * Module docblock with the full synthesis contract rides `./index.ts`.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { totalTimeMs, wallTimeToIso } from '../cdp-har-synth';
import type { CdpWallClockResolver } from '../cdp-wall-clock';
import { type CdpNetworkEvent, type CdpResponseParams, cdpStoreRequestId } from '../events';
import { emitHop, requestHeaderUpdate } from './emit';
import {
  blockedResponse,
  CDP_HAR_RETENTION_MS,
  type CdpBodyFetchContext,
  type CdpBodyRef,
  MAX_CDP_BODY_REFS_PER_TAB,
  MAX_CDP_HAR_REQUESTS_PER_TAB,
  newRequestHarState,
  passThroughWallMs,
  type RequestHarState,
  secondsToMs,
  shiftExtraToLiveHop,
} from './state';

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
        // An internal redirect (a DNR redirect/query-param rule's own 307)
        // never crosses the wire, so it receives no `*ExtraInfo`. Its hop must
        // not consume an on-the-wire ordinal — otherwise the next real hop's
        // wire header sets shunt onto it and the real hop is left provisional.
        if (event.redirectResponse.statusText === 'Internal Redirect') {
          this.skipInternalRedirectHop(existing);
        }
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
    const headers = requestHeaderUpdate(event.tabId, requestId, state, state.hopCursor);
    if (headers !== undefined) updates.push(headers);
    return updates;
  }

  /**
   * Realign the on-the-wire ordinal cursors after an internal-redirect hop
   * (just finalized at `hopCursor - 1`). That hop crossed no wire, so it gets
   * no `*ExtraInfo`: shift any extra ordinal-mis-paired onto it across to the
   * live hop (the extra-before-base race), then advance both cursors past it
   * so subsequent wire header sets pair with hops that did cross the wire.
   */
  private skipInternalRedirectHop(state: RequestHarState): void {
    const internalHop = state.hopCursor - 1;
    shiftExtraToLiveHop(state.requestExtraByHop, internalHop, state.hopCursor);
    shiftExtraToLiveHop(state.responseExtraByHop, internalHop, state.hopCursor);
    state.reqExtraCursor = Math.max(state.reqExtraCursor, state.hopCursor);
    state.respExtraCursor = Math.max(state.respExtraCursor, state.hopCursor);
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
    // A server redirect carries a real ResourceTiming block; a DNR/internal
    // redirect (a query-param / redirect rule's own 307) has none, so
    // `totalTimeMs` is undefined. Fall back to the issue→next-hop wall span —
    // the leg's true duration — instead of leaving `time` absent, which the
    // hop row renders as a flat 0 ms.
    hop.totalMs =
      totalTimeMs(redirectResponse.timing, nextRequestSec) ?? Math.max(0, (nextRequestSec - hop.issuedSec) * 1000);
    hop.terminalSec = nextRequestSec;
    return emitHop(tabId, requestId, state, hopIndex);
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
    return this.collect(emitHop(tabId, requestId, state, hopIndex));
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
    return this.collect(emitHop(tabId, requestId, state, hopIndex));
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
    return this.collect(emitHop(tabId, requestId, state, hopIndex));
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
    const headers = requestHeaderUpdate(event.tabId, requestId, state, 0);
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
      const promoted = requestHeaderUpdate(event.tabId, requestId, state, 0);
      if (promoted !== undefined) updates.push(promoted);
    }
    const emitted = emitHop(event.tabId, requestId, state, 0);
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
    return this.collect(emitHop(tabId, requestId, state, 0));
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
    const promoted = requestHeaderUpdate(tabId, requestId, state, hopIndex);
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
    return this.collect(emitHop(tabId, requestId, state, hopIndex));
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
