/**
 * Tab-lifecycle bridge — closes **S6** in
 * `REQUEST_LIFECYCLE_STATUS.md`.
 *
 * Two responsibilities:
 *
 *   1. `chrome.tabs.onCreated` → `correlator.attachTab(tabId)`.
 *      The correlator gates event emission on attached tabs; without
 *      this, webRequest events fire but nothing leaves the correlator.
 *
 *   2. `chrome.tabs.onRemoved` → `correlator.detachTab(tabId)` +
 *      `store.forgetTab(tabId)`. Invariant 2 says lifecycles die with
 *      the tab; this is the wire that enforces it.
 *
 * On SW cold-start `chrome.tabs.onCreated` will not have fired for
 * tabs that already exist, so the bridge also does a one-shot
 * `chrome.tabs.query({})` bootstrap to attach extant tabs.
 *
 * Cross-browser via `getBrowserAPI()`.
 */

import type { HeuristicCorrelator } from '@openheaders/oracle/correlator-heuristic';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';

import { getBrowserAPI } from '@/types/browser';
import { logger } from '@utils/logger';

export interface TabLifecycleBridgeOptions {
  readonly correlator: Pick<HeuristicCorrelator, 'attachTab' | 'detachTab'>;
  readonly store: Pick<RequestLifecycleStore, 'forgetTab'>;
}

/** Install the bridge. Returns a function that removes both listeners. */
export function installTabLifecycleBridge(options: TabLifecycleBridgeOptions): () => void {
  const { correlator, store } = options;
  const tabs = getBrowserAPI().tabs;
  if (!tabs) {
    logger.info('LifecycleHost', 'chrome.tabs unavailable; tab bridge inert');
    return () => {};
  }

  const onCreated = (tab: chrome.tabs.Tab): void => {
    if (typeof tab.id === 'number') correlator.attachTab(tab.id);
  };

  const onRemoved = (tabId: number): void => {
    correlator.detachTab(tabId);
    store.forgetTab(tabId);
  };

  tabs.onCreated.addListener(onCreated);
  tabs.onRemoved.addListener(onRemoved);

  // SW cold-start catch-up: attach tabs that already exist.
  tabs.query({}, (existing) => {
    for (const tab of existing) {
      if (typeof tab.id === 'number') correlator.attachTab(tab.id);
    }
  });

  return () => {
    tabs.onCreated.removeListener(onCreated);
    tabs.onRemoved.removeListener(onRemoved);
  };
}
