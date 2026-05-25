/**
 * `CdpCorrelatorStub` — typechecked, unit-tested implementation of
 * {@link RequestCorrelator} backed by a mocked CDP event source.
 *
 * Purpose (per §6.2 of the design + K1–K4 in
 * `REQUEST_LIFECYCLE_STATUS.md`): enforce that the correlator interface
 * is real. The heuristic implementation alone is not enough to validate
 * the seam — if a second strategy can't satisfy the same contract,
 * the contract is over-fit to webRequest's shape. This stub closes
 * that loop.
 *
 * The stub is NOT for production. Calling {@link CdpCorrelatorStub.fromChromeDebugger}
 * throws `NotImplementedError` (K4); production paths must not
 * instantiate it. Tests construct it with an in-memory
 * {@link CdpEventSource}.
 */

import type {
  RequestCorrelator,
  RequestLifecycle,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';
import { lifecycleKey } from '@openheaders/core/request-lifecycle';

import { cdpEventToUpdates } from './cdp-to-update';
import type { CdpEventSource, CdpNetworkEvent } from './events';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class CdpCorrelatorStub implements RequestCorrelator {
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly attached = new Set<number>();
  /**
   * Local mirror of "what we've emitted so far" keyed by
   * `(tabId, requestId)`. Used by the mapper to know whether to emit
   * `started` or `redirect`; the store's own mirror is separate and
   * downstream of this layer.
   */
  private readonly recentLifecycles = new Map<string, RequestLifecycle>();
  private readonly sourceUnsubscribe: () => void;

  constructor(source: CdpEventSource) {
    this.sourceUnsubscribe = source.subscribe((event) => this.onEvent(event));
  }

  /**
   * Real-Chrome instantiation point. Intentionally throws — see class
   * doc and K4. Lives here so the chrome-side wiring is *named* and
   * lints against rather than absent.
   */
  static fromChromeDebugger(): never {
    throw new NotImplementedError(
      'CdpCorrelatorStub is a typechecked-only seam validator; it does not ship against real Chrome. ' +
        'Wire the heuristic correlator instead.',
    );
  }

  attachTab(tabId: number): void {
    this.attached.add(tabId);
  }

  detachTab(tabId: number): void {
    this.attached.delete(tabId);
    // Drop per-tab projection state so a re-attach starts clean.
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

  private onEvent(event: CdpNetworkEvent): void {
    if (!this.attached.has(event.tabId)) return;
    const updates = cdpEventToUpdates(event);
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
