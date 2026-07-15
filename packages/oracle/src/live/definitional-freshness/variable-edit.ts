import {
  collectRequestTemplateStrings,
  type VariableFingerprint,
  workflowVariableFingerprint,
} from '@openheaders/core/live';
import { logger } from '@openheaders/core/utils';
import {
  getActiveEnvironmentId,
  getEnvironments,
  getVault,
  getWorkspaceVariables,
} from '../../entity/environment-store';
import { getRequest, getRequestCollections } from '../../entity/request-store';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { markRunDefinitionallyStale } from '../live-cache-store';
import { getLiveVariablesForWorkflow } from '../live-variable-store';
import { getLiveWorkflows } from '../live-workflow-store';
import { canScheduleWorkflow } from '../scheduling-gate';
import { type ChangedWorkflowEnv, LOG, refreshNow } from './shared';

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
    if (secret.kind === 'client-certificate') {
      // Never template-resolvable — contributes no value content.
      out.set(secret.name, '');
      continue;
    }
    out.set(
      secret.name,
      secret.kind === 'string'
        ? secret.value
        : `totp:${secret.seed}:${secret.algorithm}:${secret.digits}:${secret.period}`,
    );
  }
  return out;
}

/** Map a flat variable list to name → value (later entries win on a duplicate name).
 *  Disabled rows are excluded — the resolver skips them, so toggling
 *  `enabled` changes the resolved surface and must flip `valuesKey`. */
function toVarMap(variables: ReadonlyArray<{ name: string; value: string; enabled?: boolean }>): Map<string, string> {
  const out = new Map<string, string>();
  for (const v of variables) {
    if (v.enabled === false) continue;
    out.set(v.name, v.value);
  }
  return out;
}

/** Merge every request collection's variables into one name → value map (disabled rows excluded). */
function snapshotCollectionVars(): Map<string, string> {
  const out = new Map<string, string>();
  for (const collection of getRequestCollections()) {
    for (const v of collection.variables ?? []) {
      if (v.enabled === false) continue;
      out.set(v.name, v.value);
    }
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
export function onVariableStoreChangeForRefresh(): void {
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

/** Lifecycle teardown: clear the pending timer + drop every workspace baseline. */
export function resetVariableEditDetector(): void {
  if (variableEditDebounceTimer) {
    clearTimeout(variableEditDebounceTimer);
    variableEditDebounceTimer = null;
  }
  variableSurfaceBaseline = new Map();
}
