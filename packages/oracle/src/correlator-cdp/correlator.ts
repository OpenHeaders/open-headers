/**
 * `CdpCorrelator` — production implementation of {@link RequestCorrelator}
 * backed by a {@link CdpEventSource}. Projects CDP `Network.*` events into
 * lifecycle updates and synthesizes per-hop `InspectorHarEntry`s so the
 * panel's rich columns populate without the heuristic webRequest + HAR
 * pipeline.
 *
 * Construction is dependency-injected: the caller passes a
 * {@link CdpEventSource}. This module names no chrome API — the
 * chrome-backed source (`chrome.debugger.onEvent`) lives in the extension
 * SW one layer out (Slice 2); tests pass an in-memory source. The class
 * stays host-neutral.
 *
 * Shape mirrors {@link HeuristicCorrelator} (sibling module): a per-tab
 * `attached` gate, a listener set, and stateful helpers it owns. Here the
 * single helper is {@link CdpHarBuilder}, which accumulates HAR across the
 * multi-event request lifecycle. Each event is mapped twice: the pure
 * {@link cdpEventToUpdates} emits `started`/`redirect`/`phase` (lifecycle
 * spine), then the builder emits any completed `har-attached` — pure
 * first, so `started` precedes its `har-attached`.
 */

import type {
  RequestCorrelator,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';
import type { InspectorHarBody } from '@openheaders/core/types';

import { cdpBodyToHarBody, emptyCdpHarBody } from './cdp-body-synth';
import { type CdpBodyRef, CdpHarBuilder } from './cdp-har-builder';
import { cdpEventToUpdates } from './cdp-to-update';
import { CdpWallClock } from './cdp-wall-clock';
import type { CdpEventSource, CdpNetworkEvent } from './events';

/** Placeholder descriptor for a body whose request ref is no longer known. */
const UNKNOWN_BODY_SOURCE = { method: '', url: '', startedDateTime: '' };

export class CdpCorrelator implements RequestCorrelator {
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly attached = new Set<number>();
  private readonly wallClock = new CdpWallClock();
  /** Stable resolver handed to the pure mapper + the HAR builder (no
   *  per-event allocation). Declared before `harBuilder` so the field
   *  initializer below can hand it to the builder's constructor. */
  private readonly toWallMs = (tabId: number, sessionId: string, requestId: string, monotonicSec: number): number =>
    this.wallClock.toWallMs(tabId, sessionId, requestId, monotonicSec);
  private readonly harBuilder = new CdpHarBuilder(this.toWallMs);
  private readonly source: CdpEventSource;
  private readonly sourceUnsubscribe: () => void;

  constructor(source: CdpEventSource) {
    this.source = source;
    this.sourceUnsubscribe = source.subscribe((event) => this.onEvent(event));
  }

  attachTab(tabId: number): void {
    this.attached.add(tabId);
  }

  detachTab(tabId: number): void {
    this.attached.delete(tabId);
    this.harBuilder.forgetTab(tabId);
    this.wallClock.forgetTab(tabId);
  }

  subscribe(listener: RequestLifecycleListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Lazy, on-demand response-body fetch for one hop. The panel asks once
   * per `(requestId, hopIndex)` when the user opens that row's
   * Response/Preview tab; the body is never fetched eagerly (a per-request
   * round-trip would tax the attached session). We resolve the raw CDP
   * identity from the builder, command the fetch on its session, and emit
   * the result as an ordinary `body-attached` refinement into the same
   * `harBodyByHop` slot the heuristic path fills eagerly — the store is the
   * single downstream either way.
   *
   * A tab not attached to this correlator (heuristic-owned, where the body
   * is already eager) is a no-op. Anything that yields no body — an unknown
   * or cap-evicted request, or a body the host has dropped — resolves to an
   * empty body, so the panel leaves its indefinite "loading" state for the
   * "unavailable" copy rather than spinning forever.
   */
  async requestBody(tabId: number, requestId: string, hopIndex: number): Promise<void> {
    if (!this.attached.has(tabId)) return;
    const ref = this.harBuilder.bodyContext(tabId, requestId);
    const body = ref === undefined ? emptyCdpHarBody(UNKNOWN_BODY_SOURCE) : await this.fetchBody(tabId, ref);
    this.emit({ kind: 'body-attached', tabId, requestId, hopIndex, body });
  }

  private async fetchBody(tabId: number, ref: CdpBodyRef): Promise<InspectorHarBody> {
    try {
      const raw = await this.source.fetchResponseBody(tabId, ref.sessionId, ref.rawRequestId);
      return cdpBodyToHarBody(ref, raw);
    } catch {
      return emptyCdpHarBody(ref);
    }
  }

  /** Stop processing events from the source. Tests use this to tear down. */
  dispose(): void {
    this.sourceUnsubscribe();
    this.listeners.clear();
    this.attached.clear();
    this.harBuilder.clear();
    this.wallClock.clear();
  }

  private onEvent(event: CdpNetworkEvent): void {
    if (!this.attached.has(event.tabId)) return;
    // Capture the wall↔monotonic offset before mapping, so the terminal
    // events the mapper converts (loadingFinished/loadingFailed) resolve
    // against an offset this request's `requestWillBeSent` already recorded.
    this.wallClock.observe(event);
    // Lifecycle spine first (started/redirect/phase), then the HAR the
    // builder completed from this event — so `started` always precedes
    // its `har-attached`.
    for (const update of cdpEventToUpdates(event, this.toWallMs)) this.emit(update);
    for (const update of this.harBuilder.observe(event)) this.emit(update);
  }

  private emit(update: RequestLifecycleUpdate): void {
    for (const listener of this.listeners) listener(update);
  }
}
