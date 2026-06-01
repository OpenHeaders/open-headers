/**
 * `ResourceTimingRelay` — per-tab latest-snapshot cache + fanout.
 *
 * Background half of the `oh-rt:<tabId>` surface. Unlike the lifecycle /
 * page / fire feeds — whose hubs live in `@openheaders/oracle` because
 * they carry genuine engine state a non-chrome host (desktop, daemon)
 * also produces — resource timing is a renderer-only artifact: it exists
 * solely where there is a live DOM document, and it is reconciled
 * panel-local, never by the engine. So the relay lives here in the
 * extension and keeps the engine `webRequest` + HAR only.
 *
 * State is the simplest possible: one cached snapshot per tab,
 * last-write-wins (the Resource Timing buffer is cumulative, so each
 * observation supersedes the prior). On subscribe we deliver `ready`
 * then replay the cached snapshot synchronously — that closes the gap
 * after a service-worker eviction, where the panel reconnects before the
 * devtools-page's next poll tick would otherwise repopulate it.
 *
 * Chrome-free by construction: sinks are plain delivery callbacks, so
 * the relay is unit-testable without a port mock. The chrome wiring
 * (port parse + `postMessage`) lives in `./index`.
 */

import type { ResourceTimingEntry, ResourceTimingWireMessage } from '@openheaders/core/resource-timing';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

interface CachedSnapshot {
  readonly timeOriginMs: number;
  readonly entries: readonly ResourceTimingEntry[];
}

type Deliver = (msg: ResourceTimingWireMessage) => void;

export interface ResourceTimingRelay {
  /** Replace the tab's cached snapshot and broadcast it to live sinks. */
  notifySnapshot(tabId: number, timeOriginMs: number, entries: readonly ResourceTimingEntry[]): void;
  /** Drop the tab's snapshot and broadcast `tab-cleared`. */
  forgetTab(tabId: number): void;
  /**
   * Attach a sink for `tabId`. Delivers `ready` then replays the cached
   * snapshot (if any) as one synchronous block before returning the
   * detach handle. Idempotent on detach.
   */
  subscribe(tabId: number, deliver: Deliver): () => void;
  dispose(): void;
}

export interface ResourceTimingRelayOptions {
  /** Tab-removal source — clears the cached snapshot on `tab-forgotten`. */
  readonly bus?: TabLifecycleBus;
}

export function createResourceTimingRelay(options: ResourceTimingRelayOptions = {}): ResourceTimingRelay {
  const snapshots = new Map<number, CachedSnapshot>();
  const sinks = new Map<number, Set<Deliver>>();
  let disposed = false;

  const guard = (): void => {
    if (disposed) throw new Error('ResourceTimingRelay: operation after dispose');
  };

  const broadcast = (tabId: number, msg: ResourceTimingWireMessage): void => {
    const set = sinks.get(tabId);
    if (set === undefined) return;
    for (const deliver of set) {
      try {
        deliver(msg);
      } catch {
        /* sink delivery is best-effort — a throw must not block siblings */
      }
    }
  };

  const relay: ResourceTimingRelay = {
    notifySnapshot(tabId, timeOriginMs, entries) {
      guard();
      snapshots.set(tabId, { timeOriginMs, entries });
      broadcast(tabId, { kind: 'rt-update', update: { kind: 'snapshot', tabId, timeOriginMs, entries } });
    },

    forgetTab(tabId) {
      guard();
      if (!snapshots.has(tabId)) return;
      snapshots.delete(tabId);
      broadcast(tabId, { kind: 'rt-update', update: { kind: 'tab-cleared', tabId } });
    },

    subscribe(tabId, deliver) {
      guard();
      let set = sinks.get(tabId);
      if (set === undefined) {
        set = new Set();
        sinks.set(tabId, set);
      }
      set.add(deliver);
      deliver({ kind: 'ready', tabId });
      const cached = snapshots.get(tabId);
      if (cached !== undefined) {
        deliver({
          kind: 'rt-update',
          update: { kind: 'snapshot', tabId, timeOriginMs: cached.timeOriginMs, entries: cached.entries },
        });
      }
      let detached = false;
      return () => {
        if (detached) return;
        detached = true;
        const live = sinks.get(tabId);
        if (live === undefined) return;
        live.delete(deliver);
        if (live.size === 0) sinks.delete(tabId);
      };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribeBus?.();
      snapshots.clear();
      sinks.clear();
    },
  };

  const unsubscribeBus = options.bus
    ? options.bus.subscribe((event) => {
        if (event.kind === 'tab-forgotten') relay.forgetTab(event.tabId);
      })
    : null;

  return relay;
}
