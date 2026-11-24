/**
 * Stateful partial-HAR synthesis across the webRequest hop lifecycle —
 * the heuristic sibling of `CdpHarBuilder`, scoped to what webRequest
 * (plus the page's own Resource Timing) can honestly attest.
 *
 * One hop's partial entry spans several events (`onBeforeRequest` /
 * `onBeforeRedirect` seed the hop, `onSendHeaders` adds the wire request
 * headers, `onHeadersReceived` adds the response shell, the hop terminal
 * adds ip/error/time), so it cannot come from the pure per-event mapper.
 * This builder accumulates per `(tabId, requestId)` and emits:
 *
 *   - a partial `har-attached` at `onHeadersReceived` — the moment the
 *     detail tabs gain real response headers for an in-flight row; the
 *     entry carries the floor `timings` block (blocked from the event
 *     instants, receive still open);
 *   - a refined re-emit at the hop's terminal event (`onCompleted` /
 *     `onErrorOccurred` / `onBeforeRedirect`) carrying `serverIPAddress`,
 *     `_error`, the total `time` and the closed floor block;
 *   - a further re-emit when the page's Resource Timing entry joins the
 *     request ({@link observeResourceTiming}) and its connection legs
 *     upgrade the floor to the full ladder.
 *
 * The joined devtools HAR is always the better entry; once the correlator
 * attaches one for a hop ({@link noteRealHar}), the builder stops
 * refining that request so a later re-emit can never overwrite the
 * authoritative slot with the poorer partial. (The reverse order is
 * fine: a joined HAR landing after the refined partial overwrites it via
 * the store's slot semantics.)
 *
 * RT join semantics: Resource Timing entries are matched by URL — the
 * page records the ORIGINAL request URL for resources, so the index also
 * keys the hop-0 URL — then by closest request start inside
 * {@link RT_JOIN_WINDOW_MS}, with the document's navigation entry
 * restricted to `main_frame` hops (and resources excluded from them).
 * The pairing is sticky: a state remembers its entry's identity, so a
 * later cumulative snapshot refreshes the SAME pairing (legs land
 * progressively on a live navigation entry) instead of re-running the
 * match, and re-emits only when the computed block actually changed.
 * Terminal states are retained for {@link RT_RETENTION_MS} so the next
 * poll tick's snapshot can still join — the entry usually appears only
 * once the resource finishes.
 *
 * A hop no devtools entry will ever join is FINAL as built here, and its
 * entry says so: it carries the byte counts something recorded and the
 * no-body mark, so the row stops waiting. Two ways a hop gets there:
 *
 *   - its tab's host has no finished-request feed at all
 *     ({@link noteHarFeedAbsent}) — final from its first emission;
 *   - the host has feeds but the tab's was not open throughout the hop
 *     (its DevTools was closed) — final once the hop has ENDED. A hop
 *     still in flight is never final on such a host: its response is
 *     still arriving, and the row keeps reading as loading.
 *
 * State posture matches the correlator's sibling helpers (`HopCursor`,
 * `CorsContextStore`): per-tab maps, bounded with oldest-first eviction,
 * `forgetTab` on tab teardown; the retained terminal states age out on
 * the correlator's GC clock.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';

import { extractHeader } from './cors-classifier';
import type { WebRequestEvent, WebRequestHeader } from './events';
import type { ResourceTimingSnapshotEvent } from './resource-timing-events';
import {
  type PartialHarSizes,
  type PartialHarTerminal,
  type PartialHarTiming,
  partialHarEntry,
} from './webrequest-har-synth';
import { floorHarTimings, isResponseBodyIncomplete, resourceTimingHarTimings } from './webrequest-har-timings';

/** Per-tab cap on concurrently-tracked requests — `HopCursor`-style bound. */
export const MAX_PARTIAL_HAR_REQUESTS_PER_TAB = 5_000;

/**
 * How far the page-recorded request start may sit from the webRequest
 * `onBeforeRequest` instant for a same-URL pairing to hold. The two
 * clocks observe the same moment from different planes (renderer issue
 * vs network-stack arrival), so the usual gap is milliseconds; the
 * window only has to reject same-URL entries from a different burst.
 * Closest-start picks the winner inside it.
 */
export const RT_JOIN_WINDOW_MS = 30_000;

/**
 * How long a terminal hop state is retained for a late Resource Timing
 * join. The entry typically appears in the page's buffer at the
 * resource's end and reaches us on the next poll tick (≤ ~500 ms);
 * the window is generous to cover a slow tick without holding a whole
 * page's worth of states for long.
 */
export const RT_RETENTION_MS = 10_000;

interface PartialHarState {
  /** Hop index the partial attaches at; bumps on every `onBeforeRedirect`. */
  hopIndex: number;
  /** Hop start, wall-clock ms. */
  startedAtMs: number;
  /** Request (hop 0) start, wall-clock ms — the RT pairing instant. */
  requestStartedAtMs: number;
  /** Hop 0 URL — Resource Timing records the original request URL. */
  seedUrl: string;
  method: string;
  url: string;
  requestHeaders?: readonly WebRequestHeader[];
  /** `onHeadersReceived` instant — the floor block's first-byte mark. */
  headersReceivedAtMs?: number;
  /** Set once `onHeadersReceived` lands — the partial-emission gate. */
  response?: {
    readonly statusCode: number;
    readonly statusLine?: string;
    readonly responseHeaders?: readonly WebRequestHeader[];
    readonly resourceType: string;
  };
  /** Hop terminal facts — kept so an RT join can re-emit refined. */
  terminal?: PartialHarTerminal;
  /** The hop completed from a cache — nothing crossed the wire for it. */
  fromCache?: boolean;
  /** The joined Resource Timing entry + its clock, sticky per request. */
  rt?: { readonly entry: ResourceTimingEntry; readonly timeOriginMs: number; readonly key: string };
  /** Serialized timing of the last emission — the re-emit change gate. */
  lastTimingJson?: string;
  /** A joined devtools HAR claimed the CURRENT hop's slot — stop refining
   *  it. Reset on hop advance: a later hop's slot is still partial-owned. */
  superseded: boolean;
  /** The tab had no live finished-request feed at some point of the CURRENT
   *  hop's life — at its start, at its end, or when the feed closed in
   *  between — so no devtools entry will join it. Read afresh on hop advance. */
  feedMissed: boolean;
  /**
   * `true` between an `onBeforeRedirect` and the redirect target's own
   * `onBeforeRequest` (Chrome re-fires it per hop under the same requestId).
   * Tells that `onBeforeRequest` it is the next hop — keep the advanced
   * `hopIndex` and the hop-0 `seedUrl`, refine the hop's start/method/url —
   * rather than resetting the state to a fresh hop-0 request.
   */
  redirectPending: boolean;
}

/** Sticky identity of one Resource Timing entry inside its document. */
function rtEntryKey(entry: ResourceTimingEntry, isNavigation: boolean): string {
  return `${isNavigation ? 'n' : 'r'}#${entry.startTime}#${entry.name}`;
}

/**
 * The body length the server declared, for a hop that completed off the
 * network with a body: the framing guarantees a completed response
 * delivered exactly that many encoded bytes. The decoded size equals it
 * only when the body travelled unencoded.
 */
function declaredBodySizes(state: PartialHarState): PartialHarSizes | undefined {
  const { response, terminal } = state;
  if (response === undefined || terminal === undefined || terminal.error !== undefined) return undefined;
  if (state.fromCache === true || state.method.toUpperCase() === 'HEAD') return undefined;
  const status = response.statusCode;
  if (status < 200 || status === 204 || status === 304) return undefined;
  const declared = extractHeader(response.responseHeaders, 'Content-Length')?.trim();
  if (declared === undefined || !/^\d+$/.test(declared)) return undefined;
  const bodySize = Number(declared);
  const encoding = extractHeader(response.responseHeaders, 'Content-Encoding')?.trim().toLowerCase();
  const encoded = encoding !== undefined && encoding !== '' && encoding !== 'identity';
  return encoded ? { bodySize } : { bodySize, contentSize: bodySize };
}

/** The re-emit change gate's key: the timing block, plus sizes where a hop carries them. */
function emissionKey(timing: PartialHarTiming | undefined, sizes: PartialHarSizes | undefined): string {
  const timingJson = JSON.stringify(timing ?? null);
  return sizes === undefined ? timingJson : timingJson + JSON.stringify(sizes);
}

/** Every tab has a feed, for a host that does not track its feeds. */
const ALWAYS_LIVE = (): boolean => true;

/** Why a hop's partial is final — see the module doc. */
type FeedlessCause = 'host' | 'closed';

export class WebRequestHarBuilder {
  private readonly perTab = new Map<number, Map<string, PartialHarState>>();
  /** Tabs whose host declared no finished-request feed — see {@link noteHarFeedAbsent}. */
  private readonly harFeedAbsent = new Set<number>();

  /**
   * @param hasLiveFeed Whether a tab's finished-request feed is open right
   *   now. A host that tracks its feeds passes its answer; without one
   *   every tab is taken to have a feed and no hop is final for a closed one.
   */
  constructor(private readonly hasLiveFeed: (tabId: number) => boolean = ALWAYS_LIVE) {}

  /**
   * The tab's host has no finished-request feed, so no devtools HAR will
   * ever supersede its partial entries. From here its hops carry the byte
   * counts something recorded (the page's own timing entry, else the
   * declared body length) and say that no body will attach; a tab that
   * has a feed keeps its partials size-less and unmarked for as long as
   * a devtools entry may still join them.
   */
  noteHarFeedAbsent(tabId: number): void {
    this.harFeedAbsent.add(tabId);
  }

  /**
   * The tab's finished-request feed just closed. Every hop tracked for it
   * has now run without one; those that had already ended, still waiting
   * for their devtools entry, are re-emitted as final — the entry will
   * not come. Hops still in flight become final at their own end.
   */
  noteHarFeedClosed(tabId: number): readonly RequestLifecycleUpdate[] {
    const tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) return [];
    const updates: RequestLifecycleUpdate[] = [];
    for (const [requestId, state] of tabMap) {
      const wasFinal = this.feedlessCause(tabId, state) !== undefined;
      state.feedMissed = true;
      if (!wasFinal && state.terminal !== undefined) updates.push(...this.emitRefined(tabId, requestId, state));
    }
    return updates;
  }

  /**
   * Fold one webRequest event into the per-hop state and return the
   * `har-attached` updates it completes (at most one per event).
   */
  observe(event: WebRequestEvent): readonly RequestLifecycleUpdate[] {
    switch (event.method_kind) {
      case 'onBeforeRequest': {
        const existing = this.getState(event.tabId, event.requestId);
        if (existing?.redirectPending) {
          // Redirect target re-issue — the hop after a redirect. Keep the
          // advanced hop index and the hop-0 seedUrl (the RT pairing key);
          // refine this hop's start/method/url from the real event.
          existing.redirectPending = false;
          existing.startedAtMs = event.timeStamp;
          existing.method = event.method;
          existing.url = event.url;
          return [];
        }
        const tabMap = this.ensureTab(event.tabId);
        if (tabMap.has(event.requestId)) tabMap.delete(event.requestId);
        tabMap.set(event.requestId, {
          hopIndex: 0,
          startedAtMs: event.timeStamp,
          requestStartedAtMs: event.timeStamp,
          seedUrl: event.url,
          method: event.method,
          url: event.url,
          superseded: false,
          feedMissed: !this.hasLiveFeed(event.tabId),
          redirectPending: false,
        });
        this.evictIfOver(tabMap);
        return [];
      }
      case 'onSendHeaders': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        // Hops ≥ 1 see their real outgoing method/url here first (a 303
        // rewrites POST→GET); hop 0's values are unchanged.
        state.method = event.method;
        state.url = event.url;
        if (event.requestHeaders !== undefined) state.requestHeaders = event.requestHeaders;
        return [];
      }
      case 'onHeadersReceived': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        state.headersReceivedAtMs = event.timeStamp;
        state.response = {
          statusCode: event.statusCode,
          ...(event.statusLine !== undefined ? { statusLine: event.statusLine } : {}),
          ...(event.responseHeaders !== undefined ? { responseHeaders: event.responseHeaders } : {}),
          resourceType: event.type,
        };
        return this.emitRefined(event.tabId, event.requestId, state);
      }
      case 'onBeforeRedirect': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        // Refine the finishing hop, then advance to the next: a fresh
        // hop seed at the redirect timestamp, headers/response pending.
        this.endHop(event.tabId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
        });
        const updates = this.emitRefined(event.tabId, event.requestId, state);
        state.hopIndex += 1;
        state.startedAtMs = event.timeStamp;
        state.url = event.redirectUrl;
        state.superseded = false;
        state.feedMissed = !this.hasLiveFeed(event.tabId);
        // The redirect target's own onBeforeRequest carries this hop's real
        // start/method/url; it refines the seed instead of resetting it.
        state.redirectPending = true;
        delete state.requestHeaders;
        delete state.headersReceivedAtMs;
        delete state.response;
        delete state.terminal;
        delete state.fromCache;
        delete state.rt;
        delete state.lastTimingJson;
        return updates;
      }
      case 'onCompleted': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        this.endHop(event.tabId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
        });
        if (event.fromCache === true) state.fromCache = true;
        // Retained (not forgotten) so the next Resource Timing snapshot
        // can still upgrade the floor block; `gc` ages the state out.
        return this.emitRefined(event.tabId, event.requestId, state);
      }
      case 'onErrorOccurred': {
        const state = this.getState(event.tabId, event.requestId);
        if (state === undefined) return [];
        this.endHop(event.tabId, state, {
          completedAtMs: event.timeStamp,
          ...(event.ip !== undefined ? { ip: event.ip } : {}),
          error: event.error,
        });
        return this.emitRefined(event.tabId, event.requestId, state);
      }
    }
  }

  /**
   * Join one cumulative Resource Timing snapshot against the tab's
   * tracked requests and return the refined `har-attached` updates for
   * every pairing whose timing block changed (new joins and progressive
   * leg arrivals alike).
   */
  observeResourceTiming(event: ResourceTimingSnapshotEvent): readonly RequestLifecycleUpdate[] {
    const tabMap = this.perTab.get(event.tabId);
    if (tabMap === undefined) return [];

    // Sticky refresh first: a state that already owns an entry re-reads
    // the latest projection of the SAME entry (legs land progressively on
    // a live navigation entry), never re-matches.
    const byKey = new Map<string, { entry: ResourceTimingEntry; isNavigation: boolean }>();
    for (const entry of event.entries) byKey.set(rtEntryKey(entry, false), { entry, isNavigation: false });
    if (event.navigation !== undefined) {
      byKey.set(rtEntryKey(event.navigation, true), { entry: event.navigation, isNavigation: true });
    }

    const claimedKeys = new Set<string>();
    const updates: RequestLifecycleUpdate[] = [];
    for (const [requestId, state] of tabMap) {
      if (state.rt === undefined) continue;
      claimedKeys.add(state.rt.key);
      const latest = byKey.get(state.rt.key);
      if (latest === undefined) continue;
      state.rt = { entry: latest.entry, timeOriginMs: event.timeOriginMs, key: state.rt.key };
      updates.push(...this.emitIfTimingChanged(event.tabId, requestId, state));
    }

    // New pairings: closest request start per URL inside the window.
    for (const [key, { entry, isNavigation }] of byKey) {
      if (claimedKeys.has(key)) continue;
      const match = this.closestUnresolvedState(tabMap, entry, isNavigation, event.timeOriginMs);
      if (match === undefined) continue;
      const [requestId, state] = match;
      state.rt = { entry, timeOriginMs: event.timeOriginMs, key };
      claimedKeys.add(key);
      updates.push(...this.emitIfTimingChanged(event.tabId, requestId, state));
    }
    return updates;
  }

  /**
   * A joined devtools HAR attached at `(requestId, hopIndex)` — the
   * authoritative entry owns that slot; suppress further partial emissions
   * for it so a terminal refinement can't overwrite it. A join for an
   * earlier hop leaves the current hop's partial flow untouched.
   */
  noteRealHar(tabId: number, requestId: string, hopIndex: number): void {
    const state = this.getState(tabId, requestId);
    if (state !== undefined && state.hopIndex === hopIndex) state.superseded = true;
  }

  /** Age out terminal states past the Resource Timing join window. */
  gc(nowMs: number): void {
    for (const [tabId, tabMap] of this.perTab) {
      for (const [requestId, state] of tabMap) {
        if (state.terminal !== undefined && nowMs - state.terminal.completedAtMs > RT_RETENTION_MS) {
          tabMap.delete(requestId);
        }
      }
      if (tabMap.size === 0) this.perTab.delete(tabId);
    }
  }

  /** Drop all state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
    this.harFeedAbsent.delete(tabId);
  }

  /** Total tracked requests across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  /**
   * The unresolved state the entry pairs with: same URL (the hop-0 URL
   * for resources — the page records the original request URL — or the
   * final URL, which the navigation entry carries), document entries to
   * `main_frame` hops only and resources never to them, the recorded
   * response status when the page exposes one, and the closest request
   * start inside {@link RT_JOIN_WINDOW_MS}.
   */
  private closestUnresolvedState(
    tabMap: Map<string, PartialHarState>,
    entry: ResourceTimingEntry,
    isNavigation: boolean,
    timeOriginMs: number,
  ): [string, PartialHarState] | undefined {
    const entryStartMs = timeOriginMs + entry.startTime;
    let best: [string, PartialHarState] | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const [requestId, state] of tabMap) {
      if (state.rt !== undefined || state.response === undefined || state.headersReceivedAtMs === undefined) continue;
      if (state.url !== entry.name && state.seedUrl !== entry.name) continue;
      if ((state.response.resourceType === 'main_frame') !== isNavigation) continue;
      if (entry.responseStatus !== undefined && entry.responseStatus > 0) {
        if (state.response.statusCode !== entry.responseStatus) continue;
      }
      const delta = Math.abs(state.requestStartedAtMs - entryStartMs);
      if (delta > RT_JOIN_WINDOW_MS || delta >= bestDelta) continue;
      bestDelta = delta;
      best = [requestId, state];
    }
    return best;
  }

  /**
   * The hop's current timing block: the page-recorded ladder when an RT
   * entry has joined and passes the Timing-Allow-Origin check, else the
   * webRequest floor. `undefined` before `onHeadersReceived`.
   */
  private timingFor(state: PartialHarState): PartialHarTiming | undefined {
    if (state.headersReceivedAtMs === undefined) return undefined;
    const floor = floorHarTimings({
      startedAtMs: state.startedAtMs,
      headersReceivedAtMs: state.headersReceivedAtMs,
      ...(state.terminal !== undefined ? { completedAtMs: state.terminal.completedAtMs } : {}),
    });
    if (state.rt === undefined) return { timings: floor };
    const ladder = resourceTimingHarTimings(state.rt.entry, {
      timeOriginMs: state.rt.timeOriginMs,
      ...(state.terminal !== undefined ? { terminalMs: state.terminal.completedAtMs } : {}),
    });
    if (ladder === null) return { timings: floor };
    const incomplete = isResponseBodyIncomplete(state.rt.entry, state.terminal?.error);
    return { timings: ladder, ...(incomplete ? { responseBodyIncomplete: true } : {}) };
  }

  /** Record the hop's end, and whether it ended with the tab's feed closed. */
  private endHop(tabId: number, state: PartialHarState, terminal: PartialHarTerminal): void {
    state.terminal = terminal;
    if (!this.hasLiveFeed(tabId)) state.feedMissed = true;
  }

  /**
   * Why no devtools entry will ever join the hop — its partial is final —
   * or `undefined` while one still may. See the module doc.
   */
  private feedlessCause(tabId: number, state: PartialHarState): FeedlessCause | undefined {
    if (this.harFeedAbsent.has(tabId)) return 'host';
    return state.feedMissed && state.terminal !== undefined ? 'closed' : undefined;
  }

  /**
   * The hop's byte counts — only for a hop no devtools entry will join.
   * The page's own record wins when it exposes one (a cross-origin entry
   * that fails the Timing-Allow-Origin check reads all zeros); else the
   * declared body length of a completed response.
   */
  private sizesFor(tabId: number, state: PartialHarState): PartialHarSizes | undefined {
    if (this.feedlessCause(tabId, state) === undefined) return undefined;
    const page = state.rt?.entry;
    if (page !== undefined && (page.transferSize > 0 || page.encodedBodySize > 0 || page.decodedBodySize > 0)) {
      return { transferSize: page.transferSize, bodySize: page.encodedBodySize, contentSize: page.decodedBodySize };
    }
    return declaredBodySizes(state);
  }

  /** Re-emit the refined partial only when its timing block (or its sizes) changed. */
  private emitIfTimingChanged(
    tabId: number,
    requestId: string,
    state: PartialHarState,
  ): readonly RequestLifecycleUpdate[] {
    const timing = this.timingFor(state);
    const json = emissionKey(timing, this.sizesFor(tabId, state));
    if (json === state.lastTimingJson) return [];
    return this.emitRefined(tabId, requestId, state, timing, json);
  }

  private emitRefined(
    tabId: number,
    requestId: string,
    state: PartialHarState,
    timing?: PartialHarTiming,
    timingJson?: string,
  ): readonly RequestLifecycleUpdate[] {
    // A hop that never saw `onHeadersReceived` has no response shell to
    // emit (a blocked/failed-before-response request); its devtools
    // failure HAR, when one exists, carries the full entry.
    if (state.superseded || state.response === undefined) return [];
    const resolvedTiming = timing ?? this.timingFor(state);
    const sizes = this.sizesFor(tabId, state);
    state.lastTimingJson = timingJson ?? emissionKey(resolvedTiming, sizes);
    const har = partialHarEntry(
      {
        startedAtMs: state.startedAtMs,
        method: state.method,
        url: state.url,
        ...(state.requestHeaders !== undefined ? { requestHeaders: state.requestHeaders } : {}),
      },
      state.response,
      state.terminal,
      resolvedTiming,
      sizes,
    );
    // No devtools entry will ever join this hop, so no body will either.
    const feedless = this.feedlessCause(tabId, state);
    if (feedless !== undefined) har._ohBodyUnavailable = true;
    if (feedless === 'closed') har._ohFeedClosed = true;
    return [{ kind: 'har-attached', tabId, requestId, hopIndex: state.hopIndex, har }];
  }

  private getState(tabId: number, requestId: string): PartialHarState | undefined {
    return this.perTab.get(tabId)?.get(requestId);
  }

  private ensureTab(tabId: number): Map<string, PartialHarState> {
    let tabMap = this.perTab.get(tabId);
    if (tabMap === undefined) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
  }

  private evictIfOver(tabMap: Map<string, PartialHarState>): void {
    while (tabMap.size > MAX_PARTIAL_HAR_REQUESTS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      tabMap.delete(oldest);
    }
  }
}
