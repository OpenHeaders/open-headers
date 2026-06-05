/**
 * Tab-lifecycle bridge — closes **S6** in
 * `REQUEST_LIFECYCLE_STATUS.md`.
 *
 * Two responsibilities:
 *
 *   1. `chrome.tabs.onCreated` → `router.attachTab(tabId)`.
 *      The router registers the tab at its default owner (heuristic) and
 *      attaches that correlator, which gates event emission on attached
 *      tabs; without this, webRequest events fire but nothing leaves the
 *      correlator.
 *
 *   2. `chrome.tabs.onRemoved` → `router.detachTab(tabId)` +
 *      `store.forgetTab(tabId)`. Invariant 2 says lifecycles die with
 *      the tab; this is the wire that enforces it. The router detaches
 *      whichever correlator owns the tab.
 *
 * On SW cold-start `chrome.tabs.onCreated` will not have fired for
 * tabs that already exist, so the bridge also does a one-shot
 * `chrome.tabs.query({})` bootstrap to attach extant tabs.
 *
 * Cross-browser via `getBrowserAPI()`.
 */

import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import type { TabSourceRouter } from './tab-source-router';

export interface TabLifecycleBridgeOptions {
  readonly router: Pick<TabSourceRouter, 'attachTab' | 'detachTab'>;
  readonly store: Pick<RequestLifecycleStore, 'forgetTab'>;
  readonly bus: Pick<TabLifecycleBus, 'notifyTabForgotten'>;
}

/** Install the bridge. Returns a function that removes both listeners. */
export function installTabLifecycleBridge(options: TabLifecycleBridgeOptions): () => void {
  const { router, store, bus } = options;
  const tabs = getBrowserAPI().tabs;
  if (!tabs) {
    logger.info('LifecycleHost', 'chrome.tabs unavailable; tab bridge inert');
    return () => {};
  }

  const onCreated = (tab: chrome.tabs.Tab): void => {
    if (typeof tab.id === 'number') router.attachTab(tab.id);
  };

  // Tab-close ordering (locked in session 50): detach the owning correlator
  // (via the router) → fan out `tab-forgotten` on the bus (drivers clear
  // their per-tab state synchronously while the store partition is still
  // readable) → drop the store partition.
  const onRemoved = (tabId: number): void => {
    router.detachTab(tabId);
    bus.notifyTabForgotten(tabId);
    store.forgetTab(tabId);
  };

  tabs.onCreated.addListener(onCreated);
  tabs.onRemoved.addListener(onRemoved);

  // SW cold-start catch-up: attach tabs that already exist.
  tabs.query({}, (existing) => {
    for (const tab of existing) {
      if (typeof tab.id === 'number') router.attachTab(tab.id);
    }
  });

  return () => {
    tabs.onCreated.removeListener(onCreated);
    tabs.onRemoved.removeListener(onRemoved);
  };
}
