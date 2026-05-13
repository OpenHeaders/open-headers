/**
 * DNR Manager — single source of truth for every declarativeNetRequest update.
 *
 * Architecture:
 *
 *   - Each rule type has a `RuleCompiler` in `dnr-builders/` that turns a
 *     Rule into a `CompilationPlan { dynamicRules?, sessionRules? }`.
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
 * rules directly from the rule store and installs its MAIN-world
 * injections per main-frame commit. The two concerns have different
 * lifecycles and stay cleanly decoupled.
 */

import type { Rule } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { declarativeNetRequest } from '@utils/browser-api';
import { report as reportStatus } from '@/shared/status';
import { get as getSetting } from '@/workbench/settings/store';
import type { DnrRule, EngineCompileSettings } from './dnr-builders';
import { attachLiveBypassExclusion } from './dnr-builders';
import { applyDynamicRules, applySessionRules, clearAllDynamicRules, clearAllSessionRules } from './engine/apply';
import { compileRuleSet } from './engine/compile';
import { updateScriptableRules } from './inject-manager';
import { recordLog } from './modules/observability-log';
import { getPauseMarkers } from './modules/pause-markers-store';
import { observeRuleState } from './modules/rule-state-observer';
import { getRules } from './modules/rule-store';
import { getActiveRunSnapshots, getActiveTestTabIds } from './modules/test-runner';
import { refreshCachedTotpCodes } from './modules/totp-scheduler';
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
 * Dynamic-layer rule id → source Rule.uid. Rebuilt on every applyAllRules()
 * call. Used for telemetry lookups (e.g. getActiveRulesForTab).
 */
const dynamicDnrIdToUid: Map<number, string> = new Map();

/**
 * Per-run mapping from DNR session rule id → Rule.uid. Keyed by test
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

export function updateNetworkRules(rules: Rule[]): void {
  void scheduleRebuild(rules);
}

export function applyAllRules(): void {
  void scheduleRebuild(getRules());
}

/**
 * Same as `applyAllRules` but returns a promise that resolves after Chrome
 * commits the DNR rule update. Used by the delay-bypass path so the delay
 * page's follow-up navigation only starts once the rule change is live.
 */
export function applyAllRulesAsync(): Promise<void> {
  return scheduleRebuild(getRules());
}

// ── Rebuild serializer ───────────────────────────────────────────
//
// Single-flight with collapse-to-latest. The full rebuild
// (resolve → compile → updateDynamic + updateSession) is one
// transaction; running two in parallel races on Chrome's DNR id
// space (compilers re-use ids 1, 2, 3, … per call, so the second
// call's `addRules` collides with the first's still-being-applied
// state).
//
// The simpler "Promise.all serializer per Chrome API" misses the
// transaction boundary — dynamic + session belong together. It also
// runs N rebuilds when N requests stack up, but every rebuild fully
// replaces state, so only the LAST input matters. We keep at most
// one in-flight + one pending; intermediate requests collapse into
// the pending slot (always with the latest rule list).
//
// Awaiters of all queued requests resolve when their request's
// rebuild finishes — `applyAllRulesAsync`'s caller (test-runner setup,
// delay-bypass) sees rules live in Chrome before its promise resolves.

let inflight: Promise<void> | null = null;
interface PendingRebuild {
  rules: Rule[];
  resolvers: Array<() => void>;
}
let pending: PendingRebuild | null = null;

function scheduleRebuild(rules: Rule[]): Promise<void> {
  if (!inflight) {
    inflight = runRebuild(rules);
    return inflight;
  }
  // A rebuild is in flight — fold this request into the pending slot.
  // Intentionally overwrite `rules` with the latest snapshot so the
  // collapsed rebuild reflects the most recent intent.
  if (!pending) pending = { rules, resolvers: [] };
  else pending.rules = rules;
  return new Promise<void>((resolve) => {
    pending!.resolvers.push(resolve);
  });
}

function runRebuild(rules: Rule[]): Promise<void> {
  return rebuildAll(rules).finally(() => {
    if (pending) {
      const next = pending;
      pending = null;
      inflight = runRebuild(next.rules).finally(() => {
        for (const r of next.resolvers) r();
      });
    } else {
      inflight = null;
    }
  });
}

// ── Core compile/dispatch loop ───────────────────────────────────

async function rebuildAll(rawRules: Rule[]): Promise<void> {
  dynamicDnrIdToUid.clear();
  runSessionRuleIdToUid.clear();

  // Sync-warm opt-in LVs drive a blocking refresh of their backing
  // workflows BEFORE resolve, so the compile below sees fresh values
  // instead of stale. No-op when no LV is sync-warm opted in; 5s hard
  // ceiling when any is, then resolve falls back to stale. Live-bypass
  // + live-ref scan both read from the post-warm registry mirror.
  await kickSyncWarmRefreshes();

  // Recompute TOTP codes against the current vault BEFORE resolve so
  // every compile bakes the current-window code into DNR. Same slot
  // as `kickSyncWarmRefreshes` above — without it, the compile would
  // race the totp-scheduler's listener-driven refresh and ship stale
  // codes to Chrome's static rule store. No-op when the vault holds
  // zero kind:'totp' entries.
  await refreshCachedTotpCodes();

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

  // Extension origin id for live-bypass exclusion. Chain fetches issued
  // by the SW carry this as their initiator, so adding it to a rule's
  // `excludedInitiatorDomains` keeps a `{{live.X}}`-referencing rule
  // from firing on the very fetch that produces the LV value.
  const extensionId =
    typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.id === 'string'
      ? chrome.runtime.id
      : undefined;

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
    clearAllDynamicRules(declarativeNetRequest);
    clearAllSessionRules(declarativeNetRequest);
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

  // Engine-relevant settings, sourced once per rebuild — the engine
  // package doesn't read `@/workbench/settings/store` directly; the
  // orchestrator threads values through every compile.
  const engineSettings: EngineCompileSettings = {
    liveRulesMode: getSetting('rulesEngine.liveRulesMode'),
  };

  // ── Layer 1: dynamic rules (global, not per-tab) ──
  // Compile all enabled rules. Dynamic DNR rules go out globally; session
  // DNR rules will be tagged with excludedTabIds below to keep delay-bypass
  // loop prevention correct.
  const { dynamic: globalDynamic, session: globalSessionUntagged, scriptables } = compileRuleSet(
    rules,
    getPauseMarkers(),
    1,
    engineSettings,
  );

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
    if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass, { extensionDomain: extensionId });
    dynamicToApply.push(rule);
  }

  const dynamicPromise = applyDynamicRules(declarativeNetRequest, dynamicToApply);
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
    const { dynamic: runDynamic, session: runSession } = compileRuleSet(
      effectiveScope,
      getPauseMarkers(),
      sessionIdCounter,
      engineSettings,
    );
    // Both the "dynamic" and "session" outputs from a test scope end up
    // in the session layer with tabIds stamped — within a test run,
    // everything is per-tab.
    const all = [...runDynamic, ...runSession];
    for (const { rule, uid } of all) {
      perRunMap.set(rule.id, uid);
      const bypass = liveBypassByUid.get(uid);
      if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass, { extensionDomain: extensionId });
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
    if (bypass) rule.condition = attachLiveBypassExclusion(rule.condition, bypass, { extensionDomain: extensionId });
    if (excludedForGlobal.length > 0) {
      rule.condition = { ...rule.condition, excludedTabIds: excludedForGlobal };
    }
    sessionToApply.push(rule);
  }

  const sessionPromise = applySessionRules(declarativeNetRequest, sessionToApply);
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

