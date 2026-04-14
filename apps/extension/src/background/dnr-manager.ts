/**
 * DNR Manager — single source of truth for every declarativeNetRequest update.
 *
 * Architecture:
 *
 *   - Each rule type has a `RuleCompiler` in `dnr-builders/` that turns a
 *     V5.Rule into a `CompilationPlan { dynamicRules?, sessionRules? }`.
 *   - `rebuildAll` iterates enabled rules, compiles each, and fans out the
 *     resulting DNR rules to Chrome's two rule layers:
 *       - Dynamic layer (updateDynamicRules): rules that don't need per-tab
 *         scoping. This is where almost everything lives.
 *       - Session layer (updateSessionRules): rules that need `tabIds` or
 *         `excludedTabIds` — Chrome only allows those fields on session
 *         rules. Delay redirect rules live here so the delay-page bypass
 *         can exclude a single tab at a time without touching user rules.
 *   - While any test session is active, each session's scope rules are
 *     ALSO compiled and stamped with `tabIds: [testTabId]`, so test-
 *     scoped rules only fire on their own tab.
 *
 * Scriptable injections are NOT handled here. `inject-manager` consumes
 * V5 rules directly from the rule store and installs its MAIN-world
 * injections per main-frame commit. The two concerns have different
 * lifecycles and stay cleanly decoupled.
 */

declare const browser: typeof chrome | undefined;

import type { V5 } from '@openheaders/core/types';
import type { PauseMarker } from '@openheaders/core/utils';
import { isRuleComplete, resolvePauseState } from '@openheaders/core/utils';
import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import type { CompilationPlan, CompilerContext, DnrRule, RuleCompiler } from './dnr-builders';
import {
  blockCompiler,
  delayCompiler,
  headerCompiler,
  injectCompiler,
  queryParamCompiler,
  redirectCompiler,
} from './dnr-builders';
import { updateScriptableRules } from './inject-manager';
import { getRules } from './modules/rule-store';
import { getActiveRunSnapshots, getActiveTestTabIds } from './modules/test-runner';

// ── Paused state ─────────────────────────────────────────────────

let isPaused = false;
let pauseMarkers: Map<string, PauseMarker> = new Map();

/**
 * Dynamic-layer rule id → source V5.Rule.uid. Rebuilt on every applyAllRules()
 * call. Used for telemetry lookups (e.g. getActiveRulesForTab).
 */
const dynamicDnrIdToUid: Map<number, string> = new Map();

/**
 * Per-run mapping from DNR session rule id → V5.Rule.uid. Keyed by test
 * run id so the test-runner can look up fires for its own run without
 * colliding with other parallel runs. ("Session" in the field name refers
 * to Chrome's `updateSessionRules` DNR category, not to our test runs.)
 */
const runSessionRuleIdToUid: Map<string, Map<number, string>> = new Map();

export function getDnrIdToRuleUid(): ReadonlyMap<number, string> {
  return dynamicDnrIdToUid;
}

export function getSessionRuleIdToUid(runId: string): ReadonlyMap<number, string> {
  return runSessionRuleIdToUid.get(runId) ?? new Map();
}

export function setRulesPaused(paused: boolean): void {
  isPaused = paused;
}

export function setPauseMarkers(record: Record<string, PauseMarker>): void {
  pauseMarkers = new Map(Object.entries(record));
}

export function getPauseMarkers(): ReadonlyMap<string, PauseMarker> {
  return pauseMarkers;
}

export function initPauseState(): void {
  const browserAPI = (typeof browser !== 'undefined' ? browser : chrome) as typeof chrome;
  browserAPI.storage.sync.get(['isRulesExecutionPaused'], (result: Record<string, unknown>) => {
    isPaused = (result.isRulesExecutionPaused as boolean) || false;
  });
  browserAPI.storage.local.get(['pauseMarkers'], (result: Record<string, unknown>) => {
    const record = result.pauseMarkers as Record<string, PauseMarker> | undefined;
    if (record && typeof record === 'object') {
      pauseMarkers = new Map(Object.entries(record));
    }
  });
}

// ── Compiler registry ────────────────────────────────────────────

/**
 * Single source of truth for "how does each rule type become DNR rules?".
 * Adding a rule type means writing a compiler and registering it here —
 * nothing else needs to know.
 */
const compilers: Record<string, RuleCompiler<V5.Rule>> = {
  block: blockCompiler as RuleCompiler<V5.Rule>,
  delay: delayCompiler as RuleCompiler<V5.Rule>,
  header: headerCompiler as RuleCompiler<V5.Rule>,
  inject: injectCompiler as RuleCompiler<V5.Rule>,
  'query-param': queryParamCompiler as RuleCompiler<V5.Rule>,
  redirect: redirectCompiler as RuleCompiler<V5.Rule>,
};

/** Rule types whose scriptable side is handled by inject-manager. */
const SCRIPTABLE_TYPES: ReadonlySet<V5.Rule['type']> = new Set(['inject', 'delay', 'body', 'mock', 'header']);

// ── Delay bypass state ──────────────────────────────────────────
//
// When the delay page finishes its countdown and navigates to the real URL,
// the DNR redirect rule would match again and loop. We suppress the delay
// rule for the specific tab until the specific navigation we triggered lands.
//
// Each entry records the target URL and an expiry timestamp. An entry only
// clears when a webNavigation event reports the SAME tab navigating to the
// SAME URL (or on tab close, or on expiry).

const DELAY_BYPASS_TTL_MS = 30_000;

interface DelayBypassEntry {
  targetUrl: string;
  expiresAt: number;
}

const pendingDelayBypass: Map<number, DelayBypassEntry> = new Map();

function safeParseUrl(url: string): URL | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * Loose match between the delay.html target URL and the URL reported by
 * Chrome in webNavigation events. Compares origin + pathname + search, and
 * strips a trailing slash from the pathname so `https://example.com` and
 * `https://example.com/` are treated as the same navigation. Fragments are
 * ignored because Chrome strips them from DNR matching anyway.
 */
function urlsMatchForBypass(a: string, b: string): boolean {
  const ua = safeParseUrl(a);
  const ub = safeParseUrl(b);
  if (!ua || !ub) return a === b;
  if (ua.origin !== ub.origin) return false;
  const pathA = ua.pathname.endsWith('/') ? ua.pathname.slice(0, -1) : ua.pathname;
  const pathB = ub.pathname.endsWith('/') ? ub.pathname.slice(0, -1) : ub.pathname;
  return pathA === pathB && ua.search === ub.search;
}

function pruneExpiredBypass(): void {
  const now = Date.now();
  for (const [tabId, entry] of pendingDelayBypass) {
    if (entry.expiresAt <= now) pendingDelayBypass.delete(tabId);
  }
}

function getActiveBypassTabIds(): number[] {
  pruneExpiredBypass();
  return [...pendingDelayBypass.keys()];
}

/**
 * Mark a tab as temporarily exempt from delay redirect rules. Returns a
 * promise that resolves once the updated DNR rules are live in Chrome. The
 * delay page awaits this before navigating to the real target, so the
 * follow-up navigation doesn't race the rule update and re-trigger the delay.
 */
export function markTabForDelayBypass(tabId: number, targetUrl: string): Promise<void> {
  if (tabId < 0) return Promise.resolve();
  const existing = pendingDelayBypass.get(tabId);
  const now = Date.now();
  pendingDelayBypass.set(tabId, { targetUrl, expiresAt: now + DELAY_BYPASS_TTL_MS });
  if (existing) return Promise.resolve();
  return applyAllRulesAsync();
}

/**
 * Clear the bypass entry for a tab if the given URL matches the stashed
 * target. Called from webNavigation.onCommitted / onErrorOccurred — unrelated
 * navigations (Back button, sub-frame, sibling) leave the entry alone.
 *
 * Telemetry attribution for the delay firing is NOT done here. The
 * follow-up navigation (the `location.replace` from delay.html) goes
 * through webRequest normally, request-monitor matches the delay rule
 * against its URL, tab-telemetry records the observed fire with the
 * new requestId, and `onPageCommit` promotes it into the destination
 * page's bucket when the commit lands. Recording an additional fire here
 * would double-count.
 */
export function resolveDelayBypass(tabId: number, committedUrl: string): void {
  const entry = pendingDelayBypass.get(tabId);
  if (!entry) return;
  if (!urlsMatchForBypass(entry.targetUrl, committedUrl)) return;
  pendingDelayBypass.delete(tabId);
  applyAllRules();
}

/** Drop a tab's bypass entry unconditionally — used on tab close. */
export function forgetDelayBypassForTab(tabId: number): void {
  if (pendingDelayBypass.delete(tabId)) {
    applyAllRules();
  }
}

// ── Entry points ─────────────────────────────────────────────────

export function updateNetworkRules(rules: V5.Rule[]): void {
  void rebuildAll(rules);
}

export function applyAllRules(): void {
  void rebuildAll(getRules());
}

/**
 * Same as `applyAllRules` but returns a promise that resolves after Chrome
 * commits the DNR rule update. Used by the delay-bypass path so the delay
 * page's follow-up navigation only starts once the rule change is live.
 */
export function applyAllRulesAsync(): Promise<void> {
  return rebuildAll(getRules());
}

// ── Core compile/dispatch loop ───────────────────────────────────

interface TaggedRule {
  rule: DnrRule;
  uid: string;
}

interface RebuildOutput {
  dynamic: TaggedRule[];
  session: TaggedRule[];
  scriptables: V5.Rule[];
}

/**
 * Compile every enabled rule into DNR rules plus a scriptable passthrough
 * for inject-manager. Returns TAGGED rules (with their source V5 uid) so
 * callers can build id→uid maps for telemetry lookups.
 */
function compileRuleSet(rules: V5.Rule[], startId: number): RebuildOutput {
  const dynamic: TaggedRule[] = [];
  const session: TaggedRule[] = [];
  const scriptables: V5.Rule[] = [];

  let nextId = startId;
  const ctx: CompilerContext = { allocateId: () => nextId++ };

  for (const rule of rules) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    if (resolvePauseState(rule.path, pauseMarkers)) continue;

    // inject-manager wants every rule that has any in-page side effect,
    // regardless of whether it ALSO produces DNR rules. Passed by value.
    if (SCRIPTABLE_TYPES.has(rule.type)) {
      scriptables.push(rule);
    }

    const compiler = compilers[rule.type];
    if (!compiler) continue;
    const plan: CompilationPlan = compiler.compile(rule, ctx);
    for (const dr of plan.dynamicRules ?? []) dynamic.push({ rule: dr, uid: rule.uid });
    for (const sr of plan.sessionRules ?? []) session.push({ rule: sr, uid: rule.uid });
  }

  return { dynamic, session, scriptables };
}

function rebuildAll(rules: V5.Rule[]): Promise<void> {
  dynamicDnrIdToUid.clear();
  runSessionRuleIdToUid.clear();

  if (isPaused) {
    logger.info('DnrManager', 'Rules execution is paused, clearing all active rules');
    clearAllDynamicRules();
    clearAllSessionRules();
    updateScriptableRules([]);
    return Promise.resolve();
  }

  const testTabIds = getActiveTestTabIds();
  const runs = getActiveRunSnapshots();

  // ── Layer 1: dynamic rules (global, not per-tab) ──
  // Compile all enabled rules. Dynamic DNR rules go out globally; session
  // DNR rules will be tagged with excludedTabIds below to keep delay-bypass
  // loop prevention correct.
  const { dynamic: globalDynamic, session: globalSessionUntagged, scriptables } = compileRuleSet(rules, 1);
  const dynamicToApply: DnrRule[] = [];
  for (const { rule, uid } of globalDynamic) {
    dynamicDnrIdToUid.set(rule.id, uid);
    dynamicToApply.push(rule);
  }
  const dynamicPromise = applyDynamicRules(dynamicToApply);
  updateScriptableRules(scriptables);

  // ── Layer 2: session rules ──
  // Three subcategories:
  //
  //   (a) Test-run rules: scope-snapshot rules from each active test
  //       run, stamped with tabIds: [testTabId] so they only fire on
  //       that run's tab.
  //   (b) Delay redirect rules: emitted by compileRuleSet as `session`
  //       rules. Stamped with excludedTabIds for test tabs (so they don't
  //       collide with test isolation) AND for any tabs currently in the
  //       delay-bypass set (so the delay page's follow-up navigation
  //       passes through without re-triggering the delay).
  //   (c) Nothing else today — sessionRules from other rule types would
  //       flow through here the same way if any are added in the future.

  const sessionToApply: DnrRule[] = [];

  // (a) Test runs first — start the session rule id counter well above
  // the dynamic range to avoid id collisions in Chrome versions that
  // share the id space across both layers.
  let sessionIdCounter = 1_000_000;
  // Snapshot the bypass set once so all runs see a consistent view.
  const bypassTabSet = new Set(getActiveBypassTabIds());
  for (const run of runs) {
    const perRunMap = new Map<number, string>();
    runSessionRuleIdToUid.set(run.id, perRunMap);

    // Delay-loop guard: when this run's test tab is in the delay-bypass
    // window (the delay page is about to navigate back to the real target),
    // the delay rule under test would re-fire and loop. Drop delay rules
    // from the scope for the duration of the bypass window — every other
    // rule type in the run continues to apply normally. Once the bypass
    // entry clears (resolveDelayBypass on commit), the next applyAllRules
    // brings the delay rule back, but the test tab has already navigated
    // past it.
    const scopeForCompile = bypassTabSet.has(run.tabId)
      ? run.scopeRules.filter((r) => r.type !== 'delay')
      : run.scopeRules;

    const { dynamic: runDynamic, session: runSession } = compileRuleSet(scopeForCompile, sessionIdCounter);
    // Both the "dynamic" and "session" outputs from a test scope end up
    // in the session layer with tabIds stamped — within a test run,
    // everything is per-tab.
    const all = [...runDynamic, ...runSession];
    for (const { rule, uid } of all) {
      perRunMap.set(rule.id, uid);
      rule.condition = { ...rule.condition, tabIds: [run.tabId] };
      sessionToApply.push(rule);
      sessionIdCounter = Math.max(sessionIdCounter, rule.id + 1);
    }
  }

  // (b) Delay rules (and any other global session rules). Stamp with
  // excludedTabIds so test tabs and bypass tabs are skipped.
  const bypassTabs = getActiveBypassTabIds();
  const excludedForGlobal = [...new Set<number>([...testTabIds, ...bypassTabs])];
  for (const { rule, uid } of globalSessionUntagged) {
    dynamicDnrIdToUid.set(rule.id, uid); // global session rules are part of the "live for this tab" lookup
    if (excludedForGlobal.length > 0) {
      rule.condition = { ...rule.condition, excludedTabIds: excludedForGlobal };
    }
    sessionToApply.push(rule);
  }

  const sessionPromise = applySessionRules(sessionToApply);
  return Promise.all([dynamicPromise, sessionPromise]).then(() => undefined);
}

// ── DNR rule application ─────────────────────────────────────────

function applyDynamicRules(newRules: DnrRule[]): Promise<void> {
  return declarativeNetRequest!
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

function applySessionRules(newRules: DnrRule[]): Promise<void> {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) {
    if (newRules.length > 0) {
      logger.info('DnrManager', 'updateSessionRules unavailable — session rules will not be applied');
    }
    return Promise.resolve();
  }
  return dnr
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
