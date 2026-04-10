/**
 * DNR Manager — coordinator for all declarativeNetRequest rule updates.
 *
 * Replaces the former header-manager.ts with a modular architecture:
 * - Per-type builders handle the V5.Rule → DnrRule conversion
 * - Inject rules are routed to inject-manager (chrome.scripting, not DNR)
 * - Pause/collection-folder state management lives here
 *
 * All modules call rule-engine.scheduleUpdate() which eventually calls
 * updateNetworkRules() here. This is the single point of DNR application.
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { isPathPausedByAncestor, isRuleComplete } from '@openheaders/core/utils';
import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { DnrBuilder, DnrRule } from './dnr-builders';
import { blockBuilder, headerBuilder, queryParamBuilder, redirectBuilder } from './dnr-builders';
import { ALL_RESOURCE_TYPES, buildDnrCondition } from './dnr-builders/types';
import { formatUrlPattern } from './modules/url-utils';
import type { HeaderMergeEntry } from './inject-manager';
import { updateScriptableRules } from './inject-manager';

// ── Cached state ─────────────────────────────────────────────────

let isPaused = false;
/** Paths of paused collections/folders — rules under these are skipped. */
let pausedGroups: Set<string> = new Set();

export function setRulesPaused(paused: boolean): void {
  isPaused = paused;
}

export function setPausedGroups(paths: string[]): void {
  pausedGroups = new Set(paths);
}

export function getPausedGroups(): string[] {
  return [...pausedGroups];
}

export function initPauseState(): void {
  const browserAPI = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;
  browserAPI.storage.sync.get(['isRulesExecutionPaused'], (result: Record<string, unknown>) => {
    isPaused = (result.isRulesExecutionPaused as boolean) || false;
  });
  browserAPI.storage.local.get(['pausedGroups'], (result: Record<string, unknown>) => {
    const paths = result.pausedGroups as string[] | undefined;
    if (Array.isArray(paths)) {
      pausedGroups = new Set(paths);
    }
  });
}

// ── Builder registry ─────────────────────────────────────────────

const dnrBuilders: Record<string, DnrBuilder<V5.Rule>> = {
  header: headerBuilder as DnrBuilder<V5.Rule>,
  block: blockBuilder as DnrBuilder<V5.Rule>,
  redirect: redirectBuilder as DnrBuilder<V5.Rule>,
  'query-param': queryParamBuilder as DnrBuilder<V5.Rule>,
};

// ── Main update function ─────────────────────────────────────────

/**
 * Build and apply all declarativeNetRequest rules + inject rules.
 * Called by rule-engine after debounce/dedup.
 */
export function updateNetworkRules(rules: V5.Rule[]): void {
  if (isPaused) {
    logger.info('DnrManager', 'Rules execution is paused, clearing all active rules');
    clearAllDnrRules();
    updateScriptableRules([]);
    return;
  }

  const dnrRules: DnrRule[] = [];
  const scriptableRules: Array<V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule> = [];
  const headerMerges: HeaderMergeEntry[] = [];
  let ruleId = 1;

  /** Rule types handled by content script injection (not DNR). */
  const scriptableTypes = new Set(['inject', 'delay', 'body', 'mock']);

  const defaultSeparator = (headerName: string): string => {
    const lower = headerName.toLowerCase();
    return lower === 'cookie' || lower === 'set-cookie' ? '; ' : ', ';
  };

  for (const rule of rules) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;

    // Check collection/folder pausing
    if (isPathPausedByAncestor(rule.path, pausedGroups)) continue;

    // Route scriptable rules to inject-manager
    if (scriptableTypes.has(rule.type)) {
      scriptableRules.push(rule as V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule);

      // Inject rules with bypassCSP generate companion DNR rules to strip CSP headers
      if (rule.type === 'inject' && (rule as V5.InjectRule).action.bypassCSP) {
        const cspRules = buildCSPBypassRules(rule as V5.InjectRule, ruleId);
        dnrRules.push(...cspRules);
        ruleId += cspRules.length;
      }

      continue;
    }

    // Extract merge operations from header rules → content script injection
    if (rule.type === 'header') {
      const hr = rule as V5.HeaderRule;
      const reqMerges = (hr.action.requestHeaders ?? [])
        .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim())
        .map((m) => ({
          headerName: m.headerName,
          value: m.value!,
          separator: m.mergeSeparator || defaultSeparator(m.headerName),
        }));
      const resMerges = (hr.action.responseHeaders ?? [])
        .filter((m) => m.operation === 'merge' && m.headerName?.trim() && m.value?.trim())
        .map((m) => ({
          headerName: m.headerName,
          value: m.value!,
          separator: m.mergeSeparator || defaultSeparator(m.headerName),
        }));
      if (reqMerges.length > 0 || resMerges.length > 0) {
        const patterns = rule.conditions
          .filter((c) => c.type === 'request-domains')
          .flatMap((c) => c.values)
          .filter((v) => v.trim());
        headerMerges.push({ patterns, requestMerges: reqMerges, responseMerges: resMerges });
      }
    }

    // Look up the DNR builder for this rule type
    const builder = dnrBuilders[rule.type];
    if (!builder) continue;

    const newRules = builder.build(rule, ruleId);
    dnrRules.push(...newRules);
    ruleId += newRules.length;
  }

  applyDnrRules(dnrRules);
  updateScriptableRules(scriptableRules, headerMerges);
}

// ── DNR rule application ─────────────────────────────────────────

function applyDnrRules(newRules: DnrRule[]): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeRuleIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then(() => {
      logger.info('DnrManager', `Applied ${newRules.length} DNR rules`);
    })
    .catch((e: Error) => {
      logger.error('DnrManager', 'Error updating rules:', e.message || 'Unknown error');
    });
}

/**
 * Build DNR rules that strip Content-Security-Policy headers for inject rules
 * with bypassCSP enabled. This allows injected scripts/CSS to execute on sites
 * with strict CSP that would otherwise block inline scripts.
 */
function buildCSPBypassRules(rule: V5.InjectRule, startId: number): DnrRule[] {
  const { base, domains, useRegex, urlPattern } = buildDnrCondition(rule.conditions);

  if (domains.length === 0 && !urlPattern) return [];

  const cspHeaders: DnrRule['action']['responseHeaders'] = [
    { header: 'Content-Security-Policy', operation: 'remove' },
    { header: 'Content-Security-Policy-Report-Only', operation: 'remove' },
  ];

  const rules: DnrRule[] = [];
  let ruleId = startId;

  if (urlPattern) {
    const condition: Record<string, unknown> = { ...base, resourceTypes: ALL_RESOURCE_TYPES };
    if (useRegex) condition.regexFilter = urlPattern;
    else condition.urlFilter = urlPattern;
    rules.push({
      id: ruleId++,
      priority: 2000, // High priority — CSP must be stripped before page loads
      action: { type: 'modifyHeaders', responseHeaders: cspHeaders },
      condition: condition as DnrRule['condition'],
    });
  } else {
    for (const domain of domains) {
      rules.push({
        id: ruleId++,
        priority: 2000,
        action: { type: 'modifyHeaders', responseHeaders: cspHeaders },
        condition: { ...base, urlFilter: formatUrlPattern(domain), resourceTypes: ALL_RESOURCE_TYPES } as DnrRule['condition'],
      });
    }
  }

  return rules;
}

function clearAllDnrRules(): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrManager', 'All rules cleared (paused)');
    });
}
