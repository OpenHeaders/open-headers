/**
 * Revalidation — re-evaluates every tracked URL against the current
 * rule set when rules change, with a queue-and-retry guard so
 * concurrent triggers coalesce.
 */

import { getRuleMatchPatterns } from '@openheaders/core/utils';
import {
  clearAllTracking as clearAllTrackingState,
  iterateTrackedEntries,
  replaceTabResources,
} from '@openheaders/oracle/tracking/tab-tracking-store';
import type { TrackedResource } from '@/types/browser';
import { normalizeUrlForTracking } from '../url-utils';
import { doesUrlMatchEntry, getRules } from './matching';

const REVALIDATION_QUEUE = new Set<number>();
let isRevalidating = false;

/**
 * Re-evaluate tracked requests when rules change.
 */
export async function revalidateTrackedRequests(): Promise<void> {
  if (isRevalidating) {
    REVALIDATION_QUEUE.add(Date.now());
    return;
  }

  isRevalidating = true;

  try {
    const rules = getRules();

    if (rules.length === 0) {
      clearAllTrackingState();
      return;
    }

    for (const [tabId, trackedUrls] of [...iterateTrackedEntries()]) {
      const validUrls = new Map<string, TrackedResource>();

      for (const [url, res] of trackedUrls) {
        let stillMatches = false;
        const normalizedUrl = normalizeUrlForTracking(url);
        for (const rule of rules) {
          for (const entry of getRuleMatchPatterns(rule)) {
            if (doesUrlMatchEntry(normalizedUrl, entry)) {
              stillMatches = true;
              break;
            }
          }
          if (stillMatches) break;
        }
        if (stillMatches) {
          validUrls.set(url, res);
        }
      }

      replaceTabResources(tabId, validUrls);
    }
  } finally {
    isRevalidating = false;

    if (REVALIDATION_QUEUE.size > 0) {
      REVALIDATION_QUEUE.clear();
      setTimeout(() => revalidateTrackedRequests(), 100);
    }
  }
}
