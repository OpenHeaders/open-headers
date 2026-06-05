/**
 * Stateful CDP → page-stream correlator.
 *
 * Reconstructs HAR `log.pages[]` timings the way Chrome's exporter does,
 * but from the raw CDP stream instead of the page's (privacy-clamped)
 * Performance API. It folds two streams:
 *
 *   - the document `Network.requestWillBeSent` / `responseReceived` (the
 *     `type: 'Document'` request) — supplies the page-start baseline
 *     (`timing.requestTime`, Chrome's `PageLoad.startTime = mainRequest.
 *     startTime`) and the wall↔monotonic offset (`wallTime`, `timestamp`);
 *   - the `Page.*` lifecycle events — `frameNavigated` (main-frame commit =
 *     page boundary, ties to the document by `loaderId`),
 *     `domContentEventFired` / `loadEventFired` (the milestone timestamps).
 *
 * It emits {@link CdpPageSignal}s; the host wires those onto the
 * `PageStreamHub` (which owns page-id assignment + fan-out), exactly as the
 * devtools-page nav bridge does for the heuristic path. Mode-gating (one
 * page source per tab) lives in the host: a CDP-owned tab takes pages from
 * here, and the Performance-API bridge is suppressed for it.
 *
 * State posture mirrors the request correlators: scoped by tab, cleared by
 * {@link forgetTab}, with the per-tab document map bounded and reset at each
 * page boundary. No chrome; the math lives in {@link ./cdp-page-synth}.
 */

import { type CdpPageSignal, pageMilestoneMs, pageStartedAtMs } from './cdp-page-synth';
import type { CdpNetworkEvent } from './events';
import { cdpStoreRequestId } from './events';
import type { CdpPageEvent } from './page-events';

/**
 * Per-tab cap on tracked in-flight document requests. One real document
 * request exists per navigation, plus a handful of same-process sub-frame
 * documents; the cap bounds the leak from a navigation whose commit
 * (`frameNavigated`) never arrives. Oldest-inserted evicts first.
 */
export const MAX_CDP_PAGE_DOC_REQUESTS_PER_TAB = 256;

/** The document request fields the page start is computed from. */
interface DocRequest {
  /** Loader id — matched against the main frame's `loaderId` at commit. */
  readonly loaderId: string;
  /** First-hop `requestWillBeSent.wallTime` (UNIX seconds). */
  readonly wallTimeSec: number;
  /** First-hop `requestWillBeSent.timestamp` — monotonic issue time (seconds). */
  readonly issueSec: number;
  /** First-hop request URL — the page's committed `title` (redirect-chain root). */
  readonly url: string;
  /** Chain-root `timing.requestTime` — the start baseline. */
  requestTimeSec?: number;
}

interface TabPageState {
  /** In-flight document requests, keyed by namespaced store id. */
  readonly docByStoreId: Map<string, DocRequest>;
  /** The committed page's monotonic start + wall start, for milestone offsets. */
  current?: { readonly pageStartSec: number; readonly startedAtMs: number };
}

export class CdpPageCorrelator {
  private readonly perTab = new Map<number, TabPageState>();

  /**
   * Fold one CDP event (network or page) into the page state and return any
   * page signals it completes. The host applies these to the page hub.
   */
  observe(event: CdpNetworkEvent | CdpPageEvent): readonly CdpPageSignal[] {
    switch (event.method) {
      case 'Network.requestWillBeSent':
        return this.onDocumentRequest(event);
      case 'Network.responseReceived':
        return this.onDocumentResponse(event);
      case 'Page.frameNavigated':
        return this.onFrameNavigated(event);
      case 'Page.domContentEventFired':
        return this.onMilestone(event.tabId, event.timestamp, 'dcl');
      case 'Page.loadEventFired':
        return this.onMilestone(event.tabId, event.timestamp, 'load');
      default:
        return [];
    }
  }

  /** Drop all page state for a tab — invariant 2 (lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /** Discard all accumulated state. */
  clear(): void {
    this.perTab.clear();
  }

  private onDocumentRequest(
    event: Extract<CdpNetworkEvent, { method: 'Network.requestWillBeSent' }>,
  ): readonly CdpPageSignal[] {
    if (event.type !== 'Document') return [];
    const state = this.ensureState(event.tabId);
    const storeId = cdpStoreRequestId(event.sessionId, event.requestId);
    const existing = state.docByStoreId.get(storeId);

    // A redirected navigation reuses the request id across hops. The page
    // anchors to the redirect-chain ROOT (the host binds `PageLoad` to the
    // first request, so `url`/`startTime` are the original navigation's), so
    // a continuation must NOT overwrite the first hop's wall/issue/url. The
    // first continuation's `redirectResponse` carries the 302's own
    // `timing.requestTime` — the original request's send time — which is the
    // start baseline; earliest wins.
    if (event.redirectResponse !== undefined && existing !== undefined) {
      if (existing.requestTimeSec === undefined) {
        const rootRequestTime = event.redirectResponse.timing?.requestTime;
        if (rootRequestTime !== undefined) existing.requestTimeSec = rootRequestTime;
      }
      return [];
    }

    // First hop (or a mid-attach continuation with no tracked root): this
    // hop's request is the page-start baseline.
    state.docByStoreId.delete(storeId);
    const doc: DocRequest = {
      loaderId: event.loaderId,
      wallTimeSec: event.wallTime,
      issueSec: event.timestamp,
      url: event.request.url,
    };
    const rootRequestTime = event.redirectResponse?.timing?.requestTime;
    if (rootRequestTime !== undefined) doc.requestTimeSec = rootRequestTime;
    state.docByStoreId.set(storeId, doc);
    while (state.docByStoreId.size > MAX_CDP_PAGE_DOC_REQUESTS_PER_TAB) {
      const oldest = state.docByStoreId.keys().next().value;
      if (oldest === undefined) break;
      state.docByStoreId.delete(oldest);
    }
    return [];
  }

  private onDocumentResponse(
    event: Extract<CdpNetworkEvent, { method: 'Network.responseReceived' }>,
  ): readonly CdpPageSignal[] {
    const requestTime = event.response.timing?.requestTime;
    if (requestTime === undefined) return [];
    const doc = this.perTab.get(event.tabId)?.docByStoreId.get(cdpStoreRequestId(event.sessionId, event.requestId));
    // Set-once: a redirect already captured the chain-root start from the
    // first continuation's `redirectResponse`; the final hop's response must
    // not overwrite it. A non-redirect navigation gets its baseline here.
    if (doc !== undefined && doc.requestTimeSec === undefined) doc.requestTimeSec = requestTime;
    return [];
  }

  private onFrameNavigated(event: Extract<CdpPageEvent, { method: 'Page.frameNavigated' }>): readonly CdpPageSignal[] {
    // Only the tab's top frame is a page boundary; sub-frames carry a parent.
    if (event.frame.parentId !== undefined) return [];
    const state = this.perTab.get(event.tabId);
    const doc = state && this.findDocByLoader(state, event.frame.loaderId);
    if (!state || doc === undefined) return [];
    // `startTime` is the document request's `timing.requestTime`; until the
    // response lands it is the issue time (Chrome's `NetworkRequest.startTime`
    // pre-timing), the same fallback.
    const pageStartSec = doc.requestTimeSec ?? doc.issueSec;
    const startedAtMs = pageStartedAtMs(doc.wallTimeSec, doc.issueSec, pageStartSec);
    state.current = { pageStartSec, startedAtMs };
    // A new page begins; the prior navigation's document requests are spent.
    state.docByStoreId.clear();
    // Anchor the page title to the chain-root request URL (the host's bound
    // `mainRequest.url()`), not the final committed URL `event.frame.url` —
    // they differ for a redirected navigation.
    return [{ kind: 'nav-started', tabId: event.tabId, startedAtMs, url: doc.url }];
  }

  private onMilestone(tabId: number, eventSec: number, which: 'dcl' | 'load'): readonly CdpPageSignal[] {
    const current = this.perTab.get(tabId)?.current;
    if (current === undefined) return [];
    const ms = pageMilestoneMs(eventSec, current.pageStartSec);
    return [
      {
        kind: 'nav-timing',
        tabId,
        // `navStartMs` re-asserts the CDP-derived start so the hub keeps it
        // (it only corrects downward to a smaller value). Milestones are
        // offsets from that start.
        timing: {
          pageOrigin: null,
          navStartMs: current.startedAtMs,
          ...(which === 'dcl' ? { dclMs: ms } : { loadMs: ms }),
        },
      },
    ];
  }

  private findDocByLoader(state: TabPageState, loaderId: string): DocRequest | undefined {
    for (const doc of state.docByStoreId.values()) {
      if (doc.loaderId === loaderId) return doc;
    }
    return undefined;
  }

  private ensureState(tabId: number): TabPageState {
    let state = this.perTab.get(tabId);
    if (state === undefined) {
      state = { docByStoreId: new Map() };
      this.perTab.set(tabId, state);
    }
    return state;
  }
}
