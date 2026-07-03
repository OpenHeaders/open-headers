/**
 * Tracking state — startup restore across open tabs, the observation
 * intake (`addTrackedUrl` with its first-insert broadcast + debounced
 * persist), and full clear.
 */

import {
  clearAllTracking as clearAllTrackingState,
  setTrackedResource,
} from '@openheaders/oracle/tracking/tab-tracking-store';
import { broadcast } from '@utils/bridge';
import { tabs } from '@utils/browser-api';
import type { ObservationSource, TrackedResourceType } from '@/types/browser';
import { isTrackableUrl, normalizeUrlForTracking } from '../url-utils';
import { checkIfUrlMatchesAnyRule } from './matching';
import { scheduleTabTrackingPersist } from './session-persistence';

export async function restoreTrackingState(updateBadgeCallback: () => void): Promise<void> {
  tabs.query({}, async (allTabs: chrome.tabs.Tab[]) => {
    for (const tab of allTabs) {
      if (tab.url && tab.id && isTrackableUrl(tab.url)) {
        if (checkIfUrlMatchesAnyRule(tab.url)) {
          setTrackedResource(tab.id, normalizeUrlForTracking(tab.url), 'main_frame', 'webRequest', false);
        }
      }
    }
    if (updateBadgeCallback) updateBadgeCallback();
  });
}

/**
 * Extra metadata the caller supplies when reporting an observation.
 * `source` defaults to `'webRequest'` so existing callers don't need to
 * thread a source through; `servedFromCache` is only meaningful for
 * PerformanceObserver-sourced observations.
 */
export interface AddTrackedUrlOptions {
  source?: ObservationSource;
  servedFromCache?: boolean;
}

export function addTrackedUrl(
  tabId: number,
  url: string,
  resourceType: TrackedResourceType = 'other',
  options: AddTrackedUrlOptions = {},
): void {
  const source = options.source ?? 'webRequest';
  const servedFromCache = options.servedFromCache ?? false;
  // setTrackedResource owns the in-memory state mutation; the host-only
  // side effects (broadcast + debounced session-storage flush) stay
  // here because they reach chrome.runtime and chrome.storage.session.
  // Returns true only on first insert — re-observations don't broadcast
  // (the popup already knows about this URL; per-request broadcast
  // storms on noisy pages would wake it for no new information).
  const inserted = setTrackedResource(tabId, url, resourceType, source, servedFromCache);
  if (inserted) {
    broadcast('trackedUrlsUpdated', { tabId });
  }
  scheduleTabTrackingPersist();
}

export function clearAllTracking(): void {
  clearAllTrackingState();
}
