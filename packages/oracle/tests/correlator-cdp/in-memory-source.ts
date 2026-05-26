/**
 * In-memory implementation of `CdpEventSource` for tests. Real chrome
 * wiring is forbidden (see `CdpCorrelatorStub.fromChromeDebugger`).
 */

import type { CdpEventSource, CdpNetworkEvent } from '../../src/correlator-cdp/events';

export class InMemoryCdpSource implements CdpEventSource {
  private readonly listeners = new Set<(event: CdpNetworkEvent) => void>();

  subscribe(listener: (event: CdpNetworkEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: CdpNetworkEvent): void {
    for (const fn of this.listeners) fn(event);
  }
}
