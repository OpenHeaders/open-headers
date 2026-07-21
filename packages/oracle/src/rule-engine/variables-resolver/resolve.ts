// ── Scope sync + compile-path resolution ────────────────────────────

import type { Collection, Rule } from '@openheaders/core/types';
import { type ResolutionError, resolveRuleWithDiagnostics, type VariableResolver } from '@openheaders/core/variables';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '@openheaders/oracle/entity/environment-store';
import { getCollections, getRules } from '@openheaders/oracle/entity/rule-store';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { buildLiveRegistry } from './live-registry';
import { activeState, type ResolverState } from './state';

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
  const totpCodes = getOracleHostHooks().getCachedTotpCodes?.();
  if (totpCodes) {
    r.setTotpRegistry(totpCodes);
  }

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
function buildRuleToCollectionContext(collections: readonly Collection[]) {
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

/** One subset resolution pass: resolved rules + the per-rule error map. */
function resolveAgainstCurrentScopes(rules: readonly Rule[]): {
  resolved: Rule[];
  perRuleErrors: Map<string, ResolutionError[]>;
} {
  const state = activeState();
  syncResolverFromStores(state);
  const collectionOf = buildRuleToCollectionContext(getCollections());

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
  return { resolved, perRuleErrors };
}

/**
 * Resolve an arbitrary rule subset and report which uids failed
 * resolution, WITHOUT touching the persisted full-compile snapshot.
 * For consumers that enforce rules outside the DNR compile loop (the
 * daemon's proxy plane) and must skip unresolved-`{{ref}}` rules the
 * same way the compile loop does — a rule the extension would keep off
 * the wire never fires on the proxy either.
 */
export function resolveRuleSubsetWithDiagnostics(rules: readonly Rule[]): {
  resolved: Rule[];
  unresolvableUids: ReadonlySet<string>;
} {
  const { resolved, perRuleErrors } = resolveAgainstCurrentScopes(rules);
  return { resolved, unresolvableUids: new Set(perRuleErrors.keys()) };
}

/**
 * Resolve every {{VAR}} template in a rule set using the current env /
 * vars / vault / collection scopes. Returns a new rule array — inputs
 * are never mutated. Safe to call every rebuild; cheap even for hundreds
 * of rules.
 */
export function resolveRulesForCompile(rules: Rule[]): Rule[] {
  const { resolved, perRuleErrors } = resolveAgainstCurrentScopes(rules);

  // Only persist the snapshot when compiling the FULL active-workspace
  // rule set — a subset compile would overwrite the snapshot with a
  // partial view. A length check against the live store count is a
  // cheap discriminator.
  if (rules.length >= getRules().length) {
    const state = activeState();
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
