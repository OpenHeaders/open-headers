/**
 * Active-rules query — decides which rules are applicable to a tab
 * (tab URL or tracked sub-resources), joins fire-confirmation from
 * tab-telemetry, and runs the verdict engine per rule.
 */

import { getActionDetail, getRuleMatchPatterns, isRuleComplete } from '@openheaders/core/utils';
import { getUnresolvableRuleUids } from '@openheaders/oracle/rule-engine/variables-resolver';
import { getTrackedResourceMap } from '@openheaders/oracle/tracking/tab-tracking-store';
import { computeVerdict } from '@openheaders/oracle/tracking/verdict-engine';
import type { ActiveRule, TrackedResource } from '@/types/browser';
import { getTabSnapshot } from '../tab-telemetry';
import { isTrackableUrl, normalizeUrlForTracking } from '../url-utils';
import { getRules } from './matching';

export interface ActiveRulesResult {
  activeRules: ActiveRule[];
}

/**
 * Get all rules applicable to a specific tab — rules whose URL conditions
 * match either the tab URL itself or a previously-tracked sub-resource URL.
 * Returns both enabled and disabled rules so the popup can show toggles.
 *
 * Per-request firing data (counts, unique URLs, evidence tier) is NOT
 * returned here — the popup reads it separately from tab-telemetry via
 * `getTabTelemetry`. This module is only responsible for deciding which
 * rules are applicable to a given page.
 */
export function getActiveRulesForTab(tabId: number | undefined, tabUrl: string): ActiveRulesResult {
  if (!tabUrl || !isTrackableUrl(tabUrl)) {
    return { activeRules: [] };
  }

  const trackedResources: Map<string, TrackedResource> = new Map();
  if (tabId) {
    const existing = getTrackedResourceMap(tabId);
    if (existing) {
      for (const [url, res] of existing) {
        trackedResources.set(url, res);
      }
    }
  }

  // Fire-confirmed rule set for this tab. Joining against telemetry
  // here (rather than the popup join-at-render-time) keeps the popup
  // query single-round-trip and centralizes the "what firing means"
  // definition in one place.
  const firingUids = new Set<string>();
  if (typeof tabId === 'number') {
    const snapshot = getTabSnapshot(tabId);
    for (const uid of Object.keys(snapshot.counters)) firingUids.add(uid);
  }

  const activeRules: ActiveRule[] = [];
  const rules = getRules();
  const unresolvable = getUnresolvableRuleUids();

  const extensionTypes = new Set([
    'header',
    'block',
    'redirect',
    'query-param',
    'inject',
    'delay',
    'request-body',
    'response',
  ]);

  const normalizedTabUrl = normalizeUrlForTracking(tabUrl);

  for (const rule of rules) {
    if (!extensionTypes.has(rule.type)) continue;
    if (!isRuleComplete(rule)) continue;
    // Skip unresolved rules — they never compile to DNR so they
    // can't be "active" on a tab. The sidebar's `unresolved` badge
    // explains their absence to the user.
    if (unresolvable.has(rule.uid)) continue;

    const patterns = getRuleMatchPatterns(rule);
    const result = computeVerdict({
      rule,
      patterns,
      normalizedTabUrl,
      trackedResources,
      firing: firingUids.has(rule.uid),
      normalizeUrl: normalizeUrlForTracking,
    });

    if (!result) continue;

    const detail = getActionDetail(rule);
    const domains = rule.conditions
      .filter((c) => c.type === 'request-domains')
      .flatMap((c) => c.values)
      .filter((v) => v.trim());
    activeRules.push({
      id: rule.uid,
      key: rule.uid,
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
      verdict: result.verdict,
      verdictReason: result.reason,
      // Only include when non-empty so the serialized payload stays
      // lean for the 99% of rules that have no silent matches.
      ...(result.silentRecords.length > 0 ? { silentRecords: result.silentRecords } : {}),
    });
  }

  return { activeRules };
}
