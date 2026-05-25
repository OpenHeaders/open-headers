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
 *
 * Deliberately deferred (own future sessions):
 *   - H4 per-URL FIFO matching refinements beyond the verbatim port
 *   - H5/H6 CORS classification + `oh:cors-*` error refinement
 *   - H8/H9 per-hop HAR / `body-attached` attribution. Until H8 lands
 *     all HAR + body updates emit `hopIndex: 0`.
 */

import type {
  RequestCorrelator,
  RequestLifecycle,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';
import { lifecycleKey } from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody, InspectorHarEntry } from '@openheaders/core/types';

import { BodyJoinMap } from './body-join-map';
import type { WebRequestEvent, WebRequestEventSource } from './events';
import { FinalizedRetention } from './finalized-retention';
import { bodyAttachedUpdate, harAttachedUpdate, harEntryJoinFields, harEntryTimestamp } from './har-to-update';
import type { HarEvent, HarEventSource } from './har-events';
import { HarWaitingBuffer } from './har-waiting-buffer';
import { InFlightFifo } from './in-flight-fifo';
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
  /**
   * Local mirror of "what we've emitted so far" keyed by
   * `(tabId, requestId)`. Lets the correlator project subsequent
   * updates without re-reading store state. The store keeps its own
   * authoritative mirror downstream.
   */
  private readonly recentLifecycles = new Map<string, RequestLifecycle>();
  private readonly inFlight = new InFlightFifo();
  private readonly bodyJoin = new BodyJoinMap();
  private readonly harWaiting = new HarWaitingBuffer();
  private readonly finalizedRetention = new FinalizedRetention();
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
    for (const key of this.recentLifecycles.keys()) {
      if (key.startsWith(`${tabId}:`)) this.recentLifecycles.delete(key);
    }
    this.inFlight.forgetTab(tabId);
    this.bodyJoin.forgetTab(tabId);
    this.harWaiting.forgetTab(tabId);
    this.finalizedRetention.forgetTab(tabId);
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
    // Record onBeforeRequest into the join FIFO before mapping — the
    // mapper's `started` update and the FIFO record share the same
    // input; recording first keeps the FIFO authoritative even if a
    // listener throws downstream (which the for-loop in `emit` already
    // tolerates, but symmetric ordering is clearer to reason about).
    if (event.method_kind === 'onBeforeRequest') {
      this.inFlight.record(event.tabId, event.url, event.requestId, event.timeStamp, event.method);
    }
    const updates = webRequestEventToUpdates(event);
    for (const update of updates) this.emit(update);
    // After the started emission seeds `recentLifecycles`, drain any
    // HAR entries that were held waiting for this in-flight slot.
    if (event.method_kind === 'onBeforeRequest') {
      this.drainHarWaiting(event.tabId);
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
    const requestId = this.inFlight.popMatching(tabId, url, ts, method);
    if (requestId === undefined) {
      // Forward race (H7): no in-flight slot recorded yet. Hold for
      // up to LATE_ARRIVAL_WINDOW_MS so the matching onBeforeRequest
      // — if it lands within the window — can drain this entry.
      this.harWaiting.hold(tabId, entry, ts);
      return;
    }
    this.attachHarEntry(tabId, requestId, entry, method, url);
  }

  /**
   * Mint a `har-attached` update for a resolved `(tabId, requestId)`.
   * Shared by the eager onHarEntry path and the drain path that fires
   * after a late `onBeforeRequest` matches a buffered entry.
   */
  private attachHarEntry(
    tabId: number,
    requestId: string,
    entry: InspectorHarEntry,
    method: string,
    url: string,
  ): void {
    // Confirm a lifecycle exists for this `(tabId, requestId)`. The
    // attach-gated webRequest path always seeds one via `started`
    // before the HAR catches up, so a missing lifecycle here is a
    // genuine race (e.g. lifecycle was forgotten after tab close) —
    // drop rather than mint a floating attachment.
    if (!this.recentLifecycles.has(lifecycleKey(tabId, requestId))) return;
    // H2/H3 scope: hop 0 always. H8/H9 will derive correct per-hop
    // attribution. The body-join map remembers the same hopIndex so
    // the body emission stays consistent with its entry.
    const hopIndex = 0;
    this.bodyJoin.remember(tabId, method, url, entry.startedDateTime, { requestId, hopIndex });
    this.emit(harAttachedUpdate({ tabId, requestId, hopIndex, entry }));
  }

  /**
   * After an `onBeforeRequest` records a new in-flight slot, retry any
   * HAR entries previously held for this tab. Each successful match
   * attaches via the shared `attachHarEntry` path.
   */
  private drainHarWaiting(tabId: number): void {
    const matched = this.harWaiting.drain(tabId, (entry) => {
      const { url, method } = harEntryJoinFields(entry);
      const ts = harEntryTimestamp(entry);
      if (!url || ts === null) return undefined;
      return this.inFlight.popMatching(tabId, url, ts, method);
    });
    for (const { entry, requestId } of matched) {
      const { url, method } = harEntryJoinFields(entry);
      this.attachHarEntry(tabId, requestId, entry, method, url);
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
      this.recentLifecycles.delete(lifecycleKey(tabId, requestId));
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
        lifecycleKey(update.lifecycle.tabId, update.lifecycle.requestId),
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
    }
    for (const listener of this.listeners) listener(update);
  }
}
