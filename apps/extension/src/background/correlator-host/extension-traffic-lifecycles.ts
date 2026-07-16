/**
 * Extension-self traffic → lifecycle rows — worker-network parity for the
 * extension's own pages.
 *
 * The browser's DevTools shows requests fired by an extension's background
 * service worker (and its offscreen/popup documents) in the network panel
 * of that extension's pages — the gear-prefixed rows. Neither of our
 * per-tab planes can see them: at the webRequest layer they carry
 * `tabId === -1` (no tab issued them), and on the CDP plane the extension
 * worker is not a child of any tab target while `chrome.debugger` refuses
 * extension targets outright. So the workbench's own telemetry beacons and
 * the request editor's sends fed the executor's wire join but never became
 * rows in the inspected workbench tab.
 *
 * This plane closes the gap first-party. The webRequest adapter's
 * extension-traffic channel (own-origin initiator, `tabId === -1`) feeds a
 * second {@link HeuristicCorrelator} through a re-keying source that fans
 * each event to every OWNER tab — a tab whose main frame lives on our own
 * extension origin (workbench, panel rig) — the same origin-ownership rule
 * the browser-target plane applies to a site's service worker (a worker
 * belongs to the tabs on its origin). The correlator mints full lifecycles
 * (phases, redirects, headers, status, IP, timing floor via partial-HAR
 * synthesis) into the SAME store the page planes feed, so the rows ride
 * the existing hub → port → panel path unchanged.
 *
 * No double-feed is possible: webRequest request ids are browser-global,
 * so a re-keyed row can never collide with the owner tab's own page
 * traffic under either correlator, and the `TabSourceRouter` invariant is
 * untouched (this correlator only ever owns the tab-less stream). Site
 * service workers on http(s) origins remain the deferred CDP parity audit
 * (JS contexts plan §9) — this plane is deliberately scoped to the one
 * origin webRequest lets us capture first-party: our own.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';
import {
  type HarEvent,
  HeuristicCorrelator,
  type WebRequestEvent,
  type WebRequestEventSource,
} from '@openheaders/oracle/correlator-heuristic';
import { runtime, tabs } from '@utils/browser-api.js';
import { logger } from '@utils/logger';

export interface ExtensionTrafficLifecyclesOptions {
  /** The webRequest adapter's extension-traffic channel (own SW/offscreen fetches). */
  readonly subscribeExtensionTraffic: (listener: (event: WebRequestEvent) => void) => () => void;
  /**
   * The devtools HAR relay, tab-keyed to each inspected tab. On an
   * extension-origin page the browser's DevTools auto-attaches the
   * extension's own worker targets, so this feed DOES carry the SW's
   * fetches — sizes, wire timings, and response bodies webRequest can't
   * see. Consumed join-only: the tab's primary correlator shares the feed
   * and owns every HAR-only mint.
   */
  readonly subscribeHar: (listener: (event: HarEvent) => void) => () => void;
  /** Intake of the one `RequestLifecycleStore` every correlator feeds. */
  readonly apply: (update: RequestLifecycleUpdate) => void;
}

export interface ExtensionTrafficLifecycles {
  /** Detach chrome listeners + drop the correlator. Tests / SW shutdown only. */
  dispose(): void;
}

export function startExtensionTrafficLifecycles(
  options: ExtensionTrafficLifecyclesOptions,
): ExtensionTrafficLifecycles {
  if (!tabs?.query) {
    logger.info('ExtensionTrafficLifecycles', 'tabs API unavailable — self-traffic rows disabled');
    return { dispose: () => {} };
  }
  // Every page of this extension shares the one origin prefix
  // (`chrome-extension://<id>/`, `moz-extension://<uuid>/` on Firefox).
  const ownUrlPrefix = runtime.getURL('');

  // ── owner set: tabs whose main frame lives on our origin ───────────
  const owners = new Set<number>();

  // ── re-keying source: one channel event → one event per owner tab ──
  const rekeyListeners = new Set<(event: WebRequestEvent) => void>();
  const rekeySource: WebRequestEventSource = {
    subscribe(listener) {
      rekeyListeners.add(listener);
      return () => {
        rekeyListeners.delete(listener);
      };
    },
  };
  const correlator = new HeuristicCorrelator({
    webRequest: rekeySource,
    // The devtools HAR feed is already tab-keyed, so no re-keying source is
    // needed: the correlator's own attach-gate scopes it to owner tabs, and
    // join-only posture leaves every HAR-only mint (memory-cache, expired
    // failure) to the tab's primary correlator on the same feed.
    har: { subscribe: options.subscribeHar },
    harPosture: 'join-only',
  });
  // Provenance: everything on this channel is issued by the extension's own
  // worker plane (SW / offscreen — tab-less by definition), so stamp the
  // additive `issuedByWorker` fact onto each `started` mint, exactly as the
  // browser-target plane stamps its worker rows (started-only; never
  // patched). The panel's gear glyph gates on it — the browser's own panel
  // gears these rows too.
  const unsubscribeStore = correlator.subscribe((update) => {
    options.apply(
      update.kind === 'started'
        ? { ...update, lifecycle: { ...update.lifecycle, issuedByWorker: 'service-worker' } }
        : update,
    );
  });
  const unsubscribeTraffic = options.subscribeExtensionTraffic((event) => {
    if (owners.size === 0) return;
    for (const tabId of owners) {
      const rekeyed: WebRequestEvent = { ...event, tabId };
      for (const listener of rekeyListeners) listener(rekeyed);
    }
    // Own-bundle terminal floor: a tab-less load of the extension's own
    // packaged asset never crosses the network stack — Chromium delivers
    // onBeforeRequest (and not reliably anything after), so the row would
    // read "(pending)" forever. The browser's panel resolves these as a
    // status-less "Finished"; mirror it by synthesizing the terminal right
    // after the mint, status-less so the cell reads the same. Later events
    // refine in place (completed → completed is a legal same-rank patch).
    if (event.method_kind === 'onBeforeRequest' && isOwnUrl(event.url)) {
      for (const tabId of owners) {
        options.apply({
          kind: 'phase',
          tabId,
          requestId: event.requestId,
          patch: { phase: 'completed', completedAtMs: event.timeStamp },
        });
      }
    }
  });

  const addOwner = (tabId: number): void => {
    if (owners.has(tabId)) return;
    owners.add(tabId);
    correlator.attachTab(tabId);
  };
  const dropOwner = (tabId: number): void => {
    if (!owners.delete(tabId)) return;
    correlator.detachTab(tabId);
  };
  const isOwnUrl = (url: string | undefined | null): boolean =>
    url !== undefined && url !== null && url !== '' && url.startsWith(ownUrlPrefix);

  // ── chrome.tabs wiring (same transition set as the workspace-tab
  //    registry: created / navigated in or out / discard-swap / closed) ──
  const onCreated = (tab: chrome.tabs.Tab): void => {
    if (typeof tab.id !== 'number') return;
    const pending = (tab as chrome.tabs.Tab & { pendingUrl?: string }).pendingUrl;
    if (isOwnUrl(tab.url) || isOwnUrl(pending)) addOwner(tab.id);
  };
  const onUpdated = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo): void => {
    if (changeInfo.url === undefined) return;
    if (isOwnUrl(changeInfo.url)) addOwner(tabId);
    else dropOwner(tabId);
  };
  const onReplaced = (addedTabId: number, removedTabId: number): void => {
    if (!owners.has(removedTabId)) return;
    dropOwner(removedTabId);
    addOwner(addedTabId);
  };
  const onRemoved = (tabId: number): void => {
    dropOwner(tabId);
  };

  tabs.onCreated?.addListener(onCreated);
  tabs.onUpdated?.addListener(onUpdated);
  tabs.onReplaced?.addListener(onReplaced);
  tabs.onRemoved?.addListener(onRemoved);

  // SW-wake bootstrap: the owner set is in-memory, so re-seed from the
  // extension pages already open when the worker starts.
  try {
    tabs.query({ url: `${ownUrlPrefix}*` }, (list: chrome.tabs.Tab[]) => {
      for (const tab of list ?? []) {
        if (typeof tab.id === 'number') addOwner(tab.id);
      }
    });
  } catch (err) {
    logger.info('ExtensionTrafficLifecycles', 'owner bootstrap failed:', (err as Error).message);
  }

  return {
    dispose: () => {
      try {
        tabs.onCreated?.removeListener(onCreated);
        tabs.onUpdated?.removeListener(onUpdated);
        tabs.onReplaced?.removeListener(onReplaced);
        tabs.onRemoved?.removeListener(onRemoved);
      } catch {
        /* already gone — SW shutdown */
      }
      unsubscribeTraffic();
      unsubscribeStore();
      correlator.dispose();
      owners.clear();
      rekeyListeners.clear();
    },
  };
}
