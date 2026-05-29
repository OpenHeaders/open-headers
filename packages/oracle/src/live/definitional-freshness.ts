/**
 * Definitional-freshness detectors (LF1–LF4) — host-neutral.
 *
 * A live workflow's cached token is a function of four recipe inputs:
 * the request its steps embed (LF1), the variable VALUES that request
 * resolves (LF2), the workflow DEFINITION itself (LF3), and any
 * UPSTREAM live value its request embeds (LF4). When any of those
 * changes, every value the workflow already cached was minted by a
 * recipe that no longer exists — and the resolver keeps serving that
 * wrong-recipe token until the next cadence tick. For env-gated auth
 * that is a hard blocker, not stale-but-fine.
 *
 * Each detector therefore flags the affected `(workflow, env)` cache
 * rows definitionally stale (`computeNextFireAt` then makes each row due
 * now, re-warming even a workflow not runnable at the instant of the
 * edit) and — for a non-manual workflow runnable right now — refreshes
 * the ACTIVE env immediately so the env the user is resolving has no
 * wrong-recipe window. Manual-trigger workflows never auto-run; the flag
 * is their whole treatment.
 *
 * This module owns the detector state (per-workspace fingerprint
 * baselines + debounce timers + the cascade bucket) and its own
 * subscriptions to the host-neutral oracle store events. A host wires it
 * once via {@link startDefinitionalFreshness}, passing the single
 * host-specific seam — `refreshNow`, a gated immediate refresh of one
 * `(workspace, workflow, env)` identity (the extension's sync-warm
 * adapter path / the desktop's gated fire). Both hosts share one
 * definition of "the recipe changed."
 */

import {
  collectRequestTemplateStrings,
  requestExecutableFingerprint,
  type VariableFingerprint,
  workflowDefinitionFingerprint,
  workflowVariableFingerprint,
} from '@openheaders/core/live';
import { logger } from '@openheaders/core/utils';
import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
  onEnvironmentStoreChange,
} from '../entity/environment-store';
import { getRequest, getRequestCollections, onRequestStoreChange } from '../entity/request-store';
import { getActiveWorkspaceId, onActiveWorkspaceChange } from '../workspace/extension-workspace-store';
import {
  clearWorkflowRunCache,
  markRunDefinitionallyStale,
  markWorkflowDefinitionallyStale,
  onLiveCacheStoreChange,
  type WorkflowRunCache,
} from './live-cache-store';
import { getLiveVariablesForWorkflow, onLiveVariableStoreChange } from './live-variable-store';
import { getLiveWorkflows, onLiveWorkflowStoreChange } from './live-workflow-store';
import { canScheduleWorkflow } from './scheduling-gate';
import { canReachDownstream, computeWorkflowDownstreamMap } from './workflow-dependency-graph';

const LOG = 'DefinitionalFreshness';

/**
 * Gated immediate refresh of one `(workspace, workflow, env)` identity —
 * the single host-specific seam. The extension routes it through the
 * sync-warm adapter path (circuit gate + observability); the desktop
 * routes it through its gated `fire`. Errors are caught by the caller.
 */
export type RefreshNow = (workspaceId: string, workflowUid: string, environmentId: string | null) => Promise<void>;

let refreshNow: RefreshNow | null = null;

/** One changed `(workflow, env)` pair — shared by the LF2 + LF4 paths. */
interface ChangedWorkflowEnv {
  workflowUid: string;
  environmentId: string | null;
}

// ── LF1 — material request-edit detector ──────────────────────────
//
// A workflow's cached token is a function of the request its steps
// embed. When that request's EXECUTABLE surface changes (URL, headers,
// auth, body, scripts — see `requestExecutableFingerprint`), every
// value the workflow cached was minted by a recipe that no longer
// exists. Cosmetic edits (rename, description, folder move) never
// change the fingerprint, so they never reach this path at all.

/** Debounce window collapsing a burst of request saves into one pass. */
let requestEditRefreshDebounceMs = 600;

/** Test-only: shrink the debounce so settle runs on the next macrotask. */
export function __setRequestEditRefreshDebounceMs(ms: number): void {
  requestEditRefreshDebounceMs = ms;
}

// Per-workspace fingerprint of every request embedded by that
// workspace's workflows, as of its last settled pass. Keyed by
// workspaceId so a baseline survives a workspace switch: an edit made
// just before switching away is still diffed against the correct
// pre-edit baseline when the user returns. Within a workspace, a uid
// present with a changed fingerprint is a material edit; a uid absent
// (newly referenced, or the first pass after wake) is adopted without
// a trigger. The first settle for a workspace self-primes off its
// hydration broadcast, which always precedes any human edit.
let requestExecBaseline = new Map<string, Map<string, string>>();
let requestEditDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Fingerprint each request embedded by an active-workspace workflow. */
function snapshotActiveRequestFingerprints(): Map<string, string> {
  const out = new Map<string, string>();
  for (const workflow of getLiveWorkflows()) {
    for (const step of workflow.steps) {
      if (out.has(step.requestUid)) continue;
      const request = getRequest(step.requestUid);
      if (request) out.set(step.requestUid, requestExecutableFingerprint(request));
    }
  }
  return out;
}

/** Debounced entry point — (re)arm the settle timer on every request-store change. */
function onRequestStoreChangeForRefresh(): void {
  if (requestEditDebounceTimer) clearTimeout(requestEditDebounceTimer);
  requestEditDebounceTimer = setTimeout(() => {
    requestEditDebounceTimer = null;
    void settleRequestEditRefresh().catch((err) => {
      logger.info(LOG, `request-edit refresh settle failed: ${(err as Error).message}`);
    });
  }, requestEditRefreshDebounceMs);
}

/** Diff fingerprints against the active workspace's baseline; refresh workflows whose embedded request materially changed. */
async function settleRequestEditRefresh(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated, can't key the baseline
  }
  const current = snapshotActiveRequestFingerprints();
  const prevForWs = requestExecBaseline.get(workspaceId);
  requestExecBaseline.set(workspaceId, current);
  // First settle for this workspace — adopt its snapshot without a
  // trigger (the hydration broadcast precedes any human edit).
  if (!prevForWs) return;
  const changed = new Set<string>();
  for (const [uid, fingerprint] of current) {
    const prev = prevForWs.get(uid);
    if (prev !== undefined && prev !== fingerprint) changed.add(uid);
  }
  if (changed.size === 0) return;
  await refreshWorkflowsForChangedRequests(changed);
}

/** Flag every embedding workflow definitionally stale; refresh the active env of those runnable now. */
async function refreshWorkflowsForChangedRequests(changedRequestUids: ReadonlySet<string>): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const activeEnvironmentId = getActiveEnvironmentId();
  for (const workflow of getLiveWorkflows()) {
    if (!workflow.steps.some((step) => changedRequestUids.has(step.requestUid))) continue;
    // Flag every env cache row definitionally stale. This surfaces the
    // "needs re-run" badge AND — via `computeNextFireAt` — makes each
    // row due now, so the reconcile + cadence path refreshes it even
    // for a workflow that can't run at this instant (disabled,
    // unpublished) but becomes schedulable later.
    try {
      await markWorkflowDefinitionallyStale(workflow.uid, workspaceId);
    } catch (err) {
      logger.info(LOG, `definitional-stale flag failed for ${workflow.uid}: ${(err as Error).message}`);
    }
    // Manual workflows never auto-run — the flag is the whole treatment
    // (`computeNextFireAt` returns null for a manual policy).
    if (workflow.refresh.kind === 'manual') continue;
    // Non-manual + runnable now: refresh the ACTIVE env immediately so
    // the value the user is actually resolving has no wrong-recipe
    // window. Non-active envs — and a workflow not schedulable right
    // now — re-warm via the due-now alarm the flag drives.
    const boundVariables = getLiveVariablesForWorkflow(workflow.uid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    void refreshNow?.(workspaceId, workflow.uid, activeEnvironmentId).catch((err) => {
      logger.info(LOG, `request-edit refresh failed for ${workflow.uid}: ${(err as Error).message}`);
    });
  }
}

// ── LF2 — variable-edit detector ──────────────────────────────────
//
// A workflow's cached token is minted not only from the request its
// steps embed but from the VALUES that request's `{{var}}` references
// resolve to. When a referenced variable changes — an `{{env.X}}` /
// `{{vault.X}}` / `{{workspace.X}}` / `{{collection.X}}` edit — every
// value the workflow cached was minted by a recipe that no longer
// exists.
//
// `{{env.X}}` resolves per environment, so each (workflow, env) pair is
// fingerprinted independently. `{{vault/workspace/collection.X}}` are
// environment-independent and flip every env row at once.
//
// The fingerprint is split (`refsKey` / `valuesKey`). A request edit
// that adds or drops a `{{var}}` reference shifts `refsKey` — that is
// LF1's path, so a `refsKey` change re-baselines silently. Only a
// `valuesKey` change under a stable `refsKey` is a variable edit.

/** Debounce window collapsing a burst of variable saves into one pass. */
let variableEditRefreshDebounceMs = 600;

/** Test-only: shrink the debounce so settle runs on the next macrotask. */
export function __setVariableEditRefreshDebounceMs(ms: number): void {
  variableEditRefreshDebounceMs = ms;
}

// Per-workspace, per-(workflow, env) variable-surface fingerprint as of
// that workspace's last settled pass. Keyed by workspaceId so a baseline
// survives a workspace switch (same reasoning as `requestExecBaseline`).
let variableSurfaceBaseline = new Map<string, Map<string, Map<string | null, VariableFingerprint>>>();
let variableEditDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Reduce the vault to name → recipe — a TOTP entry contributes its seed + params, never the rotating code. */
function snapshotVaultVars(): Map<string, string> {
  const out = new Map<string, string>();
  for (const secret of getVault().secrets) {
    out.set(
      secret.name,
      secret.kind === 'string'
        ? secret.value
        : `totp:${secret.seed}:${secret.algorithm}:${secret.digits}:${secret.period}`,
    );
  }
  return out;
}

/** Map a flat variable list to name → value (later entries win on a duplicate name). */
function toVarMap(variables: ReadonlyArray<{ name: string; value: string }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of variables) out.set(v.name, v.value);
  return out;
}

/** Merge every request collection's variables into one name → value map. */
function snapshotCollectionVars(): Map<string, string> {
  const out = new Map<string, string>();
  for (const collection of getRequestCollections()) {
    for (const v of collection.variables ?? []) out.set(v.name, v.value);
  }
  return out;
}

/** Fingerprint every active-workspace workflow's variable surface, per environment (incl. "No environment"). */
function snapshotWorkflowVariableFingerprints(): Map<string, Map<string | null, VariableFingerprint>> {
  const out = new Map<string, Map<string | null, VariableFingerprint>>();
  const workflows = getLiveWorkflows();
  if (workflows.length === 0) return out;

  // Environment-independent scopes — computed once, shared across envs.
  const vaultVars = snapshotVaultVars();
  const workspaceVars = toVarMap(getWorkspaceVariables().variables);
  const collectionVars = snapshotCollectionVars();
  // The "No environment" state plus every defined environment — each
  // has its own cache row, so each is fingerprinted independently.
  const envContexts: Array<{ id: string | null; vars: Map<string, string> }> = [{ id: null, vars: new Map() }];
  for (const env of getEnvironments()) envContexts.push({ id: env.uid, vars: toVarMap(env.variables) });

  for (const workflow of workflows) {
    const templates: string[] = [];
    for (const step of workflow.steps) {
      const request = getRequest(step.requestUid);
      if (request) templates.push(...collectRequestTemplateStrings(request));
    }
    const perEnv = new Map<string | null, VariableFingerprint>();
    for (const ctx of envContexts) {
      perEnv.set(
        ctx.id,
        workflowVariableFingerprint(templates, { envVars: ctx.vars, vaultVars, workspaceVars, collectionVars }),
      );
    }
    out.set(workflow.uid, perEnv);
  }
  return out;
}

/** Debounced entry point — (re)arm the settle timer on every variable / collection store change. */
function onVariableStoreChangeForRefresh(): void {
  if (variableEditDebounceTimer) clearTimeout(variableEditDebounceTimer);
  variableEditDebounceTimer = setTimeout(() => {
    variableEditDebounceTimer = null;
    void settleVariableEditRefresh().catch((err) => {
      logger.info(LOG, `variable-edit refresh settle failed: ${(err as Error).message}`);
    });
  }, variableEditRefreshDebounceMs);
}

/** Diff the variable surface against the active workspace's baseline; act on workflows whose resolved variables changed. */
async function settleVariableEditRefresh(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated, can't key the baseline
  }
  const current = snapshotWorkflowVariableFingerprints();
  const prevForWs = variableSurfaceBaseline.get(workspaceId);
  variableSurfaceBaseline.set(workspaceId, current);
  // First settle for this workspace — adopt without a trigger.
  if (!prevForWs) return;
  const changed: ChangedWorkflowEnv[] = [];
  for (const [workflowUid, perEnv] of current) {
    const prevPerEnv = prevForWs.get(workflowUid);
    if (!prevPerEnv) continue; // first sight — adopt without a trigger
    for (const [environmentId, fingerprint] of perEnv) {
      const prev = prevPerEnv.get(environmentId);
      if (!prev) continue;
      // A `refsKey` shift means the embedded request gained or lost a
      // `{{var}}` reference — LF1's request-edit path already handled
      // it. Re-baseline silently; only a value change is LF2's.
      if (prev.refsKey !== fingerprint.refsKey) continue;
      if (prev.valuesKey !== fingerprint.valuesKey) changed.push({ workflowUid, environmentId });
    }
  }
  if (changed.length === 0) return;
  await refreshWorkflowsForChangedVariables(changed);
}

/** Flag every affected (workflow, env) row definitionally stale; refresh the active env of those runnable now. */
async function refreshWorkflowsForChangedVariables(changed: ReadonlyArray<ChangedWorkflowEnv>): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const activeEnvironmentId = getActiveEnvironmentId();

  // Group the changed envs by workflow so each workflow is gated once.
  const byWorkflow = new Map<string, Array<string | null>>();
  for (const { workflowUid, environmentId } of changed) {
    const envs = byWorkflow.get(workflowUid);
    if (envs) envs.push(environmentId);
    else byWorkflow.set(workflowUid, [environmentId]);
  }

  const workflowsByUid = new Map(getLiveWorkflows().map((w) => [w.uid, w]));
  for (const [workflowUid, environmentIds] of byWorkflow) {
    const workflow = workflowsByUid.get(workflowUid);
    if (!workflow) continue;
    // Flag every changed env cache row definitionally stale, before any
    // gate. This is the whole treatment for manual workflows and for a
    // workflow not schedulable right now (disabled, unpublished,
    // deleted-request step) — `computeNextFireAt` honors the flag, so a
    // flagged row is due as soon as the workflow can run again.
    for (const environmentId of environmentIds) {
      try {
        await markRunDefinitionallyStale(workflowUid, environmentId, workspaceId);
      } catch (err) {
        logger.info(LOG, `definitional-stale flag failed for ${workflowUid}: ${(err as Error).message}`);
      }
    }
    // Manual workflows never auto-run on an edit — the flag is the
    // whole treatment.
    if (workflow.refresh.kind === 'manual') continue;
    // Non-manual + runnable now: refresh the ACTIVE env immediately when
    // its variables changed, so the value the user is resolving has no
    // wrong-recipe window.
    const boundVariables = getLiveVariablesForWorkflow(workflowUid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    if (environmentIds.includes(activeEnvironmentId)) {
      void refreshNow?.(workspaceId, workflowUid, activeEnvironmentId).catch((err) => {
        logger.info(LOG, `variable-edit refresh failed for ${workflowUid}: ${(err as Error).message}`);
      });
    }
  }
}

// ── LF3 — workflow delete + definition edit ───────────────────────
//
// A workflow's cached token is minted from a third recipe input: the
// workflow DEFINITION itself — which steps run, in what order, under
// what gates, capturing what. Two definition changes invalidate it:
//
//   • Delete — the workflow is gone; its `liveCache` rows are orphaned.
//     A bound `{{live.X}}` would otherwise resolve a frozen, never-
//     refreshed value forever. Every env-keyed cache row is purged.
//   • Definition edit — re-pointing a step at a different request,
//     changing an extractor, adding / removing / reordering steps.
//     Treated like a material request edit (LF1): flag every env row
//     definitionally stale + refresh the active env when runnable.
//
// Both off the same `onLiveWorkflowStoreChange` broadcast against one
// workspace-tagged baseline. The fingerprint excludes cosmetic +
// scheduling fields (`name`, `description`, `enabled`, `published`,
// `refresh`), so a rename / enable-toggle / cadence change never fires.
// No debounce — a delete or a save is atomic, not a keystroke burst.

let workflowDefinitionBaseline: { workspaceId: string; defs: Map<string, string> } | null = null;

/** Test-only: drop the workflow-definition baseline so the next change re-primes. */
export function __resetWorkflowDefinitionBaseline(): void {
  workflowDefinitionBaseline = null;
}

/** Fingerprint every active-workspace workflow's executable definition. */
function snapshotWorkflowDefinitions(): Map<string, string> {
  const out = new Map<string, string>();
  for (const wf of getLiveWorkflows()) out.set(wf.uid, workflowDefinitionFingerprint(wf));
  return out;
}

/** Diff the active workspace's workflow definitions; purge deletes, refresh edits. */
async function settleWorkflowDefinitionChanges(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const current = snapshotWorkflowDefinitions();
  // First sight, or a workspace switch — adopt the new map without
  // acting (any vanished uid belongs to the other workspace, not a
  // delete; any fingerprint shift is the hydration broadcast).
  if (!workflowDefinitionBaseline || workflowDefinitionBaseline.workspaceId !== workspaceId) {
    workflowDefinitionBaseline = { workspaceId, defs: current };
    return;
  }
  const deleted: string[] = [];
  const edited: string[] = [];
  for (const [uid, fingerprint] of workflowDefinitionBaseline.defs) {
    const next = current.get(uid);
    if (next === undefined) deleted.push(uid);
    else if (next !== fingerprint) edited.push(uid);
  }
  workflowDefinitionBaseline = { workspaceId, defs: current };

  for (const uid of deleted) {
    void clearWorkflowRunCache(uid, workspaceId).catch((err) => {
      logger.info(LOG, `workflow-delete cache purge failed for ${uid}: ${(err as Error).message}`);
    });
  }
  if (edited.length > 0) await refreshWorkflowsForChangedDefinitions(edited, workspaceId);
}

/** Flag every edited workflow definitionally stale; refresh the active env of those runnable now. */
async function refreshWorkflowsForChangedDefinitions(
  editedUids: readonly string[],
  workspaceId: string,
): Promise<void> {
  const activeEnvironmentId = getActiveEnvironmentId();
  const workflowsByUid = new Map(getLiveWorkflows().map((w) => [w.uid, w]));
  for (const uid of editedUids) {
    const workflow = workflowsByUid.get(uid);
    if (!workflow) continue;
    // Flag every env cache row definitionally stale, before any gate —
    // the whole treatment for manual workflows and for one not
    // schedulable right now; `computeNextFireAt` honors the flag.
    try {
      await markWorkflowDefinitionallyStale(uid, workspaceId);
    } catch (err) {
      logger.info(LOG, `definitional-stale flag failed for ${uid}: ${(err as Error).message}`);
    }
    if (workflow.refresh.kind === 'manual') continue;
    const boundVariables = getLiveVariablesForWorkflow(uid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    void refreshNow?.(workspaceId, uid, activeEnvironmentId).catch((err) => {
      logger.info(LOG, `workflow-definition refresh failed for ${uid}: ${(err as Error).message}`);
    });
  }
}

// ── LF4 — chained-workflow cascade ────────────────────────────────
//
// A workflow's cached token is minted from any UPSTREAM live value its
// request embeds. When workflow A's `liveCache` row is rewritten by a
// real refresh, every workflow B whose step request resolves a
// `{{live.X}}` bound to A is downstream-stale: B's cached token was
// extracted from a request that carried A's OLD value.
//
// Detection: the cache-store change broadcast carries the full post-
// write run list. A row whose `extractedAt` ADVANCED since the last
// settled baseline was rewritten by a successful `putWorkflowRunCache`.
// Failures, probe-start transitions, and invalidations all preserve
// `extractedAt`, so they never spuriously cascade.
//
// Propagation is HOP-BY-HOP: a cascade refresh of B writes B's cache,
// which fires this same broadcast, which walks downstream of B to C. A
// chain A→B→C refreshes in topological order because each hop only
// fires once its upstream's new value has actually landed. A dependency
// cycle has no convergent fixpoint; the cycle guard
// (`canReachDownstream`) refuses to traverse a back-edge so the walk
// always terminates.

/** Debounce window collapsing a burst of upstream refreshes into one cascade pass. */
let liveCascadeRefreshDebounceMs = 600;

/** Test-only: shrink the debounce so the cascade settles on the next macrotask. */
export function __setLiveCascadeRefreshDebounceMs(ms: number): void {
  liveCascadeRefreshDebounceMs = ms;
}

/** Per-workspace, per-(workflow, env) `extractedAt` as of that workspace's last settled pass. */
let liveValueExtractedAtBaseline = new Map<string, Map<string, number>>();
let cascadeDebounceTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Upstream (workflow, env) pairs whose live value advanced since the
 * last settle, bucketed by workspaceId. A bucket survives a switch away
 * from its workspace and is drained when that workspace is active again.
 */
let pendingCascadeUpstreams = new Map<string, ChangedWorkflowEnv[]>();

/** Test-only: drop the cascade baseline so the next cache change re-primes. */
export function __resetLiveCascadeBaseline(): void {
  liveValueExtractedAtBaseline = new Map();
}

function cascadeRowKey(workflowUid: string, environmentId: string | null): string {
  return `${workflowUid}::${environmentId ?? '__none__'}`;
}

/**
 * LF4 detector — on every live-cache change, diff the changed
 * workflow's rows against the `extractedAt` baseline; a row that
 * advanced is a real refresh whose consumers must cascade-refresh.
 */
function onLiveCacheChangeForCascade(
  workspaceId: string,
  workflowUid: string | null,
  runs: readonly WorkflowRunCache[],
): void {
  let activeWorkspaceId: string;
  try {
    activeWorkspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  // Active-workspace-only: a write to another workspace's cache can't
  // be cascaded — the workflow / request stores are the active view.
  if (workspaceId !== activeWorkspaceId) return;

  const current = new Map<string, number>();
  for (const run of runs) current.set(cascadeRowKey(run.workflowUid, run.environmentId), run.extractedAt ?? 0);

  // First sight of this workspace — adopt its baseline without a
  // cascade (any apparent advance is the hydration broadcast).
  const prevForWs = liveValueExtractedAtBaseline.get(workspaceId);
  liveValueExtractedAtBaseline.set(workspaceId, current);
  if (!prevForWs) return;

  // `workflowUid === null` is a bulk mutation (workspace purge) — no
  // single upstream to cascade from; the baseline was re-synced above.
  const bucket = pendingCascadeUpstreams.get(workspaceId) ?? [];
  if (workflowUid !== null) {
    for (const run of runs) {
      if (run.workflowUid !== workflowUid) continue;
      const key = cascadeRowKey(run.workflowUid, run.environmentId);
      const prev = prevForWs.get(key) ?? 0;
      const next = run.extractedAt ?? 0;
      // `extractedAt` advanced — a successful `putWorkflowRunCache`
      // minted a new value (a row's first-ever write counts: `prev`
      // defaults to 0). A failed first refresh writes `extractedAt: 0`,
      // so `next > 0` also screens that out.
      if (next > prev) {
        bucket.push({ workflowUid: run.workflowUid, environmentId: run.environmentId });
      }
    }
  }

  if (bucket.length === 0) return;
  pendingCascadeUpstreams.set(workspaceId, bucket);
  if (cascadeDebounceTimer) clearTimeout(cascadeDebounceTimer);
  cascadeDebounceTimer = setTimeout(() => {
    cascadeDebounceTimer = null;
    void settleLiveValueCascade().catch((err) => {
      logger.info(LOG, `live-value cascade settle failed: ${(err as Error).message}`);
    });
  }, liveCascadeRefreshDebounceMs);
}

/**
 * Walk downstream of each refreshed upstream (workflow, env) for the
 * active workspace; flag / refresh the consumers. Drains only the
 * active workspace's `pendingCascadeUpstreams` bucket — a bucket for a
 * workspace switched away from waits in the map until that workspace is
 * active again, so a cascade detected just before a switch is never lost.
 */
async function settleLiveValueCascade(): Promise<void> {
  let workspaceId: string;
  try {
    workspaceId = getActiveWorkspaceId();
  } catch {
    return; // bootstrap race — workspace pointer not hydrated yet
  }
  const upstreams = pendingCascadeUpstreams.get(workspaceId);
  if (!upstreams || upstreams.length === 0) return;
  pendingCascadeUpstreams.delete(workspaceId);
  const downstream = computeWorkflowDownstreamMap();
  if (downstream.size === 0) return;

  // Collect the affected downstream (workflow, env) pairs, deduped — a
  // consumer of two upstreams that both refreshed is acted on once.
  const affected = new Map<string, Set<string | null>>();
  let skippedCycle = false;
  for (const { workflowUid: upstreamUid, environmentId } of upstreams) {
    const children = downstream.get(upstreamUid);
    if (!children) continue;
    for (const childUid of children) {
      // Cycle guard: an `upstream → child` edge is a back-edge when the
      // child can itself reach the upstream downstream. A cyclic config
      // has no convergent fixpoint — refuse to traverse the cycle so the
      // hop-by-hop walk terminates. Each workflow still refreshes on its
      // own cadence timer.
      if (canReachDownstream(childUid, upstreamUid, downstream)) {
        skippedCycle = true;
        continue;
      }
      let envs = affected.get(childUid);
      if (!envs) {
        envs = new Set();
        affected.set(childUid, envs);
      }
      envs.add(environmentId);
    }
  }
  if (skippedCycle) {
    logger.info(LOG, 'live-value cascade skipped a workflow dependency cycle');
  }
  if (affected.size === 0) return;

  const activeEnvironmentId = getActiveEnvironmentId();
  const workflowsByUid = new Map(getLiveWorkflows().map((w) => [w.uid, w]));
  for (const [childUid, environmentIds] of affected) {
    const workflow = workflowsByUid.get(childUid);
    if (!workflow) continue;
    // Flag every affected env cache row definitionally stale, before any
    // gate. The row is KEPT (it keeps serving so live traffic doesn't
    // gap, and stays in the scheduler's entry set so a non-active env
    // re-warms via the due-now reconcile). A successful refresh clears
    // the flag.
    for (const environmentId of environmentIds) {
      try {
        await markRunDefinitionallyStale(childUid, environmentId, workspaceId);
      } catch (err) {
        logger.info(LOG, `cascade definitional-stale flag failed for ${childUid}: ${(err as Error).message}`);
      }
    }
    if (workflow.refresh.kind === 'manual') continue;
    // Non-manual + runnable now: refresh the ACTIVE env immediately when
    // its upstream value changed. The resulting cache write fires the
    // next hop of the cascade.
    const boundVariables = getLiveVariablesForWorkflow(childUid);
    if (!canScheduleWorkflow(workflow, boundVariables)) continue;
    if (environmentIds.has(activeEnvironmentId)) {
      void refreshNow?.(workspaceId, childUid, activeEnvironmentId).catch((err) => {
        logger.info(LOG, `live-value cascade refresh failed for ${childUid}: ${(err as Error).message}`);
      });
    }
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────

let unsubscribers: Array<() => void> = [];
let started = false;

/**
 * Start the definitional-freshness detectors. Subscribes to the
 * host-neutral oracle store events and wires the host's `refreshNow`
 * seam. Idempotent — a second call is a no-op. Returns nothing; tear
 * down via {@link stopDefinitionalFreshness}.
 */
export function startDefinitionalFreshness(deps: { refreshNow: RefreshNow }): void {
  if (started) return;
  started = true;
  refreshNow = deps.refreshNow;
  unsubscribers = [
    // A workflow-store change drives LF3 (delete + definition edit). A
    // definition edit can re-point a step at a different request,
    // shifting the variable-surface `refsKey` — re-baseline LF2 (no
    // trigger; a `refsKey` shift is LF1's path) so a later variable edit
    // isn't masked.
    onLiveWorkflowStoreChange(() => {
      void settleWorkflowDefinitionChanges().catch((err) => {
        logger.info(LOG, `workflow-definition settle failed: ${(err as Error).message}`);
      });
      onVariableStoreChangeForRefresh();
    }),
    // A live-variable binding change can alter which workflow a value
    // resolves through — re-diff the variable surface (LF2).
    onLiveVariableStoreChange(onVariableStoreChangeForRefresh),
    // A live-cache change drives the LF4 chained-workflow cascade.
    onLiveCacheStoreChange(onLiveCacheChangeForCascade),
    // A request edit drives LF1 (material executable-surface change) and
    // LF2 (a `{{collection.X}}` value behind a collection-variable edit).
    onRequestStoreChange(() => {
      onRequestStoreChangeForRefresh();
      onVariableStoreChangeForRefresh();
    }),
    // An env / vault / workspace-variable edit changes the value behind
    // an `{{env.X}}` / `{{vault.X}}` / `{{workspace.X}}` reference (LF2).
    onEnvironmentStoreChange(onVariableStoreChangeForRefresh),
    // A chained-workflow cascade detected just before a switch away stays
    // queued in its per-workspace bucket; drain it once that workspace is
    // active again so a pre-switch cascade is never lost.
    onActiveWorkspaceChange((newWsId) => {
      if ((pendingCascadeUpstreams.get(newWsId)?.length ?? 0) > 0) {
        void settleLiveValueCascade().catch((err) => {
          logger.info(LOG, `deferred cascade settle after workspace switch failed: ${(err as Error).message}`);
        });
      }
    }),
  ];
}

/** Tear down all subscriptions + reset detector state. Idempotent. */
export function stopDefinitionalFreshness(): void {
  if (!started) return;
  started = false;
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  refreshNow = null;
  if (requestEditDebounceTimer) {
    clearTimeout(requestEditDebounceTimer);
    requestEditDebounceTimer = null;
  }
  requestExecBaseline = new Map();
  if (variableEditDebounceTimer) {
    clearTimeout(variableEditDebounceTimer);
    variableEditDebounceTimer = null;
  }
  variableSurfaceBaseline = new Map();
  workflowDefinitionBaseline = null;
  if (cascadeDebounceTimer) {
    clearTimeout(cascadeDebounceTimer);
    cascadeDebounceTimer = null;
  }
  pendingCascadeUpstreams = new Map();
  liveValueExtractedAtBaseline = new Map();
}
