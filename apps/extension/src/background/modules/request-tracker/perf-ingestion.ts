/**
 * PerformanceObserver ingestion — Resource Timing entries from the
 * perf-observer content script, mapped onto the tracked-resource
 * taxonomy. Cache-served hits count as applicability, never as fires.
 */

import type { TrackedResourceType } from '@/types/browser';
import { isTrackableUrl, normalizeUrlForTracking } from '../url-utils';
import { checkIfUrlMatchesAnyRule } from './matching';
import { addTrackedUrl } from './tracking';

/**
 * Map a Resource Timing `initiatorType` onto our `TrackedResourceType`
 * enum, which is modeled on webRequest's resource taxonomy. The Resource
 * Timing spec uses DOM-element names ("img", "script") rather than
 * webRequest's categorical names ("image", "script"); most line up 1:1
 * but a handful need translation. Anything unrecognized lands in
 * 'other', which the popup's filter row treats as a valid category.
 */
function perfInitiatorToResourceType(initiatorType: string): TrackedResourceType {
  switch (initiatorType) {
    case 'img':
    case 'image':
      return 'image';
    case 'script':
      return 'script';
    case 'css':
    case 'link':
      return 'stylesheet';
    case 'xmlhttprequest':
    case 'fetch':
      return 'xmlhttprequest';
    case 'iframe':
    case 'frame':
      return 'sub_frame';
    case 'beacon':
    case 'ping':
      return 'ping';
    case 'video':
    case 'audio':
      return 'media';
    case 'navigation':
      return 'main_frame';
    default:
      return 'other';
  }
}

/**
 * Ingest a batch of Resource Timing entries observed by the
 * perf-observer content script. For each entry whose URL matches any
 * rule, the URL is added to `tabsWithActiveRules` with
 * `source='perfObserver'` and the cache flag from the timing entry.
 *
 * Unlike webRequest ingestion, this does NOT count as a "fire" — the
 * rule's action couldn't have run on a cache-served response because
 * there was no request to modify. Instead, the popup surfaces these as
 * a `silent` verdict (applicable but no fire). Callers feed fire-level
 * telemetry through `recordObservedFire` separately when webRequest
 * also sees the same request.
 *
 * Returns the count of URLs that matched a rule for the caller's
 * bookkeeping (currently unused, but useful for debugging).
 */
export function ingestPerfEntries(
  tabId: number,
  entries: ReadonlyArray<{ url: string; initiatorType: string; servedFromCache: boolean }>,
): number {
  if (!tabId || tabId < 0) return 0;
  let matched = 0;
  for (const entry of entries) {
    if (!isTrackableUrl(entry.url)) continue;
    if (!checkIfUrlMatchesAnyRule(entry.url)) continue;
    const normalized = normalizeUrlForTracking(entry.url);
    addTrackedUrl(tabId, normalized, perfInitiatorToResourceType(entry.initiatorType), {
      source: 'perfObserver',
      servedFromCache: entry.servedFromCache,
    });
    matched++;
  }
  return matched;
}
