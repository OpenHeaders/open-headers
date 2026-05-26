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
 * Shape mirrors `CdpCorrelatorStub` (sibling module) — the symmetry is
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
 *     time (hop 0 at `onBeforeRequest`; hops ≥ 1 at the
 *     `onSendHeaders` following an `onBeforeRedirect`). HAR entries
 *     and their bodies inherit the stamp via the FIFO + body-join
 *     map.                                                            ✓
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

import type { CorsVerdict } from './cors-types';

import { BodyJoinMap } from './body-join-map';
import { classifyCors, extractHeader } from './cors-classifier';
import { CorsContextStore } from './cors-context-store';
import { refineUpdateWithCors } from './cors-error-refinement';
import type { WebRequestEvent, WebRequestEventSource } from './events';
import { FinalizedRetention } from './finalized-retention';
import { bodyAttachedUpdate, harAttachedUpdate, harEntryJoinFields, harEntryTimestamp } from './har-to-update';
import type { HarEvent, HarEventSource } from './har-events';
import { HarWaitingBuffer } from './har-waiting-buffer';
import { HopCursor } from './hop-cursor';
import { InFlightFifo } from './in-flight-fifo';
import type { InFlightMatch } from './in-flight-fifo';
import { RecentLifecyclesMirror } from './recent-lifecycles-mirror';
import { webRequestEventToUpdates } from './webrequest-to-update';

/**
 * Required injections for the heuristic correlator. Both seams are
 * mandatory; hosts without a real HAR pipeline pass a noop
 * `HarEventSource` (`{ subscribe: () => () => {} }`).
 */
export interface HeuristicCorrelatorSources {
  readonly webRequest: WebRequestEventSource;
  readonly har: HarEventSource;
}

export class HeuristicCorrelator implements RequestCorrelator {
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly attached = new Set<number>();
  private readonly recentLifecycles = new RecentLifecyclesMirror();
  private readonly inFlight = new InFlightFifo();
  private readonly bodyJoin = new BodyJoinMap();
  private readonly harWaiting = new HarWaitingBuffer();
  private readonly finalizedRetention = new FinalizedRetention();
  private readonly corsContext = new CorsContextStore();
  private readonly hopCursor = new HopCursor();
  private readonly webRequestUnsubscribe: () => void;
  private readonly harUnsubscribe: () => void;

  constructor(sources: HeuristicCorrelatorSources) {
    this.webRequestUnsubscribe = sources.webRequest.subscribe((event) => this.onWebRequestEvent(event));
    this.harUnsubscribe = sources.har.subscribe((event) => this.onHarEvent(event));
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
  }

  subscribe(listener: RequestLifecycleListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stop processing events from both sources. Tests use this to tear down. */
  dispose(): void {
    this.webRequestUnsubscribe();
    this.harUnsubscribe();
    this.listeners.clear();
    this.attached.clear();
    this.recentLifecycles.clear();
    // Per-tab maps clear by dropping references — `forgetTab` loops
    // would be redundant since the whole correlator is going away.
  }

  private onWebRequestEvent(event: WebRequestEvent): void {
    if (!this.attached.has(event.tabId)) return;
    this.gcLateArrival(event.timeStamp);
    // Bookkeeping before mapping — keeps the FIFO and hop-cursor
    // authoritative even if a listener throws downstream (the for-loop
    // in `emit` already tolerates, but ordering is clearer this way).
    this.maybeUpdateHopBookkeeping(event);
    const verdict = this.maybeUpdateCorsContext(event);
    const updates = webRequestEventToUpdates(event);
    for (const update of updates) this.emit(refineUpdateWithCors(update, verdict));
    // After the started emission seeds `recentLifecycles`, drain any
    // HAR entries that were held waiting for this in-flight slot.
    if (event.method_kind === 'onBeforeRequest') {
      this.drainHarWaiting(event.tabId);
    }
  }

  /**
   * Side-effects on {@link InFlightFifo} + {@link HopCursor} that
   * thread the correct hop index into every HAR / body attachment
   * downstream (H8/H9).
   *
   *   - `onBeforeRequest` seeds hop 0 into both stores in lockstep.
   *   - `onBeforeRedirect` advances the cursor but defers the FIFO
   *     record: the next hop's actual outgoing method is unknown at
   *     this point (a 303 rewrites POST→GET) and the HAR's method
   *     gate would otherwise miss the join.
   *   - `onSendHeaders` for hops ≥ 1 consumes the pending record and
   *     stamps the FIFO entry with the now-known method. Hop 0's
   *     `onSendHeaders` produces no FIFO record (it already exists)
   *     but still runs for CORS-context capture downstream.
   *
   * Bookkeeping is silent on the H6 / non-CORS paths (`onHeadersReceived`,
   * `onCompleted`, `onErrorOccurred`). Hop-cursor entries are released
   * at terminal-phase emission (`emit` does the `forget`).
   */
  private maybeUpdateHopBookkeeping(event: WebRequestEvent): void {
    switch (event.method_kind) {
      case 'onBeforeRequest':
        this.inFlight.record(event.tabId, event.url, event.requestId, event.timeStamp, event.method, 0);
        this.hopCursor.start(event.tabId, event.requestId, event.method);
        return;
      case 'onBeforeRedirect':
        this.hopCursor.noteRedirect(event.tabId, event.requestId);
        return;
      case 'onSendHeaders': {
        const pending = this.hopCursor.consumePendingRecord(
          event.tabId,
          event.requestId,
          event.method,
        );
        if (pending === undefined) return;
        this.inFlight.record(
          event.tabId,
          event.url,
          event.requestId,
          event.timeStamp,
          pending.method,
          pending.hopIndex,
        );
        // A late HAR for the newly-recorded hop may already be sitting
        // in the waiting buffer — drain to surface those attachments
        // before the next event.
        this.drainHarWaiting(event.tabId);
        return;
      }
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
        this.corsContext.recordOrigin(
          event.tabId,
          event.requestId,
          extractHeader(event.requestHeaders, 'Origin'),
        );
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
    const match = this.inFlight.popMatching(tabId, url, ts, method);
    if (match === undefined) {
      // Forward race (H7): no in-flight slot recorded yet. Hold for
      // up to LATE_ARRIVAL_WINDOW_MS so the matching onBeforeRequest
      // (or onSendHeaders for hops ≥ 1) — if it lands within the
      // window — can drain this entry.
      this.harWaiting.hold(tabId, entry, ts);
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
    if (!this.recentLifecycles.has(tabId, match.requestId)) return;
    this.bodyJoin.remember(tabId, method, url, entry.startedDateTime, {
      requestId: match.requestId,
      hopIndex: match.hopIndex,
    });
    this.emit(
      harAttachedUpdate({ tabId, requestId: match.requestId, hopIndex: match.hopIndex, entry }),
    );
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
      return this.inFlight.popMatching(tabId, url, ts, method);
    });
    for (const { entry, requestId, hopIndex } of matched) {
      const { url, method } = harEntryJoinFields(entry);
      this.attachHarEntry(tabId, { requestId, hopIndex }, entry, method, url);
    }
  }

  /**
   * GC tick driven by incoming event timestamps. Expires held HAR
   * entries past their window and releases finalized lifecycles whose
   * retention window has elapsed (deleting them from
   * `recentLifecycles` so the mirror stays bounded).
   */
  private gcLateArrival(nowMs: number): void {
    this.harWaiting.gc(nowMs);
    const expired = this.finalizedRetention.gcExpired(nowMs);
    for (const { tabId, requestId } of expired) {
      this.recentLifecycles.forget(tabId, requestId);
    }
  }

  private onHarBody(tabId: number, body: InspectorHarBody): void {
    const target = this.bodyJoin.consume(tabId, body.method, body.url, body.startedDateTime);
    if (target === undefined) return;
    this.emit(
      bodyAttachedUpdate({ tabId, requestId: target.requestId, hopIndex: target.hopIndex, body }),
    );
  }

  private emit(update: RequestLifecycleUpdate): void {
    if (update.kind === 'started') {
      this.recentLifecycles.set(
        update.lifecycle.tabId,
        update.lifecycle.requestId,
        update.lifecycle,
      );
    } else if (
      update.kind === 'phase' &&
      (update.patch.phase === 'completed' || update.patch.phase === 'failed') &&
      update.patch.completedAtMs !== undefined
    ) {
      // Terminal-phase emission — start the retention clock so the
      // recentLifecycles mirror gets pruned once the late-arrival
      // window elapses. `completedAtMs` is set by the webRequest
      // mapper for both onCompleted and onErrorOccurred branches.
      this.finalizedRetention.markFinalized(
        update.tabId,
        update.requestId,
        update.patch.completedAtMs,
      );
      // Hop bookkeeping is done — release the cursor. The FIFO entry
      // for the current hop is consumed by its HAR (or expires via
      // staleness sweep); the cursor exists only to bridge
      // onBeforeRedirect → onSendHeaders and has no further role.
      this.hopCursor.forget(update.tabId, update.requestId);
    }
    for (const listener of this.listeners) listener(update);
  }
}
