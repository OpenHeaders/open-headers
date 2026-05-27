/**
 * Composition root for the heuristic correlation pipeline inside the
 * extension SW.
 *
 * Wires three pieces:
 *
 *   `ChromeWebRequestEventSource` (chrome adapter — this package)
 *        ↓ WebRequestEventSource seam
 *   `HeuristicCorrelator`        (oracle — chrome-free)
 *        ↓ RequestCorrelator seam (subscribe)
 *   `RequestLifecycleStore`      (oracle — pure reducer + LRU)
 *
 * Plus the per-tab bridge that closes S6 ({@link installTabLifecycleBridge}).
 *
 * The host attaches every tab observed via `chrome.tabs.onCreated` and
 * also lazily on the first webRequest event for an untracked tab — SW
 * cold starts can miss `onCreated` for tabs that already existed before
 * boot. The bridge cleanly detaches on `chrome.tabs.onRemoved` and
 * tells the store to drop the partition.
 */

import { HeuristicCorrelator } from '@openheaders/oracle/correlator-heuristic';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { logger } from '@utils/logger';

import { ChromeHarEventSource } from './chrome-har-source';
import { ChromeWebRequestEventSource } from './chrome-webrequest-source';
import { installTabLifecycleBridge } from './tab-lifecycle-bridge';

export interface LifecycleHostOptions {
  readonly bus: TabLifecycleBus;
}

export interface LifecycleHost {
  readonly webRequestSource: ChromeWebRequestEventSource;
  readonly harSource: ChromeHarEventSource;
  readonly correlator: HeuristicCorrelator;
  readonly store: RequestLifecycleStore;
  /** Detach all chrome listeners — tests / SW shutdown only. */
  dispose(): void;
}

/**
 * Construct and boot one `LifecycleHost`. Idempotent at the call-site
 * level — `background.ts` invokes this exactly once per SW lifetime.
 *
 * Composes:
 *   `ChromeWebRequestEventSource` (chrome adapter)
 *        ↓ WebRequestEventSource seam
 *   `ChromeHarEventSource`        (chrome adapter)
 *        ↓ HarEventSource seam
 *   `HeuristicCorrelator`        (oracle — chrome-free)
 *        ↓ RequestCorrelator seam (subscribe)
 *   `RequestLifecycleStore`      (oracle — pure reducer + LRU)
 *
 * Plus the per-tab `tab-lifecycle-bridge` (S6).
 */
export function startLifecycleHost(options: LifecycleHostOptions): LifecycleHost {
  const webRequestSource = new ChromeWebRequestEventSource();
  const harSource = new ChromeHarEventSource();
  const correlator = new HeuristicCorrelator({
    webRequest: webRequestSource,
    har: harSource,
  });
  const store = new RequestLifecycleStore({
    onReject: (update, reason) => {
      logger.warn('LifecycleHost', 'store rejected update', { kind: update.kind, reason });
    },
  });

  // The store is the canonical downstream consumer. Additional
  // subscribers (panel forwarder, tab-telemetry projection) attach
  // through `correlator.subscribe(...)` in their own modules.
  correlator.subscribe((update) => store.apply(update));

  const detachBridge = installTabLifecycleBridge({ correlator, store, bus: options.bus });

  logger.info('LifecycleHost', 'request lifecycle pipeline online');

  return {
    webRequestSource,
    harSource,
    correlator,
    store,
    dispose: () => {
      detachBridge();
      correlator.dispose();
      webRequestSource.dispose();
      harSource.dispose();
    },
  };
}
