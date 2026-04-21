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

import type { V5 } from '@openheaders/core/types';
import { isRuleEffective } from '@openheaders/core/utils';
import { declarativeNetRequest } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { get as getSetting } from '@/workbench/settings/store';
import { report as reportStatus } from '@/shared/status';
import type { CompilationPlan, CompilerContext, DnrRule, RuleCompiler } from './dnr-builders';
import {
  attachLiveBypassExclusion,
  blockCompiler,
  delayCompiler,
  headerCompiler,
  injectCompiler,
  queryParamCompiler,
  redirectCompiler,
} from './dnr-builders';
import { updateScriptableRules } from './inject-manager';
import { CACHE_BYPASS_ID_BASE } from './modules/cache-bypass';
import { recordLog } from './modules/observability-log';
import { getPauseMarkers } from './modules/pause-markers-store';
import { observeRuleState } from './modules/rule-state-observer';
import { getRules } from './modules/rule-store';
import { getActiveRunSnapshots, getActiveTestTabIds } from './modules/test-runner';
import {
  computeRuleLiveBypass,
  getLastAggregatedResolutionErrors,
  getLastResolutionErrors,
  getUnresolvableRuleUids,
  kickSyncWarmRefreshes,
  resolveRulesForCompile,
} from './modules/variables-resolver';

// ── Paused state ─────────────────────────────────────────────────

let isPaused = false;

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

export function getRulesPaused(): boolean {
  return isPaused;
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
    // `compileRuleSet` only runs when the engine is NOT globally paused
    // (checked upstream in `rebuildAll`), so we pass `false` for
    // `enginePaused` here.
    if (!isRuleEffective(rule, getPauseMarkers(), false)) continue;

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

async function rebuildAll(rawRules: V5.Rule[]): Promise<void> {
  dynamicDnrIdToUid.clear();
  runSessionRuleIdToUid.clear();

  // Sync-warm opt-in LVs drive a blocking refresh of their backing
  // workflows BEFORE resolve, so the compile below sees fresh values
  // instead of stale. No-op when no LV is sync-warm opted in; 5s hard
  // ceiling when any is, then resolve falls back to stale. Live-bypass
  // + live-ref scan both read from the post-warm registry mirror.
  await kickSyncWarmRefreshes();

  // Live-bypass map: `ruleUid → Set<workflowUid>` so each emitted DnrRule
  // carries an `excludedRequestHeaders` clause matching the bypass tag its
  // chain fetches stamp. Computed from RAW rules because the `{{live.X}}`
  // references are what we need to see — after resolve those literals have
  // been substituted with the cached values. Memoized so test-run scope
  // recompiles (which share source uids with the global rule set) don't
  // re-walk every rule's templates.
  const liveBypassByUid = new Map<string, ReadonlySet<string>>();
  for (const rule of rawRules) {
    const bypass = computeRuleLiveBypass(rule);
    if (bypass.size > 0) liveBypassByUid.set(rule.uid, bypass);
  }

  // Resolve {{VAR}} templates against the current env/vars/vault/collection
  // scopes BEFORE any downstream consumer sees the rules. Every compile
  // and every observer diff must see the same resolved shape — otherwise
  // a variable edit can change effective patterns without the observer
  // noticing, or the DNR layer can receive literal "{{VAR}}" strings.
  const resolvedRules = resolveRulesForCompile(rawRules);

  // Drop rules whose templates contain unresolved references. Shipping
  // a rule with a literal `{{wat}}` header value to Chrome would set
  // the header to the literal placeholder on the wire — almost never
  // the user's intent. The rule stays saved (visible to the sidebar,
  // reflected in the resolution-errors map) and re-activates on the
  // next rebuild once the var is defined in some scope. Reserved
  // namespaces (`{{file.X}}` / `{{dynamic.X}}`) don't contribute to
  // `getUnresolvableRuleUids` so those references don't gate rules.
  const unresolvable = getUnresolvableRuleUids();
  const rules = unresolvable.size > 0 ? resolvedRules.filter((r) => !unresolvable.has(r.uid)) : resolvedRules;

  // Diff the effective-active rule set against the previous snapshot
  // and enqueue any necessary cache eviction. Runs on every rebuild
  // regardless of pause state — pausing the engine is itself a
  // transition that should evict caches holding rule-applied bytes.
  observeRuleState(rules, getPauseMarkers(), isPaused);

  if (isPaused) {
    logger.info('DnrManager', 'Rules execution is paused, clearing all active rules');
    clearAllDynamicRules();
    clearAllSessionRules();
    updateScriptableRules([]);
    reportStatus({
      subsystem: 'rules',
      state: 'green',
      message: 'Rule execution paused',
    });
    return Promise.resolve();
  }

  const testTabIds = getActiveTestTabIds();
  const runs = getActiveRunSnapshots();

  // ── Layer 1: dynamic rules (global, not per-tab) ──
  // Compile all enabled rules. Dynamic DNR rules go out globally; session
  // DNR rules will be tagged with excludedTabIds below to keep delay-bypass
  // loop prevention correct.
  const { dynamic: globalDynamic, session: globalSessionUntagged, scriptables } = compileRuleSet(rules, 1);

  // ── Capacity enforcement ───────────────────────────────────────
  //
  // `rulesEngine.maxActiveRules` is the hard cap on the dynamic layer —
  // Chrome's own dynamic-rule ceiling is 30000 (MAX_DYNAMIC), but users
  // hit performance cliffs well before that. Past the cap we log and
  // truncate in match-order: rules at the top of the list win a slot,
  // the overflow gets dropped. Truncation is logged so the user can
  // reason about why a rule that's enabled isn't live.
  const cap = getSetting('rulesEngine.maxActiveRules');
  let dropped = 0;
  let effectiveDynamic = globalDynamic;
  if (globalDynamic.length > cap) {
    dropped = globalDynamic.length - cap;
    effectiveDynamic = globalDynamic.slice(0, cap);
    logger.warn('DnrManager', `Active rule cap (${cap}) exceeded — dropping ${dropped} overflow DNR rules`);
  }

  // ── Large rule-set warning ────────────────────────────────────
  // Reported through the Status API (`rules` subsystem) after both DNR
  // layers commit — see the tail of rebuildAll for the single-point
  // reporting pass.
  let largeRuleSet = false;
  const largeRuleSetThreshold = getSetting('rulesEngine.largeRuleSetThreshold');
  if (getSetting('rulesEngine.warnOnLargeRuleSets') && effectiveDynamic.length >= largeRuleSetThreshold) {
    largeRuleSet = true;
    logger.warn(
      'DnrManager',
      `Active rule count (${effectiveDynamic.length}) >= ${largeRuleSetThreshold} — approaching DNR capacity`,
    );
  }

  const dynamicToApply: DnrRule[] = [];
  for (const { rule, uid } of effectiveDynamic) {
    dynamicDnrIdToUid.set(rule.id, uid);
    const bypass = liveBypassByUid.get(uid);
    if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass);
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

    // Test-run scope snapshots predate the active env/vars and therefore
    // carry raw `{{VAR}}` templates. Resolve against the CURRENT scopes
    // so a test run reflects the live environment — same contract as
    // the outer rule set above, including the unresolvable filter so a
    // test run can't silently apply a rule with literal `{{VAR}}` on
    // the wire either.
    const resolvedScope = resolveRulesForCompile(scopeForCompile);
    const scopeUnresolvable = getUnresolvableRuleUids();
    const effectiveScope =
      scopeUnresolvable.size > 0 ? resolvedScope.filter((r) => !scopeUnresolvable.has(r.uid)) : resolvedScope;
    const { dynamic: runDynamic, session: runSession } = compileRuleSet(effectiveScope, sessionIdCounter);
    // Both the "dynamic" and "session" outputs from a test scope end up
    // in the session layer with tabIds stamped — within a test run,
    // everything is per-tab.
    const all = [...runDynamic, ...runSession];
    for (const { rule, uid } of all) {
      perRunMap.set(rule.id, uid);
      const bypass = liveBypassByUid.get(uid);
      if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass);
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
    const bypass = liveBypassByUid.get(uid);
    if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass);
    if (excludedForGlobal.length > 0) {
      rule.condition = { ...rule.condition, excludedTabIds: excludedForGlobal };
    }
    sessionToApply.push(rule);
  }

  const sessionPromise = applySessionRules(sessionToApply);
  return Promise.all([dynamicPromise, sessionPromise]).then(([dyn, ses]) => {
    // Single reporting point for the `rules` Status subsystem. Layered
    // so the worst condition wins: transport failure > unresolved
    // references > cap breach > large-rule-set warning > healthy.
    if (!dyn.ok || !ses.ok) {
      const layer = !dyn.ok ? 'dynamic' : 'session';
      const error = !dyn.ok ? dyn.error : !ses.ok ? ses.error : 'Unknown error';
      reportStatus({
        subsystem: 'rules',
        state: 'red',
        message: `Failed to apply ${layer} DNR rules: ${error}`,
        context: { layer, error },
      });
      return;
    }
    // Report unresolved {{VAR}} references BEFORE cap/large-set checks.
    // A rule with a literal `{{TOKEN}}` left in its pattern is broken in
    // a way the user can't see from the cap/size numbers — it silently
    // matches nothing on the wire. Reserved namespaces (`{{file.X}}` /
    // `{{dynamic.X}}`) are excluded by getLastAggregatedResolutionErrors
    // because those are intentionally unresolved until v2 ships the
    // corresponding feature.
    const resolutionErrors = getLastAggregatedResolutionErrors();
    if (resolutionErrors.length > 0) {
      const perRuleErrors = getLastResolutionErrors();
      const affectedRuleCount = perRuleErrors.size;
      // Log a single aggregate entry — per-reference entries would
      // spam the ring on every rebuild (hundreds of variable refs in a
      // large rule set). The UI can drill into `getLastResolutionErrors`
      // for per-rule attribution.
      recordLog({
        subsystem: 'rule-engine',
        op: 'resolve',
        level: 'warn',
        message: `${resolutionErrors.length} unresolved variable${resolutionErrors.length === 1 ? '' : 's'} across ${affectedRuleCount} rule${affectedRuleCount === 1 ? '' : 's'}`,
        context: {},
      });
      reportStatus({
        subsystem: 'rules',
        state: 'yellow',
        message: `${resolutionErrors.length} unresolved variable${resolutionErrors.length === 1 ? '' : 's'} in ${affectedRuleCount} rule${affectedRuleCount === 1 ? '' : 's'}`,
        context: {
          unresolvedCount: resolutionErrors.length,
          affectedRuleCount,
          firstReference: resolutionErrors[0]?.reference,
        },
      });
      return;
    }
    if (dropped > 0) {
      reportStatus({
        subsystem: 'rules',
        state: 'yellow',
        message: `Dropped ${dropped} rule${dropped === 1 ? '' : 's'} over cap (${cap})`,
        context: { cap, dropped, active: effectiveDynamic.length },
      });
      return;
    }
    if (largeRuleSet) {
      reportStatus({
        subsystem: 'rules',
        state: 'yellow',
        message: `Approaching DNR capacity (${effectiveDynamic.length} ≥ ${largeRuleSetThreshold})`,
        context: { active: effectiveDynamic.length, threshold: largeRuleSetThreshold },
      });
      return;
    }
    const activeCount = effectiveDynamic.length;
    reportStatus({
      subsystem: 'rules',
      state: 'green',
      message: `${activeCount} active DNR rule${activeCount === 1 ? '' : 's'}`,
      context: { active: activeCount },
    });
  });
}

// ── DNR rule application ─────────────────────────────────────────

type ApplyResult = { ok: true } | { ok: false; error: string };

function applyDynamicRules(newRules: DnrRule[]): Promise<ApplyResult> {
  return declarativeNetRequest!
    .getDynamicRules()
    .then((existingRules) => {
      const removeRuleIds = existingRules.map((r) => r.id);
      return declarativeNetRequest!.updateDynamicRules({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then((): ApplyResult => {
      logger.debug('DnrManager', `Applied ${newRules.length} dynamic DNR rules`);
      return { ok: true };
    })
    .catch((e: Error): ApplyResult => {
      const error = e.message || 'Unknown error';
      logger.error('DnrManager', 'Error updating dynamic rules:', error);
      return { ok: false, error };
    });
}

function applySessionRules(newRules: DnrRule[]): Promise<ApplyResult> {
  const dnr = declarativeNetRequest;
  if (!dnr?.updateSessionRules || !dnr.getSessionRules) {
    if (newRules.length > 0) {
      logger.info('DnrManager', 'updateSessionRules unavailable — session rules will not be applied');
    }
    // Absent API is not a failure — treat as no-op success so the
    // Status pill doesn't show red on Firefox's session-rule-less
    // codepath. Users on browsers without session rules never expect
    // delay-tab scoping to work anyway.
    return Promise.resolve({ ok: true });
  }
  return dnr
    .getSessionRules()
    .then((existing) => {
      // Preserve cache-bypass session rules (installed by the inspector
      // panel's "Disable Cache" toggle) — they have their own lifecycle
      // and shouldn't be nuked by a user-rule rebuild. See
      // `modules/cache-bypass.ts`.
      const removeRuleIds = existing.filter((r) => r.id < CACHE_BYPASS_ID_BASE).map((r) => r.id);
      return dnr.updateSessionRules!({
        removeRuleIds,
        addRules: newRules as chrome.declarativeNetRequest.Rule[],
      });
    })
    .then((): ApplyResult => {
      logger.debug('DnrManager', `Applied ${newRules.length} session DNR rules`);
      return { ok: true };
    })
    .catch((e: Error): ApplyResult => {
      const error = e.message || 'Unknown error';
      logger.error('DnrManager', 'Error updating session rules:', error);
      return { ok: false, error };
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
