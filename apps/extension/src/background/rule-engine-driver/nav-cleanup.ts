/**
 * Nav Cleanup — installs the `chrome.webNavigation.onBeforeNavigate`
 * listener that drops a tab's tracked-URL set on main-frame navigation.
 * Lives in the rule-engine driver because it operates on
 * `tabsWithActiveRules`, the same state `match-tracker` writes to.
 *
 * Not a `chrome.webRequest.*` subscriber — invariant 7 is unaffected.
 */

import { getBrowserAPI } from '@/types/browser';
import { type UpdateBadge, triggerBadgeIfActive } from './badge-trigger';
import { dropTabTracking } from './match-tracker';

export interface NavCleanupOptions {
  readonly updateBadge: UpdateBadge;
}

export function installNavCleanup(options: NavCleanupOptions): () => void {
  const api = getBrowserAPI().webNavigation;
  if (!api?.onBeforeNavigate) return noop;

  const listener = (details: chrome.webNavigation.WebNavigationBaseCallbackDetails & { frameId: number }) => {
    if (details.frameId !== 0) return;
    dropTabTracking(details.tabId);
    triggerBadgeIfActive(details.tabId, options.updateBadge);
  };

  api.onBeforeNavigate.addListener(listener);
  return () => api.onBeforeNavigate.removeListener(listener);
}

function noop(): void {
  /* no webNavigation API on this platform */
}
