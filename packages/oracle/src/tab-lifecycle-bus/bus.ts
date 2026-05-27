/**
 * `TabLifecycleBus` — process-local fanout for cross-driver tab-lifecycle
 * events. Sibling of `RequestLifecycleStore`; producer is the correlator
 * tab-lifecycle bridge, subscribers are the rule-engine driver and
 * tab-telemetry source (and later the three lifecycle hubs).
 *
 * Subscriber callbacks are wrapped in try/catch so a single broken
 * listener can't strand siblings — matches the oracle convention used by
 * `TabSinkRegistry.broadcast` / `.dispose`.
 */

import type { TabLifecycleEvent, TabLifecycleListener, Unsubscribe } from './types';

export class TabLifecycleBus {
  private readonly listeners = new Set<TabLifecycleListener>();
  private disposed = false;

  get isDisposed(): boolean {
    return this.disposed;
  }

  subscribe(listener: TabLifecycleListener): Unsubscribe {
    if (this.disposed) throw new Error('TabLifecycleBus: subscribe after dispose');
    this.listeners.add(listener);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.listeners.delete(listener);
    };
  }

  notifyTabForgotten(tabId: number): void {
    this.emit({ kind: 'tab-forgotten', tabId });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
  }

  private emit(event: TabLifecycleEvent): void {
    if (this.disposed) return;
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* listener delivery is best-effort — a throw must not block siblings */
      }
    }
  }
}
