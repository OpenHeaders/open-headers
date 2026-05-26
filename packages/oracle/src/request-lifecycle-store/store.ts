/**
 * `RequestLifecycleStore` — engine-side authoritative store for request
 * lifecycles.
 *
 * Owns the identity-keyed map (invariant 1) partitioned per tab
 * (invariant 2). Reduces `RequestLifecycleUpdate`s with the pure reducer
 * (invariants 3, 5, 6). Fans out applied updates to subscribers (S5).
 * Evicts via per-tab LRU at `maxLifecyclesPerTab` (S4). `forgetTab`
 * drops the partition (S6 wire-up — wired by the SW adapter on
 * `chrome.tabs.onRemoved`).
 *
 * The store does not subscribe to chrome.* APIs itself — it is a pure
 * data layer. The heuristic correlator + a thin SW adapter feed it.
 */

import type {
  RequestLifecycle,
  RequestLifecycleListener,
  RequestLifecycleUpdate,
  Unsubscribe,
} from '@openheaders/core/request-lifecycle';

import { DEFAULT_MAX_LIFECYCLES_PER_TAB } from './config';
import { reduce } from './reducer';
import type { ReducerRejection } from './reducer';
import { TabLifecycles } from './tab-lifecycles';

export interface RequestLifecycleStoreOptions {
  /** Hard cap per `tabId`. Defaults to {@link DEFAULT_MAX_LIFECYCLES_PER_TAB}. */
  readonly maxLifecyclesPerTab?: number;
  /**
   * Called when the reducer rejects an update. The store's policy is
   * "log and drop"; throwing here is reserved for tests/dev. Defaults to
   * a no-op so production wiring decides its own logger.
   */
  readonly onReject?: (update: RequestLifecycleUpdate, reason: ReducerRejection) => void;
  /**
   * Called when an LRU eviction drops a lifecycle. Available for hosts
   * that need to keep parallel facet maps in sync with eviction; no
   * production wiring uses it today. The store does NOT emit a `gone`
   * update on eviction — eviction is a memory-bound housekeeping
   * signal, not a lifecycle termination. Defaults to a no-op.
   */
  readonly onEvict?: (evicted: RequestLifecycle) => void;
}

export class RequestLifecycleStore {
  private readonly tabs = new Map<number, TabLifecycles>();
  private readonly listeners = new Set<RequestLifecycleListener>();
  private readonly maxLifecyclesPerTab: number;
  private readonly onReject: NonNullable<RequestLifecycleStoreOptions['onReject']>;
  private readonly onEvict: NonNullable<RequestLifecycleStoreOptions['onEvict']>;

  constructor(options: RequestLifecycleStoreOptions = {}) {
    this.maxLifecyclesPerTab = options.maxLifecyclesPerTab ?? DEFAULT_MAX_LIFECYCLES_PER_TAB;
    this.onReject = options.onReject ?? noop;
    this.onEvict = options.onEvict ?? noop;
  }

  /** Apply a correlator update. Rejections route to `onReject` and drop. */
  apply(update: RequestLifecycleUpdate): void {
    const tabId = tabIdOf(update);
    const requestId = requestIdOf(update);
    const tab = this.tabs.get(tabId);
    const prev = tab?.get(requestId);

    const result = reduce(prev, update);

    switch (result.kind) {
      case 'insert':
      case 'update': {
        const partition = tab ?? this.openTab(tabId);
        const { evicted } = partition.set(requestId, result.next);
        if (evicted !== undefined) this.onEvict(evicted);
        this.broadcast(update);
        return;
      }
      case 'delete': {
        if (tab === undefined) return;
        tab.delete(requestId);
        if (tab.size === 0) this.tabs.delete(tabId);
        this.broadcast(update);
        return;
      }
      case 'noop':
        return;
      case 'reject':
        this.onReject(update, result.reason);
        return;
    }
  }

  /** Synchronous read for in-process consumers and replay (hub). */
  get(tabId: number, requestId: string): RequestLifecycle | undefined {
    return this.tabs.get(tabId)?.get(requestId);
  }

  /**
   * Snapshot of every lifecycle currently tracked for a tab. Used by the
   * subscriber hub for replay-on-connect. Order is LRU position (oldest
   * first) — stable but not semantically meaningful; consumers that need
   * arrival ordering should sort by `startedAtMs`.
   */
  snapshotTab(tabId: number): readonly RequestLifecycle[] {
    const tab = this.tabs.get(tabId);
    if (tab === undefined) return [];
    return [...tab.values()];
  }

  /** Tab close / dispose. Drops the partition; subscribers are not notified. */
  forgetTab(tabId: number): void {
    this.tabs.delete(tabId);
  }

  /** Subscribe to applied updates. Listeners fire in registration order. */
  subscribe(listener: RequestLifecycleListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private openTab(tabId: number): TabLifecycles {
    const partition = new TabLifecycles(this.maxLifecyclesPerTab);
    this.tabs.set(tabId, partition);
    return partition;
  }

  private broadcast(update: RequestLifecycleUpdate): void {
    for (const listener of this.listeners) listener(update);
  }
}

function tabIdOf(update: RequestLifecycleUpdate): number {
  return update.kind === 'started' ? update.lifecycle.tabId : update.tabId;
}

function requestIdOf(update: RequestLifecycleUpdate): string {
  return update.kind === 'started' ? update.lifecycle.requestId : update.requestId;
}

function noop(): void {
  /* default option */
}
