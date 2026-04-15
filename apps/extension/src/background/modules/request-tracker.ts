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
import { broadcast } from '@utils/bridge';
import { tabs } from '@utils/browser-api';
import type { ActiveRule, TrackedResource, TrackedResourceType } from '@/types/browser';
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
 * A single header operation as seen by arbitration. Normalized away from
 * the V5 wire shape (`override`/`add` collapsed into set/append) because
 * the arbitrator only cares about the *effective semantics* on Chrome's
 * side, not the UX labels. The name is lowercased — HTTP header names are
 * case-insensitive and Chrome collapses them internally.
 */
export interface MatchingRuleHeaderOp {
  side: 'request' | 'response';
  /**
   * Effective operation:
   *   - 'set'     — override an existing value (Chrome 'set'; V5 'override')
   *   - 'append'  — add a new header entry alongside any existing (V5 'add')
   *   - 'remove'  — delete all instances of the header
   *   - 'merge'   — scriptable read-modify-write, not a DNR operation
   */
  operation: 'set' | 'append' | 'remove' | 'merge';
  /** Lowercased header name. */
  name: string;
}

/**
 * A single rule that matched a request — the minimum info request-monitor
 * needs to drive tab-telemetry ingestion AND shadow arbitration.
 */
export interface MatchingRule {
  uid: string;
  name: string;
  type: V5.Rule['type'];
  pattern: string;
  /**
   * True when the rule has a scriptable channel that *might* emit a fire
   * via the in-page fire-bridge. Gates the 500ms fallback buffer in
   * tab-telemetry. See `computeDeferred` below for the per-type rules —
   * notably, header rules are only deferred when they have `merge`
   * operations, because plain override/set/remove operations run through
   * pure DNR and never emit a scriptable fire.
   */
  deferred: boolean;
  /**
   * Populated only for `header` rules. Used by shadow arbitration to
   * detect header-stacking ambiguity and mock-intercept on response-side
   * modifications. Normalized away from the V5 wire shape.
   */
  headerOps?: MatchingRuleHeaderOp[];
}

/**
 * Decide whether a specific rule instance can emit a scriptable fire. This
 * is per-rule, not per-type, because `header` rules are split: merge-type
 * operations flow through the MAIN-world fire-bridge, but plain
 * override/set/remove operations stay pure DNR. Passing the wrong flag
 * would strand plain header rules in the fallback buffer and surface them
 * as `matched-fallback` evidence, which is factually wrong.
 */
function computeDeferred(rule: V5.Rule): boolean {
  switch (rule.type) {
    case 'delay':
    case 'body':
    case 'mock':
    case 'inject':
      return true;
    case 'header':
      return hasHeaderMergeAction(rule);
    default:
      return false;
  }
}

function hasHeaderMergeAction(rule: V5.HeaderRule): boolean {
  const req = rule.action.requestHeaders ?? [];
  const res = rule.action.responseHeaders ?? [];
  for (const h of req) if (h.operation === 'merge') return true;
  for (const h of res) if (h.operation === 'merge') return true;
  return false;
}

/**
 * Normalize a header rule's action into the arbitration-facing shape.
 * V5's `override` is Chrome's `set`; V5's `add` is Chrome's `append`;
 * `remove` and `merge` pass through. Names are lowercased because HTTP
 * header matching is case-insensitive. Empty output means "header rule
 * with no modifications" — callers should treat that the same as a
 * non-header rule for arbitration purposes.
 */
function extractHeaderOps(rule: V5.HeaderRule): MatchingRuleHeaderOp[] {
  const out: MatchingRuleHeaderOp[] = [];
  const convert = (op: V5.HeaderOperation): MatchingRuleHeaderOp['operation'] => {
    if (op === 'override') return 'set';
    if (op === 'add') return 'append';
    return op; // 'remove' | 'merge'
  };
  for (const h of rule.action.requestHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'request', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  for (const h of rule.action.responseHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'response', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  return out;
}

/**
 * Return every enabled, complete rule whose URL conditions match this URL.
 * Used by the tab-telemetry ingestion path in request-monitor to attribute
 * each observed request to the specific rule uids that would have matched.
 * The `pattern` field is the literal pattern string from the first matching
 * condition — callers pass it through to tab-telemetry so the expand panel
 * can highlight which condition matched. `name` is included so shadow
 * arbitration can surface the shadowing rule's name in tooltips. `deferred`
 * is computed per-rule so header rules without merge operations don't end
 * up stranded in the scriptable fallback buffer.
 */
export function matchRulesToRequest(url: string): MatchingRule[] {
  const normalizedUrl = normalizeUrlForTracking(url);
  const out: MatchingRule[] = [];
  for (const rule of getRules()) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        const matching: MatchingRule = {
          uid: rule.uid,
          name: rule.name,
          type: rule.type,
          pattern: entry.pattern,
          deferred: computeDeferred(rule),
        };
        if (rule.type === 'header') {
          const ops = extractHeaderOps(rule);
          if (ops.length > 0) matching.headerOps = ops;
        }
        out.push(matching);
        break;
      }
    }
  }
  return out;
}

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
  if (tabId && tabsWithActiveRules.has(tabId)) {
    for (const [url, res] of tabsWithActiveRules.get(tabId)!) {
      trackedResources.set(url, res);
    }
  }

  const activeRules: ActiveRule[] = [];
  const rules = getRules();

  const extensionTypes = new Set(['header', 'block', 'redirect', 'query-param', 'inject', 'delay', 'body', 'mock']);

  const normalizedTabUrl = normalizeUrlForTracking(tabUrl);

  for (const rule of rules) {
    if (!extensionTypes.has(rule.type)) continue;
    if (!isRuleComplete(rule)) continue;

    const patterns = getRuleMatchPatterns(rule);
    let isApplicable = false;

    for (const entry of patterns) {
      if (doesUrlMatchEntry(normalizedTabUrl, entry)) {
        isApplicable = true;
        break;
      }
    }

    if (!isApplicable && trackedResources.size > 0) {
      for (const resourceUrl of trackedResources.keys()) {
        const normalizedResUrl = normalizeUrlForTracking(resourceUrl);
        for (const entry of patterns) {
          if (doesUrlMatchEntry(normalizedResUrl, entry)) {
            isApplicable = true;
            break;
          }
        }
        if (isApplicable) break;
      }
    }

    if (isApplicable) {
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
      });
    }
  }

  return { activeRules };
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
  broadcast('trackedUrlsUpdated', { tabId });
}

export function clearAllTracking(): void {
  tabsWithActiveRules.clear();
}
