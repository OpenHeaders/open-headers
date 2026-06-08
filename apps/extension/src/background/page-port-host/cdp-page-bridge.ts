/**
 * CDP `Page`-domain → PageStreamHub bridge.
 *
 * The page-timing counterpart to the request pipeline's CDP path: for
 * CDP-attached tabs it drives `log.pages[]` from the raw `Page.*` lifecycle
 * stream + the document network request, so page `startedDateTime` /
 * `onContentLoad` / `onLoad` match Chrome's exporter byte-for-byte (the
 * Performance-API bridge's values are anchored differently and clamped).
 *
 * Pure glue: the host-neutral {@link CdpPageCorrelator} (oracle) does the
 * correlation and emits {@link CdpPageSignal}s; this bridge wires them onto
 * the same `PageStreamHub` verbs the Performance-API bridge uses, so the
 * hub stays the single owner of page-id assignment + fan-out. The
 * correlator only ever sees events for CDP-attached tabs (the debugger
 * source gates its streams on its attach set), so heuristic tabs are
 * untouched here and keep flowing through the Performance-API bridge.
 */

import { type CdpEventSource, CdpPageCorrelator } from '@openheaders/oracle/correlator-cdp';
import type { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

export interface CdpPageBridge {
  /** Detach the source subscriptions + bus listener. Tests / SW shutdown. */
  dispose(): void;
}

export interface CdpPageBridgeOptions {
  /** The CDP source — the bridge subscribes to its network + page streams. */
  readonly source: CdpEventSource;
  readonly hub: PageStreamHub;
  /** Drops per-tab correlator state when a tab closes. */
  readonly bus: TabLifecycleBus;
}

export function startCdpPageBridge(options: CdpPageBridgeOptions): CdpPageBridge {
  const { source, hub, bus } = options;
  const correlator = new CdpPageCorrelator();

  const apply = (event: Parameters<CdpPageCorrelator['observe']>[0]): void => {
    for (const signal of correlator.observe(event)) {
      if (signal.kind === 'nav-started') {
        hub.notifyNavStarted(signal.tabId, signal.startedAtMs, signal.url, signal.loaderId);
      } else {
        hub.notifyNavTimingAttached(signal.tabId, signal.timing);
      }
    }
  };

  const offNetwork = source.subscribe(apply);
  const offPage = source.subscribePage(apply);
  const offBus = bus.subscribe((event) => {
    if (event.kind === 'tab-forgotten') correlator.forgetTab(event.tabId);
  });

  return {
    dispose: () => {
      offNetwork();
      offPage();
      offBus();
      correlator.clear();
    },
  };
}
