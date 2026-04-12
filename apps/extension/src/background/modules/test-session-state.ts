/**
 * Test Session State — the active-sessions registry.
 *
 * Split out from test-runner so dnr-manager (for per-tab isolation) and
 * inject-manager (for scope filtering) can query session state without
 * pulling in the session lifecycle and telemetry wiring. The test-runner
 * owns lifecycle (create/finish); this module owns the *current* state.
 *
 * Tab isolation invariant, enforced by the callers of this module:
 *
 *   A rule R affects tab T iff
 *     (R is a dynamic rule AND T is not in any active session's tab) OR
 *     (R is in session S's scope AND T is S's test tab)
 *
 *   getActiveTestTabIds() → dnr-manager stamps every dynamic rule with
 *     `excludedTabIds: [...getActiveTestTabIds()]`.
 *   getActiveSessionSnapshots() → dnr-manager builds a session ruleset
 *     per active session, each with `tabIds: [session.tabId]`.
 *   getTestScopeForTab(tabId) → inject-manager filters scriptable rules
 *     so only rules in the session's scope inject on the test tab.
 *   isRuleUnderTest(ruleUid) → inject-manager suppresses the rule on
 *     non-test tabs so the session doesn't leak outside its sandbox.
 */

import type { V5 } from '@openheaders/core/types';

export interface ActiveSessionEntry {
  id: string;
  scopeRules: V5.Rule[];
  ruleUids: Set<string>;
  tabId: number | null;
}

const activeSessions: Map<string, ActiveSessionEntry> = new Map();

/** Register a new session. Called by test-runner at session creation. */
export function registerSession(entry: ActiveSessionEntry): void {
  activeSessions.set(entry.id, entry);
}

/** Update the tabId of an existing session once the test tab is created. */
export function setSessionTabId(sessionId: string, tabId: number): void {
  const entry = activeSessions.get(sessionId);
  if (entry) entry.tabId = tabId;
}

/** Remove a session — called by test-runner at finish. */
export function unregisterSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

export function hasActiveSessions(): boolean {
  return activeSessions.size > 0;
}

/** Public snapshot of an active session — what dnr-manager needs to build session rules. */
export interface ActiveSessionSnapshot {
  id: string;
  tabId: number;
  scopeRules: V5.Rule[];
  ruleUids: Set<string>;
}

/** All currently-active sessions that have a tab assigned. */
export function getActiveSessionSnapshots(): ActiveSessionSnapshot[] {
  const out: ActiveSessionSnapshot[] = [];
  for (const entry of activeSessions.values()) {
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

/** Tab ids of every active test session — dnr-manager uses for excludedTabIds. */
export function getActiveTestTabIds(): number[] {
  const out: number[] = [];
  for (const entry of activeSessions.values()) {
    if (entry.tabId != null) out.push(entry.tabId);
  }
  return out;
}

/**
 * If `tabId` is a test tab, return the Set of rule uids allowed to run on it.
 * If not, return null. Used by inject-manager to filter scriptable rules.
 */
export function getTestScopeForTab(tabId: number): Set<string> | null {
  for (const entry of activeSessions.values()) {
    if (entry.tabId === tabId) return entry.ruleUids;
  }
  return null;
}

/**
 * Is this rule uid currently under test in any session? Used by inject-manager
 * to suppress the rule on non-test tabs so the test doesn't leak.
 */
export function isRuleUnderTest(ruleUid: string): boolean {
  for (const entry of activeSessions.values()) {
    if (entry.ruleUids.has(ruleUid)) return true;
  }
  return false;
}
