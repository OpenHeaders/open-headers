/**
 * Match Tracker — owns the tracked-resource membership decisions
 * driven by lifecycle updates. Decides whether a given URL on a given
 * tab matches any enabled rule and updates the tracked set accordingly;
 * handles cleanup when a tracked URL fails at the network layer before
 * any rule could have acted on it.
 */

import { dropTab, dropTrackedUrl } from '@openheaders/oracle/tracking/tab-tracking-store';

import { addTrackedUrl, checkIfUrlMatchesAnyRule } from '../modules/request-tracker';
import { isTrackableUrl, normalizeUrlForTracking } from '../modules/url-utils';
import type { TrackedResourceType } from '@/types/browser';

export interface ObservedMatchInput {
  tabId: number;
  url: string;
  resourceType: TrackedResourceType;
}

/**
 * Apply a tracked-URL ingestion for a `started` or `redirect` lifecycle
 * point. Returns true when the URL matched a rule and the tracked set
 * changed (callers may want to refresh the badge).
 */
export function ingestMatchObservation({ tabId, url, resourceType }: ObservedMatchInput): boolean {
  if (tabId === -1 || !isTrackableUrl(url)) return false;
  const normalized = normalizeUrlForTracking(url);
  if (!checkIfUrlMatchesAnyRule(normalized)) return false;
  addTrackedUrl(tabId, normalized, resourceType);
  return true;
}

export interface NetworkFailureInput {
  tabId: number;
  url: string;
}

/**
 * Drop a tracked URL when its request failed at the network layer
 * (connection refused, DNS, TLS, etc.). Returns true when something was
 * removed so the caller can trigger a badge refresh.
 */
export function dropOnNetworkFailure({ tabId, url }: NetworkFailureInput): boolean {
  return dropTrackedUrl(tabId, normalizeUrlForTracking(url));
}

/** Drop every tracked URL for a tab — used on main-frame navigation. */
export function dropTabTracking(tabId: number): void {
  dropTab(tabId);
}
