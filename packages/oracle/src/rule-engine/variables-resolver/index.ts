/**
 * Variables Resolver — the single {{VAR}} resolver wired into the DNR
 * compile pipeline.
 *
 * Holds a long-lived `VariableResolver` from @openheaders/core/variables.
 * Source of truth for each scope:
 *   - vault, environments, active env, workspace vars → environment-store
 *   - collection-scoped variables                     → rule-store (each
 *     `Collection.variables`)
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

export { computeRuleLiveBypass } from './live-bypass';
export {
  getLiveRegistrySnapshot,
  getLiveRegistrySnapshotForWorkspace,
  hydrateLiveCacheMirror,
} from './live-registry';
export {
  getLastAggregatedResolutionErrors,
  getLastResolutionErrors,
  getResolvedRules,
  getUnresolvableRuleUids,
} from './reads';
export { getResolver, resolveRulesForCompile, syncResolver } from './resolve';
export { disposeResolverStateForWorkspace } from './state';
export { __setSyncWarmRunner, kickSyncWarmRefreshes, SYNC_WARM_TIMEOUT_MS, type SyncWarmRunner } from './sync-warm';
export { __resetForTests } from './testing';
