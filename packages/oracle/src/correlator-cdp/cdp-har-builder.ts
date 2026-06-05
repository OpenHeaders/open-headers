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
import type { CdpNetworkEvent, CdpRequestParams, CdpResponseParams } from './events';

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

const secondsToMs = (t: number): number => Math.round(t * 1000);

interface HopPartial {
  /** Wall-clock ISO start, stamped from this hop's `requestWillBeSent.wallTime`. */
  readonly startedDateTime: string;
  readonly request: CdpRequestParams;
  /** Set once the response (or `redirectResponse` for a prior hop) is known. */
  response?: CdpResponseParams;
}

interface RequestHarState {
  /** Hop index the live response events currently attribute to. */
  hopCursor: number;
  /** Dense per-hop partials; index = hop number. */
  readonly hops: HopPartial[];
  /** Monotonic ms of the terminal event, once seen — drives retention gc. */
  finalizedAtMs?: number;
}

export class CdpHarBuilder {
  private readonly perTab = new Map<number, Map<string, RequestHarState>>();

  /**
   * Fold one CDP event into the accumulating HAR state and return any
   * `har-attached` updates it completes. Pure relative to the listener
   * set — the correlator emits these alongside the mapper's lifecycle
   * updates.
   */
  observe(event: CdpNetworkEvent): readonly RequestLifecycleUpdate[] {
    this.gcFinalized(event.tabId, secondsToMs(event.timestamp));
    switch (event.method) {
      case 'Network.requestWillBeSent':
        return this.onRequest(event);
      case 'Network.responseReceived':
        return this.onResponse(event.tabId, event.requestId, event.response);
      case 'Network.loadingFinished':
        return this.onFinished(event.tabId, event.requestId, event.encodedDataLength, event.timestamp);
      case 'Network.loadingFailed':
        this.markFinalized(event.tabId, event.requestId, secondsToMs(event.timestamp));
        return [];
    }
  }

  /** Drop all HAR state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /** Discard all accumulated state. */
  clear(): void {
    this.perTab.clear();
  }

  /** Total tracked requests across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  private onRequest(
    event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
  ): readonly RequestLifecycleUpdate[] {
    const updates: RequestLifecycleUpdate[] = [];
    let state: RequestHarState;
    if (event.redirectResponse !== undefined) {
      // Continuation hop: the prior hop just finished — finalize its HAR
      // from the carried response before advancing the cursor.
      const existing = this.getState(event.tabId, event.requestId);
      state = existing ?? this.startState(event.tabId, event.requestId);
      if (existing !== undefined) {
        const finalized = this.finalizeRedirectHop(
          event.tabId,
          event.requestId,
          existing,
          event.redirectResponse,
          event.timestamp,
        );
        if (finalized !== undefined) updates.push(finalized);
        existing.hopCursor += 1;
      }
    } else {
      // Fresh lifecycle (also resets a reused requestId after gc).
      state = this.startState(event.tabId, event.requestId);
    }
    state.finalizedAtMs = undefined;
    state.hops[state.hopCursor] = {
      startedDateTime: wallTimeToIso(event.wallTime),
      request: event.request,
    };
    return updates;
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
    const total = totalTimeMs(redirectResponse.timing, nextRequestSec);
    return this.harAttached(tabId, requestId, hopIndex, hop, redirectResponse.encodedDataLength, total);
  }

  private onResponse(tabId: number, requestId: string, response: CdpResponseParams): readonly RequestLifecycleUpdate[] {
    const state = this.getState(tabId, requestId);
    if (state === undefined) return [];
    const hopIndex = state.hopCursor;
    const hop = state.hops[hopIndex];
    if (hop === undefined) return [];
    hop.response = response;
    // Partial: total time and transfer size are not known until the
    // body finishes; emit the headers/cookies/status now and refine later.
    return [this.harAttached(tabId, requestId, hopIndex, hop, undefined, undefined)];
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
    const total = totalTimeMs(hop.response.timing, finishedSec);
    return [this.harAttached(tabId, requestId, hopIndex, hop, encodedDataLength, total)];
  }

  private harAttached(
    tabId: number,
    requestId: string,
    hopIndex: number,
    hop: HopPartial,
    transferSize: number | undefined,
    totalMs: number | undefined,
  ): RequestLifecycleUpdate {
    const response = hop.response;
    const har: InspectorHarEntry = {
      startedDateTime: hop.startedDateTime,
      ...(totalMs !== undefined ? { time: totalMs } : {}),
      request: cdpRequestToHar(hop.request),
      ...(response !== undefined ? { response: cdpResponseToHar(response, transferSize) } : {}),
      ...(response?.remoteIPAddress !== undefined ? { serverIPAddress: response.remoteIPAddress } : {}),
      ...(response?.timing !== undefined ? { timings: cdpTimingToHar(response.timing, totalMs) } : {}),
    };
    return { kind: 'har-attached', tabId, requestId, hopIndex, har };
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
    const state: RequestHarState = { hopCursor: 0, hops: [] };
    tabMap.set(requestId, state);
    while (tabMap.size > MAX_CDP_HAR_REQUESTS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      tabMap.delete(oldest);
    }
    return state;
  }

  private ensureTab(tabId: number): Map<string, RequestHarState> {
    let tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
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
