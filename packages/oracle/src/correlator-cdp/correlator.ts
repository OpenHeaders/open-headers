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

import { CdpHarBuilder } from './cdp-har-builder';
import { cdpEventToUpdates } from './cdp-to-update';
import type { CdpEventSource, CdpNetworkEvent } from './events';

export class CdpCorrelator implements RequestCorrelator {
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly attached = new Set<number>();
  private readonly harBuilder = new CdpHarBuilder();
  private readonly sourceUnsubscribe: () => void;

  constructor(source: CdpEventSource) {
    this.sourceUnsubscribe = source.subscribe((event) => this.onEvent(event));
  }

  attachTab(tabId: number): void {
    this.attached.add(tabId);
  }

  detachTab(tabId: number): void {
    this.attached.delete(tabId);
    this.harBuilder.forgetTab(tabId);
  }

  subscribe(listener: RequestLifecycleListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Stop processing events from the source. Tests use this to tear down. */
  dispose(): void {
    this.sourceUnsubscribe();
    this.listeners.clear();
    this.attached.clear();
    this.harBuilder.clear();
  }

  private onEvent(event: CdpNetworkEvent): void {
    if (!this.attached.has(event.tabId)) return;
    // Lifecycle spine first (started/redirect/phase), then the HAR the
    // builder completed from this event — so `started` always precedes
    // its `har-attached`.
    for (const update of cdpEventToUpdates(event)) this.emit(update);
    for (const update of this.harBuilder.observe(event)) this.emit(update);
  }

  private emit(update: RequestLifecycleUpdate): void {
    for (const listener of this.listeners) listener(update);
  }
}
