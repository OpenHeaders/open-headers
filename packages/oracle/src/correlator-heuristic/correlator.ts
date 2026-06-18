/**
 * `HeuristicCorrelator` — production-bound implementation of
 * {@link RequestCorrelator} that projects webRequest- and HAR-shaped
 * events into lifecycle updates.
 *
 * Construction is **dependency-injected only**: the caller passes both
 * a {@link WebRequestEventSource} and a {@link HarEventSource}. This
 * module names no chrome API; the host-bound bindings
 * (`ChromeWebRequestEventSource`, `ChromeHarEventSource`) live in the
 * extension SW, one layer out. Tests pass in-memory sources.
 *
 * Shape mirrors `CdpCorrelator` (sibling module) — the symmetry is
 * the proof that the {@link RequestCorrelator} contract is real and
 * not over-fit to either event source.
 *
 * Implementation status:
 *   - H1 webRequest mapping (start / headers / redirect / complete /
 *     fail)                                                          ✓
 *   - H2 HAR ingestion via the HarEventSource seam                   ✓
 *   - H3 closest-timestamp HAR ↔ requestId join (per-tab FIFO)       ✓
 *   - H7 invariant-8 late-arrival pair: forward-race
 *     {@link HarWaitingBuffer} + backward {@link FinalizedRetention}  ✓
 *   - H5 CORS classification: `Origin` captured on `onSendHeaders`,
 *     verdict computed on `onHeadersReceived` via {@link classifyCors},
 *     stamped onto every subsequent `phase` patch                     ✓
 *   - H6 `net::ERR_FAILED` → `oh:cors-*` error refinement pre-emit
 *     via {@link refineUpdateWithCors}                                ✓
 *   - H8/H9 per-hop HAR + body attribution via {@link HopCursor}: the
 *     correlator stamps `hopIndex` into {@link InFlightFifo} at record
 *     time. Each hop begins at its own `onBeforeRequest` (Chrome re-fires
 *     it for every redirect target under the same requestId): hop 0 on a
 *     fresh request, hops ≥ 1 on the `onBeforeRequest` following an
 *     `onBeforeRedirect`. HAR entries and their bodies inherit the stamp
 *     via the FIFO + body-join map.                                    ✓
 *   - HAR-only lifecycle synthesis: a failure-shaped HAR entry that
 *     expires un-joined (a request webRequest never saw — canceled
 *     while renderer-queued) mints its own `oh-har:` lifecycle instead
 *     of being dropped                                                ✓
 *   - Partial-HAR synthesis from webRequest wire facts (response
 *     headers / status line / ip) via {@link WebRequestHarBuilder}, so
 *     a row whose devtools HAR never arrives — canceled mid-stream, no
 *     terminal `onRequestFinished` — still populates the detail tabs;
 *     a joined devtools HAR supersedes the partial per hop            ✓
 *   - Resource Timing join (optional third source): the page-recorded
 *     connection legs upgrade a partial entry's floor `timings` block
 *     to the full ladder, the doc row via the navigation entry        ✓
 *
 * Deliberately deferred (own future sessions):
 *   - H4 per-URL FIFO matching refinements on top of the current FIFO
 */

import type {
  RequestCorrelator,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';
import { BodyJoinMap } from './body-join-map';
import { classifyCors, extractHeader } from './cors-classifier';
import { CorsContextStore } from './cors-context-store';
import { refineUpdateWithCors } from './cors-error-refinement';
import type { CorsVerdict } from './cors-types';
import type { WebRequestEvent, WebRequestEventSource } from './events';
import { FinalizedRetention } from './finalized-retention';
import type { HarEvent, HarEventSource } from './har-events';
import {
  bodyAttachedUpdate,
  harAttachedUpdate,
  harEntryDurationMs,
  harEntryJoinFields,
  harEntryTimestamp,
  harOnlyLifecycleUpdates,
  hasHarFailureVerdict,
  isMemoryCacheHarEntry,
  memoryCacheHarLifecycleUpdates,
} from './har-to-update';
import type { HarWaitingDropLogger } from './har-waiting-buffer';
import { HarWaitingBuffer } from './har-waiting-buffer';
import { HopCursor } from './hop-cursor';
import type { FifoEvictionLogger, InFlightMatch } from './in-flight-fifo';
import { InFlightFifo } from './in-flight-fifo';
import { HAR_FAILURE_HOLD_MS, HAR_FORWARD_HOLD_MS } from './late-arrival-constants';
import { RecentLifecyclesMirror } from './recent-lifecycles-mirror';
import type { ResourceTimingEvent, ResourceTimingEventSource } from './resource-timing-events';
import { WebRequestHarBuilder } from './webrequest-har-builder';
import { webRequestEventToUpdates } from './webrequest-to-update';

/**
 * Required injections for the heuristic correlator. The webRequest and
 * HAR seams are mandatory; hosts without a real HAR pipeline pass a noop
 * `HarEventSource` (`{ subscribe: () => () => {} }`). The Resource
 * Timing seam is optional — it exists only while a DevTools session
 * samples the inspected page; without it every partial HAR keeps its
 * webRequest-floor timing block.
 */
export interface HeuristicCorrelatorSources {
  readonly webRequest: WebRequestEventSource;
  readonly har: HarEventSource;
  readonly resourceTiming?: ResourceTimingEventSource;
}

/**
 * Optional drop/loss observers for the HAR-attachment path. All
 * production drop sites are silent by default (see lifecycle audit
 * §1.7); a host wires these to surface where HAR attribution is lost.
 * Pure observation — never alters correlation.
 */
export interface CorrelatorDiagnostics {
  /** In-flight URL-LRU evicted a non-empty queue → join keys lost. */
  readonly onFifoEviction?: FifoEvictionLogger;
  /** A buffered (forward-race) HAR entry was dropped without attaching. */
  readonly onHarWaitingDrop?: HarWaitingDropLogger;
  /**
   * A HAR entry found no in-flight slot and was parked in the waiting
   * buffer. `pending` is how many in-flight entries exist for the URL:
   * 0 = key never recorded (not ingested / lost to SW restart),
   * >0 = key present but no candidate matched (timestamp/method drift).
   * The bucket counts + `nearestDeltaMs` (signed `entry.t - harTs` of the
   * closest method-matching entry) say which gate rejected the match.
   */
  readonly onJoinMiss?: (info: {
    readonly tabId: number;
    readonly url: string;
    readonly method: string;
    readonly harTimestamp: number;
    readonly pending: number;
    readonly methodMismatch: number;
    readonly tooOld: number;
    readonly tooNew: number;
    readonly nearestDeltaMs: number | null;
  }) => void;
  /**
   * `popMatching` resolved a join key but the lifecycle had already been
   * pruned from `recentLifecycles` → the resolved HAR is discarded.
   */
  readonly onRetentionDrop?: (info: { readonly tabId: number; readonly requestId: string }) => void;
}

export class HeuristicCorrelator implements RequestCorrelator {
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly attached = new Set<number>();
  private readonly recentLifecycles = new RecentLifecyclesMirror();
  private readonly inFlight: InFlightFifo;
  private readonly bodyJoin = new BodyJoinMap();
  private readonly harWaiting: HarWaitingBuffer;
  private readonly finalizedRetention = new FinalizedRetention();
  private readonly corsContext = new CorsContextStore();
  private readonly hopCursor = new HopCursor();
  private readonly partialHar = new WebRequestHarBuilder();
  private readonly diagnostics: CorrelatorDiagnostics | undefined;
  private readonly webRequestUnsubscribe: () => void;
  private readonly harUnsubscribe: () => void;
  private readonly resourceTimingUnsubscribe: () => void;
  /** Monotonic suffix for `oh-har:` synthesized request ids. */
  private harOnlySequence = 0;

  constructor(sources: HeuristicCorrelatorSources, diagnostics?: CorrelatorDiagnostics) {
    this.diagnostics = diagnostics;
    this.inFlight = new InFlightFifo({ onEviction: diagnostics?.onFifoEviction });
    this.harWaiting = new HarWaitingBuffer({ onDrop: diagnostics?.onHarWaitingDrop });
    this.webRequestUnsubscribe = sources.webRequest.subscribe((event) => this.onWebRequestEvent(event));
    this.harUnsubscribe = sources.har.subscribe((event) => this.onHarEvent(event));
    this.resourceTimingUnsubscribe =
      sources.resourceTiming?.subscribe((event) => this.onResourceTimingEvent(event)) ?? (() => {});
  }

  attachTab(tabId: number): void {
    this.attached.add(tabId);
  }

  detachTab(tabId: number): void {
    this.attached.delete(tabId);
    this.recentLifecycles.forgetTab(tabId);
    this.inFlight.forgetTab(tabId);
    this.bodyJoin.forgetTab(tabId);
    this.harWaiting.forgetTab(tabId);
    this.finalizedRetention.forgetTab(tabId);
    this.corsContext.forgetTab(tabId);
    this.hopCursor.forgetTab(tabId);
    this.partialHar.forgetTab(tabId);
  }

  subscribe(listener: RequestLifecycleListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stop processing events from all sources. Tests use this to tear down. */
  dispose(): void {
    this.webRequestUnsubscribe();
    this.harUnsubscribe();
    this.resourceTimingUnsubscribe();
    this.listeners.clear();
    this.attached.clear();
    this.recentLifecycles.clear();
    // Per-tab maps clear by dropping references — `forgetTab` loops
    // would be redundant since the whole correlator is going away.
  }

  private onWebRequestEvent(event: WebRequestEvent): void {
    if (!this.attached.has(event.tabId)) return;
    this.gcLateArrival(event.timeStamp);
    // A DNR `redirect`/`query-param` rule rewrites the URL IN PLACE — webRequest
    // fires NO `onBeforeRedirect` for it; the only signal is that `onSendHeaders`
    // carries a different URL than the hop's `onBeforeRequest`. Synthesize the
    // internal-redirect hop from that change (the host's devtools records it as
    // its own 307 entry) and process it before the real event, so the chain
    // surfaces the rule's own leg + its rewritten destination.
    const rewrite = this.synthesizeInPlaceRewrite(event);
    if (rewrite !== undefined) this.processWebRequestEvent(rewrite);
    this.processWebRequestEvent(event);
  }

  private processWebRequestEvent(event: WebRequestEvent): void {
    // Bookkeeping before mapping — keeps the FIFO and hop-cursor
    // authoritative even if a listener throws downstream (the for-loop
    // in `emit` already tolerates, but ordering is clearer this way).
    this.maybeUpdateHopBookkeeping(event);
    const verdict = this.maybeUpdateCorsContext(event);
    const updates = webRequestEventToUpdates(event);
    for (const update of updates) this.emit(refineUpdateWithCors(update, verdict));
    // Partial-HAR synthesis from the wire facts webRequest itself carries
    // (response headers / status line / ip), so a row whose devtools HAR
    // never arrives — a request canceled mid-stream gets no terminal
    // `onRequestFinished` — still populates the detail tabs. Emitted after
    // the mapper's updates so the phase change precedes its HAR, matching
    // the CDP correlator's ordering; a joined devtools HAR supersedes the
    // partial per hop (see `attachHarEntry`).
    for (const update of this.partialHar.observe(event)) this.emit(update);
    // After the started emission seeds `recentLifecycles`, drain any
    // HAR entries that were held waiting for this in-flight slot.
    if (event.method_kind === 'onBeforeRequest') {
      this.drainHarWaiting(event.tabId);
    }
  }

  /**
   * Detect a DNR in-place URL rewrite and return the synthetic
   * `onBeforeRedirect` that represents it, or `undefined` when the event is
   * not a rewrite. A `redirect`/`query-param` rule changes the URL between
   * `onBeforeRequest` and `onSendHeaders` with no `onBeforeRedirect` of its
   * own; comparing `onSendHeaders`' URL to the hop's recorded URL surfaces it.
   * The synthetic hop is the internal redirect (`source → rewritten`, 307) the
   * host's devtools also records — feeding it through the normal pipeline makes
   * the chain reconstruction identical to a server redirect's.
   */
  private synthesizeInPlaceRewrite(event: WebRequestEvent): WebRequestEvent | undefined {
    if (event.method_kind !== 'onSendHeaders') return undefined;
    const hopUrl = this.hopCursor.currentUrl(event.tabId, event.requestId);
    if (hopUrl === undefined || hopUrl === '' || hopUrl === event.url) return undefined;
    return {
      method_kind: 'onBeforeRedirect',
      tabId: event.tabId,
      requestId: event.requestId,
      url: hopUrl,
      method: event.method,
      type: event.type,
      timeStamp: event.timeStamp,
      statusCode: 307,
      redirectUrl: event.url,
      internal: true,
    };
  }

  /**
   * Side-effects on {@link InFlightFifo} + {@link HopCursor} that thread the
   * correct hop index into every HAR / body attachment downstream (H8/H9).
   * Each hop begins at its own event — `onBeforeRequest` for a fresh request
   * or a server redirect's target, `onSendHeaders` for a DNR in-place rewrite
   * (whose synthetic `onBeforeRedirect` ran just before):
   *
   *   - A fresh `onBeforeRequest` (no pending redirect) seeds hop 0.
   *   - `onBeforeRedirect` (server or synthetic) advances the cursor and marks
   *     the next hop's FIFO record pending.
   *   - The next hop-bearing event — the target's `onBeforeRequest` (server
   *     redirect) or the rewriting `onSendHeaders` (DNR rewrite) — consumes the
   *     pending record and stamps the FIFO entry at the advanced hop index with
   *     the now-known URL + method.
   *
   *   - `onCompleted` / `onErrorOccurred` stamp the terminal time onto the
   *     (still-held) FIFO record — the wire-measured duration that breaks
   *     warm-burst same-URL ties when the late HAR arrives.
   *
   * Hop-cursor entries are released at terminal-phase emission (`emit` does
   * the `forget`).
   */
  private maybeUpdateHopBookkeeping(event: WebRequestEvent): void {
    switch (event.method_kind) {
      case 'onBeforeRequest': {
        // A pending redirect (set by the preceding onBeforeRedirect) marks
        // this as a server redirect's target — hop ≥ 1. Record it at the
        // advanced hop index with this hop's own URL + method. Otherwise it's
        // a fresh request: seed hop 0.
        const pending = this.hopCursor.consumePendingRecord(event.tabId, event.requestId, event.method, event.url);
        if (pending !== undefined) {
          this.inFlight.record(
            event.tabId,
            event.url,
            event.requestId,
            event.timeStamp,
            pending.method,
            pending.hopIndex,
          );
        } else {
          this.inFlight.record(event.tabId, event.url, event.requestId, event.timeStamp, event.method, 0);
          this.hopCursor.start(event.tabId, event.requestId, event.method, event.url);
        }
        return;
      }
      case 'onSendHeaders': {
        // A DNR in-place rewrite synthesized a redirect just before this event,
        // leaving the rewritten hop's FIFO record owed — its own
        // `onBeforeRequest` never fires, so record it here. A normal
        // `onSendHeaders` has no pending record and is a no-op.
        const pending = this.hopCursor.consumePendingRecord(event.tabId, event.requestId, event.method, event.url);
        if (pending !== undefined) {
          this.inFlight.record(
            event.tabId,
            event.url,
            event.requestId,
            event.timeStamp,
            pending.method,
            pending.hopIndex,
          );
          this.drainHarWaiting(event.tabId);
        }
        return;
      }
      case 'onBeforeRedirect':
        this.hopCursor.noteRedirect(event.tabId, event.requestId);
        return;
      case 'onCompleted':
      case 'onErrorOccurred':
        this.inFlight.noteTerminal(event.tabId, event.url, event.requestId, event.timeStamp);
        return;
      default:
        return;
    }
  }

  /**
   * Side-effects on the CORS context store + returns the verdict to
   * stamp onto whatever updates this event produces.
   *
   * `onSendHeaders` is record-only (mapper emits nothing); the verdict
   * is `undefined` because we don't have ACAO yet. `onHeadersReceived`
   * finalizes a fresh verdict that refines the `headers-received`
   * patch. `onCompleted` / `onErrorOccurred` *consume* the stored
   * verdict — terminal-phase emission is the last reader.
   *
   * Non-CORS events (`onBeforeRequest`, `onBeforeRedirect`) return
   * `undefined`. Redirect deliberately does not consume: the next hop's
   * `onSendHeaders` overwrites the captured origin cleanly.
   */
  private maybeUpdateCorsContext(event: WebRequestEvent): CorsVerdict | undefined {
    switch (event.method_kind) {
      case 'onSendHeaders': {
        this.corsContext.recordOrigin(event.tabId, event.requestId, extractHeader(event.requestHeaders, 'Origin'));
        return undefined;
      }
      case 'onHeadersReceived': {
        const origin = this.corsContext.getOrigin(event.tabId, event.requestId);
        const acao = extractHeader(event.responseHeaders, 'Access-Control-Allow-Origin');
        const verdict = classifyCors({ origin, requestUrl: event.url, acao });
        this.corsContext.finalize(event.tabId, event.requestId, verdict);
        return verdict;
      }
      case 'onCompleted':
      case 'onErrorOccurred':
        return this.corsContext.consume(event.tabId, event.requestId);
      default:
        return undefined;
    }
  }

  /**
   * Join one Resource Timing snapshot against the partial-HAR builder's
   * tracked requests — the page-recorded connection legs upgrade the
   * floor timing block of every matching hop slot (Slice J). Joined
   * devtools HARs stay authoritative (the builder's supersession holds);
   * the panel's memory-cache reconciliation is untouched — it counts the
   * same entries against the same real lifecycles either way.
   */
  private onResourceTimingEvent(event: ResourceTimingEvent): void {
    if (!this.attached.has(event.tabId)) return;
    for (const update of this.partialHar.observeResourceTiming(event)) this.emit(update);
  }

  private onHarEvent(event: HarEvent): void {
    if (!this.attached.has(event.tabId)) return;
    if (event.kind === 'har-entry') {
      const ts = harEntryTimestamp(event.entry);
      if (ts !== null) this.gcLateArrival(ts);
      this.onHarEntry(event.tabId, event.entry);
      return;
    }
    if (event.kind === 'har-body') {
      this.onHarBody(event.tabId, event.body);
    }
  }

  private onHarEntry(tabId: number, entry: InspectorHarEntry): void {
    const { url, method } = harEntryJoinFields(entry);
    const ts = harEntryTimestamp(entry);
    if (!url || ts === null) return;
    // A memory-cache hit fired no webRequest events — no lifecycle and no
    // FIFO record exist for it, and any same-URL FIFO match its entry
    // could make (now or from the waiting buffer) is a DIFFERENT, wire
    // request. Mint its own lifecycle immediately instead of offering it
    // to the join (probe-proven: a held memory-cache entry mis-attached
    // to a later same-URL wire request, which then lost its own entry).
    if (isMemoryCacheHarEntry(entry)) {
      this.mintMemoryCacheLifecycle(tabId, entry, method, url);
      return;
    }
    // Snapshot the candidate picture BEFORE popMatching sweeps stale
    // entries — only when a miss observer is wired (zero cost otherwise).
    const onJoinMiss = this.diagnostics?.onJoinMiss;
    const diag = onJoinMiss ? this.inFlight.diagnoseMatch(tabId, url, ts, method) : undefined;
    const match = this.inFlight.popMatching(tabId, url, ts, method, harEntryDurationMs(entry));
    if (match === undefined) {
      // Forward race (H7): no in-flight slot recorded yet. Hold so the
      // matching onBeforeRequest — if it lands within the window — can drain
      // this entry. Failure-shaped entries get the short fuse: their expiry
      // synthesizes the `(canceled)` row, and the panel reads wrong until it
      // lands.
      if (onJoinMiss && diag) onJoinMiss({ tabId, url, method, harTimestamp: ts, ...diag });
      this.harWaiting.hold(tabId, entry, ts, hasHarFailureVerdict(entry) ? HAR_FAILURE_HOLD_MS : HAR_FORWARD_HOLD_MS);
      return;
    }
    this.attachHarEntry(tabId, match, entry, method, url);
  }

  /**
   * Mint a `har-attached` update for a resolved {@link InFlightMatch}.
   * Shared by the eager onHarEntry path and the drain path that fires
   * after a late hop record matches a buffered entry. The `hopIndex`
   * was stamped at FIFO record time (H8/H9) — body-join inherits it
   * so the body emission stays consistent with its entry.
   */
  private attachHarEntry(
    tabId: number,
    match: InFlightMatch,
    entry: InspectorHarEntry,
    method: string,
    url: string,
  ): void {
    // Confirm a lifecycle exists for this `(tabId, requestId)`. The
    // attach-gated webRequest path always seeds one via `started`
    // before the HAR catches up, so a missing lifecycle here is a
    // genuine race (e.g. lifecycle was forgotten after tab close) —
    // drop rather than mint a floating attachment.
    if (!this.recentLifecycles.has(tabId, match.requestId)) {
      this.diagnostics?.onRetentionDrop?.({ tabId, requestId: match.requestId });
      return;
    }
    this.bodyJoin.remember(tabId, method, url, entry.startedDateTime, {
      requestId: match.requestId,
      hopIndex: match.hopIndex,
    });
    // The joined entry is authoritative for this hop slot — stop the
    // partial-HAR builder from refining over it at the hop's terminal.
    this.partialHar.noteRealHar(tabId, match.requestId, match.hopIndex);
    this.emit(harAttachedUpdate({ tabId, requestId: match.requestId, hopIndex: match.hopIndex, entry }));
  }

  /**
   * After a hop record lands (hop 0 at `onBeforeRequest` or hop ≥ 1
   * at `onSendHeaders`), retry any HAR entries previously held for
   * this tab. Each successful match attaches via the shared
   * `attachHarEntry` path with its `hopIndex` recovered from the
   * FIFO.
   */
  private drainHarWaiting(tabId: number): void {
    const matched = this.harWaiting.drain(tabId, (entry) => {
      const { url, method } = harEntryJoinFields(entry);
      const ts = harEntryTimestamp(entry);
      if (!url || ts === null) return undefined;
      return this.inFlight.popMatching(tabId, url, ts, method, harEntryDurationMs(entry));
    });
    for (const { entry, requestId, hopIndex } of matched) {
      const { url, method } = harEntryJoinFields(entry);
      this.attachHarEntry(tabId, { requestId, hopIndex }, entry, method, url);
    }
  }

  /**
   * Host-driven GC tick. The internal clock only advances on incoming
   * events, so a tab that goes quiet right after a burst (e.g. the user
   * stops a page load) would starve the expiry sweep — and with it the
   * HAR-only synthesis below. Hosts call this on a trailing timer after
   * the last HAR delivery; `nowMs` is wall-clock ms like every event
   * timestamp this correlator consumes.
   */
  gcTick(nowMs: number): void {
    this.gcLateArrival(nowMs);
  }

  /**
   * GC tick driven by incoming event timestamps. Expires held HAR
   * entries past their window — synthesizing a HAR-only lifecycle for
   * the failure-shaped ones — and releases finalized lifecycles whose
   * retention window has elapsed (deleting them from
   * `recentLifecycles` so the mirror stays bounded).
   */
  private gcLateArrival(nowMs: number): void {
    for (const { tabId, entry } of this.harWaiting.gc(nowMs)) {
      if (this.maybeSynthesizeFromExpiredHar(tabId, entry)) continue;
      this.diagnostics?.onHarWaitingDrop?.({ tabId, reason: 'expired', entry });
    }
    const expired = this.finalizedRetention.gcExpired(nowMs);
    for (const { tabId, requestId } of expired) {
      this.recentLifecycles.forget(tabId, requestId);
    }
    this.partialHar.gc(nowMs);
  }

  /**
   * HAR-only lifecycle synthesis (the canceled-while-queued fix). A
   * failure-shaped HAR entry that spent the whole forward-race window
   * un-joined describes a request `webRequest` never saw — typically one
   * the renderer canceled before it reached the network stack. The host's
   * devtools recorded it (and Chrome's own panel shows it as canceled),
   * so dropping it silently both loses the row AND leaves the request's
   * Resource Timing entry un-matched, which the panel's memory-cache
   * reconciliation then misreads as a cache hit. Mint a lifecycle from
   * the entry instead: the host's `_error` verdict is a recorded fact,
   * never a guess, and the synthesis only fires after the join had its
   * full window. Non-failure entries keep today's drop semantics.
   *
   * Returns whether the entry was synthesized.
   */
  private maybeSynthesizeFromExpiredHar(tabId: number, entry: InspectorHarEntry): boolean {
    if (!this.attached.has(tabId)) return false;
    if (!hasHarFailureVerdict(entry)) return false;
    const requestId = `oh-har:${++this.harOnlySequence}`;
    const updates = harOnlyLifecycleUpdates({ tabId, requestId, entry });
    if (updates.length === 0) return false;
    // Register the body join so a late `getContent` delivery for this
    // entry still attaches (keyed the same way joined entries are).
    const { url, method } = harEntryJoinFields(entry);
    this.bodyJoin.remember(tabId, method, url, entry.startedDateTime, { requestId, hopIndex: 0 });
    for (const update of updates) this.emit(update);
    return true;
  }

  /**
   * HAR-only lifecycle for a memory-cache hit — minted eagerly at entry
   * arrival (unlike the failure synthesis, which waits out the join
   * window: a memory-cache entry can never join, so there is nothing to
   * wait for). The lifecycle carries the host's full header sets where
   * the panel's Resource Timing synthesis could only mint a headerless
   * row — and the count-based reconciliation retires that synthetic once
   * this row exists.
   */
  private mintMemoryCacheLifecycle(tabId: number, entry: InspectorHarEntry, method: string, url: string): void {
    const requestId = `oh-har:${++this.harOnlySequence}`;
    const updates = memoryCacheHarLifecycleUpdates({ tabId, requestId, entry });
    if (updates.length === 0) return;
    this.bodyJoin.remember(tabId, method, url, entry.startedDateTime, { requestId, hopIndex: 0 });
    for (const update of updates) this.emit(update);
  }

  private onHarBody(tabId: number, body: InspectorHarBody): void {
    const target = this.bodyJoin.consume(tabId, body.method, body.url, body.startedDateTime);
    if (target === undefined) return;
    this.emit(bodyAttachedUpdate({ tabId, requestId: target.requestId, hopIndex: target.hopIndex, body }));
  }

  private emit(update: RequestLifecycleUpdate): void {
    if (update.kind === 'started') {
      this.recentLifecycles.set(update.lifecycle.tabId, update.lifecycle.requestId, update.lifecycle);
    } else if (
      update.kind === 'phase' &&
      (update.patch.phase === 'completed' || update.patch.phase === 'failed') &&
      update.patch.completedAtMs !== undefined
    ) {
      // Terminal-phase emission — start the retention clock so the
      // recentLifecycles mirror gets pruned once the late-arrival
      // window elapses. `completedAtMs` is set by the webRequest
      // mapper for both onCompleted and onErrorOccurred branches.
      this.finalizedRetention.markFinalized(update.tabId, update.requestId, update.patch.completedAtMs);
      // Hop bookkeeping is done — release the cursor. The FIFO entry
      // for the current hop is consumed by its HAR (or expires via
      // staleness sweep); the cursor exists only to bridge
      // onBeforeRedirect → onSendHeaders and has no further role.
      this.hopCursor.forget(update.tabId, update.requestId);
    }
    for (const listener of this.listeners) listener(update);
  }
}
