/**
 * Variables Resolver — the single {{VAR}} resolver wired into the DNR
 * compile pipeline.
 *
 * Holds a long-lived `VariableResolver` from @openheaders/core/variables.
 * Source of truth for each scope:
 *   - vault, environments, active env, workspace vars → environment-store
 *   - collection-scoped variables                     → rule-store (each
 *     `V5.Collection.variables`)
 *
 * Sync strategy: re-populate scopes on every call to
 * `resolveRulesForCompile`. The resolver is cheap (arrays of variables,
 * no I/O), so we don't attempt to diff. Callers run this on every DNR
 * rebuild and every time env/vars change, so freshness follows the same
 * cadence as `rule-engine.scheduleUpdate`.
 *
 * Context: the 4-scope priority is
 *   vault > environment > collection > workspace
 * `ResolutionContext.collectionId` for each rule is derived from its
 * `path` — the collection whose path is a prefix of the rule's path
 * owns it. Rules not under any collection (defensive — every rule
 * should have one) resolve without a collection scope.
 */

import { isLiveVariableEffective, scanTemplateReferencesMany } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';
import {
  collectRuleTemplateStrings,
  EMPTY_LIVE_REGISTRY,
  type LiveRegistry,
  type ResolutionError,
  type ResolvedLiveValue,
  resolveRuleWithDiagnostics,
  VariableResolver,
} from '@openheaders/core/variables';
import { logger } from '@utils/logger';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from './environment-store';
import { listWorkflowRunCaches, onLiveCacheStoreChange, type WorkflowRunCache } from './live-cache-store';
import { getLiveVariables } from './live-variable-store';
import { recordLog } from './observability-log';
import { getCollections, getRules } from './rule-store';
import { getCachedTotpCodes } from './totp-scheduler';
import { peekActiveWorkspaceId } from './workspace-store';

// ── Per-workspace resolver state ───────────────────────────────────
//
// Each resident workspace gets its own `ResolverState` — its own
// `VariableResolver` (env/vars/vault scopes are workspace-scoped), its
// own last-resolved memo, its own live-cache mirror, and its own
// collection-uid bookkeeping. The state map is lazily populated and
// cleared on `disposeResolverStateForWorkspace` (called from the SW
// service's `finalizeDisposal` so a torn-down workspace's resolver
// state goes with it). MWPT-FULL F-16 lint backstop: no module-level
// resolver state remains; per-workspace warmup misses no resident
// workspace because each workspace owns its own slot.
//
// Sentinel key for the "no active workspace" path — used by tests that
// exercise the resolver without bootstrapping `workspace-store`, and
// by SW-internal callers that race ahead of the bootstrap broadcast.
// Production lookups that resolve through `peekActiveWorkspaceId()`
// only see this sentinel during the cold-wake window before the first
// active broadcast lands.

interface ResolverState {
  workspaceId: string;
  resolver: VariableResolver;
  /**
   * Cached snapshot of the most recently resolved rule set for THIS
   * workspace. Downstream consumers (request-tracker pattern match,
   * badge verdicts, Inspector panel telemetry) need to see the SAME
   * resolved strings the DNR layer saw — otherwise a rule with
   * `{{API_HOST}}` in its domain condition would fire in DNR but the
   * tracker would match the raw token and fail to attribute the
   * request.
   *
   * Populated on every `resolveRulesForCompile` call. Empty before the
   * first compile.
   */
  lastResolvedRules: V5.Rule[];
  /**
   * Per-rule resolution errors collected during the most recent
   * `resolveRulesForCompile` for THIS workspace. Keyed by rule uid so
   * callers can line up errors against specific rules without
   * re-walking the set. Errors for a rule with no unresolved
   * references are not stored — `has` → false.
   *
   * Cleared (reset to an empty map) at the start of every resolve pass
   * so the snapshot always matches `lastResolvedRules`.
   */
  lastResolutionErrors: Map<string, ResolutionError[]>;
  /**
   * Warm mirror of THIS workspace's live cache rows. Populated by the
   * `onLiveCacheStoreChange` listener (filtered to events tagged with
   * this workspaceId) so `buildLiveRegistry` stays synchronous.
   */
  cachedLiveRuns: WorkflowRunCache[];
  /**
   * Sentinel set used by `syncResolverFromStores` to detect collections
   * that were dropped between sync passes — the resolver's internal
   * collection-variable map needs explicit removes for collections that
   * no longer exist.
   */
  lastKnownCollectionUids: Set<string>;
}

const NO_WORKSPACE_KEY = '__no-workspace__';

const states = new Map<string, ResolverState>();

function createState(workspaceId: string): ResolverState {
  return {
    workspaceId,
    resolver: new VariableResolver(),
    lastResolvedRules: [],
    lastResolutionErrors: new Map(),
    cachedLiveRuns: [],
    lastKnownCollectionUids: new Set(),
  };
}

function getOrCreateState(workspaceId: string): ResolverState {
  let state = states.get(workspaceId);
  if (!state) {
    state = createState(workspaceId);
    states.set(workspaceId, state);
  }
  return state;
}

function activeKey(): string {
  return peekActiveWorkspaceId() ?? NO_WORKSPACE_KEY;
}

/**
 * Lookup the runtime-Active workspace's resolver state, lazily
 * materializing it on first reach. Public reads (e.g.
 * {@link getResolvedRules}) route through here so the state map stays
 * the single source of truth.
 */
function activeState(): ResolverState {
  return getOrCreateState(activeKey());
}

/**
 * Drop a workspace's resolver state. Called from the SW service's
 * `finalizeDisposal` so a torn-down workspace's resolver memo + live-
 * cache mirror don't outlive their owning service. Idempotent.
 */
export function disposeResolverStateForWorkspace(workspaceId: string): void {
  states.delete(workspaceId);
}

/**
 * Current resolved-rule snapshot for the runtime-Active workspace.
 * Returns an empty array until the first DNR compile runs.
 */
export function getResolvedRules(): V5.Rule[] {
  return activeState().lastResolvedRules;
}

/**
 * Per-rule resolution errors from the most recent compile pass.
 * `.get(ruleUid)` returns the error list for that rule, or `undefined`
 * if the rule resolved cleanly (or hasn't been compiled yet).
 *
 * Both the outer Map and each inner list are typed readonly so callers
 * can't mutate module state through the returned reference — the same
 * snapshot is read by Status reporting, Inspector surfaces, and tests.
 */
export function getLastResolutionErrors(): ReadonlyMap<string, readonly ResolutionError[]> {
  return activeState().lastResolutionErrors;
}

/**
 * Flat list of every resolution error aggregated across the rule set,
 * deduped by `reference`. Useful for subsystem-level reporting
 * (observability + Status) where per-rule attribution isn't required.
 * Reserved-namespace errors (`{{file.X}}` / `{{dynamic.X}}`) are
 * filtered out — those references are intentionally unresolved until
 * those features ship in v2, so they should not yellow-pill the
 * `rules` subsystem.
 */
export function getLastAggregatedResolutionErrors(): ResolutionError[] {
  const seen = new Set<string>();
  const out: ResolutionError[] = [];
  for (const errors of activeState().lastResolutionErrors.values()) {
    for (const err of errors) {
      if (err.reason === 'reserved-namespace') continue;
      if (seen.has(err.reference)) continue;
      seen.add(err.reference);
      out.push(err);
    }
  }
  return out;
}

/**
 * Set of rule uids whose most recent resolution pass produced at
 * least one BLOCKING error (anything except `reserved-namespace`).
 * These rules are not shipped to DNR — a rule with `{{wat2}}` that
 * doesn't exist in any scope would otherwise set a header to the
 * literal string `{{wat2}}` on the wire, which is almost never the
 * user's intent. Re-exposed for the rule-state observer + sidebar so
 * the UI can surface the "unresolved" state distinct from draft.
 *
 * Returns an empty set until the first `resolveRulesForCompile` run.
 */
export function getUnresolvableRuleUids(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [uid, errors] of activeState().lastResolutionErrors) {
    const hasBlocker = errors.some((e) => e.reason !== 'reserved-namespace');
    if (hasBlocker) out.add(uid);
  }
  return out;
}

// ── Live-cache sync mirror ─────────────────────────────────────────
//
// The resolver's `live` scope needs a sync snapshot of
// `WorkflowRunCache[]` at compile time, but the authoritative store
// reads through `chrome.storage.local` (async). Each workspace owns
// its own mirror in {@link ResolverState.cachedLiveRuns}; the
// `onLiveCacheStoreChange` listener routes events to the matching
// workspace's state so non-Active workspaces stay warm in tandem.
//
// The mirror is deliberately best-effort: an uninitialized mirror
// resolves `{{live.X}}` as unset, which surfaces a structured error
// via the existing `unset-in-scope` path (the same behavior a missing
// LV would produce). `hydrateLiveCacheMirror` is called once at SW
// wake from `background.ts` to prime the runtime-Active workspace's
// mirror before the first DNR compile.

export async function hydrateLiveCacheMirror(): Promise<void> {
  try {
    const runs = await listWorkflowRunCaches();
    activeState().cachedLiveRuns = runs;
  } catch (err) {
    logger.info('VariablesResolver', `Initial live-cache mirror hydrate failed: ${(err as Error).message}`);
    activeState().cachedLiveRuns = [];
  }
}

// Keep each resident workspace's mirror warm. The store's notify
// carries the post-write run list so the mirror update is synchronous
// — landing before any other listener on the same event can read the
// state. Per-workspace routing means a non-Active workspace's runner
// (post-1f) sees its own fresh captures rather than waiting for an
// Active flip.
onLiveCacheStoreChange((workspaceId, _workflowUid, runs) => {
  getOrCreateState(workspaceId).cachedLiveRuns = [...runs];
});

/**
 * Sync accessor — returns the current `LiveRegistry` snapshot for
 * callers (request executor) that build their own resolver but want
 * the same `live` scope the DNR compile pipeline sees. Rebuilds from
 * the mirror on every call to stay cheap + honest about staleness.
 */
export function getLiveRegistrySnapshot(): LiveRegistry {
  return buildLiveRegistry(activeState());
}

/**
 * Collect the set of workflow uids this rule "touches" — i.e., every
 * workflow whose LV bindings appear in any of the rule's templatable
 * strings. Driven from the RAW rule (pre-resolve) because the template
 * literals are what carry `{{live.X}}`; after resolution they've been
 * substituted with values. Called from the DNR compile pipeline so
 * each emitted DnrRule can carry an `excludedRequestHeaders` clause
 * that blocks the rule from firing on its own chain's step requests.
 *
 * Returns an empty set when the rule touches no live variables, or
 * when no matching LV is enabled — disabled bindings don't contribute
 * to the feedback-loop risk (their workflows won't produce values a
 * disabled LV's rule consumes).
 */
export function computeRuleLiveBypass(rule: V5.Rule): ReadonlySet<string> {
  const strings = collectRuleTemplateStrings(rule);
  if (strings.length === 0) return EMPTY_STRING_SET;
  const { live } = scanTemplateReferencesMany(strings);
  if (live.length === 0) return EMPTY_STRING_SET;
  const lvByName = new Map<string, V5.LiveVariable>();
  for (const lv of getLiveVariables()) {
    if (isLiveVariableEffective(lv)) lvByName.set(lv.name, lv);
  }
  const out = new Set<string>();
  for (const name of live) {
    const lv = lvByName.get(name);
    if (lv) out.add(lv.workflowUid);
  }
  return out.size === 0 ? EMPTY_STRING_SET : out;
}

const EMPTY_STRING_SET: ReadonlySet<string> = new Set();

// ── Sync-warm refresh hook ─────────────────────────────────────────
//
// Per plan §E / locked decision #6: most LVs are async-warm (rule
// compile uses cached value even if stale and enqueues a refresh in
// the background). An LV with `requireFreshOnRuleBuild: true` opts
// into sync-warm — the DNR compile path blocks on a refresh of the
// backing workflow before it resolves templates, falling back to the
// stale value if the refresh takes longer than `SYNC_WARM_TIMEOUT_MS`.
//
// Opt-in is per-LV because most workflows absorb a stale value fine
// (the scheduler catches up within one cadence tick), but a rule that
// must carry a just-rotated staging token on every fire can't; the
// yellow-pill risk of stale DNR is worse than the second of compile
// latency.
//
// Timeout chosen to match the plan's 5-second budget (§E edge-case
// table). On hit, a `warn` observability entry lets triage see "we
// blocked for the full 5 seconds and served stale" after the fact.

export const SYNC_WARM_TIMEOUT_MS = 5_000;

interface SyncWarmTarget {
  workflowUid: string;
  environmentId: string | null;
}

/**
 * Drive a single workflow refresh to completion for the sync-warm
 * path. Injected by `live-refresh-scheduler` at SW boot; `null` when
 * no scheduler is attached (unit tests that exercise pieces of this
 * module without the scheduler chain stay self-contained).
 */
export type SyncWarmRunner = (workspaceId: string, workflowUid: string, environmentId: string | null) => Promise<void>;

let syncWarmRunner: SyncWarmRunner | null = null;

/**
 * Register the live scheduler's synchronous refresh entry point.
 * Called once from the scheduler module at SW boot so this module
 * doesn't need a direct import chain to `live-refresh-scheduler` —
 * keeping the dependency one-way (scheduler → resolver) and the
 * DNR compile path's imports lightweight for tests.
 */
export function __setSyncWarmRunner(runner: SyncWarmRunner | null): void {
  syncWarmRunner = runner;
}

/**
 * Pick the workflows that need sync-warm refresh RIGHT NOW — enabled
 * LVs with `requireFreshOnRuleBuild: true` whose cache row for the
 * active env is absent OR past its `expiresAt`. Returns unique
 * workflow targets so two LVs pointing at the same workflow drive
 * one refresh, not two.
 */
function collectSyncWarmTargets(state: ResolverState, activeEnv: string | null, now: number): SyncWarmTarget[] {
  const lvs = getLiveVariables().filter((v) => isLiveVariableEffective(v) && v.requireFreshOnRuleBuild === true);
  if (lvs.length === 0) return [];

  const runByWorkflow = new Map<string, WorkflowRunCache>();
  for (const run of state.cachedLiveRuns) {
    if (run.environmentId === activeEnv) runByWorkflow.set(run.workflowUid, run);
  }

  const targets = new Map<string, SyncWarmTarget>();
  for (const lv of lvs) {
    if (lv.manualOverride) {
      const expired = lv.manualOverride.until != null && lv.manualOverride.until <= now;
      if (!expired) continue; // override serves a fixed value — no warm needed
    }
    const run = runByWorkflow.get(lv.workflowUid);
    const stale = !run || (run.expiresAt != null && run.expiresAt <= now) || run.extractedAt === 0;
    if (!stale) continue;
    targets.set(lv.workflowUid, { workflowUid: lv.workflowUid, environmentId: activeEnv });
  }
  return [...targets.values()];
}

/**
 * Block up to `SYNC_WARM_TIMEOUT_MS` while every `requireFreshOnRuleBuild`
 * LV's backing workflow refreshes. After the timeout the resolver
 * proceeds with whatever's in the cache — the `stale` flag on the
 * registry entry still signals to Status / observability that the
 * value is behind.
 *
 * No-op (returns immediately) when no LV is sync-warm opted in — the
 * common case. The rule engine's `rebuildAll` awaits this
 * unconditionally because the common-case cost is a single-digit-ms
 * store read + map walk.
 */
export async function kickSyncWarmRefreshes(): Promise<void> {
  if (!syncWarmRunner) return; // scheduler not attached — SW boot order or test environment
  const workspaceId = peekActiveWorkspaceId();
  if (!workspaceId) return; // no Active workspace; nothing to warm against
  const state = getOrCreateState(workspaceId);
  const targets = collectSyncWarmTargets(state, getActiveEnvironmentId(), Date.now());
  if (targets.length === 0) return;

  const runner = syncWarmRunner;
  const deadline = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), SYNC_WARM_TIMEOUT_MS));

  const refreshes = targets.map(async (t) => {
    try {
      await runner(workspaceId, t.workflowUid, t.environmentId);
    } catch (err) {
      // Adapter swallows cache-write errors via `recordRefreshError`;
      // anything that bubbles here is unexpected. Log but don't
      // throw — the rebuild path must make forward progress.
      logger.info('VariablesResolver', `sync-warm refresh for ${t.workflowUid} threw: ${(err as Error).message}`);
    }
  });

  const outcome = await Promise.race([Promise.all(refreshes).then(() => 'done' as const), deadline]);
  if (outcome === 'timeout') {
    recordLog({
      subsystem: 'live',
      op: 'sync-warm-timeout',
      level: 'warn',
      message: `Sync-warm refresh exceeded ${SYNC_WARM_TIMEOUT_MS}ms; serving stale for ${targets.length} workflow(s)`,
      context: { workspaceId },
    });
  }
}

/**
 * Build the `LiveRegistry` passed to the resolver for a single compile.
 *
 * Semantics:
 *   - Only ENABLED Live Variables participate. Disabled bindings never
 *     populate the registry — the resolver then emits `unset-in-scope`
 *     the same way a deleted LV would.
 *   - Manual overrides win over cached captures. When `manualOverride
 *     .value` is set AND `until` is in the future (or unset), the
 *     override is served verbatim — the underlying workflow keeps
 *     refreshing so the user can toggle the override off without
 *     losing freshness.
 *   - Cached captures are scoped to the ACTIVE environment's cache row
 *     (keyed by `(workflowUid, environmentId)`). Env switches expose
 *     a distinct cache per env; unmatched envs resolve as unset until
 *     the next refresh populates them.
 *   - Stale flag is advisory: v1 serves stale values verbatim (async-
 *     warm default per the plan). Phase F's UI reads the flag to badge
 *     the LV in the picker/inspector; Phase G's Status pill uses it
 *     for the `live` subsystem yellow-threshold.
 */
function buildLiveRegistry(state: ResolverState): LiveRegistry {
  // Effective LVs only (published + enabled). Mirrors the renderer-side
  // `useVariableResolver` + `VariablesPanel.liveRegistry` filters so the
  // SW compile path agrees with what the user sees in the editor.
  const lvs = getLiveVariables().filter((v) => isLiveVariableEffective(v));
  if (lvs.length === 0) return EMPTY_LIVE_REGISTRY;

  const activeEnv = getActiveEnvironmentId();
  const now = Date.now();

  // Index cache runs by workflowUid for the active env — at most one
  // row per workflow for the env. Skipping runs keyed to other envs
  // is critical: otherwise env-switching would cross-contaminate.
  const runByWorkflow = new Map<string, WorkflowRunCache>();
  for (const run of state.cachedLiveRuns) {
    if (run.environmentId === activeEnv) runByWorkflow.set(run.workflowUid, run);
  }

  const registry = new Map<string, ResolvedLiveValue>();
  for (const lv of lvs) {
    // Manual override path — bypasses the cache entirely but still
    // reports against the backing workflow for UI navigation.
    const override = lv.manualOverride;
    if (override && override.value != null) {
      const expired = override.until != null && override.until <= now;
      if (!expired) {
        registry.set(lv.name, { value: override.value, workflowUid: lv.workflowUid });
        continue;
      }
    }

    const run = runByWorkflow.get(lv.workflowUid);
    const value = run?.stepCaptures?.[lv.stepId]?.[lv.captureName];
    if (value === undefined) continue;
    const stale = run?.expiresAt != null && run.expiresAt < now;
    registry.set(lv.name, {
      value,
      workflowUid: lv.workflowUid,
      ...(stale ? { stale: true } : {}),
    });
  }
  return registry;
}

/**
 * Push the current state of every scope into the resolver. Called right
 * before each compile so callers never see a stale resolver after an env
 * switch or variable edit. Idempotent — re-running is a no-op if nothing
 * changed, and cheap if it did.
 */
function syncResolverFromStores(state: ResolverState): void {
  const r = state.resolver;
  r.setVault(getVault());
  r.setEnvironments(getEnvironments());
  r.setActiveEnvironmentId(getActiveEnvironmentId());
  r.setDefaultEnvironmentId(getDefaultEnvironmentId());
  r.setWorkspaceVariables(getWorkspaceVariables());
  // Live scope — see `buildLiveRegistry` for the resolution order
  // (manual override > cached capture; skips disabled LVs + envs that
  // don't match the current active env's cache row).
  r.setLiveRegistry(buildLiveRegistry(state));
  // TOTP scope — `totp-scheduler` keeps a mirror of currently-valid
  // codes warm by ticking on each window-flip and refreshing on vault
  // edits. Reading the mirror is sync; the actual crypto runs on the
  // scheduler's tick so the compile path stays fast.
  r.setTotpRegistry(getCachedTotpCodes());

  // Collection scope: reset then re-populate from rule-store. Using
  // set/remove on a Map inside VariableResolver means we don't need to
  // know which collections were dropped; we just overwrite each live
  // collection's entry and drop any that no longer exist by uid.
  const collections = getCollections();
  const liveUids = new Set<string>(collections.map((c) => c.uid));
  for (const c of collections) {
    r.setCollectionVariables(c.uid, c.variables ?? []);
  }
  // Drop stale entries (collections that were deleted between syncs).
  // VariableResolver exposes `removeCollectionVariables`; the per-state
  // `lastKnownCollectionUids` tracks what we've seen so we can issue
  // explicit removes for vanished collections.
  for (const uid of state.lastKnownCollectionUids) {
    if (!liveUids.has(uid)) r.removeCollectionVariables(uid);
  }
  state.lastKnownCollectionUids = liveUids;
}

// ── Rule → collection uid mapping ───────────────────────────────────

/**
 * Build a fast rule-path → collection-uid lookup from the current
 * collection list. We build it per-compile (small N, trivially cheap)
 * instead of memoizing — collections can be renamed / reordered between
 * compiles and cache invalidation for a Map keyed by ephemeral paths
 * isn't worth the complexity.
 */
function buildRuleToCollectionContext(collections: readonly V5.Collection[]) {
  const prefixPairs: Array<{ prefix: string; uid: string }> = collections
    .map((c) => ({ prefix: `${c.path}/`, uid: c.uid }))
    // Longer prefixes first so nested collections (v2) win over ancestors.
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return (rulePath: string): string | undefined => {
    for (const { prefix, uid } of prefixPairs) {
      if (rulePath.startsWith(prefix)) return uid;
    }
    return undefined;
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Resolve every {{VAR}} template in a rule set using the current env /
 * vars / vault / collection scopes. Returns a new rule array — inputs
 * are never mutated. Safe to call every rebuild; cheap even for hundreds
 * of rules.
 */
export function resolveRulesForCompile(rules: V5.Rule[]): V5.Rule[] {
  const state = activeState();
  syncResolverFromStores(state);
  const collections = getCollections();
  const collectionOf = buildRuleToCollectionContext(collections);

  const perRuleErrors: Map<string, ResolutionError[]> = new Map();
  const resolved = rules.map((rule) => {
    const collectionId = collectionOf(rule.path);
    const { rule: resolvedRule, errors } = resolveRuleWithDiagnostics(
      rule,
      state.resolver,
      collectionId ? { collectionId } : undefined,
    );
    if (errors.length > 0) perRuleErrors.set(rule.uid, errors);
    return resolvedRule;
  });

  // Only persist the snapshot when compiling the FULL active-workspace
  // rule set — not when compiling a test-run scope subset (which would
  // overwrite the snapshot with a partial view). Test runs always pass
  // a strict subset of the store's rule list, so a length check against
  // the live store count is a cheap discriminator.
  if (rules.length >= getRules().length) {
    state.lastResolvedRules = resolved;
    state.lastResolutionErrors = perRuleErrors;
  }
  return resolved;
}

/**
 * Exposed for tests + future UI surfaces (Inspector "Variables in this
 * request" view). Returns the runtime-Active workspace's resolver;
 * callers MUST call {@link syncResolver} first if they want a current
 * snapshot.
 */
export function getResolver(): VariableResolver {
  return activeState().resolver;
}

/**
 * Ensure the runtime-Active workspace's resolver is up to date before a
 * direct {@link getResolver} consumer reads from it. Kept separate from
 * {@link resolveRulesForCompile} so UI code can call it without
 * triggering a rule map rebuild.
 */
export function syncResolver(): void {
  syncResolverFromStores(activeState());
}

// ── Test helpers ────────────────────────────────────────────────────

/** Test-only: drop every workspace's resolver state so each test starts
 *  from a clean slate. The sync-warm runner registration is also
 *  cleared so a stale scheduler hook from a prior test can't leak. */
export function __resetForTests(): void {
  states.clear();
  syncWarmRunner = null;
}
