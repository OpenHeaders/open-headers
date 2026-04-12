/**
 * DNR Manager — single source of truth for every declarativeNetRequest update.
 *
 * Two distinct DNR layers coexist:
 *
 *   1. **Dynamic rules** — the user's normal ruleset, persisted by Chrome
 *      across sessions. These are applied via `updateDynamicRules`. While any
 *      test session is active, every dynamic rule condition is augmented with
 *      `excludedTabIds: [...activeTestTabIds]` so the test tab(s) are invisible
 *      to the normal ruleset.
 *
 *   2. **Session rules** — ephemeral DNR rules built from each active test
 *      session's scope. Each rule condition is augmented with
 *      `tabIds: [testTabId]` so they fire ONLY on that session's test tab.
 *      Applied via `updateSessionRules` (Chrome's own mechanism for ephemeral
 *      test rules). Rebuilt whenever sessions start or end.
 *
 * This mirrors what Chrome's MV3 DNR API is designed for: dynamic rules for
 * the base config, session rules with `tabIds` for per-tab overrides, and
 * `excludedTabIds` to keep the two layers from colliding.
 *
 * The central entry point is `applyAllRules()`. The rule-engine calls this
 * after debouncing. The test-runner also calls it when a session starts or
 * ends — everything routes through the same place so DNR state is always
 * coherent.
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import {
  compileRuleForInjection,
  formatUrlPattern,
  isPathPausedByAncestor,
  isRuleComplete,
} from '@openheaders/core/utils';
import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { DnrBuilder, DnrRule } from './dnr-builders';
import { blockBuilder, headerBuilder, queryParamBuilder, redirectBuilder } from './dnr-builders';
import { ALL_RESOURCE_TYPES, buildDnrCondition } from './dnr-builders/types';
import type { HeaderMergeEntry } from './inject-manager';
import { updateScriptableRules } from './inject-manager';
import { getRules } from './modules/rule-store';
import { getActiveSessionSnapshots, getActiveTestTabIds } from './modules/test-runner';

// ── Cached state ─────────────────────────────────────────────────

let isPaused = false;
/** Paths of paused collections/folders — rules under these are skipped. */
let pausedGroups: Set<string> = new Set();

/**
 * Mapping from currently-applied DYNAMIC rule id → V5.Rule.uid.
 * Rebuilt on every applyAllRules() call. Used for non-test-session lookups
 * (e.g. the existing getActiveRulesForTab display path).
 */
const dynamicDnrIdToUid: Map<number, string> = new Map();

/**
 * Per-session mapping from SESSION rule id → V5.Rule.uid. Keyed by sessionId
 * so the test-runner can look up fires for its own session without colliding
 * with other parallel sessions.
 */
const sessionDnrIdToUid: Map<string, Map<number, string>> = new Map();

export function getDnrIdToRuleUid(): ReadonlyMap<number, string> {
  return dynamicDnrIdToUid;
}

export function getSessionRuleIdToUid(sessionId: string): ReadonlyMap<number, string> {
  return sessionDnrIdToUid.get(sessionId) ?? new Map();
}

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

/** Rule types handled by content script injection (not DNR). */
const SCRIPTABLE_TYPES = new Set(['inject', 'delay', 'body', 'mock']);

// ── Entry points ─────────────────────────────────────────────────

/**
 * Entry point called by the rule-engine with the rules to apply as the
 * dynamic layer. The session layer is always rebuilt from the current set of
 * active test sessions.
 */
export function updateNetworkRules(rules: V5.Rule[]): void {
  rebuildAll(rules);
}

/**
 * The central DNR application function — rebuilds both dynamic and session
 * layers, reading the latest rules from the rule store.
 *
 * Called by the test-runner when a session starts or ends so `excludedTabIds`
 * and session rules stay in sync with the set of active sessions without
 * waiting for the next rule-engine flush.
 */
export function applyAllRules(): void {
  rebuildAll(getRules());
}

function rebuildAll(rules: V5.Rule[]): void {
  dynamicDnrIdToUid.clear();

  if (isPaused) {
    logger.info('DnrManager', 'Rules execution is paused, clearing all active rules');
    clearAllDynamicRules();
    clearAllSessionRules();
    updateScriptableRules([]);
    return;
  }

  const testTabIds = getActiveTestTabIds();
  const sessions = getActiveSessionSnapshots();

  // ── Layer 1: dynamic rules (normal, global) ──
  const { dnrRules: dynamicRules, scriptableRules, headerMerges } = buildDnrRulesForScope(rules, 1);
  for (const built of dynamicRules) {
    const uid = built.__ohUid;
    if (uid) dynamicDnrIdToUid.set(built.id, uid);
    delete built.__ohUid;
    if (testTabIds.length > 0) {
      built.condition = { ...built.condition, excludedTabIds: testTabIds };
    }
  }
  applyDynamicRules(dynamicRules);
  updateScriptableRules(scriptableRules, headerMerges);

  // ── Layer 2: session rules (per-tab scoped) ──
  // Each active session builds its own DNR rules from its scope snapshot,
  // then every condition is stamped with tabIds:[testTabId].
  const sessionDnrRules: DnrRule[] = [];
  sessionDnrIdToUid.clear();
  // Session rule ids must not collide with each other OR with dynamic rule ids
  // (some Chrome versions share the id space across dynamic + session). Start
  // the session id counter well above the dynamic range.
  let sessionRuleId = 1_000_000;
  for (const session of sessions) {
    const perSessionMap = new Map<number, string>();
    sessionDnrIdToUid.set(session.id, perSessionMap);
    const { dnrRules: built } = buildDnrRulesForScope(session.scopeRules, sessionRuleId);
    for (const r of built) {
      const uid = r.__ohUid;
      if (uid) perSessionMap.set(r.id, uid);
      delete r.__ohUid;
      r.condition = { ...r.condition, tabIds: [session.tabId] };
    }
    sessionDnrRules.push(...built);
    sessionRuleId += built.length;
  }
  applySessionRules(sessionDnrRules);
}

// ── Shared builder path ──────────────────────────────────────────

interface BuildOutput {
  dnrRules: Array<DnrRule & { __ohUid?: string }>;
  scriptableRules: Array<V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule>;
  headerMerges: HeaderMergeEntry[];
}

/**
 * Build the DNR rules, scriptable rules, and header-merge entries for a given
 * set of V5 rules starting from `startId`. Used for both the dynamic layer
 * (all enabled non-scriptable rules) and session layers (a single session's
 * scope snapshot).
 *
 * Each emitted DnrRule carries a transient `__ohUid` field tagging its source
 * V5 rule. Callers are expected to read this into their id→uid map, then
 * delete it before handing the rule to Chrome.
 */
function buildDnrRulesForScope(rules: V5.Rule[], startId: number): BuildOutput {
  const dnrRules: Array<DnrRule & { __ohUid?: string }> = [];
  const scriptableRules: Array<V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule> = [];
  const headerMerges: HeaderMergeEntry[] = [];
  let ruleId = startId;

  const defaultSeparator = (headerName: string): string => {
    const lower = headerName.toLowerCase();
    return lower === 'cookie' || lower === 'set-cookie' ? '; ' : ', ';
  };

  for (const rule of rules) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    if (isPathPausedByAncestor(rule.path, pausedGroups)) continue;

    if (SCRIPTABLE_TYPES.has(rule.type)) {
      scriptableRules.push(rule as V5.InjectRule | V5.DelayRule | V5.BodyRule | V5.MockRule);

      if (rule.type === 'inject' && (rule as V5.InjectRule).action.bypassCSP) {
        const cspRules = buildCSPBypassRules(rule as V5.InjectRule, ruleId);
        for (const csp of cspRules) {
          (csp as DnrRule & { __ohUid?: string }).__ohUid = rule.uid;
        }
        dnrRules.push(...(cspRules as Array<DnrRule & { __ohUid?: string }>));
        ruleId += cspRules.length;
      }
      continue;
    }

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
        // Compile the rule's URL conditions (request-domains, url-filter,
        // url-regex) into regex sources once, in the background. The
        // injected function just `new RegExp(src, 'i').test(url)`s them.
        // Empty array = rule has no URL conditions → won't match anything.
        const regexSources = compileRuleForInjection(rule);
        headerMerges.push({
          ruleUid: rule.uid,
          regexSources,
          requestMerges: reqMerges,
          responseMerges: resMerges,
        });
      }
    }

    const builder = dnrBuilders[rule.type];
    if (!builder) continue;

    const newRules = builder.build(rule, ruleId);
    for (const built of newRules) {
      (built as DnrRule & { __ohUid?: string }).__ohUid = rule.uid;
    }
    dnrRules.push(...(newRules as Array<DnrRule & { __ohUid?: string }>));
    ruleId += newRules.length;
  }

  return { dnrRules, scriptableRules, headerMerges };
}

// ── DNR rule application ─────────────────────────────────────────

function applyDynamicRules(newRules: DnrRule[]): void {
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
      logger.info('DnrManager', `Applied ${newRules.length} dynamic DNR rules`);
    })
    .catch((e: Error) => {
      logger.error('DnrManager', 'Error updating dynamic rules:', e.message || 'Unknown error');
    });
}

function applySessionRules(newRules: DnrRule[]): void {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) {
    if (newRules.length > 0) {
      logger.info('DnrManager', 'updateSessionRules unavailable — test session rules will not be applied');
    }
    return;
  }
  dnr
    .getSessionRules()
    .then((existing) => {
      const removeRuleIds = existing.map((r) => r.id);
      return dnr.updateSessionRules!({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then(() => {
      logger.info('DnrManager', `Applied ${newRules.length} session DNR rules`);
    })
    .catch((e: Error) => {
      logger.error('DnrManager', 'Error updating session rules:', e.message || 'Unknown error');
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

function clearAllDynamicRules(): void {
  declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrManager', 'All dynamic rules cleared');
    });
}

function clearAllSessionRules(): void {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) return;
  dnr
    .getSessionRules()
    .then((existing) => {
      const removeIds = existing.map((r) => r.id);
      return dnr.updateSessionRules!({ removeRuleIds: removeIds, addRules: [] });
    })
    .then(() => {
      logger.debug('DnrManager', 'All session rules cleared');
    });
}
