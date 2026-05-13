/**
 * Test Run State — the active-runs registry.
 *
 * Split out from test-runner so dnr-manager (for per-tab isolation) and
 * inject-manager (for scope filtering) can query run state without
 * pulling in the run lifecycle and telemetry wiring. The test-runner
 * owns lifecycle (create/finish); this module owns the *current* state.
 *
 * Tab isolation invariant, enforced by the callers of this module:
 *
 *   A rule R affects tab T iff
 *     (R is a dynamic rule AND T is not in any active run's tab) OR
 *     (R is in run S's scope AND T is S's test tab)
 *
 *   getActiveTestTabIds() → dnr-manager stamps every dynamic rule with
 *     `excludedTabIds: [...getActiveTestTabIds()]`.
 *   getActiveRunSnapshots() → dnr-manager builds a session ruleset
 *     per active run, each with `tabIds: [run.tabId]`.
 *   getTestScopeForTab(tabId) → inject-manager filters scriptable rules
 *     so only rules in the run's scope inject on the test tab.
 *   isRuleUnderTest(ruleUid) → inject-manager suppresses the rule on
 *     non-test tabs so the run doesn't leak outside its sandbox.
 */

import type { Rule } from '@openheaders/core/types';
export interface ActiveRunEntry {
  id: string;
  scopeRules: Rule[];
  ruleUids: Set<string>;
  tabId: number | null;
}

const activeRuns: Map<string, ActiveRunEntry> = new Map();

/** Register a new run. Called by test-runner at run creation. */
export function registerRun(entry: ActiveRunEntry): void {
  activeRuns.set(entry.id, entry);
}

/** Update the tabId of an existing run once the test tab is created. */
export function setRunTabId(runId: string, tabId: number): void {
  const entry = activeRuns.get(runId);
  if (entry) entry.tabId = tabId;
}

/** Remove a run — called by test-runner at finish. */
export function unregisterRun(runId: string): void {
  activeRuns.delete(runId);
}

export function hasActiveRuns(): boolean {
  return activeRuns.size > 0;
}

/** Public snapshot of an active run — what dnr-manager needs to build session rules. */
export interface ActiveRunSnapshot {
  id: string;
  tabId: number;
  scopeRules: Rule[];
  ruleUids: Set<string>;
}

/** All currently-active runs that have a tab assigned. */
export function getActiveRunSnapshots(): ActiveRunSnapshot[] {
  const out: ActiveRunSnapshot[] = [];
  for (const entry of activeRuns.values()) {
    if (entry.tabId != null) {
      out.push({
        id: entry.id,
        tabId: entry.tabId,
        scopeRules: entry.scopeRules,
        ruleUids: entry.ruleUids,
      });
    }
  }
  return out;
}

/** Tab ids of every active test run — dnr-manager uses for excludedTabIds. */
export function getActiveTestTabIds(): number[] {
  const out: number[] = [];
  for (const entry of activeRuns.values()) {
    if (entry.tabId != null) out.push(entry.tabId);
  }
  return out;
}

/**
 * If `tabId` is a test tab, return the Set of rule uids allowed to run on it.
 * If not, return null. Used by inject-manager to filter scriptable rules.
 */
export function getTestScopeForTab(tabId: number): Set<string> | null {
  for (const entry of activeRuns.values()) {
    if (entry.tabId === tabId) return entry.ruleUids;
  }
  return null;
}

/**
 * Is this rule uid currently under test in any run? Used by inject-manager
 * to suppress the rule on non-test tabs so the run doesn't leak.
 */
export function isRuleUnderTest(ruleUid: string): boolean {
  for (const entry of activeRuns.values()) {
    if (entry.ruleUids.has(ruleUid)) return true;
  }
  return false;
}
