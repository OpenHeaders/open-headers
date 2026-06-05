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

import { cdpRequestToHar, cdpResponseToHar, cdpTimingToHar, totalTimeMs, wallTimeToIso } from './cdp-har-synth';
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

interface HopPartial {
  /** Wall-clock ISO start, stamped from this hop's `requestWillBeSent.wallTime`. */
  readonly startedDateTime: string;
  readonly request: CdpRequestParams;
  /** `Network.Initiator` for this hop — forwarded verbatim as HAR `_initiator`. */
  readonly initiator?: CdpInitiator;
  /** Set once the response (or `redirectResponse` for a prior hop) is known. */
  response?: CdpResponseParams;
  /** Wire bytes, known at the hop's terminal/redirect point — HAR `_transferSize`. */
  transferSize?: number;
  /** Total span in ms, computed at the hop's terminal/redirect point — HAR `time`. */
  totalMs?: number;
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

export class CdpHarBuilder {
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
   * `har-attached` updates it completes. Pure relative to the listener
   * set — the correlator emits these alongside the mapper's lifecycle
   * updates.
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
        return this.onResponse(event.tabId, requestId, event.response);
      case 'Network.loadingFinished':
        return this.onFinished(event.tabId, requestId, event.encodedDataLength, event.timestamp);
      case 'Network.loadingFailed':
        this.markFinalized(event.tabId, requestId, secondsToMs(event.timestamp));
        return [];
      case 'Network.requestWillBeSentExtraInfo':
        return this.onRequestExtra(event.tabId, requestId, event.headers);
      case 'Network.responseReceivedExtraInfo':
        return this.onResponseExtra(event.tabId, requestId, event.headers);
    }
  }

  /**
   * The body ref for a store id, or `undefined` if the request was never
   * seen on this tab (or its ref was cap-evicted). The lazy body fetcher
   * (Slice 8) resolves the raw CDP identity + descriptive fields through
   * this.
   */
  bodyContext(tabId: number, requestId: string): CdpBodyRef | undefined {
    return this.bodyRefs.get(tabId)?.get(requestId);
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
      request: event.request,
      ...(event.initiator !== undefined ? { initiator: event.initiator } : {}),
    };
    this.recordBodyRef(event, requestId);
    return updates;
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
    return this.emitHop(tabId, requestId, state, hopIndex);
  }

  private onResponse(tabId: number, requestId: string, response: CdpResponseParams): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    if (state === undefined) return [];
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return [];
    // Partial: total time and transfer size are not known until the
    // body finishes; emit the headers/cookies/status now and refine later.
    hop.response = response;
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
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
    return this.collect(this.emitHop(tabId, requestId, state, hopIndex));
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
    return this.reemitIfResponded(tabId, requestId, state, hopIndex);
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
    const har: InspectorHarEntry = {
      startedDateTime: hop.startedDateTime,
      ...(hop.totalMs !== undefined ? { time: hop.totalMs } : {}),
      request: cdpRequestToHar(hop.request, requestExtra),
      ...(response !== undefined ? { response: cdpResponseToHar(response, hop.transferSize, responseExtra) } : {}),
      ...(response?.remoteIPAddress !== undefined ? { serverIPAddress: response.remoteIPAddress } : {}),
      ...(response?.timing !== undefined ? { timings: cdpTimingToHar(response.timing, hop.totalMs) } : {}),
      ...(hop.initiator !== undefined ? { _initiator: hop.initiator } : {}),
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
