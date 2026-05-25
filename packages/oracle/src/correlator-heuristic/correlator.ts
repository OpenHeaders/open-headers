/**
 * `HeuristicCorrelator` — production-bound implementation of
 * {@link RequestCorrelator} that projects webRequest-shaped events into
 * lifecycle updates.
 *
 * Construction is **dependency-injected only**: the caller passes a
 * `WebRequestEventSource`. This module names no chrome API; the
 * `chrome.webRequest.*` binding lives in the extension SW's
 * `ChromeWebRequestEventSource` adapter, one layer out. Tests pass an
 * in-memory source.
 *
 * Shape mirrors `CdpCorrelatorStub` (sibling module) — the symmetry is
 * the proof that the {@link RequestCorrelator} contract is real and not
 * over-fit to either event source.
 *
 * H1 scope: drives the pure mapper. The following H-row concerns live
 * in their own sessions and **are not implemented here yet**:
 *   - H2/H3 HAR closest-timestamp join
 *   - H4 per-URL FIFO matching
 *   - H5/H6 CORS classification + `oh:cors-*` error refinement
 *   - H7 per-`(tabId, requestId)` late-arrival mini-buffer
 *   - H8/H9 per-hop HAR / `body-attached` emission
 *
 * Until those land, ordering is whatever the source emits and HAR
 * updates do not flow through this correlator at all.
 */

import type {
  RequestCorrelator,
  RequestLifecycle,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';
import { lifecycleKey } from '@openheaders/core/request-lifecycle';

import type { WebRequestEvent, WebRequestEventSource } from './events';
import { webRequestEventToUpdates } from './webrequest-to-update';

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
  private readonly sourceUnsubscribe: () => void;

  constructor(source: WebRequestEventSource) {
    this.sourceUnsubscribe = source.subscribe((event) => this.onEvent(event));
  }

  attachTab(tabId: number): void {
    this.attached.add(tabId);
  }

  detachTab(tabId: number): void {
    this.attached.delete(tabId);
    for (const key of this.recentLifecycles.keys()) {
      if (key.startsWith(`${tabId}:`)) this.recentLifecycles.delete(key);
    }
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
    this.recentLifecycles.clear();
  }

  private onEvent(event: WebRequestEvent): void {
    if (!this.attached.has(event.tabId)) return;
    const updates = webRequestEventToUpdates(event);
    for (const update of updates) this.emit(update);
  }

  private emit(update: RequestLifecycleUpdate): void {
    if (update.kind === 'started') {
      this.recentLifecycles.set(
        lifecycleKey(update.lifecycle.tabId, update.lifecycle.requestId),
        update.lifecycle,
      );
    }
    for (const listener of this.listeners) listener(update);
  }
}
