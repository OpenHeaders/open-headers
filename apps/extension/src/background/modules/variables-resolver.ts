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

import type { V5 } from '@openheaders/core/types';
import { resolveRule, VariableResolver } from '@openheaders/core/variables';
import { getActiveEnvironmentId, getEnvironments, getVault, getWorkspaceVariables } from './environment-store';
import { getCollections, getRules } from './rule-store';

// ── Singleton resolver + last resolved snapshot ────────────────────

const resolver = new VariableResolver();

/**
 * Cached snapshot of the most recently resolved rule set. Downstream
 * consumers (request-tracker pattern match, badge verdicts, Inspector
 * panel telemetry) need to see the SAME resolved strings the DNR layer
 * saw — otherwise a rule with `{{API_HOST}}` in its domain condition
 * would fire in DNR but the tracker would match the raw token and fail
 * to attribute the request.
 *
 * Populated on every `resolveRulesForCompile` call. Empty before the
 * first compile — fallback callers should tolerate that and drop back
 * to `getRules()` from rule-store (raw view).
 */
let lastResolvedRules: V5.Rule[] = [];

/**
 * Current resolved-rule snapshot. Returns an empty array until the
 * first DNR compile runs.
 */
export function getResolvedRules(): V5.Rule[] {
  return lastResolvedRules;
}

/**
 * Push the current state of every scope into the resolver. Called right
 * before each compile so callers never see a stale resolver after an env
 * switch or variable edit. Idempotent — re-running is a no-op if nothing
 * changed, and cheap if it did.
 */
function syncResolverFromStores(): void {
  resolver.setVault(getVault());
  resolver.setEnvironments(getEnvironments());
  resolver.setActiveEnvironmentId(getActiveEnvironmentId());
  resolver.setWorkspaceVariables(getWorkspaceVariables());

  // Collection scope: reset then re-populate from rule-store. Using
  // set/remove on a Map inside VariableResolver means we don't need to
  // know which collections were dropped; we just overwrite each live
  // collection's entry and drop any that no longer exist by uid.
  const collections = getCollections();
  const liveUids = new Set<string>(collections.map((c) => c.uid));
  for (const c of collections) {
    resolver.setCollectionVariables(c.uid, c.variables ?? []);
  }
  // Drop stale entries (collections that were deleted between syncs).
  // VariableResolver exposes `removeCollectionVariables`; we can iterate
  // by tracking what we've seen via a sentinel registry on the module.
  for (const uid of lastKnownCollectionUids) {
    if (!liveUids.has(uid)) resolver.removeCollectionVariables(uid);
  }
  lastKnownCollectionUids = liveUids;
}

let lastKnownCollectionUids: Set<string> = new Set();

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
  syncResolverFromStores();
  const collections = getCollections();
  const collectionOf = buildRuleToCollectionContext(collections);

  const resolved = rules.map((rule) => {
    const collectionId = collectionOf(rule.path);
    return resolveRule(rule, resolver, collectionId ? { collectionId } : undefined);
  });

  // Only persist the snapshot when compiling the FULL active-workspace
  // rule set — not when compiling a test-run scope subset (which would
  // overwrite the snapshot with a partial view). Test runs always pass
  // a strict subset of the store's rule list, so a length check against
  // the live store count is a cheap discriminator.
  if (rules.length >= getRules().length) {
    lastResolvedRules = resolved;
  }
  return resolved;
}

/**
 * Exposed for tests + future UI surfaces (Inspector "Variables in this
 * request" view). Returns the shared singleton; callers MUST call
 * `syncResolverFromStores` first if they want a current snapshot.
 */
export function getResolver(): VariableResolver {
  return resolver;
}

/**
 * Ensure the resolver is up to date before a direct `getResolver()`
 * consumer reads from it. Kept separate from `resolveRulesForCompile`
 * so UI code can call it without triggering a rule map rebuild.
 */
export function syncResolver(): void {
  syncResolverFromStores();
}

// ── Test helpers ────────────────────────────────────────────────────

/** Test-only: reset the module so each test starts from a clean slate. */
export function __resetForTests(): void {
  lastKnownCollectionUids = new Set();
  lastResolvedRules = [];
  resolver.setVault({ secrets: [] });
  resolver.setEnvironments([]);
  resolver.setActiveEnvironmentId(null);
  resolver.setWorkspaceVariables({ variables: [] });
}
