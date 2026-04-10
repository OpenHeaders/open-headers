/**
 * Request Tracker — tracks which tabs have requests matching V5 rules.
 *
 * Used for badge display and the Active tab in the popup.
 * Reads rules from the in-memory rule store (no storage reads in hot paths).
 */

import type { V5 } from '@openheaders/core/types';
import { getActionDetail, isRuleComplete } from '@openheaders/core/utils';
import { tabs } from '@utils/browser-api';
import { sendMessageWithCallback } from '@utils/messaging';
import type { ActiveRule, MatchedRequest } from '@/types/browser';
import { getRules } from './rule-store';
import {
  clearPatternCache,
  doesUrlMatchPattern,
  isTrackableUrl,
  normalizeUrlForTracking,
  precompileAllPatterns,
} from './url-utils';

// ── Helpers ──────────────────────────────────────────────────────

/** Extract host domain values from a rule's conditions (non-exclude). */
function getHostDomains(rule: V5.Rule): string[] {
  return rule.conditions
    .filter((c) => c.type === 'request-domains')
    .flatMap((c) => c.values)
    .filter((v) => v.trim());
}

// ── Tracked state ─────────────────────────────────────────────────

const REVALIDATION_QUEUE = new Set<number>();
let isRevalidating = false;

/**
 * Map<tabId, Map<normalizedUrl, timestamp>> — tracks which resource URLs
 * were seen on which tabs. Used for indirect matching.
 */
export const tabsWithActiveRules: Map<number, Map<string, number>> = new Map();

// ── Pattern precompilation ────────────────────────────────────────

/**
 * Precompile URL patterns from all rules for fast matching.
 * Called when rules change.
 */
export function precompileRulePatterns(): void {
  clearPatternCache();
  const allDomains: string[] = [];
  for (const rule of getRules()) {
    const domains = getHostDomains(rule);
    if (domains.length > 0) {
      allDomains.push(...domains);
    }
  }
  if (allDomains.length > 0) {
    precompileAllPatterns(allDomains);
  }
}

// ── Matching ──────────────────────────────────────────────────────

/**
 * Check if a URL matches any rule's domain patterns.
 */
export function checkIfUrlMatchesAnyRule(url: string): boolean {
  const normalizedUrl = normalizeUrlForTracking(url);
  for (const rule of getRules()) {
    if (!isRuleComplete(rule)) continue;
    const domains = getHostDomains(rule);
    for (const domain of domains) {
      if (doesUrlMatchPattern(normalizedUrl, domain)) {
        return true;
      }
    }
  }
  return false;
}

export interface ActiveRulesResult {
  activeRules: ActiveRule[];
  uniqueRequestCount: number;
}

/**
 * Get all matching rules for a specific tab (direct and indirect matches).
 * Returns both enabled and disabled rules so the popup can show toggles.
 */
export function getActiveRulesForTab(tabId: number | undefined, tabUrl: string): ActiveRulesResult {
  if (!tabUrl || !isTrackableUrl(tabUrl)) {
    return { activeRules: [], uniqueRequestCount: 0 };
  }

  const trackedResources: Map<string, number> = new Map();
  if (tabId && tabsWithActiveRules.has(tabId)) {
    for (const [url, ts] of tabsWithActiveRules.get(tabId)!) {
      trackedResources.set(url, ts);
    }
  }

  const activeRules: ActiveRule[] = [];
  const now = Date.now();
  const rules = getRules();

  const extensionTypes = new Set(['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock']);

  for (const rule of rules) {
    if (!extensionTypes.has(rule.type)) continue;
    if (!isRuleComplete(rule)) continue;

    const domains = getHostDomains(rule);
    let matchType: 'direct' | 'indirect' | null = null;
    const matchedUrls: MatchedRequest[] = [];

    if (domains.length === 0) {
      matchType = 'direct';
      matchedUrls.push({ url: tabUrl, pattern: '*', timestamp: now });
      for (const [resourceUrl, ts] of trackedResources) {
        matchedUrls.push({ url: resourceUrl, pattern: '*', timestamp: ts });
      }
    } else {
      for (const domain of domains) {
        if (doesUrlMatchPattern(tabUrl, domain)) {
          matchType = 'direct';
          matchedUrls.push({ url: tabUrl, pattern: domain, timestamp: now });
          break;
        }
      }

      if (trackedResources.size > 0) {
        for (const [resourceUrl, ts] of trackedResources) {
          for (const domain of domains) {
            if (doesUrlMatchPattern(resourceUrl, domain)) {
              matchedUrls.push({ url: resourceUrl, pattern: domain, timestamp: ts });
              if (!matchType) matchType = 'indirect';
              break;
            }
          }
        }
      }
    }

    if (matchType) {
      const detail = getActionDetail(rule);
      activeRules.push({
        id: rule.uid,
        key: rule.uid,
        matchType,
        matchedUrls,
        name: rule.name,
        ruleType: rule.type,
        summary: detail.label ? `${detail.label}: ${detail.value}` : detail.value || detail.tooltip,
        actionLabel: detail.label,
        actionOperation: detail.operation,
        actionTooltip: detail.tooltip,
        actionDirection: detail.direction,
        actionValue: detail.value,
        isEnabled: rule.enabled,
        domains,
        path: rule.path,
      });
    }
  }

  const uniqueRequests = new Set<string>();
  for (const rule of activeRules) {
    for (const m of rule.matchedUrls) {
      uniqueRequests.add(`${m.url}\0${m.timestamp}`);
    }
  }

  return { activeRules, uniqueRequestCount: uniqueRequests.size };
}

// ── Revalidation ──────────────────────────────────────────────────

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
      tabsWithActiveRules.clear();
      return;
    }

    for (const [tabId, trackedUrls] of tabsWithActiveRules.entries()) {
      const validUrls = new Map<string, number>();

      for (const [url, ts] of trackedUrls) {
        let stillMatches = false;
        for (const rule of rules) {
          const domains = getHostDomains(rule);
          for (const domain of domains) {
            if (doesUrlMatchPattern(url, domain)) {
              stillMatches = true;
              break;
            }
          }
          if (stillMatches) break;
        }
        if (stillMatches) {
          validUrls.set(url, ts);
        }
      }

      if (validUrls.size > 0) {
        tabsWithActiveRules.set(tabId, validUrls);
      } else {
        tabsWithActiveRules.delete(tabId);
      }
    }
  } finally {
    isRevalidating = false;

    if (REVALIDATION_QUEUE.size > 0) {
      REVALIDATION_QUEUE.clear();
      setTimeout(() => revalidateTrackedRequests(), 100);
    }
  }
}

// ── Tracking state ────────────────────────────────────────────────

export async function restoreTrackingState(updateBadgeCallback: () => void): Promise<void> {
  tabs.query({}, async (allTabs: chrome.tabs.Tab[]) => {
    for (const tab of allTabs) {
      if (tab.url && tab.id && isTrackableUrl(tab.url)) {
        if (checkIfUrlMatchesAnyRule(tab.url)) {
          if (!tabsWithActiveRules.has(tab.id)) {
            tabsWithActiveRules.set(tab.id, new Map());
          }
          tabsWithActiveRules.get(tab.id)!.set(normalizeUrlForTracking(tab.url), Date.now());
        }
      }
    }
    if (updateBadgeCallback) updateBadgeCallback();
  });
}

export function addTrackedUrl(tabId: number, url: string): void {
  if (!tabsWithActiveRules.has(tabId)) {
    tabsWithActiveRules.set(tabId, new Map());
  }
  const trackedUrls = tabsWithActiveRules.get(tabId)!;
  if (trackedUrls.has(url)) return;
  trackedUrls.set(url, Date.now());
  sendMessageWithCallback({ type: 'trackedUrlsUpdated', tabId }, () => {});
}

export function clearAllTracking(): void {
  tabsWithActiveRules.clear();
}
