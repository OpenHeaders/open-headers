/**
 * Request Tracker — tracks which tabs have requests matching V5 rules.
 *
 * Used for badge display and the Active tab in the popup.
 * Reads rules from the in-memory rule store (no storage reads in hot paths).
 */

import type { V5 } from '@openheaders/core/types';
import {
  doesUrlMatchEntry as coreDoesUrlMatchEntry,
  getActionDetail,
  getRuleMatchPatterns,
  isRuleComplete,
  type MatchPattern,
} from '@openheaders/core/utils';
import { tabs } from '@utils/browser-api';
import { sendMessageWithCallback } from '@utils/messaging';
import type { ActiveRule, MatchedRequest, TrackedResource, TrackedResourceType } from '@/types/browser';
import { getRules } from './rule-store';
import {
  clearPatternCache,
  doesUrlMatchPattern,
  isTrackableUrl,
  normalizeUrlForTracking,
  precompileAllPatterns,
} from './url-utils';

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Test if a URL matches a MatchPattern. Thin wrapper around core's
 * matcher that routes 'url-filter' patterns through the extension's
 * compiled-regex cache (`doesUrlMatchPattern`) for hot-path perf. The
 * match semantics are identical to core — the cache is pure memoization.
 */
function doesUrlMatchEntry(url: string, entry: MatchPattern): boolean {
  if (entry.kind === 'url-filter') {
    return doesUrlMatchPattern(url, entry.pattern);
  }
  return coreDoesUrlMatchEntry(url, entry);
}


// ── Tracked state ─────────────────────────────────────────────────

const REVALIDATION_QUEUE = new Set<number>();
let isRevalidating = false;

/**
 * Map<tabId, Map<normalizedUrl, TrackedResource>> — tracks which resource URLs
 * were seen on which tabs, with resource type metadata. Used for indirect matching.
 */
export const tabsWithActiveRules: Map<number, Map<string, TrackedResource>> = new Map();

// ── Pattern precompilation ────────────────────────────────────────

/**
 * Precompile URL patterns from all rules for fast matching.
 * Called when rules change.
 */
export function precompileRulePatterns(): void {
  clearPatternCache();
  const compilablePatterns: string[] = [];
  for (const rule of getRules()) {
    for (const entry of getRuleMatchPatterns(rule)) {
      // url-regex patterns are used as-authored; only url-filter goes
      // through the cached urlFilter compiler.
      if (entry.kind === 'url-filter') {
        compilablePatterns.push(entry.pattern);
      }
    }
  }
  if (compilablePatterns.length > 0) {
    precompileAllPatterns(compilablePatterns);
  }
}

// ── Matching ──────────────────────────────────────────────────────

/**
 * Check if a URL matches any rule's URL conditions (request-domains,
 * url-filter, url-regex). A complete rule without any URL conditions
 * is never considered a match — rules that don't declare where they
 * apply don't fire anywhere.
 */
export function checkIfUrlMatchesAnyRule(url: string): boolean {
  const normalizedUrl = normalizeUrlForTracking(url);
  for (const rule of getRules()) {
    if (!isRuleComplete(rule)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Return every enabled, complete rule whose URL conditions match this URL.
 * Used by the tab-telemetry ingestion path in request-monitor to attribute
 * each observed request to the specific rule uids that would have matched,
 * for DNR probable-fire counts. The result is shallow `{uid, type}` — no
 * action detail — so callers can filter by rule type without loading the
 * full rule object.
 */
export function matchRulesToRequest(url: string): Array<{ uid: string; type: V5.Rule['type'] }> {
  const normalizedUrl = normalizeUrlForTracking(url);
  const out: Array<{ uid: string; type: V5.Rule['type'] }> = [];
  for (const rule of getRules()) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        out.push({ uid: rule.uid, type: rule.type });
        break;
      }
    }
  }
  return out;
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

  const trackedResources: Map<string, TrackedResource> = new Map();
  if (tabId && tabsWithActiveRules.has(tabId)) {
    for (const [url, res] of tabsWithActiveRules.get(tabId)!) {
      trackedResources.set(url, res);
    }
  }

  const activeRules: ActiveRule[] = [];
  const now = Date.now();
  const rules = getRules();

  const extensionTypes = new Set(['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock']);

  for (const rule of rules) {
    if (!extensionTypes.has(rule.type)) continue;
    if (!isRuleComplete(rule)) continue;

    const patterns = getRuleMatchPatterns(rule);
    let matchType: 'direct' | 'indirect' | null = null;
    const matchedUrls: MatchedRequest[] = [];
    const normalizedTabUrl = normalizeUrlForTracking(tabUrl);

    for (const entry of patterns) {
      if (doesUrlMatchEntry(normalizedTabUrl, entry)) {
        matchType = 'direct';
        matchedUrls.push({ url: tabUrl, pattern: entry.pattern, timestamp: now, resourceType: 'main_frame' });
        break;
      }
    }

    if (trackedResources.size > 0) {
      for (const [resourceUrl, res] of trackedResources) {
        const normalizedResUrl = normalizeUrlForTracking(resourceUrl);
        for (const entry of patterns) {
          if (doesUrlMatchEntry(normalizedResUrl, entry)) {
            matchedUrls.push({
              url: resourceUrl,
              pattern: entry.pattern,
              timestamp: res.timestamp,
              resourceType: res.resourceType,
            });
            if (!matchType) matchType = 'indirect';
            break;
          }
        }
      }
    }

    if (matchType) {
      const detail = getActionDetail(rule);
      const domains = rule.conditions
        .filter((c) => c.type === 'request-domains')
        .flatMap((c) => c.values)
        .filter((v) => v.trim());
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
        actionItems: detail.items,
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
          tabsWithActiveRules
            .get(tab.id)!
            .set(normalizeUrlForTracking(tab.url), { timestamp: Date.now(), resourceType: 'main_frame' });
        }
      }
    }
    if (updateBadgeCallback) updateBadgeCallback();
  });
}

export function addTrackedUrl(tabId: number, url: string, resourceType: TrackedResourceType = 'other'): void {
  if (!tabsWithActiveRules.has(tabId)) {
    tabsWithActiveRules.set(tabId, new Map());
  }
  const trackedUrls = tabsWithActiveRules.get(tabId)!;
  if (trackedUrls.has(url)) return;
  trackedUrls.set(url, { timestamp: Date.now(), resourceType });
  sendMessageWithCallback({ type: 'trackedUrlsUpdated', tabId }, () => {});
}

export function clearAllTracking(): void {
  tabsWithActiveRules.clear();
}
