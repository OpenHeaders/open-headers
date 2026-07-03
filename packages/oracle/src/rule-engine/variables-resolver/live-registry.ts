// ── Live-cache sync mirror + LiveRegistry construction ──────────────
//
// The resolver's `live` scope needs a sync snapshot of
// `WorkflowRunCache[]` at compile time, but the authoritative store
// reads through `chrome.storage.local` (async). Each workspace owns
// its own mirror in `ResolverState.cachedLiveRuns`; the
// `onLiveCacheStoreChange` listener routes events to the matching
// workspace's state so non-Active workspaces stay warm in tandem.
//
// The mirror is deliberately best-effort: an uninitialized mirror
// resolves `{{live.X}}` as unset, which surfaces a structured error
// via the existing `unset-in-scope` path (the same behavior a missing
// LV would produce). `hydrateLiveCacheMirror` is called once at SW
// wake from `background.ts` to prime the runtime-Active workspace's
// mirror before the first DNR compile.

import { isLiveVariableEffective, isWorkflowEffective, workflowStepsResolvable } from '@openheaders/core/live';
import type { LiveVariable, LiveWorkflow } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { EMPTY_LIVE_REGISTRY, type LiveRegistry, type ResolvedLiveValue } from '@openheaders/core/variables';
import { getActiveEnvironmentId } from '@openheaders/oracle/entity/environment-store';
import { getRequestUidsForWorkspace } from '@openheaders/oracle/entity/request-store';
import {
  listWorkflowRunCaches,
  onLiveCacheStoreChange,
  type WorkflowRunCache,
} from '@openheaders/oracle/live/live-cache-store';
import { getLiveVariables, getLiveVariablesForWorkspace } from '@openheaders/oracle/live/live-variable-store';
import { getLiveWorkflows, getLiveWorkflowsForWorkspace } from '@openheaders/oracle/live/live-workflow-store';
import { activeState, getOrCreateState, type ResolverState } from './state';

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
 * Per-workspace `LiveRegistry` snapshot — used by the live-refresh
 * chain executor when refreshing a workflow whose owning workspace is
 * NOT runtime-Active (MWPT-FULL session #19). Routes through the
 * per-workspace `ResolverState.cachedLiveRuns` mirror (already kept
 * warm by the workspace-routed `onLiveCacheStoreChange` listener) and
 * the per-workspace LV cache, so the chain step's `{{live.X}}`
 * references resolve against the SAME captures the renderer mirror
 * would see for that workspace — never the Active workspace's.
 *
 * The `activeEnvironmentId` argument is passed in explicitly because
 * the chain dispatch is keyed on a specific `(workspaceId, envId)`
 * pair (each env owns a distinct cache row). For a chain refresh
 * scheduled under env "staging", the registry consults the staging
 * row; the Active env pointer for that workspace is irrelevant to
 * this dispatch.
 */
export function getLiveRegistrySnapshotForWorkspace(
  workspaceId: string,
  activeEnvironmentId: string | null,
): LiveRegistry {
  const state = getOrCreateState(workspaceId);
  return buildLiveRegistryFor(
    state,
    getLiveVariablesForWorkspace(workspaceId),
    getLiveWorkflowsForWorkspace(workspaceId),
    activeEnvironmentId,
    getRequestUidsForWorkspace(workspaceId),
  );
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
export function buildLiveRegistry(state: ResolverState): LiveRegistry {
  return buildLiveRegistryFor(
    state,
    getLiveVariables(),
    getLiveWorkflows(),
    getActiveEnvironmentId(),
    getRequestUidsForWorkspace(state.workspaceId),
  );
}

/**
 * Parameterized variant of {@link buildLiveRegistry}. Used by
 * {@link getLiveRegistrySnapshotForWorkspace} so non-Active workspace
 * dispatches consult per-workspace LVs + workflows + an explicit env,
 * not the Active-bound module-level reads.
 *
 * `knownRequestUids` is the set of request uids in the workspace, or
 * `null` when the request registry has not materialized yet. `null`
 * skips the deleted-request gate so a cold registry never blanks every
 * live value out of the rule feed.
 */
function buildLiveRegistryFor(
  state: ResolverState,
  liveVariables: readonly LiveVariable[],
  liveWorkflows: readonly LiveWorkflow[],
  activeEnv: string | null,
  knownRequestUids: ReadonlySet<string> | null,
): LiveRegistry {
  // Effective LVs only (published + enabled). Mirrors the renderer-side
  // `useVariableResolver` + `VariablesPanel.liveRegistry` filters so the
  // SW compile path agrees with what the user sees in the editor.
  const lvs = liveVariables.filter((v) => isLiveVariableEffective(v));
  if (lvs.length === 0) return EMPTY_LIVE_REGISTRY;

  // A cached capture must stop feeding rules once its backing workflow
  // is no longer effective (disabled, unpublished, or made incomplete)
  // OR once one of its steps references a request that was deleted —
  // such a workflow can never re-run that step, so its cached value is
  // frozen-stale and must not keep feeding env-gated traffic. The cache
  // row is intentionally KEPT — fixing the step (or re-enabling the
  // workflow) restores the last cached value without forcing a re-run.
  // Mirrors how a disabled LV is skipped rather than purged.
  const effectiveWorkflowUids = new Set<string>();
  for (const wf of liveWorkflows) {
    if (!isWorkflowEffective(wf)) continue;
    if (knownRequestUids !== null && !workflowStepsResolvable(wf, knownRequestUids)) continue;
    effectiveWorkflowUids.add(wf.uid);
  }

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

    // Skip the cached-capture path for a non-effective workflow. The
    // manual-override branch above is deliberately NOT gated — an
    // override is a user-set value independent of workflow execution.
    if (!effectiveWorkflowUids.has(lv.workflowUid)) continue;

    const run = runByWorkflow.get(lv.workflowUid);
    const value = run?.stepCaptures?.[lv.stepId]?.[lv.captureName];
    if (value === undefined) continue;
    const stale = run?.expiresAt != null && run.expiresAt < now;
    // `definitionallyStale` is orthogonal to `stale`: the former flags a
    // wrong-recipe value (a material edit landed on a manual workflow);
    // the latter flags an expired-but-fine one.
    registry.set(lv.name, {
      value,
      workflowUid: lv.workflowUid,
      ...(stale ? { stale: true } : {}),
      ...(run?.definitionallyStale === true ? { definitionallyStale: true } : {}),
    });
  }
  return registry;
}
