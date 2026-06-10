/**
 * Chrome adapter implementing the host-side Resource Timing seam
 * ({@link ResourceTimingEventSource}).
 *
 * Sole responsibility: own `chrome.runtime.onConnect` for ports named
 * `devtools-har-source:<tabId>` and normalize each `resource-timing`
 * {@link HarSourceMessage} into the oracle-shaped
 * {@link ResourceTimingSnapshotEvent} the heuristic correlator joins
 * connection legs from.
 *
 * Cohabitation: `ChromeHarEventSource`, the nav bridge and the
 * `ResourceTimingRelay` also register `chrome.runtime.onConnect`
 * listeners for the same port name. Chrome dispatches every listener on
 * each connect with the same `Port`; each adapter consumes a disjoint
 * subset of {@link HarSourceMessage} (this one reads only
 * `resource-timing` — the relay reads the same frames for the
 * panel-local memory-cache feed, a separate consumer by design).
 *
 * Cross-browser: uses `getBrowserAPI()` for Firefox/Chrome/Safari/Edge.
 */

import { type HarSourceMessage, parseHarSourcePortName } from '@openheaders/core/types';
import type { ResourceTimingEvent, ResourceTimingEventSource } from '@openheaders/oracle/correlator-heuristic';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

type ResourceTimingListener = (event: ResourceTimingEvent) => void;

export class ChromeResourceTimingEventSource implements ResourceTimingEventSource {
  private readonly listeners = new Set<ResourceTimingListener>();
  private readonly removeOnConnect: (() => void) | null;

  constructor() {
    this.removeOnConnect = this.installOnConnect();
  }

  subscribe(listener: ResourceTimingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Tear down the chrome listener. Tests / SW shutdown only. */
  dispose(): void {
    if (this.removeOnConnect) this.removeOnConnect();
    this.listeners.clear();
  }

  private installOnConnect(): (() => void) | null {
    const browserAPI = getBrowserAPI();
    const onConnect = browserAPI.runtime?.onConnect;
    if (!onConnect?.addListener) {
      logger.info('LifecycleHost', 'runtime.onConnect unavailable; Resource Timing source inert');
      return null;
    }
    const listener = (port: chrome.runtime.Port): void => {
      const tabId = parseHarSourcePortName(port.name);
      if (tabId === null) return;
      port.onMessage.addListener((msg: HarSourceMessage) => {
        this.dispatchMessage(tabId, msg);
      });
    };
    onConnect.addListener(listener);
    return () => onConnect.removeListener(listener);
  }

  private dispatchMessage(tabId: number, msg: HarSourceMessage): void {
    if (!msg || msg.type !== 'resource-timing') return;
    if (typeof msg.timeOriginMs !== 'number' || !Array.isArray(msg.entries)) return;
    const event: ResourceTimingEvent = {
      kind: 'rt-snapshot',
      tabId,
      timeOriginMs: msg.timeOriginMs,
      entries: msg.entries,
      ...(msg.navigation !== undefined ? { navigation: msg.navigation } : {}),
    };
    for (const listener of this.listeners) listener(event);
  }
}
