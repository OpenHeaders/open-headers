/**
 * Badge Trigger — invokes the badge-update callback only when the given
 * tab is the currently-active tab. The active-tab gate avoids waking
 * the badge API for background-tab churn on noisy pages.
 */

import { tabs } from '@utils/browser-api';

export type UpdateBadge = () => void;

export function triggerBadgeIfActive(tabId: number, updateBadge: UpdateBadge): void {
  tabs.query({ active: true, currentWindow: true }, (tabsList: chrome.tabs.Tab[]) => {
    if (tabsList[0] && tabsList[0].id === tabId) {
      updateBadge();
    }
  });
}
