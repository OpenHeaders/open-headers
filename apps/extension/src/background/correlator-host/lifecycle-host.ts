/**
 * Composition root for the request-correlation pipeline inside the
 * extension SW.
 *
 * Two correlators feed one store; a {@link TabSourceRouter} guarantees a
 * tab is `attachTab`'d to exactly one of them (no double-feed):
 *
 *   `ChromeWebRequestEventSource` + `ChromeHarEventSource`
 *   + `ChromeResourceTimingEventSource` (chrome adapters)
 *        ↓ WebRequestEventSource / HarEventSource / ResourceTimingEventSource seams
 *   `HeuristicCorrelator`        (oracle — chrome-free) ─┐
 *                                                        ├─→ `RequestLifecycleStore`
 *   `ChromeDebuggerEventSource`  (chrome adapter)        │      (pure reducer + LRU)
 *        ↓ CdpEventSource seam                           │
 *   `CdpCorrelator`              (oracle — chrome-free) ─┘
 *
 * The CDP pieces are constructed but inert until Slice 4's reconciler
 * `route`s a tab to `'cdp'` (which needs the Slice 5 master switch ON):
 * the debugger source attaches nothing on its own and the CDP correlator
 * is never `attachTab`'d, so with CDP disabled the store sees only the
 * heuristic stream — byte-for-byte unchanged.
 *
 * Plus the per-tab bridge ({@link installTabLifecycleBridge}). Every tab
 * observed via `chrome.tabs.onCreated` (and the cold-start
 * `chrome.tabs.query` bootstrap) is routed to the default `'heuristic'`
 * owner; the bridge cleanly detaches on `chrome.tabs.onRemoved` and tells
 * the store to drop the partition.
 */

import { CdpCorrelator } from '@openheaders/oracle/correlator-cdp';
import { HAR_FAILURE_HOLD_MS, HeuristicCorrelator } from '@openheaders/oracle/correlator-heuristic';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { logger } from '@utils/logger';

import { ChromeDebuggerEventSource } from './chrome-debugger-source';
import { ChromeHarEventSource } from './chrome-har-source';
import { ChromeResourceTimingEventSource } from './chrome-resource-timing-source';
import { ChromeWebRequestEventSource } from './chrome-webrequest-source';
import { LifecycleDiagnostics } from './lifecycle-diagnostics';
import { overrideEventSource } from './override-source';
import { installTabLifecycleBridge } from './tab-lifecycle-bridge';
import { TabSourceRouter } from './tab-source-router';

export interface LifecycleHostOptions {
  readonly bus: TabLifecycleBus;
}

export interface LifecycleHost {
  readonly webRequestSource: ChromeWebRequestEventSource;
  readonly harSource: ChromeHarEventSource;
  readonly resourceTimingSource: ChromeResourceTimingEventSource;
  readonly correlator: HeuristicCorrelator;
  readonly debuggerSource: ChromeDebuggerEventSource;
  readonly cdpCorrelator: CdpCorrelator;
  readonly router: TabSourceRouter;
  readonly store: RequestLifecycleStore;
  /** Detach all chrome listeners — tests / SW shutdown only. */
  dispose(): void;
}

/**
 * Construct and boot one `LifecycleHost`. Idempotent at the call-site
 * level — `background.ts` invokes this exactly once per SW lifetime.
 *
 * Composes the heuristic and CDP correlators into one store behind a
 * {@link TabSourceRouter} (see the module doc-comment). The CDP source +
 * correlator are constructed inert; Slice 4 drives them.
 */
export function startLifecycleHost(options: LifecycleHostOptions): LifecycleHost {
  const webRequestSource = new ChromeWebRequestEventSource();
  const harSource = new ChromeHarEventSource();
  const resourceTimingSource = new ChromeResourceTimingEventSource();
  const debuggerSource = new ChromeDebuggerEventSource();
  // Lifecycle-pipeline telemetry (lifecycle audit §1.7) — wired only at
  // debug log level so prod runs the plain correlator path with zero
  // overhead. The settings bootstrap applies `data.logLevel` before this
  // runs (see `background.ts` initializeExtension order), so the level is
  // already authoritative here. Set `data.logLevel: debug` + reload to
  // surface per-stage counts in the SW console.
  const diagnostics = logger.getLevel() === 'debug' ? new LifecycleDiagnostics() : undefined;
  const correlator = new HeuristicCorrelator(
    {
      webRequest: webRequestSource,
      har: harSource,
      resourceTiming: resourceTimingSource,
      // Page-relayed rule-modification captures (response/request overrides) —
      // the fire bridge feeds this via the `tabResponseOverride` handler.
      override: overrideEventSource,
    },
    diagnostics,
  );
  const cdpCorrelator = new CdpCorrelator(debuggerSource);
  const store = new RequestLifecycleStore({
    onReject: (update, reason) => {
      logger.warn('LifecycleHost', 'store rejected update', { kind: update.kind, reason });
    },
  });

  // The store is the canonical downstream consumer of both correlators.
  // The router (below) guarantees a tab is attached to exactly one of
  // them, so the store sees a single stream per tab. Additional
  // subscribers (panel forwarder, tab-telemetry projection) attach
  // through `correlator.subscribe(...)` in their own modules.
  correlator.subscribe((update) => store.apply(update));
  cdpCorrelator.subscribe((update) => store.apply(update));

  if (diagnostics) {
    // Raw-source taps see every event (the correlator's own attach gate
    // is downstream), so the counts reflect true ingestion volume.
    webRequestSource.subscribe((event) => diagnostics.webRequestIn(event));
    harSource.subscribe((event) => diagnostics.harIn(event));
    correlator.subscribe((update) => diagnostics.emitted(update));
  }

  // Trailing GC tick. The correlator's expiry clock advances only on
  // incoming events, so a tab that goes quiet right after a burst (the
  // user stops a page load) would never flush its held HAR entries — and
  // the HAR-only `(canceled)` synthesis they carry. One debounced timer,
  // re-armed on EVERY pipeline event (both sources), ticks the correlator
  // once the forward-race window has fully elapsed after the LAST event.
  // Re-arming on both sources matters: the tick uses wall-clock `now`,
  // which is only safe once the event stream is silent — a still-draining
  // webRequest backlog carries lagged timestamps, and expiring against
  // wall-clock mid-backlog could synthesize a row whose real lifecycle is
  // seconds from arriving. Organic ticks (event-timestamp-driven, inside
  // the correlator) cover the busy-stream case at the lagged clock.
  // The delay tracks the FAILURE window (the synthesis fuse) — that is
  // the expiry with user-visible urgency. Default-window (non-failure)
  // entries left un-expired by this tick are destined for a diagnostic
  // drop anyway and get swept by the next organic event.
  let harGcTimer: ReturnType<typeof setTimeout> | undefined;
  const armTrailingGcTick = (): void => {
    if (harGcTimer !== undefined) clearTimeout(harGcTimer);
    harGcTimer = setTimeout(() => {
      harGcTimer = undefined;
      correlator.gcTick(Date.now());
    }, HAR_FAILURE_HOLD_MS + 500);
  };
  const unsubscribeHarGcPump = harSource.subscribe((event) => {
    if (event.kind === 'har-entry') armTrailingGcTick();
  });
  const unsubscribeWebRequestGcPump = webRequestSource.subscribe(() => {
    if (harGcTimer !== undefined) armTrailingGcTick();
  });

  const router = new TabSourceRouter({ heuristic: correlator, cdp: cdpCorrelator });
  const detachBridge = installTabLifecycleBridge({ router, store, bus: options.bus });

  logger.info('LifecycleHost', 'request lifecycle pipeline online');

  return {
    webRequestSource,
    harSource,
    resourceTimingSource,
    correlator,
    debuggerSource,
    cdpCorrelator,
    router,
    store,
    dispose: () => {
      if (harGcTimer !== undefined) clearTimeout(harGcTimer);
      unsubscribeHarGcPump();
      unsubscribeWebRequestGcPump();
      detachBridge();
      correlator.dispose();
      cdpCorrelator.dispose();
      webRequestSource.dispose();
      harSource.dispose();
      resourceTimingSource.dispose();
      debuggerSource.dispose();
    },
  };
}
