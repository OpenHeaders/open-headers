/**
 * DNR Manager — coordinator for all declarativeNetRequest rule updates.
 *
 * Replaces the former header-manager.ts with a modular architecture:
 * - Per-type builders handle the V5.Rule → DnrRule conversion
 * - Inject rules are routed to inject-manager (chrome.scripting, not DNR)
 * - Pause/tag-group state management lives here
 *
 * All modules call rule-engine.scheduleUpdate() which eventually calls
 * updateNetworkRules() here. This is the single point of DNR application.
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { blockBuilder, headerBuilder, queryParamBuilder, redirectBuilder } from './dnr-builders';
import type { DnrBuilder, DnrRule } from './dnr-builders';
import { updateInjectRules } from './inject-manager';

// ── Cached state ─────────────────────────────────────────────────

let isPaused = false;
let disabledTagGroups: Set<string> = new Set();

export function setRulesPaused(paused: boolean): void {
  isPaused = paused;
}

export function setDisabledTagGroups(groups: string[]): void {
  disabledTagGroups = new Set(groups);
}

export function getDisabledTagGroups(): string[] {
  return [...disabledTagGroups];
}

export function initPauseState(): void {
  const browserAPI = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;
  browserAPI.storage.sync.get(['isRulesExecutionPaused'], (result: Record<string, unknown>) => {
    isPaused = (result.isRulesExecutionPaused as boolean) || false;
  });
  browserAPI.storage.local.get(['disabledTagGroups'], (result: Record<string, unknown>) => {
    const groups = result.disabledTagGroups as string[] | undefined;
    if (Array.isArray(groups)) {
      disabledTagGroups = new Set(groups);
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
    updateInjectRules([]);
    return;
  }

  const dnrRules: DnrRule[] = [];
  const injectRules: V5.InjectRule[] = [];
  let ruleId = 1;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    // Check tag groups
    const tagGroup = rule.tags[0] || '__no_tag__';
    if (disabledTagGroups.has(tagGroup)) continue;

    // Route inject rules to inject-manager
    if (rule.type === 'inject') {
      injectRules.push(rule as V5.InjectRule);
      continue;
    }

    // Look up the DNR builder for this rule type
    const builder = dnrBuilders[rule.type];
    if (!builder) continue; // body, delay, mock — not supported in extension

    const newRules = builder.build(rule, ruleId);
    dnrRules.push(...newRules);
    ruleId += newRules.length;
  }

  applyDnrRules(dnrRules);
  updateInjectRules(injectRules);
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
